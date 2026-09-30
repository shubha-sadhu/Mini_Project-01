/*==================================================
        ADMIN DASHBOARD - JS ENGINE
==================================================*/

const API_BASE = "http://localhost:5000/api";
const sessionToken = sessionStorage.getItem("sessionToken");

if (!sessionToken) {
    window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
    fetchStudents();
    setupThemeToggle();
    setupAddModal();
    setupEditModal(); // <-- New Edit logic initialized
});

/*==================================================
        FETCH & RENDER STUDENT DATA
==================================================*/
async function fetchStudents() {
    const tbody = document.getElementById("adminTableBody");
    try {
        const res = await fetch(`${API_BASE}/admin/students`, {
            headers: { Authorization: `Bearer ${sessionToken}` }
        });
        if (!res.ok) throw new Error("Failed to fetch students");
        const students = await res.json();
        renderTable(students, tbody);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#DC3545; padding: 30px;">Failed to load records.</td></tr>`;
    }
}

function renderTable(students, tbody) {
    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px;">No student records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = students.map(student => {
        const feeBadgeClass = student.feeStatus ? "success" : "warning";
        const feeBadgeText = student.feeStatus ? "Cleared" : "Pending";
        
        return `
            <tr>
                <td style="font-weight: 600; color: var(--text-main);">${student.enrollmentNo}</td>
                <td>${student.fullname}</td>
                <td>${student.email}</td>
                <td>${student.department}</td>
                <td>
                    <span class="badge ${feeBadgeClass}" style="cursor: pointer;" onclick="toggleFeeStatus('${student.enrollmentNo}', ${student.feeStatus})" title="Click to toggle status">
                        ${feeBadgeText}
                    </span>
                </td>
                <td style="text-align: right; white-space: nowrap;">
                    <button class="action-btn" onclick="openEditModal('${student.enrollmentNo}', '${student.fullname}', '${student.email}', '${student.department}')" style="padding: 6px 12px; font-size: 0.8rem; display: inline-flex; margin-right: 5px;" title="Edit Student">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="action-btn" onclick="deleteStudent('${student.enrollmentNo}')" style="padding: 6px 12px; font-size: 0.8rem; display: inline-flex; color: #DC3545; border-color: rgba(220,53,69,0.3);" title="Delete Student">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

/*==================================================
        INTERACTIVE CRUD ACTIONS
==================================================*/
window.toggleFeeStatus = async function(enrollmentNo, currentStatus) {
    const newStatus = !currentStatus;
    try {
        const res = await fetch(`${API_BASE}/admin/students/${enrollmentNo}/fee`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
            body: JSON.stringify({ feeStatus: newStatus })
        });
        if (res.ok) fetchStudents(); 
        else alert("Failed to update fee status.");
    } catch (err) {
        alert("Network error.");
    }
};

window.deleteStudent = async function(enrollmentNo) {
    if (!confirm(`Are you sure you want to permanently delete record for ${enrollmentNo}?`)) return;
    try {
        const res = await fetch(`${API_BASE}/admin/students/${enrollmentNo}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${sessionToken}` }
        });
        if (res.ok) fetchStudents(); 
        else alert("Failed to delete student.");
    } catch (err) {
        alert("Network error.");
    }
};

/*==================================================
        ADD NEW STUDENT MODAL
==================================================*/
function setupAddModal() {
    const addModal = document.getElementById("addStudentModal");
    const openBtn = document.querySelector('button[title="Add Student"]') || Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Add Student'));
    const closeBtn = document.getElementById("closeAddModalBtn");
    const form = document.getElementById("addStudentForm");
    const submitBtn = document.getElementById("addStudentSubmitBtn");

    if(openBtn) openBtn.addEventListener("click", () => addModal.classList.remove("d-none"));
    if(closeBtn) closeBtn.addEventListener("click", () => { addModal.classList.add("d-none"); form.reset(); });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";

        const payload = {
            enrollmentNo: document.getElementById("addRoll").value.trim(),
            fullname: document.getElementById("addName").value.trim(),
            email: document.getElementById("addEmail").value.trim()
        };

        try {
            const res = await fetch(`${API_BASE}/admin/students`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                addModal.classList.add("d-none");
                form.reset();
                fetchStudents();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to add student.");
            }
        } catch (err) {
            alert("Network error.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Save Record";
        }
    });
}

/*==================================================
        EDIT STUDENT MODAL
==================================================*/
window.openEditModal = function(roll, name, email, department) {
    document.getElementById('editRoll').value = roll;
    document.getElementById('editName').value = name;
    document.getElementById('editEmail').value = email;
    document.getElementById('editDepartment').value = department;
    document.getElementById('editStudentSubtitle').textContent = `Updating record for ${roll}`;
    document.getElementById('editStudentModal').classList.remove('d-none');
};

function setupEditModal() {
    const modal = document.getElementById("editStudentModal");
    const closeBtn = document.getElementById("closeEditModalBtn");
    const form = document.getElementById("editStudentForm");
    const submitBtn = document.getElementById("editStudentSubmitBtn");

    if(closeBtn) closeBtn.addEventListener("click", () => modal.classList.add("d-none"));

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = "Updating...";

        const roll = document.getElementById("editRoll").value;
        const payload = {
            fullname: document.getElementById("editName").value.trim(),
            email: document.getElementById("editEmail").value.trim(),
            department: document.getElementById("editDepartment").value.trim()
        };

        try {
            const res = await fetch(`${API_BASE}/admin/students/${roll}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                modal.classList.add("d-none");
                fetchStudents(); // Refresh table
            } else {
                const data = await res.json();
                alert(data.error || "Failed to update student.");
            }
        } catch (err) {
            alert("Network error.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Update Record";
        }
    });
}

