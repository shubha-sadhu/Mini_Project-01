const User = require("../models/User");

const pdfDataService = require("../services/pdfDataService.js");
const consolidateDataService = require("../services/consolidateDataService.js");
const pdfService = require("../services/pdfService.js");


console.log("PDF SERVICE EXPORTS:", pdfService);

const generatePDF = async (req, res) => {
    try {
        // MongoDB ID of the currently logged-in user
        const userId = req.userId;

        console.log("User id:", userId);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User is not authenticated"
            });
        }

        // Find the user in MongoDB
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // First 10 characters of email = enrollment ID
        const enrollmentId = user.email
            .substring(0, 10)
            .toUpperCase();

        console.log("Enrollment ID:", enrollmentId);

        // Get student and subject data from PostgreSQL
        const studentData =
            await pdfDataService(enrollmentId);

        // Convert it to the structure expected by the EJS template
        const consolidatedStudentData =
            consolidateDataService(studentData);

        // Generate PDF
        const pdfPath =
            await pdfService.generatePDF(
                consolidatedStudentData
            );

        // Send PDF to frontend
        return res.sendFile(pdfPath);

    } catch (error) {
        console.error("Error generating PDF:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to generate PDF"
        });
    }
};

module.exports = generatePDF;