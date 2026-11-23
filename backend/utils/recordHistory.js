import RecordHistory from "../models/RecordHistory.js"
import { diffRecord, HISTORY_ENTITIES } from "../../shared/history.js"

/**
 * Best-effort record history logger.
 * Never throws or interrupts calling routes.
 * Never logs PII.
 *
 * @param {object} params
 * @param {string|object} params.userId
 * @param {"booking"|"expense"|"customer"|"cashEntry"} params.entityType
 * @param {string|object} params.entityId
 * @param {"created"|"updated"|"deleted"|"restored"|"cancelled"} params.action
 * @param {object} [params.before]
 * @param {object} [params.after]
 * @param {Array} [params.changes] - Explicit changes override
 * @param {object} [params.user] - Request user info
 * @param {string} [params.source="api"]
 */
export async function recordHistory({
  userId,
  entityType,
  entityId,
  action,
  before,
  after,
  changes,
  user,
  source = "api",
}) {
  try {
    if (!userId || !entityType || !entityId || !action) return
    if (!HISTORY_ENTITIES.includes(entityType)) return

    let finalChanges = Array.isArray(changes) ? changes : []

    if (action === "updated" && (!changes || changes.length === 0)) {
      if (before && after) {
        finalChanges = diffRecord(entityType, before, after)
        // If no tracked fields changed, skip writing a redundant history event
        if (finalChanges.length === 0) return
      }
    }

    const by = {
      id: user?.id || user?._id || userId,
      name: user?.userName || user?.name || "Operator",
      role: user?.role || "operator",
    }

    await RecordHistory.create({
      userId,
      entityType,
      entityId,
      action,
      by,
      changes: finalChanges,
      source,
      at: new Date(),
    })
  } catch (err) {
    // Log only error name/code, strictly no payload or PII
    console.error(`[RecordHistory] Non-blocking history record failed: ${err.name || "Error"} (${err.code || "UNKNOWN"})`)
  }
}

export default recordHistory
