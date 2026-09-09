const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true", // true for port 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const mailer = getTransporter();

  await mailer.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}

function otpEmailTemplate(otp) {
  return {
    subject: "Your IIEST Shibpur Portal verification code",
    text: `Your verification code is ${otp}. It expires in ${process.env.OTP_EXPIRES_MINUTES || 10} minutes. If you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px;">
        <h2 style="color:#111;margin-bottom:4px;">IIEST Shibpur</h2>
        <p style="color:#555;margin-top:0;">Semester Registration Portal</p>
        <p>Your email verification code is:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#111;">${otp}</p>
        <p style="color:#555;">This code expires in ${process.env.OTP_EXPIRES_MINUTES || 10} minutes. Do not share it with anyone.</p>
        <p style="color:#999;font-size:12px;">If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  };
}

function tempPasswordEmailTemplate(tempPassword) {
  return {
    subject: "Your temporary password - IIEST Shibpur Portal",
    text: `Your temporary password is ${tempPassword}. Please log in and change it as soon as possible.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px;">
        <h2 style="color:#111;margin-bottom:4px;">IIEST Shibpur</h2>
        <p style="color:#555;margin-top:0;">Semester Registration Portal</p>
        <p>A password reset was requested for your account. Your temporary password is:</p>
        <p style="font-size:26px;font-weight:700;letter-spacing:2px;color:#111;">${tempPassword}</p>
        <p style="color:#555;">Please log in with this temporary password and change it right away from your dashboard settings.</p>
        <p style="color:#999;font-size:12px;">If you did not request this, please contact the portal administrator immediately.</p>
      </div>
    `,
  };
}

module.exports = { sendMail, otpEmailTemplate, tempPasswordEmailTemplate };
