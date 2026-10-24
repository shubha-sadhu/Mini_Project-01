const fs = require("fs");

const csvImportService = require("../services/csvImportService");
const csvSubjectImportService = require("../services/csvSubjectImportService");

// multer leaves the upload in uploads/ - delete it once we are done with it.
const removeTempFile = (file) => {
    if (file && file.path) {
        fs.promises.unlink(file.path).catch(() => {});
    }
};

const importStudents = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "CSV file is required"
            });
        }

        const result =
            await csvImportService.importStudents(
                req.file.path
            );

        res.status(200).json({
            message: "Students imported successfully",
            ...result
        });

    } catch (error) {
        console.error(error);

        res.status(error.status || 500).json({
            message: "Failed to import students",
            error: error.message
        });
    } finally {
        removeTempFile(req.file);
    }
};

const importSubjects = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "CSV file is required"
            });
        }

        const courseCode = req.body && req.body.courseCode;

        if (!courseCode) {
            return res.status(400).json({
                message: "courseCode is required"
            });
        }

        const result =
            await csvSubjectImportService.importSubjects(
                req.file.path,
                courseCode
            );

        res.status(200).json({
            message: `Subjects imported successfully into ${result.course}`,
            ...result
        });

    } catch (error) {
        console.error(error);

        res.status(error.status || 500).json({
            message: "Failed to import subjects",
            error: error.message
        });
    } finally {
        removeTempFile(req.file);
    }
};

module.exports = {
    importStudents,
    importSubjects
};