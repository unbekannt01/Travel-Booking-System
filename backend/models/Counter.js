import mongoose from "mongoose"

const counterSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    prefix: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
)

counterSchema.index({ userId: 1, prefix: 1 }, { unique: true })

export default mongoose.model("Counter", counterSchema)
