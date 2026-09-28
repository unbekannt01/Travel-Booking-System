import mongoose from "mongoose"

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    receiptNo: { type: String, required: true },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ["advance", "balance", "partial", "refund"],
      default: "partial",
    },
    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Card", "Net Banking", "Cheque"],
      default: "Cash",
    },
    paymentDate: { type: Date, default: Date.now },
    referenceNo: { type: String, default: "" },
    notes: { type: String, default: "" },
    recordedBy: { type: String, default: "" },
    isVoid: { type: Boolean, default: false },
    voidReason: { type: String, default: "" },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: String, default: "" },
  },
  { timestamps: true }
)

// Receipt numbers must be unique per user
paymentSchema.index({ userId: 1, receiptNo: 1 }, { unique: true })
paymentSchema.index({ userId: 1, bookingId: 1 })

export default mongoose.model("Payment", paymentSchema)
