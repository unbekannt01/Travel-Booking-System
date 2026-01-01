import mongoose from "mongoose"

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "admin" },
    twoFactorSecret: { type: String, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
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
