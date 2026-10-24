const fs = require("fs");
const csv = require("csv-parser");

const parseCSV = (filePath) => {
    return new Promise((resolve, reject) => {
        const results = [];

        fs.createReadStream(filePath)
            .pipe(
                csv({
                    // Excel adds a hidden BOM to the first header and people vary the
                    // capitalisation, so "Enrollment_ID" and "enrollment_id" both work.
                    mapHeaders: ({ header }) =>
                        header.replace(/^\uFEFF/, "").trim().toLowerCase(),
                })
            )
            .on("data", (row) => {
                results.push(row);
            })
            .on("end", () => {
                resolve(results);
            })
            .on("error", (error) => {
                reject(error);
            });
    });
};

module.exports = parseCSV;