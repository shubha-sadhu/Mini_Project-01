const express = require("express");
const multer = require("multer");

const csvController = require("../controllers/csvController");
const { requireAuth } = require("../middleware/auth_middle");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

const upload = multer({
    dest: "uploads/",
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB is plenty for a CSV
});

router.post(
    "/students",
    requireAuth,
    adminMiddleware,
    upload.single("file"),
    csvController.importStudents
);

// Form fields: file (the CSV) and courseCode (CSB, CSM, CSP, ITB, ITM or ITP)
router.post(
    "/subjects",
    requireAuth,
    adminMiddleware,
    upload.single("file"),
    csvController.importSubjects
);

module.exports = router;