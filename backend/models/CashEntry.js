import mongoose from "mongoose"
import { MANUAL_ENTRY_TYPES, ACCOUNTS } from "../../shared/cashbook.js"

const cashEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: MANUAL_ENTRY_TYPES,
    },
    account: {
      type: String,
      required: true,
      enum: ACCOUNTS,
      default: "cash",
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than zero"],
      max: [10000000, "Amount cannot exceed ₹10,000,000"],
    },
    direction: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    voucherNo: {
      type: String,
      default: "",
      trim: true,
      maxLength: 60,
    },
    referenceNo: {
      type: String,
      default: "",
      trim: true,
      maxLength: 80,
    },
    partyName: {
      type: String,
      default: "",
      trim: true,
      maxLength: 100,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxLength: 300,
    },
    isAutoAdjustment: {
      type: Boolean,
      default: false,
    },
    closeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BooksClose",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
)

cashEntrySchema.index({ userId: 1, date: -1 })
cashEntrySchema.index({ userId: 1, deletedAt: 1 })

export default mongoose.model("CashEntry", cashEntrySchema)
