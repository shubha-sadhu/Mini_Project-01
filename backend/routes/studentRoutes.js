const express = require("express");
const requireUser = require("../middleware/requireUser");
const { getMyProfile, getSubjects } = require("../controllers/studentController");

const router = express.Router();

router.get("/me", requireUser, getMyProfile);
router.get("/subjects", requireUser, getSubjects);

module.exports = router;