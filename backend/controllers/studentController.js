const pool = require("../config/postgres");
const openElectiveService = require("../services/openElectiveService");

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

// PUT /api/student/open-elective   { semester, slotId, subjectCode }
exports.chooseOpenElective = async (req, res, next) => {
  try {
    const enrollmentId = getEnrollmentId(req.user);
    const parsed = parseEnrollmentId(enrollmentId);

    if (!parsed) {
      return res.status(400).json({ error: "Could not read your programme from your enrolment number." });
    }

    const body = req.body || {};

    const chosen = await openElectiveService.saveChoice({
      enrollmentId,
      courseCode: parsed.courseCode,
      semester: Number(body.semester),
      slotId: Number(body.slotId),
      subjectCode: String(body.subjectCode ?? "").trim(),
    });

    res.json({ message: "Open elective saved.", chosen });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};