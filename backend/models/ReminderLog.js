import mongoose from "mongoose"
import { REMINDER_LANGUAGES, REMINDER_TONES } from "../../shared/reminders.js"

const reminderLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    bookingIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Booking" }],
      default: [],
      validate: [
        (val) => Array.isArray(val) && val.length <= 20,
        "Cannot exceed 20 booking IDs per reminder log",
      ],
    },
    tone: {
      type: String,
      enum: REMINDER_TONES,
      required: true,
    },
    language: {
      type: String,
      enum: REMINDER_LANGUAGES,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    templateSource: {
      type: String,
      enum: ["default", "custom"],
      required: true,
    },
    status: {
      type: String,
      enum: ["opened", "sent"],
      default: "opened",
    },
    openedAt: {
      type: Date,
      default: Date.now,
    },
    markedSentAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
)

// TTL index: 400 days on createdAt (SEC-PRIVACY)
reminderLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 400 * 24 * 60 * 60 })

// Compound indexes for history queries & outstanding aggregation
reminderLogSchema.index({ userId: 1, customerId: 1, openedAt: -1 })
reminderLogSchema.index({ userId: 1, createdAt: -1 })

export default mongoose.model("ReminderLog", reminderLogSchema)
