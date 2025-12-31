import mongoose from "mongoose"

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    duration: {
      type: String,
      required: true,
    },
    busType: {
      type: String,
      required: true,
    },
    defaultJourneyDate: {
      type: Date,
    },
    lowerBerth: {
      type: Number,
      default: 0,
    },
    upperBerth: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
)

export default mongoose.model("Tour", tourSchema)
