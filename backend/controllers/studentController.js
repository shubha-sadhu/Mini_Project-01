const pool = require("../config/postgres");
const openElectiveService = require("../services/openElectiveService");
const HttpError = require("../utils/httpError");

/*
 * Everything the portal shows about a student is worked out from data that
 * already exists, using the same rules as the PDF generator:
 *   - name / Hindi name / mobile / semester -> `students` table
 *   - department / programme      -> programme code inside the enrolment no.
 *   - current semester            -> `students.semester` column
 *   - G-suite ID                  -> enrolment no. + first name
 *   - subjects                    -> the table named after the programme code
 *   - amount paid / payment date  -> `fee_payments`
 */

// Only these are ever used as table names (the name goes into the SQL text).
const VALID_COURSE_CODES = ["CSB", "CSM", "CSP", "ITB", "ITM", "ITP"];

const PROGRAMME_DETAILS = {
  CSB: { department: "Computer Science & Technology", programme: "B.Tech.", specialization: "" },
  CSM: { department: "Computer Science & Technology", programme: "M.Tech.", specialization: "" },
  CSP: { department: "Computer Science & Technology", programme: "Ph.D.", specialization: "" },
  ITB: { department: "Information Technology", programme: "B.Tech", specialization: "" },
  ITM: { department: "Information Technology", programme: "M.Tech", specialization: "" },
  ITP: { department: "Information Technology", programme: "Ph.D", specialization: "" },
};

/*
 * Which student is logged in? Uses an explicit enrolment id on the user if
 * there is one, otherwise the part of the G-suite address before the first dot:
 *   2025csb120.aryan@students.iiests.ac.in  ->  2025CSB120
 */
function getEnrollmentId(user) {
  const explicit = user.enrollmentId || user.enrollment_id;
  if (explicit) return String(explicit).trim().toUpperCase();

  const localPart = String(user.email || "").split("@")[0];
  return localPart.split(/[._]/)[0].trim().toUpperCase();
}

// "2025CSB120" -> { enrollmentYear: 2025, courseCode: "CSB" }, or null if malformed
function parseEnrollmentId(enrollmentId) {
  const enrollmentYear = Number(enrollmentId.substring(0, 4));
  const courseCode = enrollmentId.substring(4, 7).toUpperCase();

  if (!Number.isInteger(enrollmentYear) || !VALID_COURSE_CODES.includes(courseCode)) {
    return null;
  }
  return { enrollmentYear, courseCode };
}

function getGsuiteId(enrollmentId, name) {
  const firstName = String(name || "").trim().split(/\s+/)[0].toLowerCase();
  return `${enrollmentId}.${firstName}@students.iiests.ac.in`;
}

const isValidSemester = (n) => Number.isInteger(n) && n >= 1 && n <= 8;

// <input type="date"> wants YYYY-MM-DD
function toISODate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

