import mongoose from "mongoose"

const userSchema = new mongoose.Schema(
  {
    userName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "admin" },
    twoFactorSecret: { type: String, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
    companyName: { type: String, default: "Xyz Tourism" },
    companyTagline: { type: String, default: "Tourism & Travels" },
    companyHeadquarters: { type: String, default: "City, State, Pincode" },
    companyPhone: { type: String, default: "+91 98765 43210" },
    companyLogo: { type: String, default: "" },
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
