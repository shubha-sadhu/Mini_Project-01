const parseCSV = require("../utils/csvParser");
const studentModel = require("../models/studentModel");

const importStudents = async (filePath) => {
    const rows = await parseCSV(filePath);

    for (const row of rows) {
        if (!row.enrollment_id) {
            throw new Error("Missing enrollment_id");
        }

        if (!row.name_english) {
            throw new Error(
                `Missing name for ${row.enrollment_id}`
            );
        }

        await studentModel.insertStudent({
            enrollment_id: row.enrollment_id.trim(),
            name_english: row.name_english.trim(),
            name_hindi: row.name_hindi?.trim() || null,
            mobile: row.mobile?.trim() || null
        });
    }

    return {
        imported: rows.length
    };
};

module.exports = {
    importStudents
};