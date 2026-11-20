/**
 * YatraHub (TBS) — Invoice Studio Template Definitions & Validators (Part 3.7b)
 * Pure, zero-dependency ESM module shared across frontend and backend.
 */

export const INVOICE_LAYOUTS = ["legacy", "modern", "classic", "minimal", "corporate"]

export const PAPER_SIZES = ["a4", "a5", "thermal80", "thermal58"]

export const COPIES_OPTIONS = ["single", "original-duplicate", "original-duplicate-triplicate"]

export const FONT_FAMILIES = ["system", "inter", "serif"]

export const COLOR_PRESETS = {
  indigo: {
    id: "indigo",
    label: "Indigo Night",
    primary: "#4f46e5",
    accent: "#6366f1",
    text: "#0f172a",
    border: "#e2e8f0",
    bg: "#ffffff",
    surface: "#f8fafc",
  },
  emerald: {
    id: "emerald",
    label: "Emerald Valley",
    primary: "#059669",
    accent: "#10b981",
    text: "#0f172a",
    border: "#d1fae5",
    bg: "#ffffff",
    surface: "#f0fdf4",
  },
  amber: {
    id: "amber",
    label: "Amber Gold",
    primary: "#d97706",
    accent: "#f59e0b",
    text: "#0f172a",
    border: "#fef3c7",
    bg: "#ffffff",
    surface: "#fffbeb",
  },
  rose: {
    id: "rose",
    label: "Rose Royal",
    primary: "#e11d48",
    accent: "#f43f5e",
    text: "#0f172a",
    border: "#ffe4e6",
    bg: "#ffffff",
    surface: "#fff1f2",
  },
  slate: {
    id: "slate",
    label: "Slate Steel",
    primary: "#334155",
    accent: "#64748b",
    text: "#0f172a",
    border: "#e2e8f0",
    bg: "#ffffff",
    surface: "#f8fafc",
  },
  monochrome: {
    id: "monochrome",
    label: "Classic Monochrome",
    primary: "#0f172a",
    accent: "#475569",
    text: "#000000",
    border: "#cbd5e1",
    bg: "#ffffff",
    surface: "#f1f5f9",
  },
}

/**
 * Parses 3- or 6-digit hex string into {r, g, b} (0-255).
 * Falls back to black {r: 0, g: 0, b: 0} if invalid.
 */
export function parseHexColor(hex) {
  if (typeof hex !== "string") return { r: 0, g: 0, b: 0 }
  let cleaned = hex.trim().replace(/^#/, "")
  if (cleaned.length === 3) {
    cleaned = cleaned.split("").map((c) => c + c).join("")
  }
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return { r: 0, g: 0, b: 0 }
  }
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  }
}

/**
 * Calculates relative luminance for RGB according to WCAG 2.1 specs.
 */
export function getRelativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculates WCAG contrast ratio between two hex colors.
 * Returns a number rounded to 2 decimal places (e.g. 7.42). Range: 1.0 to 21.0.
 */
export function calculateContrastRatio(fgHex, bgHex) {
  const rgb1 = parseHexColor(fgHex)
  const rgb2 = parseHexColor(bgHex)
  const l1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b)
  const l2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  const ratio = (lighter + 0.05) / (darker + 0.05)
  return Math.round(ratio * 100) / 100
}

/**
 * Checks if color contrast satisfies WCAG AA (4.5:1 for normal text).
 */
export function isWcagAccessible(fgHex, bgHex, minRatio = 4.5) {
  return calculateContrastRatio(fgHex, bgHex) >= minRatio
}

export function getPresetColors(presetKey) {
  const p = COLOR_PRESETS[presetKey] || COLOR_PRESETS.indigo
  return {
    primary: p.primary,
    accent: p.accent,
    text: p.text,
    border: p.border,
    bg: p.bg,
    surface: p.surface,
  }
}

