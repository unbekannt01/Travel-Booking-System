import mongoose from "mongoose"

const emailTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  purpose: {
    type: String,
    enum: ["password-reset", "2fa-recovery"],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600, // Token automatically expires in 1 hour
  },
})

const EmailToken = mongoose.model("EmailToken", emailTokenSchema)
export default EmailToken
