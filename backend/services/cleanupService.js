const fs=require("fs/promises");
const path=require("path");

const PDF_DIR = path.resolve("./generated");

const EXPIRY = 14 * 24 * 60 * 60 * 1000; // 14 days

module.exports= async function cleanupPDFs() {
    try {
        // Reads all files in directory
        const files = await fs.readdir(PDF_DIR);

        const now = Date.now();

        // Loops through all files in the directory
        for (const file of files) {
            if (!file.endsWith(".pdf")) 
                continue;

            const filePath = path.join(PDF_DIR, file);
            const stats = await fs.stat(filePath);

            const age = now - stats.mtimeMs;

            // If file older than 14days, unlink the file
            if (age > EXPIRY) {
                await fs.unlink(filePath);
                console.log(`Deleted expired PDF: ${file}`);
            }
        }
    } catch (error) {
        console.error("PDF cleanup failed:", error);
    }
}