export const DEFAULT_TEMPLATE_CONFIG = {
  layout: "legacy",
  colorPreset: "indigo",
  colors: getPresetColors("indigo"),
  typography: {
    fontFamily: "system",
    fontSize: "normal", // "compact" | "normal" | "spacious"
    headingWeight: "bold",
  },
  header: {
    style: "standard", // "standard" | "minimal" | "banner" | "corporate" | "compact"
    showLogo: true,
    logoHeight: 56,
    showTagline: true,
    showGstin: true,
    showOrganizers: true,
  },
  sections: {
    showCustomer: true,
    showTourDetails: true,
    showPassengerManifest: true,
    showFinancialBreakup: true,
    showTerms: true,
    showBankDetails: true,
    showUpiQr: true,
    showNotes: true,
    showAuthorizedSignature: false,
  },
  watermark: {
    enabled: false,
    text: "",
    opacity: 0.1,
    autoStatus: true, // auto watermark for VOID or CANCELLED
  },
  copies: "single",
  copyLabels: {
    copy1: "Original for Recipient",
    copy2: "Duplicate for Transporter",
    copy3: "Triplicate for Supplier",
  },
  paper: {
    size: "a4",
    orientation: "portrait",
    marginMm: 8,
  },
  footer: {
    customText: "",
    showWishJourney: true,
    showWebsite: true,
  },
  language: "en",
  labels: {},
}

