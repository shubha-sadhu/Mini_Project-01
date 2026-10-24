/*==================================================
        AUTH GUARD + LOAD LOGGED-IN USER'S PROFILE
==================================================*/
const API_BASE = "http://localhost:5000/api/auth";
const STUDENT_API = "http://localhost:5000/api/student";

// Student record loaded from the database (null until it arrives).
let studentProfile = null;
// Last user object returned by /api/auth/me (or the login cache).
let latestUser = null;

const sessionToken = sessionStorage.getItem("sessionToken");

if (!sessionToken) {
    // No one is logged in for this tab/session — bounce back to login.
    window.location.href = "../login/index.html";
}

function getDisplayNameFromEmail(email) {
    if (!email || typeof email !== "string" || !email.includes("@")) return "Student";

    const localPart = email.split("@")[0];

    // "ayan.behera123" / "ayan_behera" -> "Ayan Behera123"
    return localPart
        .split(/[._]+/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function getInitials(displayName) {
    if (!displayName) return "";
    const parts = displayName.trim().split(/\s+/);
    const initials = parts.slice(0, 2).map(p => p[0]).join("");
    return initials.toUpperCase();
}

function applyUserToDashboard(user) {
    latestUser = user;
    const displayName = (studentProfile && studentProfile.nameEnglish) || getDisplayNameFromEmail(user.email);
    const initials = getInitials(displayName);

    // Sidebar
    const sidebarAvatarEl = document.querySelector(".sidebar .avatar");
    const sidebarNameEl = document.querySelector(".sidebar .user-info .name");
    const sidebarRollEl = document.querySelector(".sidebar .user-info .roll");

    if (sidebarAvatarEl && !sidebarAvatarEl.style.backgroundImage.includes("url")) {
        sidebarAvatarEl.textContent = initials;
    }
    if (sidebarNameEl) sidebarNameEl.textContent = displayName;
    if (sidebarRollEl) sidebarRollEl.textContent = user.email;

    // Settings -> Profile Details
    const settingsAvatarEl = document.getElementById("settingsAvatar");
    if (settingsAvatarEl && !settingsAvatarEl.style.backgroundImage.includes("url")) {
        settingsAvatarEl.textContent = initials;
    }

    const avatarInfoName = document.querySelector(".avatar-info h4");
    const avatarInfoSub = document.querySelector(".avatar-info p");
    if (avatarInfoName) avatarInfoName.textContent = displayName;
    if (avatarInfoSub) avatarInfoSub.textContent = user.email;

    // Home page greeting ("Welcome back, <name>!")
    const greetingEl = document.querySelector(".greeting-box h2");
    if (greetingEl) greetingEl.textContent = `Welcome back, ${displayName}!`;

    // Until the student record arrives, fall back to what we can derive from the login.
    // Once it has arrived, fillSettingsFromProfile() owns these fields.
    const profileForm = document.getElementById("profileForm");
    if (profileForm && !studentProfile) {
        const nameInput = profileForm.querySelector('input[type="text"]');
        const emailInput = profileForm.querySelector('input[type="email"]');
        if (nameInput) nameInput.value = displayName;
        if (emailInput) emailInput.value = user.email;
    }

    // Settings -> Update Contact Info
    const mobileInputEl = document.getElementById("mobileInput");
    if (mobileInputEl) mobileInputEl.value = (studentProfile && studentProfile.mobile) || user.mobile || "";
}

// Paint instantly from the cache written at login (avoids a blank flash),
// then refresh from the server so the data is always accurate.
const cachedUserRaw = sessionStorage.getItem("cachedUser");
if (cachedUserRaw) {
    try {
        applyUserToDashboard(JSON.parse(cachedUserRaw));
    } catch (err) {
        // Ignore a corrupted cache entry; the live fetch below will fix it.
    }
}

if (sessionToken) {
    fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
    })
        .then(async (res) => {
            if (res.status === 401) {
                sessionStorage.removeItem("sessionToken");
                sessionStorage.removeItem("cachedUser");
                window.location.href = "../login/index.html";
                return;
            }

            const data = await res.json();

            if (!res.ok) {
                console.error("Could not load profile:", data.error);
                return;
            }

            sessionStorage.setItem("cachedUser", JSON.stringify(data.user));
            applyUserToDashboard(data.user);
        })
        .catch((err) => {
            console.error("Network error loading profile:", err);
        });
}

