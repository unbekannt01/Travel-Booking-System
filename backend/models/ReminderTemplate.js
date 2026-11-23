import mongoose from "mongoose"
import { REMINDER_LANGUAGES, REMINDER_TONES } from "../../shared/reminders.js"

const reminderTemplateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    language: {
      type: String,
      enum: REMINDER_LANGUAGES,
      required: true,
    },
    tone: {
      type: String,
      enum: REMINDER_TONES,
      required: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxLength: 600,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
)

// Unique compound index: one custom template per user per language per tone
reminderTemplateSchema.index({ userId: 1, language: 1, tone: 1 }, { unique: true })

export default mongoose.model("ReminderTemplate", reminderTemplateSchema)