export const TEMPLATE_PRESETS = {
  "classic-bus": {
    id: "classic-bus",
    name: "Classic Yatra Bus",
    description: "Default YatraHub invoice with high clarity and balanced layout.",
    config: {
      ...DEFAULT_TEMPLATE_CONFIG,
      layout: "legacy",
      colorPreset: "indigo",
      colors: getPresetColors("indigo"),
    },
  },
  "modern-minimal": {
    id: "modern-minimal",
    name: "Modern Minimalist",
    description: "Clean aesthetic with muted borders, concise typography and generous spacing.",
    config: {
      ...DEFAULT_TEMPLATE_CONFIG,
      layout: "minimal",
      colorPreset: "slate",
      colors: getPresetColors("slate"),
      typography: { fontFamily: "inter", fontSize: "normal", headingWeight: "bold" },
      header: { style: "minimal", showLogo: true, logoHeight: 48, showTagline: true, showGstin: true, showOrganizers: false },
      watermark: { enabled: false, text: "", opacity: 0.08, autoStatus: true },
      paper: { size: "a4", orientation: "portrait", marginMm: 10 },
      footer: { customText: "", showWishJourney: false, showWebsite: true },
    },
  },
  "gujarat-heritage": {
    id: "gujarat-heritage",
    name: "Gujarat Heritage",
    description: "Warm amber and gold accents with duplicate copies for transporter records.",
    config: {
      ...DEFAULT_TEMPLATE_CONFIG,
      layout: "modern",
      colorPreset: "amber",
      colors: getPresetColors("amber"),
      typography: { fontFamily: "inter", fontSize: "normal", headingWeight: "bold" },
      header: { style: "banner", showLogo: true, logoHeight: 60, showTagline: true, showGstin: true, showOrganizers: true },
      sections: {
        ...DEFAULT_TEMPLATE_CONFIG.sections,
        showAuthorizedSignature: true,
      },
      copies: "original-duplicate",
      copyLabels: {
        copy1: "Original for Traveler",
        copy2: "Duplicate for Operator",
        copy3: "Office Copy",
      },
      footer: { customText: "Jay Mataji • Safe travels with YatraHub", showWishJourney: true, showWebsite: true },
      language: "gu",
    },
  },
  "pilgrim-simple": {
    id: "pilgrim-simple",
    name: "Pilgrim Simple",
    description: "Emerald green compact layout optimized for A5 printouts.",
    config: {
      ...DEFAULT_TEMPLATE_CONFIG,
      layout: "classic",
      colorPreset: "emerald",
      colors: getPresetColors("emerald"),
      typography: { fontFamily: "system", fontSize: "compact", headingWeight: "bold" },
      header: { style: "standard", showLogo: true, logoHeight: 44, showTagline: true, showGstin: true, showOrganizers: true },
      sections: {
        ...DEFAULT_TEMPLATE_CONFIG.sections,
        showNotes: false,
        showAuthorizedSignature: true,
      },
      paper: { size: "a5", orientation: "portrait", marginMm: 6 },
      footer: { customText: "Subh Yatra! May your pilgrimage be peaceful and blessed.", showWishJourney: true, showWebsite: false },
      language: "hi",
    },
  },
  "thermal-compact": {
    id: "thermal-compact",
    name: "Thermal POS 80mm",
    description: "High-contrast monochrome layout tailored for 80mm roll receipt printers.",
    config: {
      ...DEFAULT_TEMPLATE_CONFIG,
      layout: "minimal",
      colorPreset: "monochrome",
      colors: getPresetColors("monochrome"),
      typography: { fontFamily: "system", fontSize: "compact", headingWeight: "bold" },
      header: { style: "compact", showLogo: false, logoHeight: 32, showTagline: false, showGstin: true, showOrganizers: false },
      sections: {
        showCustomer: true,
        showTourDetails: true,
        showPassengerManifest: true,
        showFinancialBreakup: true,
        showTerms: false,
        showBankDetails: false,
        showUpiQr: true,
        showNotes: false,
        showAuthorizedSignature: false,
      },
      watermark: { enabled: false, text: "", opacity: 0, autoStatus: false },
      paper: { size: "thermal80", orientation: "portrait", marginMm: 2 },
      footer: { customText: "Thank you for traveling with us!", showWishJourney: false, showWebsite: false },
    },
  },
  "corporate-blue": {
    id: "corporate-blue",
    name: "Corporate Tour Blue",
    description: "Formal corporate invoice with GST breakup, triplicate copies and signatory box.",
    config: {
      ...DEFAULT_TEMPLATE_CONFIG,
      layout: "corporate",
      colorPreset: "indigo",
      colors: getPresetColors("indigo"),
      typography: { fontFamily: "inter", fontSize: "normal", headingWeight: "bold" },
      header: { style: "corporate", showLogo: true, logoHeight: 56, showTagline: true, showGstin: true, showOrganizers: true },
      sections: {
        ...DEFAULT_TEMPLATE_CONFIG.sections,
        showAuthorizedSignature: true,
      },
      copies: "original-duplicate-triplicate",
      copyLabels: {
        copy1: "Original for Recipient",
        copy2: "Duplicate for Transporter",
        copy3: "Triplicate for Supplier",
      },
      footer: {
        customText: "Subject to local jurisdiction. Goods & Services once booked cannot be exchanged.",
        showWishJourney: false,
        showWebsite: true,
      },
    },
  },
}

/**
 * Validates a template configuration object.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateTemplateConfig(config) {
  const errors = []
  if (!config || typeof config !== "object") {
    return { valid: false, errors: ["Template configuration must be a non-null object"] }
  }

  if (config.layout && !INVOICE_LAYOUTS.includes(config.layout)) {
    errors.push(`Invalid layout '${config.layout}'. Must be one of: ${INVOICE_LAYOUTS.join(", ")}`)
  }

  if (config.paper?.size && !PAPER_SIZES.includes(config.paper.size)) {
    errors.push(`Invalid paper size '${config.paper.size}'. Must be one of: ${PAPER_SIZES.join(", ")}`)
  }

  if (config.copies && !COPIES_OPTIONS.includes(config.copies)) {
    errors.push(`Invalid copies option '${config.copies}'. Must be one of: ${COPIES_OPTIONS.join(", ")}`)
  }

  if (config.typography?.fontFamily && !FONT_FAMILIES.includes(config.typography.fontFamily)) {
    errors.push(`Invalid font family '${config.typography.fontFamily}'. Must be one of: ${FONT_FAMILIES.join(", ")}`)
  }

  // Validate hex colors if provided
  if (config.colors && typeof config.colors === "object") {
    const validColorFields = ["primary", "accent", "text", "border", "bg", "surface"]
    for (const [key, val] of Object.entries(config.colors)) {
      if (validColorFields.includes(key)) {
        if (typeof val !== "string" || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val.trim())) {
          errors.push(`Invalid hex color for '${key}': '${val}'`)
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Normalizes a raw/partial template configuration by filling defaults,
 * sanitizing values and ensuring complete structures.
 */