/*==================================================
        AUTOFILL: SETTINGS PAGE + REGISTRATION FORM
        Pulls the student's record from the database and fills
        both pages. Subjects come from a separate call so they
        can be reloaded when the semester dropdown changes.
==================================================*/
function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.value = value;
}

// Picks the <option> that matches `value`, ignoring case and dots
// (so "B.Tech." from the database matches the "B.Tech" option).
function setSelectValue(id, value) {
    const el = document.getElementById(id);
    if (!el || value === undefined || value === null || value === "") return;

    const normalise = (v) => String(v).trim().toLowerCase().replace(/\./g, "");
    let wanted = normalise(value);
    if (id.toLowerCase().includes("gender")) {
        if (wanted === "m") wanted = "male";
        if (wanted === "f") wanted = "female";
    }

    const match = Array.from(el.options).find(o => o.value && normalise(o.value) === wanted);
    if (match) el.value = match.value;
}

function showAutofillError(message) {
    const el = document.getElementById("autofillStatus");
    if (!el) return;
    el.textContent = message;
    el.classList.remove("d-none");
}

function fillSettingsFromProfile(s) {
    setInputValue("profileNameEnglish", s.nameEnglish);
    setInputValue("profileNameHindi", s.nameHindi);
    setInputValue("profileEnrollment", s.enrollmentId);
    setInputValue("profileGsuite", s.gsuiteId || (latestUser && latestUser.email));
    setInputValue("profileDepartment", s.department);
    setSelectValue("profileProgramme", s.programme);
    setSelectValue("profileGender", s.gender);
    setInputValue("profileSpecialization", s.specialization);
    setInputValue("mobileInput", s.mobile);
}

function fillRegistrationFromProfile(s) {
    setInputValue("regNameEnglish", s.nameEnglish);
    setInputValue("regNameHindi", s.nameHindi);
    setInputValue("regDepartment", s.department);
    setSelectValue("regProgramme", s.programme);
    setInputValue("regSpecialization", s.specialization);
    setSelectValue("regSemester", s.semester);
    setInputValue("regEnrollment", s.enrollmentId);
    setInputValue("regGsuite", s.gsuiteId || (latestUser && latestUser.email));
    setInputValue("regMobile", s.mobile);
    setInputValue("regAmountPaid", s.amountPaid);
    setInputValue("paymentDate", s.paymentDate);
}

function fillTheoryTable(subjects) {
    const tbody = document.getElementById("theoryTable").getElementsByTagName("tbody")[0];
    tbody.innerHTML = "";
    subjects.forEach(subject => addRow("theoryTable", subject));
}

async function loadSubjects(semester) {
    if (!semester) return;

    const res = await fetch(
        `${STUDENT_API}/subjects?semester=${encodeURIComponent(semester)}`,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
    );
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.error || data.message || "Could not load subjects.");
    }

    fillTheoryTable(data.subjects || []);
}

async function loadStudentData() {
    if (!sessionToken) return;

    try {
        const res = await fetch(`${STUDENT_API}/me`, {
            headers: { Authorization: `Bearer ${sessionToken}` },
        });

        if (res.status === 401) {
            sessionStorage.removeItem("sessionToken");
            sessionStorage.removeItem("cachedUser");
            window.location.href = "../login/index.html";
            return;
        }

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.error || data.message || "Could not load your student details.");
        }

        studentProfile = data.student;

        fillSettingsFromProfile(studentProfile);
        fillRegistrationFromProfile(studentProfile);

        // Re-run so the sidebar, greeting and avatar use the real name.
        if (latestUser) applyUserToDashboard(latestUser);

        await loadSubjects(studentProfile.semester);

    } catch (err) {
        console.error("Autofill error:", err);
        showAutofillError("Could not load your saved details. You can fill in the form manually.");
    }
}

loadStudentData();

// Clear the session before the default logout link navigates away.
const logoutBtn = document.querySelector(".logout-btn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem("sessionToken");
        sessionStorage.removeItem("cachedUser");
    });
}

/*==================================================
        THEME TOGGLE (DARK / LIGHT MODE & LOGO SWAP)
==================================================*/
const themeToggleBtn = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const rootHtml = document.documentElement;
const instituteLogo = document.getElementById("instituteLogo");

