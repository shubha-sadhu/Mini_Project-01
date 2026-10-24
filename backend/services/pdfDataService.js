const pool = require("../config/postgres");
const { substituteChoices } = require("./openElectiveService");

// Valid course codes for pre-checking before making the SQL query
const VALID_COURSE_CODES = ["CSB", "CSM", "CSP", "ITB", "ITM", "ITP"];

const getCurrentRegistrationData = async (enrollmentId) => {
    enrollmentId=enrollmentId.toUpperCase();
    // Getting student data
    const studentResult = await pool.query(
        `
        SELECT
            enrollment_id,
            name_english,
            name_hindi,
            mobile,
            semester
        FROM students
        WHERE enrollment_id = $1
        `,
        [enrollmentId]
    );

    if (studentResult.rows.length === 0) {
        throw new Error("Student record not found");
    }

    const student = studentResult.rows[0];

    // Extracting details from enrollment number
    const enrollmentYear = Number(enrollmentId.substring(0, 4));
    const courseCode = enrollmentId.substring(4, 7).toUpperCase();
    // The semester comes from the database. The date-based calculation is only
    // a sanity check: a mismatch is logged, but the stored value is what is used.
    const calculatedSemester = getCurrentSemester(enrollmentYear);
    const semester = resolveSemester(
        student.semester,
        calculatedSemester,
        enrollmentId
    );

    // Checking if couse code is not tampered to attack DB
    if (!VALID_COURSE_CODES.includes(courseCode)) {
    throw new Error(`Invalid programme code: ${courseCode}`);
}

    const gsuiteId = getGsuiteId(
        enrollmentId,
        student.name_english
    );

    // Fetching subjects
    const subjectsResult = await pool.query(
        `
        SELECT
            id,
            subject_code,
            subject_name,
            subject_type,
            credits,
            course_type,
            remarks
        FROM "${courseCode}"
        WHERE semester = $1
        `,
        [semester]
    );

    // Fetching fee payment details
    const feeResult = await pool.query(
    `SELECT amount_paid, payment_date FROM fee_payments
     WHERE enrollment_id = $1 AND semester = $2`,
    [enrollmentId, semester]
);
    const fee = feeResult.rows[0] || {};

    // Swap each "Open Elective" slot for the course the student chose
    // (throws if they have not chosen yet)
    const allSubjects = await substituteChoices({
        enrollmentId,
        courseCode,
        semester,
        subjects: subjectsResult.rows
    });

    // Separating theory and practical subjects
    const theorySubjects =
        allSubjects.filter(
            (subject) => subject.subject_type === "THEORY"
        );

    const practicalSubjects =
        allSubjects.filter(
            (subject) =>
                subject.subject_type === "PRACTICAL" ||
                subject.subject_type === "SESSIONAL"
        );

    // Return cumulative student data for final PDF generation
    return {
        nameEnglish: student.name_english,
        nameHindi: student.name_hindi,
        mobile: student.mobile,
        enrollmentId: enrollmentId,
        gsuiteId: gsuiteId,
        semester: semester,
        theorySubjects: theorySubjects,
        practicalSubjects: practicalSubjects,
        amountPaid: fee.amount_paid, 
        paymentDate: fee.payment_date
    };
};


const getCurrentSemester = (enrollmentYear) => {
    const currentDate = new Date();

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    const academicYear =
        currentYear - enrollmentYear;

    // July onwards = odd semester
    if (currentMonth >= 7) {
        return academicYear * 2 + 1;
    }

    // January-June = even semester
    return academicYear * 2;
};


// Uses the semester stored in the database; the calculated one only cross-checks it.
const resolveSemester = (storedSemester, calculatedSemester, enrollmentId) => {
    const stored = Number(storedSemester);
    const isValid = Number.isInteger(stored) && stored >= 1 && stored <= 8;

    // Nothing usable in the database: fall back to the calculation so the PDF still works.
    if (!isValid) {
        console.warn(
            `[semester] ${enrollmentId}: no valid semester in database (${storedSemester}); ` +
            `using calculated semester ${calculatedSemester}.`
        );
        return calculatedSemester;
    }

    if (stored !== calculatedSemester) {
        console.warn(
            `[semester] ${enrollmentId}: database says ${stored}, date-based calculation ` +
            `says ${calculatedSemester}. Using the database value.`
        );
    }

    return stored;
};


const getGsuiteId = (enrollmentId, name) => {
    const firstName =
        name.trim().split(/\s+/)[0].toLowerCase();

    return `${enrollmentId}.${firstName}@students.iiests.ac.in`;
};


module.exports = getCurrentRegistrationData;