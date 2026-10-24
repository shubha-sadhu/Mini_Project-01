const express = require("express");

const adminStudentController = require("../controllers/adminStudentController");
const { requireAuth } = require("../middleware/auth_middle");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

router.get("/", requireAuth, adminMiddleware, adminStudentController.listStudents);
router.post("/", requireAuth, adminMiddleware, adminStudentController.addStudent);

module.exports = router;