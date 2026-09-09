/*IIEST SHIBPUR
Semester Registration Portal; SIGNUP.JS*/


/*API BASE*/

const API_BASE = "http://localhost:5000/api/auth";


/*DOM ELEMENTS*/

const signupForm = document.getElementById("signup-form");

const emailInput = document.getElementById("email");
const generateOtpBtn = document.getElementById("generate-otp-btn");

const otpInput = document.getElementById("otp");
const verifyOtpBtn = document.getElementById("verify-otp-btn");
const otpStatus = document.getElementById("otp-status");

const lockedGroups = [
    document.getElementById("password-group"),
    document.getElementById("confirm-password-group"),
    document.getElementById("fullname-group"),
    document.getElementById("mobile-group"),
];

const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirm-password");
const fullnameInput = document.getElementById("fullname");
const mobileInput = document.getElementById("mobile");
const submitBtn = document.getElementById("submit-btn");

const passwordIcon = document.getElementById("password-icon");
const confirmPasswordIcon = document.getElementById("confirm-password-icon");

const successModal = document.getElementById("success-modal");

let verificationToken = null; // set once /verify-otp succeeds; required by /register
let otpVerified = false;


/*EMAIL VALIDATION*/

function isValidEmail(email) {

    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return regex.test(email);

}


/*STEP 1: GENERATE OTP*/

generateOtpBtn.addEventListener("click", async () => {

    const email = emailInput.value.trim();

    if (!isValidEmail(email)) {

        otpStatus.textContent = "Enter a valid email first.";
        otpStatus.className = "otp-status otp-status--error";

        emailInput.focus();

        return;

    }

    generateOtpBtn.disabled = true;
    generateOtpBtn.textContent = "Sending...";
    otpStatus.textContent = "";
    otpStatus.className = "otp-status";

    try {

        const res = await fetch(`${API_BASE}/send-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });

        const data = await res.json();

        if (!res.ok) {

            otpStatus.textContent = data.error || "Could not send OTP.";
            otpStatus.className = "otp-status otp-status--error";

            generateOtpBtn.disabled = false;
            generateOtpBtn.textContent = "Generate OTP";

            return;

        }

        otpInput.disabled = false;
        verifyOtpBtn.disabled = false;
        otpInput.focus();

        generateOtpBtn.textContent = "Resend OTP";
        generateOtpBtn.disabled = false;

        otpStatus.textContent = "OTP sent to " + email + ".";
        otpStatus.className = "otp-status";

    } catch (err) {

        otpStatus.textContent = "Network error. Is the backend running?";
        otpStatus.className = "otp-status otp-status--error";

        generateOtpBtn.disabled = false;
        generateOtpBtn.textContent = "Generate OTP";

    }

});


/*STEP 2: VERIFY OTP*/

verifyOtpBtn.addEventListener("click", async () => {

    const enteredOtp = otpInput.value.trim();

    if (!enteredOtp) {

        otpStatus.textContent = "Enter the OTP you received.";
        otpStatus.className = "otp-status otp-status--error";

        return;

    }

    verifyOtpBtn.disabled = true;
    verifyOtpBtn.textContent = "Verifying...";

    try {

        const res = await fetch(`${API_BASE}/verify-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailInput.value.trim(), otp: enteredOtp }),
        });

        const data = await res.json();

        verifyOtpBtn.textContent = "Verify";

        if (!res.ok) {

            otpStatus.textContent = data.error || "Incorrect OTP. Please try again.";
            otpStatus.className = "otp-status otp-status--error";

            verifyOtpBtn.disabled = false;

            return;

        }

        // Unlock the rest of the form 

        verificationToken = data.verificationToken;
        otpVerified = true;

        otpStatus.textContent = "Email verified.";
        otpStatus.className = "otp-status otp-status--success";

        otpInput.disabled = true;
        verifyOtpBtn.disabled = true;
        generateOtpBtn.disabled = true;
        emailInput.disabled = true;

        lockedGroups.forEach((group) => group.classList.remove("locked-group"));

        [passwordInput, confirmPasswordInput, fullnameInput, mobileInput].forEach(
            (input) => (input.disabled = false)
        );

        submitBtn.disabled = false;

        // Swap the lock icons for real show/hide password toggles now
        // that the fields are usable.
        enablePasswordToggle(passwordInput, passwordIcon);
        enablePasswordToggle(confirmPasswordInput, confirmPasswordIcon);

        fullnameInput.focus();

    } catch (err) {

        otpStatus.textContent = "Network error. Is the backend running?";
        otpStatus.className = "otp-status otp-status--error";

        verifyOtpBtn.disabled = false;
        verifyOtpBtn.textContent = "Verify";

    }

});


