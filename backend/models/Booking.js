import mongoose from "mongoose"

const bookingSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
    tourName: { type: String, required: true },
    journeyDate: { type: Date, required: true },
    duration: { type: String },
    busType: { type: String },
    contactName: { type: String, required: true },
    contactPhone: { type: String, required: true },
    contactEmail: { type: String },
    paymentMode: { type: String, default: "Cash" },
    totalAmount: { type: Number, required: true },
    advanceReceived: { type: Number, default: 0 },
    isPaid: { type: Boolean, default: false },
    passengers: [
      {
        name: { type: String, required: true },
        age: { type: Number, required: true },
        gender: { type: String, required: true },
        city: { type: String, required: true },
        seatId: { type: String },
        contact: { type: String },
        aadhar: { type: String },
        checkedIn: { type: Boolean, default: false },
      },
    ],
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
)

export default mongoose.model("Booking", bookingSchema)
