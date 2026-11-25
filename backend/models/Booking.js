import mongoose from "mongoose"
import { isValidBusType, STANDARD_BUS_TYPES } from "../../shared/seatLayouts.js"

const passengerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, required: true, min: 1 },
  gender: { type: String, required: true },
  city: { type: String, required: true },
  seatId: { type: String },
  contact: { type: String },
  pickupPoint: { type: String, default: "" },
  pickupTime: { type: String, default: "" },
  aadhar: { type: String },
  aadharEncrypted: { type: Boolean, default: false },
  checkedIn: { type: Boolean, default: false },
})

const paymentRecordSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 1 },
  date: { type: Date, default: Date.now },
  mode: { type: String, default: "Cash" },
  notes: { type: String, default: "" },
  recordedBy: { type: String, default: "" },
})

const bookingSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true },
    date: { type: Date, required: true, default: Date.now },
    tourName: { type: String, required: true },
    journeyDate: { type: Date, required: true },
    duration: { type: String },
    busType: {
      type: String,
      validate: {
        validator: function (v) {
          if (v === null || v === undefined || v === "") return true
          return isValidBusType(v)
        },
        message: (props) => `Invalid bus type '${props.value}'. Allowed types: ${STANDARD_BUS_TYPES.join(", ")}`,
      },
    },
    seatLayoutKey: { type: String, default: null },
    contactName: { type: String, required: true },
    contactPhone: { type: String, required: true },
    contactEmail: { type: String },
    pickupPoint: { type: String, default: "" },
    pickupTime: { type: String, default: "" },
    dropPoint: { type: String, default: "" },
    paymentMode: { type: String, default: "Cash" },
    totalAmount: { type: Number, required: true, min: 0 },
    advanceReceived: { type: Number, default: 0, min: 0 },
    isPaid: { type: Boolean, default: false },
    status: {
      type: String,
      default: "Confirmed",
      enum: ["Confirmed", "Cancelled"],
    },
    cancellationReason: { type: String, default: "" },
    cancelledAt: { type: Date, default: null },
    cancellationCharge: { type: Number, default: 0, min: 0 },
    refundAmount: { type: Number, default: 0, min: 0 },
    refundPaymentMode: { type: String, default: "Cash" },
    discount: { type: Number, default: 0, min: 0 },
    discountType: { type: String, default: "fixed", enum: ["fixed", "percentage"] },
    gstRate: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    isTaxInclusive: { type: Boolean, default: false },
    payments: [paymentRecordSchema],
    passengers: [passengerSchema],
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "BookingGroup", default: null },
    groupName: { type: String, trim: true, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

// Ensure invoiceNo is unique per user (not globally)
bookingSchema.index({ userId: 1, invoiceNo: 1 }, { unique: true })
bookingSchema.index({ userId: 1, deletedAt: 1 })
bookingSchema.index({ userId: 1, customerId: 1 })
bookingSchema.index({ userId: 1, groupId: 1 })

export default mongoose.model("Booking", bookingSchema)
