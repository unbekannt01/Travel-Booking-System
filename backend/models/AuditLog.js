import mongoose from "mongoose"

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    action: { type: String, required: true, index: true },
    ip: { type: String },
    userAgent: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, expires: 15552000 }, // 180 days TTL
  },
  { timestamps: false }
)

export const logAudit = async ({ userId, action, req, meta = {} }) => {
  try {
    const ip = req?.ip || req?.socket?.remoteAddress || "unknown"
    const userAgent = req?.headers?.["user-agent"] || "unknown"
    await mongoose.model("AuditLog").create({
      userId,
      action,
      ip,
      userAgent,
      meta,
    })
  } catch (err) {
    console.error("Audit logging failure:", err.message)
  }
}

export default mongoose.model("AuditLog", auditLogSchema)
