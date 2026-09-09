const pool = require("../config/postgres");

const insertStudent = async (student) => {
    const query = `
        INSERT INTO students (
            enrollment_id,
            name_english,
            name_hindi,
            mobile
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (enrollment_id)
        DO UPDATE SET
            name_english = EXCLUDED.name_english,
            name_hindi = EXCLUDED.name_hindi,
            mobile = EXCLUDED.mobile
        RETURNING *;
    `;

    const values = [
        student.enrollment_id,
        student.name_english,
        student.name_hindi,
        student.mobile
    ];

    const result = await pool.query(query, values);

    return result.rows[0];
};

module.exports = {
    insertStudent
};  