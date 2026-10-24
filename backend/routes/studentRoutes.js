const express = require("express");
const requireUser = require("../middleware/requireUser");
const { getMyProfile, getSubjects, chooseOpenElective } = require("../controllers/studentController");

const router = express.Router();

router.get("/me", requireUser, getMyProfile);
router.get("/subjects", requireUser, getSubjects);
router.put("/open-elective", requireUser, chooseOpenElective);

module.exports = router;