// GET /api/student/me
exports.getMyProfile = async (req, res, next) => {
  try {
    const enrollmentId = getEnrollmentId(req.user);
    const parsed = parseEnrollmentId(enrollmentId);

    if (!parsed) {
      return res
        .status(400)
        .json({ error: `Could not read programme details from enrolment number "${enrollmentId}".` });
    }

    const studentResult = await pool.query(
      `SELECT enrollment_id, name_english, name_hindi, mobile, semester
         FROM students
        WHERE enrollment_id = $1`,
      [enrollmentId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: `No student record found for ${enrollmentId}.` });
    }

    const student = studentResult.rows[0];
    const details = PROGRAMME_DETAILS[parsed.courseCode];
    const semester = Number(student.semester);

    // Fee details for the current semester (may not exist yet)
    let fee = {};
    if (isValidSemester(semester)) {
      const feeResult = await pool.query(
        `SELECT amount_paid, payment_date
           FROM fee_payments
          WHERE enrollment_id = $1 AND semester = $2`,
        [enrollmentId, semester]
      );
      fee = feeResult.rows[0] || {};
    }

    res.json({
      student: {
        enrollmentId,
        nameEnglish: student.name_english,
        nameHindi: student.name_hindi,
        gsuiteId: getGsuiteId(enrollmentId, student.name_english),
        mobile: student.mobile || req.user.mobile || "",
        department: details.department,
        programme: details.programme,
        specialization: details.specialization,
        // null when missing or outside 1-8, so nothing is selected
        semester: isValidSemester(semester) ? semester : null,
        amountPaid: fee.amount_paid ?? null,
        paymentDate: toISODate(fee.payment_date),
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/student/subjects?semester=3   (theory subjects of the student's own programme)
exports.getSubjects = async (req, res, next) => {
  try {
    const semester = Number.parseInt(req.query.semester, 10);

    if (!isValidSemester(semester)) {
      return res.status(400).json({ error: "semester must be a number from 1 to 8." });
    }

    const parsed = parseEnrollmentId(getEnrollmentId(req.user));

    if (!parsed) {
      return res.status(400).json({ error: "Could not read your programme from your enrolment number." });
    }

    // courseCode was checked against VALID_COURSE_CODES, so it is safe to use as a table name.
    const { rows } = await pool.query(
      `SELECT id, subject_code, subject_name, course_type, credits, remarks
         FROM "${parsed.courseCode}"
        WHERE semester = $1
          AND subject_type = 'THEORY'
        ORDER BY id`,
      [semester]
    );

    // "Open Elective" slots also get the list of electives to choose from
    // and whatever this student has already picked.
    const withElectives = await openElectiveService.attachOpenElectives({
      enrollmentId: getEnrollmentId(req.user),
      courseCode: parsed.courseCode,
      semester,
      subjects: rows,
    });

    const subjects = withElectives.map((s) => ({
      code: s.subject_code,
      name: s.subject_name,
      type: s.course_type,
      credits: s.credits,
      remarks: s.remarks,
      ...(s.openElective ? { openElective: s.openElective } : {}),
    }));

    res.json({ subjects });
  } catch (err) {
    next(err);
  }
};

/*
 * PUT /api/student/registration   { nameHindi, openElectives: [{ slotId, subjectCode }] }
 *
 * What happens when the student clicks "Submit Application". Only two things can be
 * changed: the student's own Hindi name and their open-elective choices. Any other
 * field in the request is refused, so name, enrolment no., mobile, semester, fees
 * etc. cannot be altered through here. The semester used to check the electives
 * is the one stored in the database, never one sent by the browser.
 * Everything is saved in one transaction: either all of it is stored or none of it.
 */
const EDITABLE_FIELDS = ["nameHindi", "openElectives"];
const PICK_FIELDS = ["slotId", "subjectCode"];
const HINDI_NAME_REGEX = /^[\u0900-\u097F\u200C\u200D ]+$/; // Devanagari characters and spaces
const MAX_PICKS = 10;

exports.submitRegistration = async (req, res, next) => {
  let client;

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    const notAllowed = Object.keys(body).filter((key) => !EDITABLE_FIELDS.includes(key));
    if (notAllowed.length > 0) {
      return res.status(400).json({
        error: `Only the Hindi name and open electives can be changed. Not allowed: ${notAllowed.join(", ")}.`,
      });
    }

    // ----- Hindi name -----
    if (typeof body.nameHindi !== "string") {
      return res.status(400).json({ error: "nameHindi is required." });
    }
    const nameHindi = body.nameHindi.trim().replace(/\s+/g, " ");

    if (!nameHindi) {
      return res.status(400).json({ error: "The Hindi name cannot be empty." });
    }
    if (nameHindi.length > 100) {
      return res.status(400).json({ error: "The Hindi name is too long (maximum 100 characters)." });
    }
    if (!HINDI_NAME_REGEX.test(nameHindi)) {
      return res.status(400).json({
        error: "The Hindi name may contain only Hindi (Devanagari) characters and spaces.",
      });
    }

    // ----- open-elective choices -----
    const rawPicks = body.openElectives === undefined ? [] : body.openElectives;
    if (!Array.isArray(rawPicks) || rawPicks.length > MAX_PICKS) {
      return res.status(400).json({ error: "openElectives must be a list of choices." });
    }

    const picks = [];
    const seenSlots = new Set();
    for (const raw of rawPicks) {
      const item = raw && typeof raw === "object" ? raw : {};
      const extra = Object.keys(item).filter((key) => !PICK_FIELDS.includes(key));
      const slotId = Number(item.slotId);
      const subjectCode = typeof item.subjectCode === "string" ? item.subjectCode.trim() : "";

      if (extra.length > 0 || !Number.isInteger(slotId) || !subjectCode || seenSlots.has(slotId)) {
        return res.status(400).json({ error: "Each open elective choice needs a slotId and a subjectCode." });
      }
      seenSlots.add(slotId);
      picks.push({ slotId, subjectCode });
    }

    // ----- who is this? -----
    const enrollmentId = getEnrollmentId(req.user);
    const parsed = parseEnrollmentId(enrollmentId);
    if (!parsed) {
      return res.status(400).json({ error: "Could not read your programme from your enrolment number." });
    }

    // ----- save everything together -----
    client = await pool.connect();
    await client.query("BEGIN");

    const student = await client.query(
      `SELECT semester FROM students WHERE enrollment_id = $1 FOR UPDATE`,
      [enrollmentId]
    );
    if (student.rows.length === 0) {
      throw new HttpError(404, "No student record found for your account.");
    }

    const semester = Number(student.rows[0].semester);
    if (picks.length > 0 && !isValidSemester(semester)) {
      throw new HttpError(400, "Your semester is not set in the college records, so open electives cannot be saved.");
    }

    // The one column of the student's own record that can change
    await client.query(
      `UPDATE students SET name_hindi = $1 WHERE enrollment_id = $2`,
      [nameHindi, enrollmentId]
    );

    const saved = [];
    for (const pick of picks) {
      const chosen = await openElectiveService.saveChoice({
        enrollmentId,
        courseCode: parsed.courseCode,
        semester,
        slotId: pick.slotId,
        subjectCode: pick.subjectCode,
        client,
      });
      saved.push({ slotId: pick.slotId, ...chosen });
    }

    await client.query("COMMIT");

    res.json({
      message: "Registration details saved.",
      nameHindi,
      openElectives: saved,
    });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  } finally {
    if (client) client.release();
  }
};