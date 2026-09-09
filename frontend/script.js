/*==================================================
        IIEST SHIBPUR
Semester Registration Portal; SCRIPT.JS
==================================================*/


/*==============================
        API BASE
==============================*/

const API_BASE = "http://localhost:5000/api/auth";


/*==============================
        DOM ELEMENTS
==============================*/

const form = document.querySelector("form");

const emailInput = document.querySelector(".email-group input");

const passwordInput = document.querySelector(".password-group input");

const eyeButton = document.getElementById("togglePassword");

const loginButton = document.querySelector(".login-btn");

const forgotPasswordLink = document.getElementById("forgotPasswordLink");


/*==============================
        SHOW PASSWORD
==============================*/

eyeButton.addEventListener("click", () => {

    if (passwordInput.type === "password") {

        passwordInput.type = "text";

        eyeButton.classList.remove("fa-eye");
        eyeButton.classList.add("fa-eye-slash");

    } else {

        passwordInput.type = "password";

        eyeButton.classList.remove("fa-eye-slash");
        eyeButton.classList.add("fa-eye");

    }

});


/*==============================
        EMAIL VALIDATION
==============================*/

function isValidEmail(email){

    const regex =
    /^[a-zA-Z0-9._%+-]+@students\.iiests\.ac\.in$/;

    return regex.test(email);

}


/*==============================
        LOGIN
==============================*/

form.addEventListener("submit",(e)=>{

    e.preventDefault();

    const email=emailInput.value.trim();

    const password=passwordInput.value.trim();


    if(email===""){

        alert("Please enter your email.");

        emailInput.focus();

        return;

    }


    if(!isValidEmail(email)){

        alert("Please enter a valid email.");

        emailInput.focus();

        return;

    }


    if(password===""){

        alert("Please enter your password.");

        passwordInput.focus();

        return;

    }


    loginButton.disabled=true;

    loginButton.innerHTML="Signing In...";


    fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    })
        .then(async (res) => {

            const data = await res.json();

            loginButton.innerHTML = "Login";
            loginButton.disabled = false;

            if (!res.ok) {

                alert(data.error || "Could not log in. Please try again.");

                return;

            }

            // Keep the session token around for later authenticated
            // requests (e.g. fetching the student's dashboard).
            sessionStorage.setItem("sessionToken", data.sessionToken);

            // Dashboard reads this on load to greet the student instantly,
            // before its own fetch("/api/auth/me") call resolves.
            sessionStorage.setItem("cachedUser", JSON.stringify(data.user));

            // Send the student straight to their dashboard instead of
            // making them click through an alert.
            window.location.href = "dashboard.html";

        })
        .catch(() => {

            loginButton.innerHTML = "Login";
            loginButton.disabled = false;

            alert("Network error. Is the backend running?");

        });

});


/*==============================
        FORGOT PASSWORD
==============================*/

forgotPasswordLink.addEventListener("click", (e) => {

    e.preventDefault();

    const email = emailInput.value.trim();

    if (email === "" || !isValidEmail(email)) {

        alert("Enter your registered email above first, then click \"Forgot Password?\".");

        emailInput.focus();

        return;

    }

    if (!confirm("Send a new password to " + email + "?")) {

        return;

    }

    fetch(`${API_BASE}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    })
        .then(async (res) => {

            const data = await res.json();

            alert(data.message || "If that email is registered, a new password has been sent to it.");

        })
        .catch(() => {

            alert("Network error. Is the backend running?");

        });

});


/*==============================
        INPUT EFFECT
==============================*/

const groups=document.querySelectorAll(

".email-group,.password-group"

);

groups.forEach(group=>{

    const input=group.querySelector("input");

    input.addEventListener("focus",()=>{

        group.style.transform="translateY(-2px)";

    });

    input.addEventListener("blur",()=>{

        group.style.transform="translateY(0)";

    });

});


/*==============================
        ENTER KEY
==============================*/

document.addEventListener("keydown",(e)=>{

    if(e.key==="Enter"){

        loginButton.click();

    }

});


/*==============================
        ACTIVE MENU
==============================*/

const nav=document.querySelectorAll(".top-menu a");

nav.forEach(item=>{

    item.addEventListener("click",(e)=>{

        e.preventDefault();

        nav.forEach(link=>{

            link.classList.remove("active");

        });

        item.classList.add("active");

    });

});


/*==============================
        PAGE LOADED
==============================*/

window.addEventListener("load",()=>{

    console.log("IIEST Portal Loaded");

});