rootHtml.setAttribute("data-theme", "light");
if (instituteLogo) instituteLogo.src = "./logo.png";

themeToggleBtn.addEventListener("click", () => {
    let currentTheme = rootHtml.getAttribute("data-theme");
    
    if(currentTheme === "light") {
        rootHtml.setAttribute("data-theme", "dark");
        themeIcon.classList.remove("fa-moon");
        themeIcon.classList.add("fa-sun");
        if (instituteLogo) instituteLogo.src = "./logo_white.png";
    } else {
        rootHtml.setAttribute("data-theme", "light");
        themeIcon.classList.remove("fa-sun");
        themeIcon.classList.add("fa-moon");
        if (instituteLogo) instituteLogo.src = "./logo.png";
    }
});

/*==================================================
        SIDEBAR COLLAPSE TOGGLE
==================================================*/
const sidebarToggleBtn = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');

sidebarToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

/*==================================================
        DASHBOARD ACTIVE MENU HANDLING (SPA LOGIC)
==================================================*/
const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view-section");
const pageTitle = document.getElementById("pageTitle");
const homeBanner = document.getElementById("homeBanner");

navItems.forEach(item => {
    item.addEventListener("click", (e) => {
        e.preventDefault(); 
        
        navItems.forEach(link => link.classList.remove("active"));
        item.classList.add("active");

        const targetId = item.getAttribute("data-target");

        if (targetId === "view-home") {
            homeBanner.classList.remove("d-none");
            pageTitle.classList.add("d-none");
        } else {
            homeBanner.classList.add("d-none");
            pageTitle.classList.remove("d-none");
            const linkText = item.querySelector("span").textContent;
            pageTitle.innerText = linkText;
        }

        views.forEach(view => {
            if(view.id === targetId) {
                view.classList.remove("d-none");
            } else {
                view.classList.add("d-none");
            }
        });
        
        if (window.innerWidth <= 992) {
            sidebar.classList.add('collapsed');
        }
    });
});

/*==================================================
        SIDEBAR PROFILE CLICK -> PROFILE SETTINGS
==================================================*/
const sidebarUserProfile = document.getElementById("sidebarUserProfile");

if (sidebarUserProfile) {
    sidebarUserProfile.addEventListener("click", () => {
        const settingsNav = document.querySelector('.nav-item[data-target="view-settings"]');
        if (settingsNav) {
            settingsNav.click();
            const profileSection = document.getElementById("profileSettingsSection");
            if (profileSection) {
                profileSection.scrollIntoView({ behavior: "smooth" });
            }
        }
    });
}

/*==================================================
        AUTO-TRANSLATE (GOOGLE WIDGET + FALLBACK)
==================================================*/
function googleTranslateElementInit() {
    new google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,hi,bn',
        autoDisplay: false
    }, 'google_translate_element');
}

const languageSelect = document.getElementById("languageSelect");

const translationDictionary = {
    hi: {
        "Home": "मुख्य पृष्ठ",
        "Registration Form": "पंजीकरण फॉर्म",
        "History": "इतिहास",
        "Settings": "सेटिंग्स",
        "Logout": "लॉग आउट",
        "About": "के बारे में",
        "Help": "सहायता",
        "Account Settings": "खाता सेटिंग्स",
        "Profile Details": "प्रोफ़ाइल विवरण",
        "Security & Password": "सुरक्षा और पासवर्ड",
        "Update Security": "पासवर्ड अद्यतन करें",
        "Update Contact Info": "संपर्क जानकारी अद्यतन करें",
        "Portal Preferences": "पोर्टल प्राथमिकताएं",
        "Notification Preferences": "अधिसूचना प्राथमिकताएं"
    },
    bn: {
        "Home": "হোম",
        "Registration Form": "নিবন্ধন ফর্ম",
        "History": "ইতিহাস",
        "Settings": "সেটিংস",
        "Logout": "লগ আউট",
        "About": "সম্পর্কে",
        "Help": "সাহায্য",
        "Account Settings": "অ্যাকাউন্ট সেটিংস",
        "Profile Details": "প্রোফাইল বিবরণ",
        "Security & Password": "সুরক্ষা এবং পাসওয়ার্ড",
        "Update Security": "পাসওয়ার্ড আপডেট করুন",
        "Update Contact Info": "যোগাযোগের তথ্য আপডেট করুন",
        "Portal Preferences": "পোর্টাল পছন্দসমূহ",
        "Notification Preferences": "বিজ্ঞপ্তি পছন্দসমূহ"
    }
};

