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
      enum: ["2x1 Sleeper Luxury", "2x2 Sleeper Luxury"],
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
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
)

export default mongoose.model("Tour", tourSchema)
