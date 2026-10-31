/*ADMIN DASHBOARD - JS ENGINE*/
const API_BASE = "/api";
const sessionToken = sessionStorage.getItem("sessionToken");

if (!sessionToken) {
    window.location.href = "index.html";
}

// True once "View All Students" has been used, so later changes refresh the table.
let studentsLoaded = false;

document.addEventListener("DOMContentLoaded", () => {
    setupThemeToggle();
    setupViewStudents();
    setupAddModal();
    setupStudentsCsvUpload();
    setupCsvModal();
});

/*SMALL HELPERS*/
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

async function readJson(res) {
    try {
        return await res.json();
    } catch (err) {
        return {};
    }
}

function errorText(data, fallback) {
    return data.error || data.message || fallback;
}

// Returns true when the response was a login/permission problem and has been handled.
function handleAuthFailure(res) {
    if (res.status === 401) {
        sessionStorage.removeItem("sessionToken");
        window.location.href = "index.html";
        return true;
    }
    if (res.status === 403) {
        alert("Admin access is required for this action.");
        return true;
    }
    return false;
}

/*VIEW ALL STUDENTS*/
function setupViewStudents() {
    const btn = document.getElementById("viewStudentsBtn");
    if (btn) btn.addEventListener("click", fetchStudents);
}

async function fetchStudents() {
    const btn = document.getElementById("viewStudentsBtn");
    const tbody = document.getElementById("adminTableBody");

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Loading...`;

    try {
        const res = await fetch(`${API_BASE}/admin/students`, {
            headers: { Authorization: `Bearer ${sessionToken}` }
        });

        if (handleAuthFailure(res)) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#DC3545; padding: 30px;">Admin access is required to view student records.</td></tr>`;
            return;
        }

        const data = await readJson(res);
        if (!res.ok) throw new Error(errorText(data, "Failed to fetch students"));

        renderTable(data.students || [], tbody);
        studentsLoaded = true;
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#DC3545; padding: 30px;">${escapeHtml(err.message || "Failed to load records.")}</td></tr>`;
        document.getElementById("studentCount").textContent = "";
    } finally {
        btn.disabled = false;
        btn.innerHTML = studentsLoaded
            ? `<i class="fa-solid fa-rotate"></i> Refresh Students`
            : `<i class="fa-solid fa-users"></i> View All Students`;
    }
}

function renderTable(students, tbody) {
    const countEl = document.getElementById("studentCount");

    if (students.length === 0) {
        countEl.textContent = "";
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 30px;">No student records found.</td></tr>`;
        return;
    }

    countEl.textContent = `Total students: ${students.length}`;

    tbody.innerHTML = students.map(student => `
        <tr>
            <td style="font-weight: 600; color: var(--text-main);">${escapeHtml(student.enrollmentId)}</td>
            <td>${escapeHtml(student.nameEnglish)}</td>
            <td>${escapeHtml(student.nameHindi) || "-"}</td>
            <td>${escapeHtml(student.gsuiteId)}</td>
            <td>${escapeHtml(student.programme)}${student.department ? ` - ${escapeHtml(student.department)}` : ""}</td>
            <td>${student.semester ?? "-"}</td>
            <td>${escapeHtml(student.mobile) || "-"}</td>
        </tr>
    `).join("");
}

/*ADD STUDENT MODAL*/
function setupAddModal() {
    const addModal = document.getElementById("addStudentModal");
    const openBtn = document.getElementById("addStudentBtn");
    const closeBtn = document.getElementById("closeAddModalBtn");
    const form = document.getElementById("addStudentForm");
    const submitBtn = document.getElementById("addStudentSubmitBtn");

    openBtn.addEventListener("click", () => addModal.classList.remove("d-none"));
    closeBtn.addEventListener("click", () => { addModal.classList.add("d-none"); form.reset(); });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";

        const payload = {
            enrollmentId: document.getElementById("addRoll").value.trim(),
            nameEnglish: document.getElementById("addName").value.trim(),
            nameHindi: document.getElementById("addHindi").value.trim(),
            mobile: document.getElementById("addMobile").value.trim(),
            semester: document.getElementById("addSemester").value
        };

        try {
            const res = await fetch(`${API_BASE}/admin/students`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
                body: JSON.stringify(payload)
            });

            if (handleAuthFailure(res)) return;

            const data = await readJson(res);

            if (res.ok) {
                addModal.classList.add("d-none");
                form.reset();
                alert(`Student ${data.student.enrollmentId} saved.`);
                if (studentsLoaded) fetchStudents();
            } else {
                alert(errorText(data, "Failed to save student."));
            }
        } catch (err) {
            alert("Network error.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Save Record";
        }
    });
}

