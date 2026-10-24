const parseCSV = require("../utils/csvParser");
const pool = require("../config/postgres");
const subjectModel = require("../models/subjectModel");
const HttpError = require("../utils/httpError");
const { VALID_COURSE_CODES, isValidSemester } = require("../utils/studentUtils");

const ALLOWED_SUBJECT_TYPES = ["THEORY", "PRACTICAL", "SESSIONAL"];
const MAX_ERRORS_SHOWN = 10;

const text = (value) => String(value ?? "").trim();

// Checks and cleans one CSV row; throws a readable Error when it is wrong.
const validateSubjectRow = (row) => {
    const subjectCode = text(row.subject_code);
    if (!subjectCode) throw new Error("Missing subject_code");

    if (!text(row.subject_name)) throw new Error(`Missing subject_name for ${subjectCode}`);

    const subjectType = text(row.subject_type).toUpperCase();
    if (!subjectType) throw new Error(`Missing subject_type for ${subjectCode}`);
    if (!ALLOWED_SUBJECT_TYPES.includes(subjectType)) {
        throw new Error(
            `Invalid subject_type "${subjectType}" for ${subjectCode} (use ${ALLOWED_SUBJECT_TYPES.join(", ")})`
        );
    }

    if (!text(row.credits)) throw new Error(`Missing credits for ${subjectCode}`);
    if (!text(row.course_type)) throw new Error(`Missing course_type for ${subjectCode}`);
    if (!text(row.semester)) throw new Error(`Missing semester for ${subjectCode}`);

    const credits = Number(row.credits);
    const semester = Number(row.semester);

    if (!Number.isInteger(credits) || credits < 0) {
        throw new Error(`Invalid credits for ${subjectCode}`);
    }
    if (!isValidSemester(semester)) {
        throw new Error(`Invalid semester for ${subjectCode} (must be 1 to 8)`);
    }

    return {
        subject_code: subjectCode,
        subject_name: text(row.subject_name),
        subject_type: subjectType,
        credits,
        course_type: text(row.course_type),
        remarks: text(row.remarks) || null,
        semester
    };
};

/*
 * Expected columns: subject_code, subject_name, subject_type, credits,
 * course_type, semester, remarks (remarks optional).
 * The whole file is checked first and saved in one transaction, so a bad row
 * never leaves a half-imported file behind.
 */
const importSubjects = async (filePath, courseCode) => {
    courseCode = text(courseCode).toUpperCase();

    // The code becomes a table name, so only whitelisted values are allowed.
    if (!VALID_COURSE_CODES.includes(courseCode)) {
        throw new HttpError(400, `Invalid course code: ${courseCode || "(none)"}`);
    }

    const rows = await parseCSV(filePath);

    if (rows.length === 0) {
        throw new HttpError(400, "The CSV file has no data rows.");
    }

    const subjects = [];
    const errors = [];

    rows.forEach((row, index) => {
        try {
            subjects.push(validateSubjectRow(row));
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

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        for (const subject of subjects) {
            await subjectModel.insertSubject(courseCode, subject, client);
        }

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");

        if (err.code === "42P01") {
            throw new HttpError(400, `The subjects table "${courseCode}" does not exist in the database.`);
        }
        if (err.code === "23514") {
            throw new HttpError(400, `The database rejected a row, so nothing was imported: ${err.message}`);
        }
        throw err;
    } finally {
        client.release();
    }

    return {
        imported: subjects.length,
        course: courseCode
    };
};

module.exports = {
    importSubjects
};