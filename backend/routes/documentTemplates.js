import express from "express"
import rateLimit from "express-rate-limit"
import { z } from "zod"
import verifyToken from "../middleware/auth.js"
import InvoiceTemplate from "../models/InvoiceTemplate.js"
import User from "../models/User.js"
import {
  TEMPLATE_PRESETS,
  validateTemplateConfig,
  normalizeTemplateConfig,
} from "../../shared/invoiceTemplate.js"
import { validateUploadedAsset } from "../utils/assetValidation.js"
import { isValidType } from "../../shared/documentTypes.js"

const router = express.Router()

// Strict rate limiting on template writes (SEC-015 compliance: 100 req / 15 min)
const templateWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many template operations, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
})

const templateInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Template name is required")
      .max(100, "Template name cannot exceed 100 characters"),
    presetId: z.string().trim().max(50).optional(),
    config: z.record(z.any()),
    assets: z
      .object({
        logo: z.string().optional().default(""),
        signature: z.string().optional().default(""),
        stamp: z.string().optional().default(""),
      })
      .optional()
      .default({}),
  })
  .strict("Unknown fields in template request are rejected")

/**
 * GET /api/document-templates
 * Returns all custom user templates combined with built-in presets.
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const userTemplates = await InvoiceTemplate.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .lean()

    const builtIns = Object.values(TEMPLATE_PRESETS).map((p) => ({
      _id: `builtin-${p.id}`,
      id: `builtin-${p.id}`,
      name: p.name,
      description: p.description,
      presetId: p.id,
      isBuiltIn: true,
      config: p.config,
      assets: {},
      version: 1,
    }))

    res.json({ templates: [...userTemplates, ...builtIns] })
  } catch (error) {
    console.error("Error fetching document templates:", error)
    res.status(500).json({ message: "Failed to fetch document templates" })
  }
})

/**
 * GET /api/document-templates/:id
 * Fetches a single template by ID (custom or built-in).
 */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params

    if (id.startsWith("builtin-")) {
      const presetKey = id.replace("builtin-", "")
      const preset = TEMPLATE_PRESETS[presetKey]
      if (!preset) {
        return res.status(404).json({ message: "Built-in template preset not found" })
      }
      return res.json({
        template: {
          _id: id,
          id,
          name: preset.name,
          description: preset.description,
          presetId: preset.id,
          isBuiltIn: true,
          config: preset.config,
          assets: {},
          version: 1,
        },
      })
    }

    const template = await InvoiceTemplate.findOne({ _id: id, userId: req.user.id })
    if (!template) {
      return res.status(404).json({ message: "Template not found" })
    }

    res.json({ template })
  } catch (error) {
    console.error("Error fetching template:", error)
    res.status(500).json({ message: "Failed to fetch template" })
  }
})

/**
 * POST /api/document-templates
 * Creates a new custom invoice template (max 20 per user).
 */
router.post("/", verifyToken, templateWriteLimiter, async (req, res) => {
  try {
    const count = await InvoiceTemplate.countDocuments({ userId: req.user.id })
    if (count >= 20) {
      return res.status(400).json({
        message: "Maximum limit of 20 custom templates reached. Please delete an existing template first.",
      })
    }

    const parsed = templateInputSchema.parse(req.body)

    const validation = validateTemplateConfig(parsed.config)
    if (!validation.valid) {
      return res.status(400).json({ message: validation.errors.join("; ") })
    }

    const normalizedConfig = normalizeTemplateConfig(parsed.config)

    const existing = await InvoiceTemplate.findOne({
      userId: req.user.id,
      name: parsed.name,
    })
    if (existing) {
      return res.status(409).json({ message: "A template with this name already exists" })
    }

    const template = new InvoiceTemplate({
      userId: req.user.id,
      name: parsed.name,
      presetId: parsed.presetId || "classic-bus",
      config: normalizedConfig,
      assets: parsed.assets || {},
      isBuiltIn: false,
      version: 1,
    })

    await template.save()
    res.status(201).json({ template })
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: error.errors[0]?.message || "Validation failed",
      })
    }
    console.error("Error creating template:", error)
    res.status(500).json({ message: "Failed to create template" })
  }
})

/**
 * PUT /api/document-templates/:id
 * Updates an existing custom template. Built-ins cannot be modified directly.
 */
router.put("/:id", verifyToken, templateWriteLimiter, async (req, res) => {
  try {
    const { id } = req.params

    if (id.startsWith("builtin-")) {
      return res.status(400).json({
        message: "Built-in templates cannot be modified directly. Please duplicate it to customize.",
      })
    }

    const template = await InvoiceTemplate.findOne({ _id: id, userId: req.user.id })
    if (!template) {
      return res.status(404).json({ message: "Template not found" })
    }

    const parsed = templateInputSchema.parse(req.body)

    const validation = validateTemplateConfig(parsed.config)
    if (!validation.valid) {
      return res.status(400).json({ message: validation.errors.join("; ") })
    }

    const normalizedConfig = normalizeTemplateConfig(parsed.config)

    if (parsed.name !== template.name) {
      const duplicateName = await InvoiceTemplate.findOne({
        userId: req.user.id,
        name: parsed.name,
        _id: { $ne: template._id },
      })
      if (duplicateName) {
        return res.status(409).json({ message: "Another template with this name already exists" })
      }
    }

    template.name = parsed.name
    template.config = normalizedConfig
    template.assets = parsed.assets || template.assets
    if (parsed.presetId) template.presetId = parsed.presetId
    template.version = (template.version || 1) + 1

    await template.save()
    res.json({ template })
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: error.errors[0]?.message || "Validation failed",
      })
    }
    console.error("Error updating template:", error)
    res.status(500).json({ message: "Failed to update template" })
  }
})

