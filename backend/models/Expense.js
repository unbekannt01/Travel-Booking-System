import mongoose from "mongoose"
import { EXPENSE_CATEGORY_IDS, EXPENSE_PAYMENT_MODE_IDS } from "../../shared/expenses.js"

const expenseSchema = new mongoose.Schema(
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
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than zero"],
      max: [10000000, "Amount cannot exceed ₹10,000,000"],
    },
    category: {
      type: String,
      required: true,
      enum: EXPENSE_CATEGORY_IDS,
    },
    tourRef: {
      type: String,
      default: null,
      trim: true,
    },
    tourLabel: {
      type: String,
      default: "",
      trim: true,
      maxLength: 100,
    },
    vendor: {
      type: String,
      default: "",
      trim: true,
      maxLength: 80,
    },
    paymentMode: {
      type: String,
      required: true,
      enum: EXPENSE_PAYMENT_MODE_IDS,
      default: "cash",
    },
    status: {
      type: String,
      required: true,
      enum: ["paid", "pending"],
      default: "paid",
    },
    paidOn: {
      type: Date,
      default: null,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxLength: 300,
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

// Compound indexes for performant querying and filtering
expenseSchema.index({ userId: 1, date: -1 })
expenseSchema.index({ userId: 1, category: 1, date: -1 })
expenseSchema.index({ userId: 1, tourRef: 1, date: -1 })
expenseSchema.index({ userId: 1, deletedAt: 1, date: -1 })

export default mongoose.model("Expense", expenseSchema)
