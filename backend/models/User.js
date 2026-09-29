import mongoose from "mongoose"

const userSchema = new mongoose.Schema(
  {
    userName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "admin" },
    twoFactorSecret: { type: String, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    recovery2FAToken: String,
    recovery2FAExpires: Date,
    dailyResetAttempts: { type: Number, default: 0 },
    lastResetAttemptDate: { type: Date, default: null },
    companyName: { type: String, default: "Yatra Tours" },
    companyTagline: { type: String, default: "Tourism & Travels" },
    companyHeadquarters: { type: String, default: "" },
    companyPhone: { type: String, default: "" },
    companyLogo: { type: String, default: "" },
    gstNumber: { type: String, default: "" },
    invoicePrefix: { type: String, default: "YHB" },
    receiptPrefix: { type: String, default: "REC" },
    invoiceTheme: {
      type: String,
      enum: ["classic", "modern", "minimal"],
      default: "classic",
    },
    invoiceColor: { type: String, default: "#4f46e5" },
    termsAndConditions: {
      type: [String],
      default: [
        "Valid Aadhar card is strictly required for all travelers.",
        "Advance payment is non-refundable upon confirmation.",
        "Final balance must be settled 24 hours prior to departure.",
        "Company is not liable for itinerary changes due to weather.",
      ],
    },
    bankDetails: {
      accountName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifscCode: { type: String, default: "" },
      bankName: { type: String, default: "" },
      upiId: { type: String, default: "" },
    },
    organizers: [
      {
        name: { type: String, required: true },
        phone: { type: String, required: true },
      },
    ],
    activeTokens: [
      {
        token: String,
        tokenId: String,
        createdAt: { type: Date, default: Date.now },
        expiresAt: Date,
      },
    ],
  },
  { timestamps: true },
)

export default mongoose.model("User", userSchema)
