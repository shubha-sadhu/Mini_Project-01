// Date
const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const getCurrentDate = () => formatDate(new Date());

// Department, Programme, Specialisation
const getProgrammeDetails = (enrollmentId) => {
  const courseCode = enrollmentId.substring(4, 7).toUpperCase();

  const programmeDetails = {
    CSB: { department: "Computer Science & Technology", programme: "B.Tech.", specialization: "" },
    CSM: { department: "Computer Science & Technology", programme: "M.Tech.", specialization: "" },
    CSP: { department: "Computer Science & Technology", programme: "Ph.D.", specialization: "" },
    ITB: { department: "Information Technology", programme: "B.Tech", specialization: "" },
    ITM: { department: "Information Technology", programme: "M.Tech", specialization: "" },
    ITP: { department: "Information Technology", programme: "Ph.D", specialization: "" },
  };

  // Fix: was checking/returning `details` and `tableCode`, neither of which
  // existed - threw a ReferenceError on every call. Now correctly checks
  // and returns `courseDetails`, and reports the actual `courseCode`.
  const courseDetails = programmeDetails[courseCode];
  if (!courseDetails) {
    throw new Error(`Programme details not found for ${courseCode}`);
  }

  return courseDetails;
};

// Semester
const formatSemester = (semester) => {
  const suffix =
    semester % 100 >= 11 && semester % 100 <= 13
      ? "th"
      : semester % 10 === 1
      ? "st"
      : semester % 10 === 2
      ? "nd"
      : semester % 10 === 3
      ? "rd"
      : "th";

  return `${semester}${suffix}`;
};

module.exports= consolidateStudentData = (data) => {
  const {
    // Fix: pdfDataService returns this field as `nameEnglish`, not `name`.
    // Reading `name` meant student.nameEnglish was always undefined.
    nameEnglish,
    nameHindi,
    mobile,
    enrollmentId,
    gsuiteId,
    semester,
    // Fix: default to [] so an empty result set doesn't throw on .map().
    theorySubjects = [],
    practicalSubjects = [],
    amountPaid,
    paymentDate
  } = data;

  const programmeDetails = getProgrammeDetails(enrollmentId);

  return {
    student: {
      nameEnglish: nameEnglish || "",
      nameHindi: nameHindi || "",
      department: programmeDetails.department,
      programme: programmeDetails.programme,
      specialization: programmeDetails.specialization,
      semester: formatSemester(semester),
      enrolmentNo: enrollmentId,
      gsuiteId: gsuiteId || "",
      mobileNo: mobile || "",
      date: getCurrentDate(),
    },

    fee: {
       amountPaid: amountPaid != null ? String(amountPaid) : "",
       paymentDate: paymentDate ? formatDate(new Date(paymentDate)) : "",
    },

    theorySubjects: theorySubjects.map((subject) => ({
      subjectCode: subject.subject_code,
      subjectName: subject.subject_name,
      coreElective: subject.course_type,
      credit: String(subject.credits),
      remarks: subject.remarks || "",
    })),

    practicalSubjects: practicalSubjects.map((subject) => ({
      subjectCode: subject.subject_code,
      subjectName: subject.subject_name,
      credit: String(subject.credits),
      remarks: subject.remarks || "",
    })),
  };
};

module.exports=consolidateStudentData;