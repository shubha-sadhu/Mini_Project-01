const pool = require("../config/postgres");

const insertSubject = async (courseCode, subject) => {
    const query = `
        INSERT INTO "${courseCode}" (
            subject_code,
            subject_name,
            subject_type,
            credits,
            course_type,
            remarks,
            semester
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
    `;

    const values = [
        subject.subject_code,
        subject.subject_name,
        subject.subject_type,
        subject.credits,
        subject.course_type,
        subject.remarks,
        subject.semester
    ];

    const result = await pool.query(query, values);

    return result.rows[0];
};

module.exports = {
    insertSubject
};