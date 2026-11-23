import mongoose from "mongoose"

const cashBookSetupSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    cashOpening: {
      type: Number,
      default: 0,
      min: 0,
    },
    bankOpening: {
      type: Number,
      default: 0,
      min: 0,
    },
    asOfDate: {
      type: String,
      required: true,
      default: "2026-01-01",
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxLength: 300,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
)

export default mongoose.model("CashBookSetup", cashBookSetupSchema)
