const studentModel = require("../models/studentModel");
const HttpError = require("../utils/httpError");
const {
    isValidEnrollmentId,
    getProgrammeDetails,
    getCurrentSemester,
    getGsuiteId,
    isValidSemester
} = require("../utils/studentUtils");

const text = (value) => String(value ?? "").trim();

/*
 * Checks and cleans one student. Takes the CSV-style field names
 * (enrollment_id, name_english, name_hindi, mobile, semester) and throws a
 * plain Error with a readable message when something is wrong.
 */
const validateStudentInput = (raw) => {
    const enrollmentId = text(raw.enrollment_id).toUpperCase();

    if (!enrollmentId) {
        throw new Error("Missing enrollment_id");
    }
    if (!isValidEnrollmentId(enrollmentId)) {
        throw new Error(
            `Invalid enrollment_id "${enrollmentId}" (expected something like 2025CSB120)`
        );
    }

    const nameEnglish = text(raw.name_english);
    if (!nameEnglish) {
        throw new Error(`Missing name_english for ${enrollmentId}`);
    }
    if (nameEnglish.length > 100) {
        throw new Error(`name_english is too long for ${enrollmentId} (max 100 characters)`);
    }

    const nameHindi = text(raw.name_hindi) || null;
    if (nameHindi && nameHindi.length > 100) {
        throw new Error(`name_hindi is too long for ${enrollmentId} (max 100 characters)`);
    }

    const mobile = text(raw.mobile).replace(/[\s-]/g, "") || null;
    if (mobile && !/^\+?\d{10,14}$/.test(mobile)) {
        throw new Error(`Invalid mobile number for ${enrollmentId}`);
    }

    let semester = null;
    const rawSemester = text(raw.semester);
    if (rawSemester) {
        semester = Number(rawSemester);
        if (!isValidSemester(semester)) {
            throw new Error(`Invalid semester for ${enrollmentId} (must be 1 to 8)`);
        }
    }

    // Only used for a brand-new student who was given no semester.
    const calculated = getCurrentSemester(Number(enrollmentId.substring(0, 4)));

    return {
        enrollment_id: enrollmentId,
        name_english: nameEnglish,
        name_hindi: nameHindi,
        mobile,
        semester,
        default_semester: isValidSemester(calculated) ? calculated : null
    };
};

// Shape sent to the admin dashboard
const toStudentDto = (row) => {
    const details = getProgrammeDetails(row.enrollment_id);

    return {
        enrollmentId: row.enrollment_id,
        nameEnglish: row.name_english,
        nameHindi: row.name_hindi || "",
        gsuiteId: getGsuiteId(row.enrollment_id, row.name_english),
        department: details.department,
        programme: details.programme,
        semester: row.semester ?? null,
        mobile: row.mobile || ""
    };
};

const listStudents = async () => {
    const rows = await studentModel.getAllStudents();
    return rows.map(toStudentDto);
};

const addStudent = async (raw) => {
    let student;
    try {
        student = validateStudentInput(raw);
    } catch (err) {
        throw new HttpError(400, err.message);
    }

    const saved = await studentModel.insertStudent(student);
    return toStudentDto(saved);
};

module.exports = {
    validateStudentInput,
    listStudents,
    addStudent
};