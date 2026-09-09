const express = require("express");
const multer = require("multer");

const csvController = require("../controllers/csvController");
const { requireAuth } = require("../middleware/auth_middle");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

const upload = multer({
    dest: "uploads/"
});

router.post(
    "/students",
    requireAuth,
    adminMiddleware,
    upload.single("file"),
    csvController.importStudents
);

module.exports = router;