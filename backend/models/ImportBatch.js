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
      enum: ["customers", "expenses", "passengers"],
    },
    status: {
      type: String,
      required: true,
      enum: ["committing", "committed", "failed", "reverted", "partially_reverted"],
      default: "committing",
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
    createdBookingIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Booking" }],
      default: [],
    },
    importedPaymentIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }],
      default: [],
    },
    mergedBookingIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Booking" }],
      default: [],
    },
    summary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    revertedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    undoSummary: {
      undone: { type: Number, default: 0 },
      booksLocked: { type: Number, default: 0 },
      inUse: { type: Number, default: 0 },
      alreadyDeleted: { type: Number, default: 0 },
    },
    errors: {
      type: [
        {
          row: { type: Number, required: true },
          field: { type: String, required: true },
          code: { type: String, required: true },
          _id: false,
        },
      ],
      default: [],
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
  { timestamps: true, suppressReservedKeysWarning: true }
)

importBatchSchema.index({ userId: 1, createdAt: -1 })
importBatchSchema.index({ userId: 1, type: 1, createdAt: -1 })

export default mongoose.model("ImportBatch", importBatchSchema)
