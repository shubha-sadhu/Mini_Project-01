const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const User = require("../models/User");
const Otp = require("../models/Otp");
const { requireAuth } = require("../middleware/auth_middle");
const { sendMail, otpEmailTemplate, tempPasswordEmailTemplate } = require("../utils/mailer");
const { generateOtp, hashOtp, compareOtp, generateTempPassword } = require("../utils/otp");
const { isEnrolledStudent, NOT_ENROLLED_MESSAGE } = require("../services/enrollmentCheckService");

const router = express.Router();

/* ==============================
      HELPERS
============================== */

function getAllowedDomain() {
  return (process.env.ALLOWED_EMAIL_DOMAIN || "students.iiests.ac.in").toLowerCase();
}

function isInstituteEmail(email) {
  const domain = getAllowedDomain();
  return typeof email === "string" && email.toLowerCase().endsWith("@" + domain);
}

function isValidEmailShape(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function signVerificationToken(email) {
  return jwt.sign({ email, purpose: "signup" }, process.env.JWT_VERIFICATION_SECRET, {
    expiresIn: process.env.VERIFICATION_TOKEN_EXPIRES_IN || "15m",
  });
}

function signSessionToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SESSION_SECRET, {
    expiresIn: process.env.SESSION_TOKEN_EXPIRES_IN || "7d",
  });
}

function signAdminSessionToken() {
  return jwt.sign({ sub: "admin", role: "admin" }, process.env.JWT_SESSION_SECRET, {
    expiresIn: process.env.SESSION_TOKEN_EXPIRES_IN || "7d",
  });
}

// Generic rate limiter for the sensitive, email-sending endpoints so the
// app can't be used to spam OTPs / reset emails at someone's inbox.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a while before trying again." },
});

/* ==============================
      STEP 1: SEND OTP (SIGNUP)
============================== */

router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!isValidEmailShape(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    if (!isInstituteEmail(email)) {
      return res.status(400).json({
        error: `Please sign up using your official @${getAllowedDomain()} email address.`,
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "An account with this email already exists. Please log in instead." });
    }

    // Only students who are in the college records may sign up. Checked before the
    // OTP is created or any e-mail is sent.
    if (!(await isEnrolledStudent(email))) {
      return res.status(403).json({ error: NOT_ENROLLED_MESSAGE });
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + Number(process.env.OTP_EXPIRES_MINUTES || 10) * 60 * 1000);

    // Replace any previous pending OTP for this email/purpose.
    await Otp.deleteMany({ email, purpose: "signup" });
    await Otp.create({ email, otpHash, purpose: "signup", expiresAt });

    const { subject, text, html } = otpEmailTemplate(otp);
    await sendMail({ to: email, subject, text, html });

    return res.json({ message: "OTP sent to your email." });
  } catch (err) {
    console.error("send-otp error:", err);
    return res.status(500).json({ error: "Could not send OTP right now. Please try again shortly." });
  }
});

/* ==============================
      STEP 2: VERIFY OTP
============================== */
router.post("/verify-otp", async (req, res) => {
  try {
    const { otp } = req.body;
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required." });
    }

    // 1. Find the OTP record
    const otpRecord = await mongoose.model("Otp").findOne({ email }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ error: "OTP expired or not found. Please request a new one." });
    }

    // 2. Check max attempts (Optional, if you have this field in your schema)
    if (otpRecord.attempts >= 5) {
      await mongoose.model("Otp").deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ error: "Too many failed attempts. Please request a new OTP." });
    }

    // 3. Verify the OTP
    const isMatch = await bcrypt.compare(String(otp), otpRecord.otpHash);
    if (!isMatch) {
      otpRecord.attempts = (otpRecord.attempts || 0) + 1;
      await otpRecord.save();
      return res.status(400).json({ error: "Incorrect OTP. Please try again." });
    }

    // 4. Generate the Verification Token (This is usually where it crashes!)
    const jwt = require("jsonwebtoken"); // Ensure jwt is required
    const secret = process.env.JWT_VERIFICATION_SECRET || "fallback_secret_key_123"; // Fallback prevents crash
    
    const verificationToken = jwt.sign(
      { email, purpose: "signup" },
      secret,
      { expiresIn: "15m" }
    );

    // 5. Clean up the used OTP
    await mongoose.model("Otp").deleteOne({ _id: otpRecord._id });

    // 6. Send success response
    return res.json({ 
      message: "Email verified successfully.", 
      verificationToken 
    });

  } catch (err) {
    console.error("verify-otp error:", err);
    return res.status(500).json({ error: "Internal server error during verification." });
  }
});

