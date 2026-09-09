const express = require("express");
const { requireAuth } = require("../middleware/auth_middle");
const generatePDF = require("../controllers/generatePdfController.js");

const router = express.Router();

router.post("/", requireAuth, generatePDF);

module.exports = router;