if (languageSelect) {
    languageSelect.addEventListener("change", (e) => {
        const lang = e.target.value;
        document.documentElement.lang = lang;

        const googleCombo = document.querySelector(".goog-te-combo");
        if (googleCombo) {
            googleCombo.value = lang;
            googleCombo.dispatchEvent(new Event("change"));
        } else {
            document.querySelectorAll("[data-translate]").forEach(el => {
                const key = el.getAttribute("data-translate");
                if (lang === "en") {
                    el.innerText = key;
                } else if (translationDictionary[lang] && translationDictionary[lang][key]) {
                    el.innerText = translationDictionary[lang][key];
                }
            });
        }
    });
}

/*==================================================
        DYNAMIC REGISTRATION FORM TABLES (ADD/REMOVE)
==================================================*/
function addRow(tableID, data = null) {
    const table = document.getElementById(tableID).getElementsByTagName('tbody')[0];
    const rowCount = table.rows.length;
    const row = table.insertRow(rowCount);
    
    row.insertCell(0).innerHTML = rowCount + 1;
    row.insertCell(1).innerHTML = '<input type="text" placeholder="Code" required>';
    row.insertCell(2).innerHTML = '<input type="text" placeholder="Subject Name" required>';

    if(tableID === 'theoryTable') {
        row.insertCell(3).innerHTML = `
            <select required>
                <option value="core">Core</option>
                <option value="elective">Elective</option>
            </select>`;
        row.insertCell(4).innerHTML = '<input type="number" step="0.5" min="0" placeholder="0.0" required>';
        row.insertCell(5).innerHTML = '<input type="text" placeholder="-">';
        
        // Add Remove Button Cell
        row.insertCell(6).innerHTML = `
            <button type="button" class="remove-row-btn" onclick="removeRow(this)" title="Remove Row">
                <i class="fa-solid fa-xmark"></i>
            </button>`;
    }
    
    // Pre-fill the new row when subject data is supplied (autofill from database)
    if (data && tableID === 'theoryTable') {
        row.cells[1].querySelector('input').value = data.code ?? "";
        row.cells[2].querySelector('input').value = data.name ?? "";
        row.cells[3].querySelector('select').value =
            String(data.type || "").toLowerCase() === "elective" ? "elective" : "core";
        row.cells[4].querySelector('input').value = data.credits ?? "";
        row.cells[5].querySelector('input').value = data.remarks ?? "";

        // "Open Elective" slot: the student picks the actual course from a list
        if (data.openElective) setupOpenElectiveRow(row, data);
    }

    updateRowNumbers(tableID);
}