/* ==============================
      STEP 3: REGISTER
============================== */
router.post("/register", async (req, res) => {
  try {
    const { password, confirmPassword, verificationToken } = req.body;
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!verificationToken) {
      return res.status(400).json({ error: "Email verification is required before registering." });
    }

    let payload;
    try {
      payload = jwt.verify(verificationToken, process.env.JWT_VERIFICATION_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Verification expired. Please verify your email again." });
    }

    if (payload.purpose !== "signup" || payload.email !== email) {
      return res.status(401).json({ error: "Verification does not match this email. Please verify again." });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "An account with this email already exists. Please log in instead." });
    }

    // Checked again here so an account can never be created for someone who is not in
    // the college records, even with a verification token issued earlier.
    if (!(await isEnrolledStudent(email))) {
      return res.status(403).json({ error: NOT_ENROLLED_MESSAGE });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Save strictly the auth data
    await User.create({
      email,
      passwordHash,
      isEmailVerified: true,
    });

    return res.status(201).json({ message: "Account created successfully." });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "An account with this email already exists. Please log in instead." });
    }
    console.error("register error:", err);
    return res.status(500).json({ error: "Could not create your account right now. Please try again." });
  }
});

/* ==============================
      LOGIN
============================== */

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    // Same login form, no separate admin username: if the password
    // matches the admin secret (hashed in .env, never in source), this
    // becomes an admin session regardless of whether the email belongs
    // to a real student account. Checked first, before the normal
    // student lookup below.
    if (process.env.ADMIN_PASSWORD_HASH) {
      const isAdminPassword = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);

      if (isAdminPassword) {
        const sessionToken = signAdminSessionToken();

        return res.json({
          message: "Admin login successful.",
          sessionToken,
          isAdmin: true,
          user: { email, fullname: "Administrator" },
        });
      }
    }

    const user = await User.findOne({ email });

    // Same generic error whether the email doesn't exist or the password
    // is wrong, so we don't leak which emails are registered.
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const sessionToken = signSessionToken(user._id.toString());

    return res.json({
      message: "Login successful.",
      sessionToken,
      isAdmin: false,
      user: {
        id: user._id,
        email: user.email,
        fullname: user.fullname,
        mobile: user.mobile,
      },
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Could not log in right now. Please try again." });
  }
});

/* ==============================
      FORGOT PASSWORD
============================== */

router.post("/forgot-password", otpLimiter, async (req, res) => {
  const genericMessage = "If that email is registered, a new password has been sent to it.";

  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!isValidEmailShape(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const user = await User.findOne({ email });

    // Always respond with the same generic message, whether or not the
    // account exists, so the endpoint can't be used to enumerate emails.
    if (!user) {
      return res.json({ message: genericMessage });
    }

    const tempPassword = generateTempPassword();
    user.passwordHash = await bcrypt.hash(tempPassword, 10);
    user.mustChangePassword = true;
    await user.save();

    const { subject, text, html } = tempPasswordEmailTemplate(tempPassword);
    await sendMail({ to: email, subject, text, html });

    return res.json({ message: genericMessage });
  } catch (err) {
    console.error("forgot-password error:", err);
    // Still return the generic message on unexpected errors to avoid
    // leaking account existence, but log server-side for debugging.
    return res.json({ message: genericMessage });
  }
});

/* ==============================
      CURRENT USER PROFILE
============================== */

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json({ user });
  } catch (err) {
    console.error("me error:", err);
    return res.status(500).json({ error: "Could not load your profile right now." });
  }
});

/* ==============================
      CHANGE PASSWORD (LOGGED IN)
============================== */

router.put("/change-password", requireAuth, async (req, res) => {
  try {
    // The admin session has no database record, so there is nothing to update.
    if (req.user && req.user.role === "admin") {
      return res.status(403).json({ error: "The admin password cannot be changed from here." });
    }

    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters long." });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ error: "New password must be different from your current password." });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      // 400 (not 401) so the frontend doesn't treat this as an expired session.
      return res.status(400).json({ error: "Current password is incorrect." });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await user.save();

    return res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("change-password error:", err);
    return res.status(500).json({ error: "Could not update your password right now. Please try again." });
  }
});

module.exports = router;