/*SHOW / HIDE PASSWORD
  (only active once a field is unlocked)*/

function enablePasswordToggle(input, icon) {

    icon.classList.remove("fa-lock");
    icon.classList.add("fa-eye");

    icon.addEventListener("click", () => {

        if (input.type === "password") {

            input.type = "text";

            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");

        } else {

            input.type = "password";

            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");

        }

    });

}


/*STEP 3: SUBMIT REGISTRATION*/

signupForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    if (!otpVerified) return; // shouldn't happen since fields are locked, but just in case

    if (passwordInput.value.length < 6) {

        otpStatus.textContent = "Password must be at least 6 characters.";
        otpStatus.className = "otp-status otp-status--error";

        passwordInput.focus();

        return;

    }

    if (passwordInput.value !== confirmPasswordInput.value) {

        otpStatus.textContent = "Passwords do not match.";
        otpStatus.className = "otp-status otp-status--error";

        confirmPasswordInput.focus();

        return;

    }

    if (fullnameInput.value.trim() === "") {

        otpStatus.textContent = "Enter your full name.";
        otpStatus.className = "otp-status otp-status--error";

        fullnameInput.focus();

        return;

    }

    if (!/^\d{10}$/.test(mobileInput.value.trim())) {

        otpStatus.textContent = "Enter a valid 10-digit mobile number.";
        otpStatus.className = "otp-status otp-status--error";

        mobileInput.focus();

        return;

    }

    const payload = {
        email: emailInput.value.trim(),
        password: passwordInput.value,
        confirmPassword: confirmPasswordInput.value,
        fullname: fullnameInput.value.trim(),
        mobile: mobileInput.value.trim(),
        verificationToken,
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {

        const res = await fetch(`${API_BASE}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await res.json();

        submitBtn.textContent = "Submit";

        if (!res.ok) {

            otpStatus.textContent = data.error || "Could not register. Please try again.";
            otpStatus.className = "otp-status otp-status--error";

            submitBtn.disabled = false;

            return;

        }

        successModal.hidden = false;

    } catch (err) {

        otpStatus.textContent = "Network error. Is the backend running?";
        otpStatus.className = "otp-status otp-status--error";

        submitBtn.textContent = "Submit";
        submitBtn.disabled = false;

    }

});


/*INPUT LIFT EFFECT
 (same touch as the login page's script.js)*/

const groups = document.querySelectorAll(

    ".email-group, .password-group"

);

groups.forEach(group => {

    const input = group.querySelector("input");

    input.addEventListener("focus", () => {

        group.style.transform = "translateY(-2px)";

    });

    input.addEventListener("blur", () => {

        group.style.transform = "translateY(0)";

    });

});


/*ACTIVE MENU*/

const nav = document.querySelectorAll(".top-menu a");

nav.forEach(item => {

    item.addEventListener("click", (e) => {

        if (item.getAttribute("href") === "#") {

            e.preventDefault();

        }

        nav.forEach(link => {

            link.classList.remove("active");

        });

        item.classList.add("active");

    });

});


/*PAGE LOADED*/

window.addEventListener("load", () => {

    console.log("IIEST Signup Page Loaded");

});
