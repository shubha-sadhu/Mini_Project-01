const adminStudentService = require("../services/adminStudentService");

// GET /api/admin/students  - every student in the database
const listStudents = async (req, res) => {
    try {
        const students = await adminStudentService.listStudents();

        res.status(200).json({ students });

    } catch (error) {
        console.error(error);

        res.status(error.status || 500).json({
            message: "Failed to load students",
            error: error.message
        });
    }
};

// POST /api/admin/students  - add one student (or update them if the enrolment no. exists)
const addStudent = async (req, res) => {
    try {
        const body = req.body || {};

        const student = await adminStudentService.addStudent({
            enrollment_id: body.enrollmentId,
            name_english: body.nameEnglish,
            name_hindi: body.nameHindi,
            mobile: body.mobile,
            semester: body.semester
        });

        res.status(200).json({
            message: "Student saved successfully",
            student
        });

    } catch (error) {
        console.error(error);

        res.status(error.status || 500).json({
            message: "Failed to save student",
            error: error.message
        });
    }
};

module.exports = {
    listStudents,
    addStudent
};