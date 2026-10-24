const express = require("express");
const requireUser = require("../middleware/requireUser");
const {
  getMyProfile,
  getSubjects,
  chooseOpenElective,
  updateMyHindiName,
} = require("../controllers/studentController");

const router = express.Router();

router.get("/me", requireUser, getMyProfile);
router.get("/subjects", requireUser, getSubjects);
router.put("/open-elective", requireUser, chooseOpenElective);

// Dedicated endpoint: only the Hindi name can be changed.
router.put("/hindi-name", requireUser, updateMyHindiName);

module.exports = router;