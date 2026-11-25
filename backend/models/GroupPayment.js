import mongoose from "mongoose"

const groupPaymentAllocationSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
  receiptNo: { type: String, default: "" },
  amount: { type: Number, required: true },
  amountPaise: { type: Number, required: true },
})

const groupPaymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "BookingGroup", required: true },
    groupPaymentId: { type: String, required: true },
    idempotencyKey: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    totalPaise: { type: Number, required: true },
    date: { type: Date, required: true, default: Date.now },
    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Card", "Net Banking", "Cheque"],
      default: "Cash",
    },
    referenceNo: { type: String, default: "" },
    notes: { type: String, default: "" },
    allocations: [groupPaymentAllocationSchema],
    status: {
      type: String,
      enum: ["recorded", "undone", "partial", "failed"],
      default: "recorded",
    },
    recordedBy: { type: String, default: "" },
    undoneAt: { type: Date, default: null },
    undoneBy: { type: String, default: "" },
  },
  { timestamps: true }
)

groupPaymentSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true })
groupPaymentSchema.index({ userId: 1, groupId: 1 })
groupPaymentSchema.index({ userId: 1, groupPaymentId: 1 })

export default mongoose.model("GroupPayment", groupPaymentSchema)
