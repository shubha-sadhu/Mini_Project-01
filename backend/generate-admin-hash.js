/*
  Usage:
    node generate-admin-hash.js "Your$Chosen-Complicated-Password123!"

  Prints a bcrypt hash to paste into backend/.env as:
    ADMIN_PASSWORD_HASH=<the printed hash>

  Run this locally — never share the plaintext password with anyone,
  including in chat, commits, or issue trackers. Only the hash goes
  into .env, and .env should never be committed to version control.
*/

const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password) {
  console.error("Usage: node generate-admin-hash.js \"YourComplicatedPassword\"");
  process.exit(1);
}

if (password.length < 12) {
  console.warn("Warning: this is a single shared master password protecting admin access — use a long, random, complicated one (12+ characters, mixed case, numbers, symbols).");
}

bcrypt.hash(password, 12).then((hash) => {
  console.log("\nAdd this line to backend/.env:\n");
  console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
});
