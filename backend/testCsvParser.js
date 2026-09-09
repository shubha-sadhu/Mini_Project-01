const parseCSV = require("./utils/csvParser");

const csvFile = "./test.csv";

async function test() {
    try {
        const data = await parseCSV(csvFile);

        console.log("CSV parsed successfully!");
        console.log("Number of rows:", data.length);
        console.log("Parsed data:");
        console.dir(data, { depth: null });

    } catch (error) {
        console.error("CSV parsing failed:");
        console.error(error);
    }
}

test();