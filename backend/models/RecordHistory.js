import mongoose from "mongoose"
import { HISTORY_ENTITIES, HISTORY_ACTIONS } from "../../shared/history.js"

const changeSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    kind: { type: String, required: true },
    from: { type: mongoose.Schema.Types.Mixed },
    to: { type: mongoose.Schema.Types.Mixed },
    changed: { type: Boolean },
  },
  { _id: false }
)

const recordHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    entityType: { type: String, required: true, enum: HISTORY_ENTITIES, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, required: true, enum: HISTORY_ACTIONS },
    at: { type: Date, default: Date.now },
    by: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "" },
      role: { type: String, default: "operator" },
    },
    changes: { type: [changeSchema], default: [] },
    source: { type: String, default: "api" },
  },
  { timestamps: false }
)

// Compound query index for fetching entity timeline
recordHistorySchema.index({ userId: 1, entityType: 1, entityId: 1, at: -1 })

// 730-day (2-year) TTL retention
recordHistorySchema.index({ at: 1 }, { expireAfterSeconds: 63072000 })

export default mongoose.model("RecordHistory", recordHistorySchema)
