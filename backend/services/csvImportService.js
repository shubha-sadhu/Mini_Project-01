const parseCSV = require("../utils/csvParser");
const studentModel = require("../models/studentModel");
const HttpError = require("../utils/httpError");
const { validateStudentInput } = require("./adminStudentService");

const MAX_ERRORS_SHOWN = 10;

/*
 * Expected columns: enrollment_id, name_english, name_hindi, mobile, semester
 * (name_hindi, mobile and semester are optional).
 * Every row is checked first; nothing is saved unless the whole file is valid.
 */
const importStudents = async (filePath) => {
    const rows = await parseCSV(filePath);

    if (rows.length === 0) {
        throw new HttpError(400, "The CSV file has no data rows.");
    }

    const students = [];
    const errors = [];

    rows.forEach((row, index) => {
        try {
            students.push(validateStudentInput(row));
        } catch (err) {
            // +2: row 1 is the header, and people count rows from 1
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

    for (const student of students) {
        await studentModel.insertStudent(student);
    }

    return {
        imported: students.length
    };
};

module.exports = {
    importStudents
};