
const pool = require("../config/postgres");

/*
 * Adds a student, or updates them if the enrollment number already exists.
 *
 * If PostgreSQL generates a duplicate user_id because the identity sequence
 * is behind the existing records, synchronize the sequence and retry once.
 *
 * No table schema or student records are changed by the sequence correction.
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

    try {
        const result = await client.query(query, values);
        return result.rows[0];
    } catch (err) {
        // Recover only from a duplicate generated primary key.
        if (
            err.code !== "23505" ||
            err.constraint !== "students_pkey"
        ) {
            throw err;
        }

        // Synchronize the identity sequence with existing student IDs.
        await client.query(`
            SELECT setval(
                pg_get_serial_sequence('public.students', 'user_id'),
                COALESCE((SELECT MAX(user_id) FROM public.students), 1),
                EXISTS (SELECT 1 FROM public.students)
            );
        `);

        // Retry the original insert once.
        const result = await client.query(query, values);
        return result.rows[0];
    }
};

const getAllStudents = async (client = pool) => {
    const result = await client.query(`
        SELECT enrollment_id, name_english, name_hindi, mobile, semester
        FROM students
        ORDER BY enrollment_id
    `);

    return result.rows;
};

module.exports = {
    insertStudent,
    getAllStudents
};
