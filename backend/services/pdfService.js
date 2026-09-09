const puppeteer = require("puppeteer");
const ejs = require("ejs");
const path = require("path");
const fs = require("fs");

async function generatePDF(studentData) {
    let browser;

    try {
        console.log("1. Starting Puppeteer...");

        browser = await puppeteer.launch({
            headless: "shell",
            /* No executablePath: let Puppeteer find the browser it downloaded for itself (in node_modules/.puppeteer or its cache dir). 
            This is what makes the code portable across machines and OSes, and avoids silent hangs when a hardcoded path points at a browser 
            that no longer exists. */

            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage"
            ],
            // Fail fast instead of hanging forever if launch or any
            // CDP call gets stuck.
            timeout: 30000,
            protocolTimeout: 30000
        });

        console.log("2. Browser launched");

        const page = await browser.newPage();

        console.log("3. New page created");

        const templatePath = path.join(
            __dirname,
            "form-template.ejs"
        );

        console.log("4. Rendering EJS...");

        const html = await ejs.renderFile(
            templatePath,
            studentData
        );

        console.log("5. EJS rendered");

        await page.setContent(html, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        console.log("6. HTML loaded");

        const outputDirectory = path.join(
            __dirname,
            "../public/generatedPdfs"
        );

        await fs.promises.mkdir(outputDirectory, {
            recursive: true
        });

        const pdfPath = path.join(
            outputDirectory,
            `${studentData.student.enrolmentNo}.pdf`
        );

        console.log("7. Generating PDF...");

        await page.pdf({
            path: pdfPath,
            format: "A4",
            printBackground: true
        });

        console.log("8. PDF generated:", pdfPath);

        return pdfPath;

    } finally {
        if (browser) {
            await browser.close();
            console.log("9. Browser closed");
        }
    }
}

module.exports = { generatePDF };