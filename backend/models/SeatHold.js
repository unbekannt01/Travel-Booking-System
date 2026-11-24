import mongoose from "mongoose"

const seatHoldSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tourName: {
      type: String,
      required: true,
      trim: true,
    },
    journeyDate: {
      type: Date,
      required: true,
    },
    busType: {
      type: String,
      default: "",
      trim: true,
    },
    seatLayoutKey: {
      type: String,
      default: null,
    },
    seatIds: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0
        },
        message: "At least one seat ID is required for a seat hold.",
      },
    },
    mode: {
      type: String,
      required: true,
      enum: ["timed", "manual"],
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    kind: {
      type: String,
      default: "hold",
      enum: ["hold", "block"],
    },
    holderName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 20,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    status: {
      type: String,
      default: "active",
      enum: ["active", "released", "converted"],
    },
    releasedAt: {
      type: Date,
      default: null,
    },
    convertedBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
  },
  { timestamps: true },
)

// Efficient compound query indexes for departure scoped conflict checks
seatHoldSchema.index({ userId: 1, tourName: 1, journeyDate: 1, busType: 1, status: 1 })
seatHoldSchema.index({ userId: 1, status: 1, expiresAt: 1 })

/**
 * Returns true if this hold is currently effective:
 * status is "active" AND (mode is "manual" OR expiresAt is in the future).
 * Expired timed holds are computed as non-effective without background jobs.
 */
seatHoldSchema.methods.isEffective = function () {
  if (this.status !== "active") return false
  if (this.mode === "manual") return true
  if (!this.expiresAt) return false
  return new Date(this.expiresAt) > new Date()
}

export default mongoose.model("SeatHold", seatHoldSchema)
