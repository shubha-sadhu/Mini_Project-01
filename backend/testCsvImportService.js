require("dotenv").config();

const csvImportService = require("./services/csvImportService");

const csvFile = "./test.csv";

async function test() {
    try {
        const result = await csvImportService.importStudents(csvFile);

        console.log("CSV import successful!");
        console.log(result);

    } catch (error) {
        console.error("CSV import failed:");
        console.error(error);
    }
}

test();