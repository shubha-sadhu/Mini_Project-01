const parseCSV = require("../utils/csvParser");
const pool = require("../config/postgres");
const HttpError = require("../utils/httpError");
const { VALID_COURSE_CODES, isValidSemester } = require("../utils/studentUtils");

const MAX_ERRORS_SHOWN = 10;
const text = (value) => String(value ?? "").trim();

const validateRow = (row) => {
    const code = text(row.subject_code);
    if (!code) throw new Error("Missing subject_code");
    if (code.length > 20) throw new Error(`subject_code is too long for ${code} (max 20 characters)`);

    const name = text(row.subject_name);
    if (!name) throw new Error(`Missing subject_name for ${code}`);
    if (name.length > 100) throw new Error(`subject_name is too long for ${code} (max 100 characters)`);

    if (!text(row.semester)) throw new Error(`Missing semester for ${code}`);

    const semester = Number(row.semester);

    if (!isValidSemester(semester)) throw new Error(`Invalid semester for ${code} (must be 1 to 8)`);

    const offeredBy = text(row.offered_by) || null;
    if (offeredBy && offeredBy.length > 100) {
        throw new Error(`offered_by is too long for ${code} (max 100 characters)`);
    }

    return { subject_code: code, subject_name: name, semester, offered_by: offeredBy };
};

/*
 * Expected columns: subject_code, subject_name, semester, offered_by (optional).
 * (No credits: they come from the "Open Elective" row in the programme's subject table.)
 * The electives go into the programme's own table ("CSB_OE" for CSB, and so on).
 * Everything is checked first and saved in one transaction. Re-uploading is safe:
 * an elective that already exists (same semester and code) is updated.
 */
const importOpenElectives = async (filePath, courseCode) => {
    courseCode = text(courseCode).toUpperCase();

    if (!VALID_COURSE_CODES.includes(courseCode)) {
        throw new HttpError(400, `Invalid course code: ${courseCode || "(none)"}`);
    }

    const rows = await parseCSV(filePath);

    if (rows.length === 0) {
        throw new HttpError(400, "The CSV file has no data rows.");
    }

    const electives = [];
    const errors = [];

    rows.forEach((row, index) => {
        try {
            electives.push(validateRow(row));
        } catch (err) {
            errors.push(`Row ${index + 2}: ${err.message}`);
        }
    });

    if (errors.length > 0) {
        const shown = errors.slice(0, MAX_ERRORS_SHOWN).join("\n");
        const more =
            errors.length > MAX_ERRORS_SHOWN
                ? `\n...and ${errors.length - MAX_ERRORS_SHOWN} more.`
                : "";
        throw new HttpError(
            400,
            `Nothing was imported. ${errors.length} problem(s) found:\n${shown}${more}`
        );
    }

    // courseCode was checked against the whitelist above, so it is safe as part of a table name.
    const table = `"${courseCode}_OE"`;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        for (const e of electives) {
            await client.query(
                `INSERT INTO ${table}
                    (subject_code, subject_name, semester, offered_by)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (semester, subject_code)
                 DO UPDATE SET subject_name = EXCLUDED.subject_name,
                               offered_by   = EXCLUDED.offered_by`,
                [e.subject_code, e.subject_name, e.semester, e.offered_by]
            );
        }

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");

        if (err.code === "42P01") {
            throw new HttpError(
                400,
                `The table ${table} does not exist yet. Create it first (see migration_open_electives.sql).`
            );
        }
        throw err;
    } finally {
        client.release();
    }

    return {
        imported: electives.length,
        course: courseCode
    };
};

module.exports = {
    importOpenElectives
};