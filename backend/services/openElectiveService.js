const pool = require("../config/postgres");
const HttpError = require("../utils/httpError");
const { VALID_COURSE_CODES, isValidSemester } = require("../utils/studentUtils");

/*
 * A row in a programme's subject table is an "open elective slot" when its
 * course_type is "Open Elective".
 */
const isOpenElectiveRow = (subject) =>
    String(subject.course_type || "").trim().toLowerCase() === "open elective";

/*
 * Name of the table that lists the open electives of a programme: CSB -> "CSB_OE".
 * The code goes into the SQL text, so it is checked against the whitelist first.
 */
const oeTable = (courseCode) => {
    if (!VALID_COURSE_CODES.includes(courseCode)) {
        throw new HttpError(400, "Could not read your programme from your enrolment number.");
    }
    return `"${courseCode}_OE"`;
};

const isMissingTable = (err) => err && err.code === "42P01";

// All electives on offer for a programme + semester. A programme with no OE table has none.
const getOptions = async (courseCode, semester) => {
    try {
        const { rows } = await pool.query(
            `SELECT subject_code AS code,
                    subject_name AS name,
                    offered_by   AS "offeredBy"
               FROM ${oeTable(courseCode)}
              WHERE semester = $1
              ORDER BY subject_code`,
            [semester]
        );
        return rows;
    } catch (err) {
        if (isMissingTable(err)) return [];
        throw err;
    }
};

// Map of slot_id -> subject_code for what this student has already picked
const getChoices = async (enrollmentId, semester) => {
    const { rows } = await pool.query(
        `SELECT slot_id, subject_code
           FROM student_open_electives
          WHERE enrollment_id = $1 AND semester = $2`,
        [enrollmentId, semester]
    );
    return new Map(rows.map((r) => [r.slot_id, r.subject_code]));
};

/*
 * For the registration form: adds an `openElective` block (slot id, the
 * student's current pick and the options) to every slot row.
 * `subjects` are raw rows from the programme table (must include `id`).
 */
const attachOpenElectives = async ({ enrollmentId, courseCode, semester, subjects }) => {
    if (!subjects.some(isOpenElectiveRow)) return subjects;

    const [options, choices] = await Promise.all([
        getOptions(courseCode, semester),
        getChoices(enrollmentId, semester)
    ]);

    return subjects.map((subject) =>
        isOpenElectiveRow(subject)
            ? {
                  ...subject,
                  openElective: {
                      slotId: subject.id,
                      selectedCode: choices.get(subject.id) ?? null,
                      options
                  }
              }
            : subject
    );
};

/*
 * For the PDF: swaps each slot row for the course the student chose.
 * Throws if they have not chosen yet.
 */
const substituteChoices = async ({ enrollmentId, courseCode, semester, subjects }) => {
    if (!subjects.some(isOpenElectiveRow)) return subjects;

    const [options, choices] = await Promise.all([
        getOptions(courseCode, semester),
        getChoices(enrollmentId, semester)
    ]);

    return subjects.map((subject) => {
        if (!isOpenElectiveRow(subject)) return subject;

        const chosen = options.find((o) => o.code === choices.get(subject.id));

        if (!chosen) {
            throw new HttpError(
                400,
                `Please choose your open elective for semester ${semester} on the registration form before generating the PDF.`
            );
        }

        return {
            ...subject,
            subject_code: chosen.code,
            subject_name: chosen.name
            // credits stay as they are: they come from the slot row in the programme table
        };
    });
};

// Saves (or changes) a student's pick for one slot.
const saveChoice = async ({ enrollmentId, courseCode, semester, slotId, subjectCode }) => {
    const table = oeTable(courseCode);

    if (!isValidSemester(semester)) {
        throw new HttpError(400, "semester must be a number from 1 to 8.");
    }
    if (!Number.isInteger(slotId) || !subjectCode) {
        throw new HttpError(400, "slotId and subjectCode are required.");
    }

    const slot = await pool.query(
        `SELECT id, course_type FROM "${courseCode}" WHERE id = $1 AND semester = $2`,
        [slotId, semester]
    );
    if (slot.rows.length === 0 || !isOpenElectiveRow(slot.rows[0])) {
        throw new HttpError(400, "That subject is not an open elective slot.");
    }

    let option;
    try {
        option = await pool.query(
            `SELECT subject_code AS code, subject_name AS name
               FROM ${table}
              WHERE semester = $1 AND subject_code = $2`,
            [semester, subjectCode]
        );
    } catch (err) {
        if (!isMissingTable(err)) throw err;
        option = { rows: [] };
    }
    if (option.rows.length === 0) {
        throw new HttpError(400, "That open elective is not offered for your programme and semester.");
    }

    // With two slots in one semester, the same course can't be picked twice.
    const duplicate = await pool.query(
        `SELECT 1 FROM student_open_electives
          WHERE enrollment_id = $1 AND semester = $2
            AND subject_code = $3 AND slot_id <> $4`,
        [enrollmentId, semester, subjectCode, slotId]
    );
    if (duplicate.rows.length > 0) {
        throw new HttpError(400, "You have already chosen that course for another open elective.");
    }

    try {
        await pool.query(
            `INSERT INTO student_open_electives (enrollment_id, semester, slot_id, subject_code)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (enrollment_id, semester, slot_id)
             DO UPDATE SET subject_code = EXCLUDED.subject_code, chosen_at = now()`,
            [enrollmentId, semester, slotId, subjectCode]
        );
    } catch (err) {
        if (err.code === "23503") {
            throw new HttpError(404, `No student record found for ${enrollmentId}.`);
        }
        throw err;
    }

    return option.rows[0];
};

module.exports = {
    isOpenElectiveRow,
    attachOpenElectives,
    substituteChoices,
    saveChoice
};