export function normalizeTemplateConfig(raw = {}) {
  const fallback = DEFAULT_TEMPLATE_CONFIG
  const cfg = typeof raw === "object" && raw !== null ? raw : {}

  const layout = INVOICE_LAYOUTS.includes(cfg.layout) ? cfg.layout : fallback.layout
  const colorPreset = COLOR_PRESETS[cfg.colorPreset] ? cfg.colorPreset : fallback.colorPreset
  const presetColors = COLOR_PRESETS[colorPreset] || COLOR_PRESETS.indigo

  const colors = {
    primary: sanitizeHex(cfg.colors?.primary, presetColors.primary),
    accent: sanitizeHex(cfg.colors?.accent, presetColors.accent),
    text: sanitizeHex(cfg.colors?.text, presetColors.text),
    border: sanitizeHex(cfg.colors?.border, presetColors.border),
    bg: sanitizeHex(cfg.colors?.bg, presetColors.bg),
    surface: sanitizeHex(cfg.colors?.surface, presetColors.surface),
  }

  const typography = {
    fontFamily: FONT_FAMILIES.includes(cfg.typography?.fontFamily)
      ? cfg.typography.fontFamily
      : fallback.typography.fontFamily,
    fontSize: ["compact", "normal", "spacious"].includes(cfg.typography?.fontSize)
      ? cfg.typography.fontSize
      : fallback.typography.fontSize,
    headingWeight: ["normal", "semibold", "bold"].includes(cfg.typography?.headingWeight)
      ? cfg.typography.headingWeight
      : fallback.typography.headingWeight,
  }

  const header = {
    style: ["standard", "minimal", "banner", "corporate", "compact"].includes(cfg.header?.style)
      ? cfg.header.style
      : fallback.header.style,
    showLogo: typeof cfg.header?.showLogo === "boolean" ? cfg.header.showLogo : fallback.header.showLogo,
    logoHeight: Math.max(20, Math.min(120, Number(cfg.header?.logoHeight) || fallback.header.logoHeight)),
    showTagline: typeof cfg.header?.showTagline === "boolean" ? cfg.header.showTagline : fallback.header.showTagline,
    showGstin: typeof cfg.header?.showGstin === "boolean" ? cfg.header.showGstin : fallback.header.showGstin,
    showOrganizers:
      typeof cfg.header?.showOrganizers === "boolean" ? cfg.header.showOrganizers : fallback.header.showOrganizers,
  }

  const sections = {
    showCustomer:
      typeof cfg.sections?.showCustomer === "boolean" ? cfg.sections.showCustomer : fallback.sections.showCustomer,
    showTourDetails:
      typeof cfg.sections?.showTourDetails === "boolean"
        ? cfg.sections.showTourDetails
        : fallback.sections.showTourDetails,
    showPassengerManifest:
      typeof cfg.sections?.showPassengerManifest === "boolean"
        ? cfg.sections.showPassengerManifest
        : fallback.sections.showPassengerManifest,
    showFinancialBreakup:
      typeof cfg.sections?.showFinancialBreakup === "boolean"
        ? cfg.sections.showFinancialBreakup
        : fallback.sections.showFinancialBreakup,
    showTerms: typeof cfg.sections?.showTerms === "boolean" ? cfg.sections.showTerms : fallback.sections.showTerms,
    showBankDetails:
      typeof cfg.sections?.showBankDetails === "boolean"
        ? cfg.sections.showBankDetails
        : fallback.sections.showBankDetails,
    showUpiQr: typeof cfg.sections?.showUpiQr === "boolean" ? cfg.sections.showUpiQr : fallback.sections.showUpiQr,
    showNotes: typeof cfg.sections?.showNotes === "boolean" ? cfg.sections.showNotes : fallback.sections.showNotes,
    showAuthorizedSignature:
      typeof cfg.sections?.showAuthorizedSignature === "boolean"
        ? cfg.sections.showAuthorizedSignature
        : fallback.sections.showAuthorizedSignature,
  }

  const watermark = {
    enabled: typeof cfg.watermark?.enabled === "boolean" ? cfg.watermark.enabled : fallback.watermark.enabled,
    text: String(cfg.watermark?.text || "").slice(0, 30),
    opacity: Math.max(0.01, Math.min(0.5, Number(cfg.watermark?.opacity) || fallback.watermark.opacity)),
    autoStatus:
      typeof cfg.watermark?.autoStatus === "boolean" ? cfg.watermark.autoStatus : fallback.watermark.autoStatus,
  }

  const copies = COPIES_OPTIONS.includes(cfg.copies) ? cfg.copies : fallback.copies
  const copyLabels = {
    copy1: String(cfg.copyLabels?.copy1 || fallback.copyLabels.copy1).slice(0, 50),
    copy2: String(cfg.copyLabels?.copy2 || fallback.copyLabels.copy2).slice(0, 50),
    copy3: String(cfg.copyLabels?.copy3 || fallback.copyLabels.copy3).slice(0, 50),
  }

  const paper = {
    size: PAPER_SIZES.includes(cfg.paper?.size) ? cfg.paper.size : fallback.paper.size,
    orientation: ["portrait", "landscape"].includes(cfg.paper?.orientation)
      ? cfg.paper.orientation
      : fallback.paper.orientation,
    marginMm: Math.max(0, Math.min(30, Number(cfg.paper?.marginMm) ?? fallback.paper.marginMm)),
  }

  const footer = {
    customText: String(cfg.footer?.customText || "").slice(0, 200),
    showWishJourney:
      typeof cfg.footer?.showWishJourney === "boolean" ? cfg.footer.showWishJourney : fallback.footer.showWishJourney,
    showWebsite:
      typeof cfg.footer?.showWebsite === "boolean" ? cfg.footer.showWebsite : fallback.footer.showWebsite,
  }

  const language = ["en", "hi", "gu"].includes(cfg.language) ? cfg.language : fallback.language
  const labels = typeof cfg.labels === "object" && cfg.labels !== null ? { ...cfg.labels } : {}

  return {
    layout,
    colorPreset,
    colors,
    typography,
    header,
    sections,
    watermark,
    copies,
    copyLabels,
    paper,
    footer,
    language,
    labels,
  }
}

function sanitizeHex(val, fallback) {
  if (typeof val === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val.trim())) {
    return val.trim().toLowerCase()
  }
  return fallback
}

/**
 * Builds a valid NPCI UPI payment URI string.
 * @param {Object} options
 * @param {string} options.upiId - Virtual Payment Address (e.g. "yatra@okhdfcbank")
 * @param {string} [options.payeeName] - Operator or business name
 * @param {number} [options.amount] - Payment amount in INR
 * @param {string} [options.note] - Payment remarks or document number
 */
export function buildUpiPaymentUri({ upiId, payeeName, amount, note }) {
  if (!upiId || typeof upiId !== "string" || !upiId.trim()) return ""
  const params = new URLSearchParams()
  params.set("pa", upiId.trim())
  if (payeeName && typeof payeeName === "string") {
    params.set("pn", payeeName.trim().slice(0, 50))
  }
  if (amount !== undefined && amount !== null && Number(amount) > 0) {
    params.set("am", Number(amount).toFixed(2))
  }
  if (note && typeof note === "string") {
    params.set("tn", note.trim().slice(0, 50))
  }
  params.set("cu", "INR")
  return `upi://pay?${params.toString()}`
}
