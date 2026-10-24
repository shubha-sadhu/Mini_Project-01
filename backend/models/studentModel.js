const pool = require("../config/postgres");

/*
 * Adds a student, or updates them if the enrolment number already exists.
 *
 * When updating, a blank Hindi name / mobile / semester does NOT wipe what is
 * already stored. `semester` is the value given by the admin (may be null);
 * `default_semester` is only used when a brand-new row has no semester.
 */
const insertStudent = async (student, client = pool) => {
    const query = `
        INSERT INTO students (
            enrollment_id,
            name_english,
            name_hindi,
            mobile,
            semester
        )
        VALUES ($1, $2, $3, $4, COALESCE($5::int, $6::int))
        ON CONFLICT (enrollment_id)
        DO UPDATE SET
            name_english = EXCLUDED.name_english,
            name_hindi = COALESCE(EXCLUDED.name_hindi, students.name_hindi),
            mobile = COALESCE(EXCLUDED.mobile, students.mobile),
            semester = COALESCE($5::int, students.semester)
        RETURNING *;
    `;

    const values = [
        student.enrollment_id,
        student.name_english,
        student.name_hindi,
        student.mobile,
        student.semester,
        student.default_semester
    ];

    const result = await client.query(query, values);

    return result.rows[0];
};

const getAllStudents = async (client = pool) => {
    const result = await client.query(
        `SELECT enrollment_id, name_english, name_hindi, mobile, semester
           FROM students
          ORDER BY enrollment_id`
    );

    return result.rows;
};

module.exports = {
    insertStudent,
    getAllStudents
};