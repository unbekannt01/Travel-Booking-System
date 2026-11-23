import express from "express"
import rateLimit from "express-rate-limit"
import verifyToken from "../middleware/auth.js"
import RecordHistory from "../models/RecordHistory.js"
import { HISTORY_ENTITIES } from "../../shared/history.js"

const router = express.Router()

const historyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { message: "Too many history requests. Please try again later." },
})

/**
 * GET /api/history
 * Fetches audit & change timeline for a specific entity.
 */
router.get("/", verifyToken, historyLimiter, async (req, res) => {
  try {
    const { entityType, entityId, limit = 50 } = req.query

    if (!entityType || !HISTORY_ENTITIES.includes(entityType)) {
      return res.status(400).json({ message: "A valid entityType is required." })
    }

    if (!entityId) {
      return res.status(400).json({ message: "entityId is required." })
    }

    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50))

    const history = await RecordHistory.find({
      userId: req.user.id,
      entityType,
      entityId,
    })
      .sort({ at: -1 })
      .limit(limitNum)
      .lean()

    res.json({ history })
  } catch (error) {
    console.error("History fetch error:", error.name)
    res.status(500).json({ message: "Failed to fetch record history." })
  }
})

export default router