// Turns a subject row into an open-elective picker: the name cell becomes a
// dropdown of the electives on offer, and choosing one is saved straight away.
function setupOpenElectiveRow(row, data) {
    const { slotId, selectedCode, options } = data.openElective;
    const codeInput = row.cells[1].querySelector('input');
    const typeSelect = row.cells[3].querySelector('select');
    const creditInput = row.cells[4].querySelector('input');

    const select = document.createElement('select');
    select.required = true;
    select.className = 'open-elective-select';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.textContent = options.length
        ? 'Choose your open elective'
        : 'No open electives available yet';
    select.appendChild(placeholder);

    options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.code;
        opt.textContent = `${o.code} - ${o.name}`;
        select.appendChild(opt);
    });

    select.value = selectedCode || '';
    select.disabled = options.length === 0;

    row.cells[2].innerHTML = '';
    row.cells[2].appendChild(select);

    typeSelect.value = 'elective';
    codeInput.readOnly = true;
    creditInput.readOnly = true;

    // Show the chosen course's code (or the placeholder's own code). Credits always
    // stay as set on the "Open Elective" row, so they are not changed here.
    const showOption = (code) => {
        const o = options.find(x => x.code === code);
        codeInput.value = o ? o.code : (data.code ?? '');
        creditInput.value = data.credits ?? '';
    };
    showOption(selectedCode);

    let lastSaved = selectedCode || '';

    select.addEventListener('change', async () => {
        select.disabled = true;
        try {
            const res = await fetch(`${STUDENT_API}/open-elective`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${sessionToken}`
                },
                body: JSON.stringify({
                    semester: Number(document.getElementById('regSemester').value),
                    slotId,
                    subjectCode: select.value
                })
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || body.message || 'Could not save your choice.');

            lastSaved = select.value;
            showOption(select.value);
        } catch (err) {
            alert(err.message);
            select.value = lastSaved;       // put back the previous choice
            showOption(lastSaved);
        } finally {
            select.disabled = false;
        }
    });
}

function removeRow(button) {
    // Traverse up to the TR element and remove it
    const row = button.closest('tr');
    const tableID = row.closest('table').id;
    row.remove();
    
    // Recalculate Serial Numbers so they stay sequential
    updateRowNumbers(tableID);
}

function updateRowNumbers(tableID) {
    const tbody = document.getElementById(tableID).getElementsByTagName('tbody')[0];
    const rows = tbody.rows;
    for (let i = 0; i < rows.length; i++) {
        rows[i].cells[0].innerText = i + 1;
    }
}

/*==================================================
        OTP VERIFICATION LOGIC (ROCK-SOLID ENGINE)
==================================================*/
const otpModalOverlay = document.getElementById("otpModalOverlay");
const cancelOtpBtn = document.getElementById("cancelOtpBtn");
const otpForm = document.getElementById("otpForm");

let otpSuccessCallback = null;
let otpCancelCallback = null;

function triggerVerificationFlow(onSuccess, onCancel = null) {
    otpSuccessCallback = onSuccess;
    otpCancelCallback = onCancel;
    otpForm.reset();
    otpModalOverlay.classList.remove("d-none");
}

function closeOtpModal() {
    otpModalOverlay.classList.add("d-none");
    if(otpCancelCallback) {
        otpCancelCallback();
    }
    otpSuccessCallback = null;
    otpCancelCallback = null;
}

if (cancelOtpBtn) {
    cancelOtpBtn.addEventListener("click", closeOtpModal);
}

if (otpForm) {
    otpForm.addEventListener("submit", (e) => {
        e.preventDefault(); 
        otpModalOverlay.classList.add("d-none");
        
        if (otpSuccessCallback) {
            otpSuccessCallback(); 
        }
        
        otpSuccessCallback = null;
        otpCancelCallback = null;
    });
}

window.addEventListener('load', () => {
    if (window.innerWidth <= 992) {
        sidebar.classList.add('collapsed');
    }
    // Blank starter rows - but not if the database autofill has already filled the table.
    const theoryBody = document.getElementById('theoryTable').getElementsByTagName('tbody')[0];
    if (theoryBody.rows.length === 0) {
        for(let i=0; i<5; i++) { addRow('theoryTable'); }
    }

    const paymentDateInput = document.getElementById('paymentDate');
    if(paymentDateInput) {
        const today = new Date().toISOString().split('T')[0];
        paymentDateInput.setAttribute('max', today);
    }
});

/*==================================================
        AVATAR (PICK FILE FIRST -> THEN VERIFY)
==================================================*/
const uploadPhotoBtn = document.getElementById("uploadPhotoBtn");
const avatarInput = document.getElementById("avatarInput");
const settingsAvatar = document.getElementById("settingsAvatar");
const sidebarAvatar = document.querySelector(".sidebar .avatar");
const removeAvatarBtn = document.getElementById("removeAvatarBtn");

if (uploadPhotoBtn && avatarInput) {
    uploadPhotoBtn.addEventListener("click", () => {
        avatarInput.click();
    });

    avatarInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { 
                alert("File size must be less than 2MB.");
                avatarInput.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const imgUrl = event.target.result;
                
                triggerVerificationFlow(
                    () => {
                        settingsAvatar.style.backgroundImage = `url('${imgUrl}')`;
                        settingsAvatar.textContent = "";
                        if (sidebarAvatar) {
                            sidebarAvatar.style.backgroundImage = `url('${imgUrl}')`;
                            sidebarAvatar.style.backgroundSize = "cover";
                            sidebarAvatar.textContent = "";
                        }
                        alert("Profile picture updated securely.");
                    }, 
                    () => {
                        avatarInput.value = ""; 
                    }
                );
            };
            reader.readAsDataURL(file);
        }
    });
}

if (removeAvatarBtn) {
    removeAvatarBtn.addEventListener("click", () => {
        triggerVerificationFlow(() => {
            settingsAvatar.style.backgroundImage = "none";
            settingsAvatar.textContent = "AB";
            if (sidebarAvatar) {
                sidebarAvatar.style.backgroundImage = "none";
                sidebarAvatar.textContent = "AB";
            }
            avatarInput.value = "";
            alert("Profile picture removed securely.");
        });
    });
}

/*==================================================
        MOBILE NUMBER (VERIFY BEFORE EDIT)
==================================================*/
const editMobileBtn = document.getElementById("editMobileBtn");
const mobileInput = document.getElementById("mobileInput");
const saveMobileBtn = document.getElementById("saveMobileBtn");
const contactForm = document.getElementById('contactForm');

if (editMobileBtn) {
    editMobileBtn.addEventListener("click", () => {
        triggerVerificationFlow(() => {
            mobileInput.removeAttribute("readonly");
            mobileInput.classList.remove("readonly-input");
            saveMobileBtn.removeAttribute("disabled");
            mobileInput.focus();
        });
    });
}

if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert("Mobile number updated successfully!");
        mobileInput.setAttribute("readonly", "true");
        mobileInput.classList.add("readonly-input");
        saveMobileBtn.setAttribute("disabled", "true");
    });
}

/*==================================================
        SECURITY FORM (VERIFY TO SAVE)
==================================================*/
const securityForm = document.getElementById('securityForm');
if (securityForm) {
    securityForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPass = document.getElementById('currentPass').value;
        const newPass = document.getElementById('newPass').value;
        const confirmPass = document.getElementById('confirmPass').value;
        const submitBtn = securityForm.querySelector('button[type="submit"]');

        if (newPass !== confirmPass) {
            alert("Your new passwords do not match. Please try again.");
            return;
        }
        if (newPass.length < 8) {
            alert("New password must be at least 8 characters long.");
            return;
        }
        if (newPass === currentPass) {
            alert("New password must be different from your current password.");
            return;
        }

        const originalBtnHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

        try {
            const res = await fetch(`${API_BASE}/change-password`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${sessionToken}`,
                },
                body: JSON.stringify({
                    currentPassword: currentPass,
                    newPassword: newPass,
                }),
            });

            let data = {};
            try { data = await res.json(); } catch (_) { /* non-JSON response */ }

            if (res.status === 401) {
                // Session expired / invalid token
                alert("Your session has expired. Please log in again.");
                sessionStorage.removeItem("sessionToken");
                sessionStorage.removeItem("cachedUser");
                window.location.href = "../login/index.html";
                return;
            }

            if (!res.ok) {
                alert(data.error || data.message || "Could not update password. Please try again.");
                return;
            }

            alert("Password updated successfully!");
            securityForm.reset();

            // Re-hide passwords after reset
            securityForm.querySelectorAll('.toggle-password').forEach(icon => {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
                icon.title = "Show Password";
            });
            securityForm.querySelectorAll('input').forEach(inp => {
                if (inp.type === 'text') inp.type = 'password';
            });
        } catch (err) {
            console.error("Password update failed:", err);
            alert("Could not reach the server. Make sure the backend is running.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    });
}

/*==================================================
        PASSWORD VISIBILITY TOGGLE
==================================================*/
const togglePasswordBtns = document.querySelectorAll('.toggle-password');

togglePasswordBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        const input = this.previousElementSibling; 
        
        if (input.type === 'password') {
            input.type = 'text';
            this.classList.remove('fa-eye');
            this.classList.add('fa-eye-slash');
            this.title = "Hide Password";
        } else {
            input.type = 'password';
            this.classList.remove('fa-eye-slash');
            this.classList.add('fa-eye');
            this.title = "Show Password";
        }
    });
});

