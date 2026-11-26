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
      enum: ["Cash", "UPI", "Card", "Net Banking", "Cheque", "Other"],
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
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "BookingGroup", default: null },
    groupPaymentId: { type: String, default: null },
    passengerSeatId: { type: String, default: "" },
    externalRef: { type: String, default: null, trim: true },
  },
  { timestamps: true }
)

// Receipt numbers must be unique per user
paymentSchema.index({ userId: 1, receiptNo: 1 }, { unique: true })
paymentSchema.index({ userId: 1, bookingId: 1 })
paymentSchema.index({ userId: 1, groupId: 1 })
paymentSchema.index({ userId: 1, groupPaymentId: 1 })
paymentSchema.index({ userId: 1, externalRef: 1 }, { sparse: true })

export default mongoose.model("Payment", paymentSchema)
