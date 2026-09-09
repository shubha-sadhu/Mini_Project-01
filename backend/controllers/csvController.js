const csvImportService = require("../services/csvImportService");

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

        res.status(500).json({
            message: "Failed to import students",
            error: error.message
        });
    }
};

module.exports = {
    importStudents
};