// Reload the subject list when the student picks a different semester
const regSemesterSelect = document.getElementById("regSemester");
if (regSemesterSelect) {
    regSemesterSelect.addEventListener("change", async () => {
        try {
            await loadSubjects(regSemesterSelect.value);
        } catch (err) {
            console.error("Could not load subjects:", err);
            showAutofillError("Could not load subjects for that semester.");
        }
    });
}

// Registration Form Submit
const regForm = document.getElementById('regForm');
if(regForm) {
    regForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert("Registration form submitted successfully!");
    });
}



/* ==================================================
   GENERATE REGISTRATION PDF
================================================== */

const pdfNavItem = document.querySelector(
    '.nav-item[data-target="view-pdf"]'
);

const pdfViewer = document.getElementById("pdfViewer");
const pdfLoading = document.getElementById("pdfLoading");
const pdfError = document.getElementById("pdfError");
const pdfBlocker = document.getElementById("pdfBlocker");

// Stop keyboard use (Tab, Enter, etc.) while the request is running
function blockKeys(e) {
    e.preventDefault();
    e.stopPropagation();
}

function lockScreen() {
    pdfBlocker.classList.remove("d-none");
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", blockKeys, true);
}

function unlockScreen() {
    pdfBlocker.classList.add("d-none");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", blockKeys, true);
}

