import mongoose from "mongoose"
import { ALLOWED_BUS_TYPES, STANDARD_BUS_TYPES } from "../../shared/seatLayouts.js"

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
      enum: {
        values: [...ALLOWED_BUS_TYPES],
        message: `Invalid bus type '{VALUE}'. Allowed types: ${STANDARD_BUS_TYPES.join(", ")}`,
      },
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
