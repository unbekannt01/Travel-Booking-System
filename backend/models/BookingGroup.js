import mongoose from "mongoose"

const bookingGroupSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    leaderName: { type: String, trim: true, default: "" },
    leaderPhone: { type: String, trim: true, default: "" },
    tourName: { type: String, required: true },
    journeyDate: { type: Date, required: true },
    busType: { type: String, required: true },
    note: { type: String, maxlength: 200, default: "" },
    discount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["active", "disbanded"],
      default: "active",
    },
  },
  { timestamps: true }
)

bookingGroupSchema.index({ userId: 1, tourName: 1, journeyDate: 1, busType: 1, status: 1 })
bookingGroupSchema.index({ userId: 1, status: 1 })

export default mongoose.model("BookingGroup", bookingGroupSchema)