/**
 * DELETE /api/document-templates/:id
 * Deletes a custom template. Built-ins are protected.
 */
router.delete("/:id", verifyToken, templateWriteLimiter, async (req, res) => {
  try {
    const { id } = req.params

    if (id.startsWith("builtin-")) {
      return res.status(400).json({ message: "Built-in templates cannot be deleted." })
    }

    const result = await InvoiceTemplate.findOneAndDelete({ _id: id, userId: req.user.id })
    if (!result) {
      return res.status(404).json({ message: "Template not found" })
    }

    res.json({ message: "Template deleted successfully" })
  } catch (error) {
    console.error("Error deleting template:", error)
    res.status(500).json({ message: "Failed to delete template" })
  }
})

/**
 * POST /api/document-templates/:id/duplicate
 * Duplicates a custom or built-in template into a new custom template.
 */
router.post("/:id/duplicate", verifyToken, templateWriteLimiter, async (req, res) => {
  try {
    const { id } = req.params

    const count = await InvoiceTemplate.countDocuments({ userId: req.user.id })
    if (count >= 20) {
      return res.status(400).json({
        message: "Maximum limit of 20 custom templates reached. Please delete an existing template first.",
      })
    }

    let sourceName = ""
    let sourceConfig = null
    let sourceAssets = {}
    let sourcePresetId = "classic-bus"

    if (id.startsWith("builtin-")) {
      const presetKey = id.replace("builtin-", "")
      const preset = TEMPLATE_PRESETS[presetKey]
      if (!preset) {
        return res.status(404).json({ message: "Built-in preset not found" })
      }
      sourceName = preset.name
      sourceConfig = preset.config
      sourcePresetId = preset.id
    } else {
      const source = await InvoiceTemplate.findOne({ _id: id, userId: req.user.id })
      if (!source) {
        return res.status(404).json({ message: "Template not found" })
      }
      sourceName = source.name
      sourceConfig = source.config
      sourceAssets = source.assets
      sourcePresetId = source.presetId
    }

    // Determine unique duplicate name
    let newName = `${sourceName} (Copy)`
    let counter = 2
    while (await InvoiceTemplate.findOne({ userId: req.user.id, name: newName })) {
      newName = `${sourceName} (Copy ${counter})`
      counter++
    }

    const cloned = new InvoiceTemplate({
      userId: req.user.id,
      name: newName,
      presetId: sourcePresetId,
      config: normalizeTemplateConfig(sourceConfig),
      assets: sourceAssets || {},
      isBuiltIn: false,
      version: 1,
    })

    await cloned.save()
    res.status(201).json({ template: cloned })
  } catch (error) {
    console.error("Error duplicating template:", error)
    res.status(500).json({ message: "Failed to duplicate template" })
  }
})

/**
 * POST /api/document-templates/assets
 * Uploads an asset (logo, signature, stamp) with magic-byte verification (max 200 KB, no SVG).
 */
router.post("/assets", verifyToken, templateWriteLimiter, async (req, res) => {
  try {
    const { file, type = "logo" } = req.body
    if (!file) {
      return res.status(400).json({ message: "No file provided" })
    }

    const result = validateUploadedAsset(file, type)
    if (!result.valid) {
      return res.status(400).json({ message: result.error })
    }

    res.json({
      url: result.dataUrl,
      mimeType: result.mimeType,
      size: result.size,
    })
  } catch (error) {
    console.error("Error uploading template asset:", error)
    res.status(500).json({ message: "Failed to upload asset" })
  }
})

/**
 * PUT /api/document-templates/default/:type
 * Assigns default template for a specific document type.
 */
router.put("/default/:type", verifyToken, templateWriteLimiter, async (req, res) => {
  try {
    const { type } = req.params
    const { templateId } = req.body

    if (!isValidType(type)) {
      return res.status(400).json({ message: `Invalid document type '${type}'` })
    }

    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const currentSettings = user.documentSettings || {}
    const typeSettings = currentSettings[type] || {}
    typeSettings.defaultTemplateId = templateId || null

    currentSettings[type] = typeSettings
    user.documentSettings = currentSettings
    user.markModified("documentSettings")
    await user.save()

    res.json({
      message: `Default template updated for ${type}`,
      settings: user.documentSettings,
    })
  } catch (error) {
    console.error("Error updating default template:", error)
    res.status(500).json({ message: "Failed to update default template" })
  }
})

export default router
