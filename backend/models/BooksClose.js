import mongoose from "mongoose"

const booksCloseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    closedUpTo: {
      type: String, // Stored as YYYY-MM-DD
      required: true,
      index: true,
    },
    systemCash: {
      type: Number,
      required: true,
    },
    systemBank: {
      type: Number,
      required: true,
    },
    countedCash: {
      type: Number,
      required: true,
    },
    difference: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "reopened"],
      default: "active",
      index: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxLength: 500,
    },
    adjustmentEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CashEntry",
      default: null,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reopenedAt: {
      type: Date,
      default: null,
    },
    reopenedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reopenReason: {
      type: String,
      default: "",
      trim: true,
      maxLength: 500,
    },
  },
  { timestamps: true },
)

booksCloseSchema.index({ userId: 1, closedUpTo: -1, status: 1 })

export default mongoose.model("BooksClose", booksCloseSchema)
