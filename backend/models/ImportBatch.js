import mongoose from "mongoose"

const importBatchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["customers", "expenses"],
    },
    status: {
      type: String,
      required: true,
      enum: ["committed", "reverted", "partially_reverted"],
      default: "committed",
    },
    totalRows: {
      type: Number,
      required: true,
      min: 0,
    },
    successCount: {
      type: Number,
      required: true,
      min: 0,
    },
    skippedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    recordIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId }],
      required: true,
      default: [],
    },
    revertedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    fileName: {
      type: String,
      default: "",
      trim: true,
      maxLength: 255,
    },
    mapping: {
      type: Map,
      of: String,
      default: {},
    },
    revertedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

importBatchSchema.index({ userId: 1, createdAt: -1 })
importBatchSchema.index({ userId: 1, type: 1, createdAt: -1 })

export default mongoose.model("ImportBatch", importBatchSchema)