let pdfRequestInProgress = false;

if (pdfNavItem) {
    pdfNavItem.addEventListener("click", async () => {

        if (!sessionToken) {
            window.location.href = "../login/index.html";
            return;
        }

        if (pdfRequestInProgress) return;   // ignore repeat clicks
        pdfRequestInProgress = true;

        lockScreen();
        pdfError.classList.add("d-none");
        pdfViewer.removeAttribute("src");

        // Give up after 60 seconds so the user is never locked out forever
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const response = await fetch(
                "http://localhost:5000/api/generatePdf",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${sessionToken}`
                    },
                    signal: controller.signal
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);

                throw new Error(
                    errorData?.message ||
                    "Failed to generate PDF."
                );
            }

            const pdfBlob = await response.blob();

            // Free the previous blob URL so memory doesn't pile up
            if (pdfViewer.dataset.blobUrl) {
                URL.revokeObjectURL(pdfViewer.dataset.blobUrl);
            }

            const pdfUrl = URL.createObjectURL(pdfBlob);
            pdfViewer.dataset.blobUrl = pdfUrl;
            pdfViewer.src = pdfUrl;

        } catch (error) {

            console.error("PDF generation error:", error);

            pdfError.textContent =
                error.name === "AbortError"
                    ? "The server took too long to respond. Please try again."
                    : (error.message || "Could not generate PDF.");

            pdfError.classList.remove("d-none");

        } finally {
            clearTimeout(timeoutId);
            pdfRequestInProgress = false;
            unlockScreen();                 // always runs, even on error
        }
    });
}

/*==================================================
        HINDI VIRTUAL KEYBOARD
        On-screen Devanagari keyboard for the "Name (in Hindi)"
        fields (Registration Form + Settings). One shared keyboard
        is attached to whichever field's keyboard button is clicked.
        Fields only accept Devanagari characters and spaces, so
        English letters from a physical keyboard are ignored.
==================================================*/
const HINDI_KB_LAYOUT = [
    { title: "Vowels (स्वर)", keys: ["अ", "आ", "इ", "ई", "उ", "ऊ", "ऋ", "ए", "ऐ", "ओ", "औ", "अं", "अः"] },
    { title: "Vowel signs (मात्राएँ)", matra: true, keys: ["ा", "ि", "ी", "ु", "ू", "ृ", "े", "ै", "ो", "ौ", "ं", "ः", "ँ", "्"] },
    { title: "Consonants (व्यंजन)", keys: [
        "क", "ख", "ग", "घ", "ङ", "च", "छ", "ज", "झ", "ञ",
        "ट", "ठ", "ड", "ढ", "ण", "त", "थ", "द", "ध", "न",
        "प", "फ", "ब", "भ", "म", "य", "र", "ल", "व", "ळ",
        "श", "ष", "स", "ह"
    ] },
    { title: "Conjuncts & nukta", keys: ["क्ष", "त्र", "ज्ञ", "श्र", "ड़", "ढ़"] }
];

const HINDI_ONLY_REGEX = /[^\u0900-\u097F\u200C\u200D ]/g;

let hindiKbEl = null;
let hindiKbTarget = null;
let hindiKbBtn = null;

function hindiKbInsert(text) {
    const input = hindiKbTarget;
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = input.value.slice(0, start) + text + input.value.slice(end);
    if (input.maxLength > 0 && next.length > input.maxLength) return;
    input.value = next;
    input.focus({ preventScroll: true });
    input.setSelectionRange(start + text.length, start + text.length);
    input.dispatchEvent(new Event("input", { bubbles: true }));
}

function hindiKbBackspace() {
    const input = hindiKbTarget;
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    let from = start;
    if (start === end) {
        if (start === 0) return;
        from = start - 1;
    }
    input.value = input.value.slice(0, from) + input.value.slice(end);
    input.focus({ preventScroll: true });
    input.setSelectionRange(from, from);
    input.dispatchEvent(new Event("input", { bubbles: true }));
}

function buildHindiKeyboard() {
    const kb = document.createElement("div");
    kb.className = "hindi-keyboard";
    kb.setAttribute("role", "group");
    kb.setAttribute("aria-label", "Hindi keyboard");

    HINDI_KB_LAYOUT.forEach(section => {
        const title = document.createElement("div");
        title.className = "hk-title";
        title.textContent = section.title;
        kb.appendChild(title);

        const row = document.createElement("div");
        row.className = "hk-row";
        section.keys.forEach(key => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "hk-key";
            btn.dataset.insert = key;
            if (section.matra) {
                btn.innerHTML = '<span class="hk-dotted">◌</span>' + key;
            } else {
                btn.textContent = key;
            }
            row.appendChild(btn);
        });
        kb.appendChild(row);
    });

    const actions = document.createElement("div");
    actions.className = "hk-actions";
    actions.innerHTML =
        '<button type="button" class="hk-key hk-space" data-action="space">Space</button>' +
        '<button type="button" class="hk-key" data-action="backspace" title="Backspace">⌫</button>' +
        '<button type="button" class="hk-key" data-action="clear">Clear</button>' +
        '<button type="button" class="hk-key hk-done" data-action="close">Done</button>';
    kb.appendChild(actions);

    // Keep the caret in the text field while keys are pressed.
    kb.addEventListener("mousedown", e => e.preventDefault());

    kb.addEventListener("click", e => {
        const btn = e.target.closest("button");
        if (!btn) return;
        if (btn.dataset.insert) {
            hindiKbInsert(btn.dataset.insert);
        } else if (btn.dataset.action === "space") {
            hindiKbInsert(" ");
        } else if (btn.dataset.action === "backspace") {
            hindiKbBackspace();
        } else if (btn.dataset.action === "clear") {
            if (hindiKbTarget) {
                hindiKbTarget.value = "";
                hindiKbTarget.dispatchEvent(new Event("input", { bubbles: true }));
                hindiKbTarget.focus({ preventScroll: true });
            }
        } else if (btn.dataset.action === "close") {
            closeHindiKeyboard();
        }
    });

    return kb;
}

function closeHindiKeyboard() {
    if (hindiKbEl && hindiKbEl.parentNode) hindiKbEl.parentNode.removeChild(hindiKbEl);
    if (hindiKbBtn) hindiKbBtn.classList.remove("active");
    hindiKbTarget = null;
    hindiKbBtn = null;
}

function openHindiKeyboard(input, btn) {
    closeHindiKeyboard();
    if (!hindiKbEl) hindiKbEl = buildHindiKeyboard();
    input.closest(".input-group").appendChild(hindiKbEl);
    hindiKbTarget = input;
    hindiKbBtn = btn;
    btn.classList.add("active");
    input.focus({ preventScroll: true });
}

document.querySelectorAll(".hindi-kb-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;
        if (hindiKbTarget === input) {
            closeHindiKeyboard();
        } else {
            openHindiKeyboard(input, btn);
        }
    });
});

// Accept Devanagari only (also covers a Hindi IME / pasted text).
document.querySelectorAll(".hindi-input").forEach(input => {
    input.addEventListener("input", () => {
        const cleaned = input.value.replace(HINDI_ONLY_REGEX, "");
        if (cleaned !== input.value) {
            const pos = (input.selectionStart ?? cleaned.length) - (input.value.length - cleaned.length);
            input.value = cleaned;
            input.setSelectionRange(Math.max(pos, 0), Math.max(pos, 0));
        }
    });
});

// Close when clicking elsewhere or pressing Escape.
document.addEventListener("click", e => {
    if (!hindiKbTarget) return;
    if (hindiKbEl.contains(e.target) || e.target.closest(".hindi-field")) return;
    closeHindiKeyboard();
});
document.addEventListener("keydown", e => {
    if (e.key === "Escape" && hindiKbTarget) closeHindiKeyboard();
});