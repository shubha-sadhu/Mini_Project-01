const crypto = require("crypto");
const bcrypt = require("bcryptjs");

// 6-digit numeric OTP, e.g. "042871".
function generateOtp() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
}

async function hashOtp(otp) {
  return bcrypt.hash(otp, 10);
}

async function compareOtp(otp, otpHash) {
  return bcrypt.compare(otp, otpHash);
}

// Random temporary password for "forgot password" flow, e.g. "kX7#pQ2!mZ4r".
// Guarantees at least one lowercase, uppercase, digit, and symbol.
function generateTempPassword(length = 12) {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = lower + upper + digits + symbols;

  const pick = (set) => set[crypto.randomInt(0, set.length)];

  let chars = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  while (chars.length < length) {
    chars.push(pick(all));
  }

  // Shuffle so the guaranteed characters aren't always in the same spot.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

module.exports = { generateOtp, hashOtp, compareOtp, generateTempPassword };