/*==================================================
        THEME TOGGLE
==================================================*/
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

/*==================================================
        CSV BULK UPLOAD LOGIC
==================================================*/
const uploadCsvBtn = document.getElementById("uploadCsvBtn");
const csvFileInput = document.getElementById("csvFileInput");

if (uploadCsvBtn && csvFileInput) {
    // 1. Clicking the button opens the hidden file input
    uploadCsvBtn.addEventListener("click", () => csvFileInput.click());

    // 2. When a file is selected, parse it
    csvFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function(event) {
            const csvText = event.target.result;
            const rows = csvText.split('\n').filter(row => row.trim() !== '');
            
            // Assume first row is headers: Roll, Name, Email, Department
            const students = [];
            for (let i = 1; i < rows.length; i++) {
                const cols = rows[i].split(',');
                if (cols.length >= 3) {
                    students.push({
                        enrollmentNo: cols[0].trim(),
                        fullname: cols[1].trim(),
                        email: cols[2].trim(),
                        department: cols[3] ? cols[3].trim() : "Computer Science and Technology"
                    });
                }
            }

            if (students.length === 0) {
                alert("No valid data found in CSV. Please ensure columns are: Roll, Name, Email, Dept");
                return;
            }

            // 3. Send parsed data to backend
            uploadCsvBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`;
            uploadCsvBtn.disabled = true;

            try {
                const res = await fetch(`${API_BASE}/admin/students/bulk`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
                    body: JSON.stringify({ students })
                });

                if (res.ok) {
                    alert(`Successfully imported ${students.length} students!`);
                    fetchStudents(); // Refresh the table
                } else {
                    const data = await res.json();
                    alert(data.error || "Failed to import students.");
                }
            } catch (err) {
                alert("Network error during upload.");
            } finally {
                uploadCsvBtn.innerHTML = `<i class="fa-solid fa-file-csv"></i> Upload CSV`;
                uploadCsvBtn.disabled = false;
                csvFileInput.value = ""; // Reset file input
            }
        };
        
        reader.readAsText(file);
    });
}