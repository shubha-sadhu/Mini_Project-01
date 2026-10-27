const pool = require("../config/postgres");
const { isValidEnrollmentId } = require("../utils/studentUtils");

// Same setting (and default) that routes/auth.js uses for the institute domain.
const getAllowedDomain = () =>
    (process.env.ALLOWED_EMAIL_DOMAIN || "students.iiests.ac.in").toLowerCase();

const NOT_ENROLLED_MESSAGE =
    "This email does not match the college records, so an account cannot be created. " +
    "Please check your enrolment number and name in the address, or contact your department.";

/*
 * True only when the e-mail is exactly the institute address the college records
 * give that student: enrolment number + first name, the same rule the registration
 * PDF uses for the G-suite ID.
 *
 *   2025csb047.shubhapriya@students.iiests.ac.in   -> 2025CSB047 is "Shubhapriya Sadhukhan"  OK
 *   2025csb048.shubhapriya@students.iiests.ac.in   -> 2025CSB048 is someone else            refused
 *   2025csb999.nobody@students.iiests.ac.in        -> no such enrolment number              refused
 *
 * Both parts have to belong to the same student, so a real enrolment number cannot be
 * paired with another person's name. Anything that is not an institute address is
 * false. If the database cannot be reached this throws, so a caller's error handling
 * keeps registration blocked.
 */
async function isEnrolledStudent(email) {
    const suffix = "@" + getAllowedDomain();
    const normalized = String(email || "").trim().toLowerCase();

    if (!normalized.endsWith(suffix)) return false;

    const localPart = normalized.slice(0, -suffix.length);
    const enrollmentId = localPart.split(".")[0].toUpperCase();

    if (localPart.includes("@") || !isValidEnrollmentId(enrollmentId)) return false;

    const result = await pool.query(
        "SELECT enrollment_id, name_english FROM students WHERE enrollment_id = $1",
        [enrollmentId]
    );

    if (result.rows.length === 0) return false;

    const { enrollment_id, name_english } = result.rows[0];
    const firstName = String(name_english || "").trim().split(/\s+/)[0].toLowerCase();

    return normalized === `${enrollment_id.toLowerCase()}.${firstName}${suffix}`;
}

module.exports = {
    isEnrolledStudent,
    NOT_ENROLLED_MESSAGE
};