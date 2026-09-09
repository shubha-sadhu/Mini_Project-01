const dns = require("dns");
dns.setServers(["1.1.1.1"]);
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
// const pdfRoutes = require("./routes/generatePdfRoutes");
const cleanupPDFs=require("./services/cleanupService.js");
const generatePdfRoutes=require("./routes/generatePdfRoutes.js");
const csvRoutes = require("./routes/csvRoutes");

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "*",
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
// app.use("/api/pdf", pdfRoutes);

app.use("/api/generatePdf", generatePdfRoutes);

// Fallback error handler for anything unexpected that slips past a route.
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.use("/api/admin/import", csvRoutes);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`IIEST Portal backend running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });


// Cleaning up pdfs older than 14 days
setInterval(() => { 
    cleanupPDFs();
}, 24 * 60 * 60 * 1000);