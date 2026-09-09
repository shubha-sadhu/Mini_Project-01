const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // We only ever store a hash of the OTP, never the plaintext code.
    otpHash: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ["signup"],
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// MongoDB TTL index: documents are automatically deleted once expiresAt
// has passed, so expired OTPs don't pile up in the database.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", otpSchema);
