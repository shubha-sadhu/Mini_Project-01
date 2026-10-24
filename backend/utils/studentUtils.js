// Shared rules for enrolment numbers (same rules as the PDF generator uses).

const VALID_COURSE_CODES = ["CSB", "CSM", "CSP", "ITB", "ITM", "ITP"];

const PROGRAMME_DETAILS = {
  CSB: { department: "Computer Science & Technology", programme: "B.Tech." },
  CSM: { department: "Computer Science & Technology", programme: "M.Tech." },
  CSP: { department: "Computer Science & Technology", programme: "Ph.D." },
  ITB: { department: "Information Technology", programme: "B.Tech" },
  ITM: { department: "Information Technology", programme: "M.Tech" },
  ITP: { department: "Information Technology", programme: "Ph.D" },
};

// 4-digit year + programme code + roll number, e.g. 2025CSB120
const ENROLLMENT_REGEX = new RegExp(`^\\d{4}(${VALID_COURSE_CODES.join("|")})\\d{1,4}$`);

const isValidEnrollmentId = (id) => ENROLLMENT_REGEX.test(id);

const getProgrammeDetails = (enrollmentId) =>
  PROGRAMME_DETAILS[String(enrollmentId).substring(4, 7).toUpperCase()] ||
  { department: "", programme: "" };

// July onwards = odd semester, January-June = even semester
const getCurrentSemester = (enrollmentYear) => {
  const now = new Date();
  const academicYear = now.getFullYear() - enrollmentYear;
  return now.getMonth() + 1 >= 7 ? academicYear * 2 + 1 : academicYear * 2;
};

const getGsuiteId = (enrollmentId, name) => {
  const firstName = String(name || "").trim().split(/\s+/)[0].toLowerCase();
  return `${enrollmentId}.${firstName}@students.iiests.ac.in`;
};

const isValidSemester = (n) => Number.isInteger(n) && n >= 1 && n <= 8;

module.exports = {
  VALID_COURSE_CODES,
  isValidEnrollmentId,
  getProgrammeDetails,
  getCurrentSemester,
  getGsuiteId,
  isValidSemester,
};