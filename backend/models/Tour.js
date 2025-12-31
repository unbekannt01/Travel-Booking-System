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
    journeyDate: {
      type: String,
    },
    pricingType: {
      type: String,
      enum: ["berth", "fixed"],
      default: "berth",
    },
    fixedPrice: {
      type: Number,
      default: 0,
    },
    lowerPrice: {
      type: Number,
      default: 0,
    },
    upperPrice: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
)

export default mongoose.model("Tour", tourSchema)