/*UPLOAD STUDENTS CSV*/
function setupStudentsCsvUpload() {
    const btn = document.getElementById("uploadStudentsCsvBtn");
    const input = document.getElementById("studentsCsvInput");

    btn.addEventListener("click", () => input.click());

    input.addEventListener("change", async () => {
        const file = input.files[0];
        if (!file) return;

        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`;
        btn.disabled = true;

        try {
            const formData = new FormData();
            formData.append("file", file);

            // No Content-Type header: the browser sets it, including the file boundary.
            const res = await fetch(`${API_BASE}/admin/import/students`, {
                method: "POST",
                headers: { Authorization: `Bearer ${sessionToken}` },
                body: formData
            });

            if (handleAuthFailure(res)) return;

            const data = await readJson(res);

            if (res.ok) {
                alert(`${data.message}\n${data.imported} student(s) added or updated.`);
                if (studentsLoaded) fetchStudents();
            } else {
                alert(errorText(data, "Failed to import students."));
            }
        } catch (err) {
            alert("Network error during upload.");
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            input.value = "";
        }
    });
}

/*UPLOAD SUBJECTS / OPEN ELECTIVES CSV (shared modal)*/
const CSV_KINDS = {
    subjects: {
        title: "Upload Subjects CSV",
        hint: "Columns: subject_code, subject_name, subject_type (THEORY / PRACTICAL / SESSIONAL), credits, course_type, semester, remarks (optional). Subjects are added to the selected programme, so uploading the same file twice creates duplicates. For an open elective slot, use course_type \"Open Elective\".",
        endpoint: "/admin/import/subjects",
        done: "subject(s) added."
    },
    openElectives: {
        title: "Upload Open Electives CSV",
        hint: "Columns: subject_code, subject_name, semester, offered_by (optional). Credits are not needed: they come from the \"Open Elective\" row of the subjects table. These are the courses students can choose for the \"Open Elective\" slot. They are saved in the selected programme's own table (e.g. CSB_OE), which must already exist. Uploading again updates existing electives, so repeating a file is safe.",
        endpoint: "/admin/import/open-electives",
        done: "open elective(s) saved."
    }
};

function setupCsvModal() {
    const modal = document.getElementById("subjectsCsvModal");
    const form = document.getElementById("subjectsCsvForm");
    const closeBtn = document.getElementById("closeSubjectsModalBtn");
    const submitBtn = document.getElementById("subjectsCsvSubmitBtn");
    const statusEl = document.getElementById("subjectsCsvStatus");

    let kind = CSV_KINDS.subjects;

    const showStatus = (message, isError) => {
        statusEl.textContent = message;
        statusEl.style.color = isError ? "#DC3545" : "var(--success)";
        statusEl.classList.remove("d-none");
    };

    const openModal = (selectedKind) => {
        kind = selectedKind;
        document.getElementById("csvModalTitle").textContent = kind.title;
        document.getElementById("csvModalHint").textContent = kind.hint;
        statusEl.classList.add("d-none");
        form.reset();
        modal.classList.remove("d-none");
    };

    document.getElementById("uploadSubjectsCsvBtn")
        .addEventListener("click", () => openModal(CSV_KINDS.subjects));
    document.getElementById("uploadOpenElectivesCsvBtn")
        .addEventListener("click", () => openModal(CSV_KINDS.openElectives));

    closeBtn.addEventListener("click", () => {
        modal.classList.add("d-none");
        form.reset();
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const courseCode = document.getElementById("subjectCourse").value;
        const file = document.getElementById("subjectsCsvFile").files[0];

        if (!courseCode || !file) {
            showStatus("Please choose a programme and a CSV file.", true);
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Uploading...";
        statusEl.classList.add("d-none");

        try {
            const formData = new FormData();
            formData.append("courseCode", courseCode);
            formData.append("file", file);

            const res = await fetch(`${API_BASE}${kind.endpoint}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${sessionToken}` },
                body: formData
            });

            if (handleAuthFailure(res)) return;

            const data = await readJson(res);

            if (res.ok) {
                showStatus(`${data.message}\n${data.imported} ${kind.done}`, false);
                form.reset();
            } else {
                showStatus(errorText(data, "Upload failed."), true);
            }
        } catch (err) {
            showStatus("Network error during upload.", true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Upload";
        }
    });
}

/*THEME TOGGLE*/
function setupThemeToggle() {
    const themeToggleBtn = document.getElementById("themeToggle");
    const themeIcon = document.getElementById("themeIcon");
    const rootHtml = document.documentElement;
    const instituteLogo = document.getElementById("instituteLogo");

    rootHtml.setAttribute("data-theme", "light");
    if (instituteLogo) instituteLogo.src = "logo.png";

    themeToggleBtn.addEventListener("click", () => {
        let currentTheme = rootHtml.getAttribute("data-theme");
        if (currentTheme === "light") {
            rootHtml.setAttribute("data-theme", "dark");
            themeIcon.className = "fa-solid fa-sun";
            if (instituteLogo) instituteLogo.src = "logo_white.png";
        } else {
            rootHtml.setAttribute("data-theme", "light");
            themeIcon.className = "fa-solid fa-moon";
            if (instituteLogo) instituteLogo.src = "logo.png";
        }
    });
}