import mongoose from "mongoose"

const couplePairSchema = new mongoose.Schema(
  {
    a: { type: String, required: true },
    b: { type: String, required: true },
  },
  { _id: false },
)

const departureSeatConfigSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tourName: { type: String, required: true },
    journeyDate: { type: Date, required: true },
    busType: { type: String, required: true },
    ladiesSeats: {
      type: [String],
      default: [],
    },
    couplePairs: {
      type: [couplePairSchema],
      default: [],
    },
    fares: {
      lower: { type: Number, min: 0, default: 0 },
      upper: { type: Number, min: 0, default: 0 },
      rear: { type: Number, min: 0, default: 0 },
      seat: { type: Number, min: 0, default: 0 },
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Scoped departure configuration per tenant
departureSeatConfigSchema.index(
  { userId: 1, tourName: 1, journeyDate: 1, busType: 1 },
  { unique: true },
)

const DepartureSeatConfig = mongoose.model(
  "DepartureSeatConfig",
  departureSeatConfigSchema,
)

export default DepartureSeatConfig
