import express from "express"
import rateLimit from "express-rate-limit"
import verifyToken from "../middleware/auth.js"
import { logAudit } from "../models/AuditLog.js"
import ReminderTemplate from "../models/ReminderTemplate.js"
import {
  REMINDER_LANGUAGES,
  REMINDER_TONES,
  DEFAULT_REMINDER_TEMPLATES,
  validateTemplate,
} from "../../shared/reminders.js"
import {
  templateParamsSchema,
  saveTemplateBodySchema,
} from "../utils/reminderValidation.js"

const router = express.Router()

// Rate limiter for template modifications (SEC-009)
const reminderTemplateWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: "Too many template updates. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * GET /api/reminder-templates
 * Returns merged map of all 9 templates for current tenant (custom if exists, else default).
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const customTemplates = await ReminderTemplate.find({ userId: req.user.id }).lean()
    const customMap = new Map()
    for (const t of customTemplates) {
      customMap.set(`${t.language}:${t.tone}`, t.body)
    }

    const templates = {}
    for (const lang of REMINDER_LANGUAGES) {
      templates[lang] = {}
      for (const tone of REMINDER_TONES) {
        const customBody = customMap.get(`${lang}:${tone}`)
        const isCustom = customBody !== undefined && customBody !== null
        templates[lang][tone] = {
          language: lang,
          tone,
          body: isCustom ? customBody : (DEFAULT_REMINDER_TEMPLATES[lang]?.[tone] || ""),
          isCustom,
        }
      }
    }

    res.json({ templates })
  } catch (error) {
    console.error("Fetch reminder templates error:", error)
    res.status(500).json({ message: "Failed to fetch reminder templates" })
  }
})

/**
 * PUT /api/reminder-templates/:language/:tone
 * Saves custom template for the tenant.
 */
router.put(
  "/:language/:tone",
  verifyToken,
  reminderTemplateWriteLimiter,
  async (req, res) => {
    try {
      const parsedParams = templateParamsSchema.safeParse(req.params)
      if (!parsedParams.success) {
        return res.status(400).json({
          message: parsedParams.error.issues[0]?.message || "Invalid parameters",
        })
      }

      const parsedBody = saveTemplateBodySchema.safeParse(req.body)
      if (!parsedBody.success) {
        return res.status(400).json({
          message: parsedBody.error.issues[0]?.message || "Invalid template body",
        })
      }

      const { language, tone } = parsedParams.data
      const { body } = parsedBody.data

      const valResult = validateTemplate(body)
      if (!valResult.valid) {
        return res.status(400).json({
          message: valResult.errors[0] || "Invalid template content",
          errors: valResult.errors,
        })
      }

      const updated = await ReminderTemplate.findOneAndUpdate(
        { userId: req.user.id, language, tone },
        { body: body.trim(), updatedBy: req.user.id },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )

      await logAudit({
        userId: req.user.id,
        action: "reminder_template_updated",
        req,
        meta: { language, tone },
      })

      res.json({
        success: true,
        template: {
          language: updated.language,
          tone: updated.tone,
          body: updated.body,
          isCustom: true,
        },
      })
    } catch (error) {
      console.error("Save reminder template error:", error)
      res.status(500).json({ message: "Failed to save reminder template" })
    }
  }
)

/**
 * DELETE /api/reminder-templates/:language/:tone
 * Resets template back to default by removing custom record.
 */
router.delete(
  "/:language/:tone",
  verifyToken,
  reminderTemplateWriteLimiter,
  async (req, res) => {
    try {
      const parsedParams = templateParamsSchema.safeParse(req.params)
      if (!parsedParams.success) {
        return res.status(400).json({
          message: parsedParams.error.issues[0]?.message || "Invalid parameters",
        })
      }

      const { language, tone } = parsedParams.data

      await ReminderTemplate.findOneAndDelete({
        userId: req.user.id,
        language,
        tone,
      })

      await logAudit({
        userId: req.user.id,
        action: "reminder_template_reset",
        req,
        meta: { language, tone },
      })

      res.json({
        success: true,
        template: {
          language,
          tone,
          body: DEFAULT_REMINDER_TEMPLATES[language]?.[tone] || "",
          isCustom: false,
        },
      })
    } catch (error) {
      console.error("Reset reminder template error:", error)
      res.status(500).json({ message: "Failed to reset reminder template" })
    }
  }
)

export default router
