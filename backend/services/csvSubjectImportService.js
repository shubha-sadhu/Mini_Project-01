const parseCSV = require("../utils/csvParser");
const subjectModel = require("../models/subjectModel");

const ALLOWED_COURSES = [
    "CSB",
    "CSM",
    "CSP"
];

const importSubjects = async (filePath, courseCode) => {
    courseCode = courseCode.toUpperCase();

    if (!ALLOWED_COURSES.includes(courseCode)) {
        throw new Error(`Invalid course code: ${courseCode}`);
    }

    const rows = await parseCSV(filePath);

    for (const row of rows) {

        if (!row.subject_code?.trim()) {
            throw new Error("Missing subject_code");
        }

        if (!row.subject_name?.trim()) {
            throw new Error(
                `Missing subject name for ${row.subject_code}`
            );
        }

        if (!row.subject_type?.trim()) {
            throw new Error(
                `Missing subject_type for ${row.subject_code}`
            );
        }

        if (!row.credits?.trim()) {
            throw new Error(
                `Missing credits for ${row.subject_code}`
            );
        }

        if (!row.course_type?.trim()) {
            throw new Error(
                `Missing course_type for ${row.subject_code}`
            );
        }

        if (!row.semester?.trim()) {
            throw new Error(
                `Missing semester for ${row.subject_code}`
            );
        }

        const credits = Number(row.credits);
        const semester = Number(row.semester);

        if (!Number.isInteger(credits) || credits < 0) {
            throw new Error(
                `Invalid credits for ${row.subject_code}`
            );
        }

        if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
            throw new Error(
                `Invalid semester for ${row.subject_code}`
            );
        }

        await subjectModel.insertSubject(courseCode, {
            subject_code: row.subject_code.trim(),
            subject_name: row.subject_name.trim(),
            subject_type: row.subject_type.trim().toUpperCase(),
            credits,
            course_type: row.course_type.trim(),
            remarks: row.remarks?.trim() || null,
            semester
        });
    }

    return {
        imported: rows.length,
        course: courseCode
    };
};

module.exports = {
    importSubjects
};