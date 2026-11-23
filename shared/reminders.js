/**
 * YatraHub (TBS) — Pure Shared Reminders Engine (Part 5c)
 * Plain JavaScript ESM module with zero external dependencies.
 * Shared between backend (models/routes/audit) and frontend (ReminderModal/Settings/Outstanding).
 *
 * RULES:
 * 1. Semi-Automated / Manual wa.me flow:
 *    - The system prepares polite, personalized messages and generates https://wa.me/91<10digits>?text=... URLs.
 *    - The operator clicks the link to open WhatsApp and presses send themselves.
 *    - No automated background sending, no WhatsApp Business Cloud API.
 * 2. Privacy & Security:
 *    - No Aadhaar, passenger lists, or other customers' personal data in message text.
 *    - Never store the rendered message text or customer phone in database logs.
 *    - Control characters and bidirectional overrides are strictly stripped from all substitutions.
 *    - WhatsApp does not make `upi://` URI schemes clickable on most mobile devices, so only plain text UPI ID is included.
 */

import { normalizeIndianMobile } from "./customers.js"

export const REMINDER_TONES = Object.freeze(["friendly", "due-soon", "overdue"])

export const REMINDER_LANGUAGES = Object.freeze(["en", "hi", "gu"])

export const REMINDER_PLACEHOLDERS = Object.freeze([
  "customerName",
  "companyName",
  "companyPhone",
  "tourName",
  "journeyDate",
  "invoiceNo",
  "balance",
  "totalAmount",
  "paidAmount",
  "daysOverdue",
  "upiId",
])

/**
 * Default reminder templates (3 languages x 3 tones = 9 templates).
 * Max 600 characters each.
 * All English, Hindi and Gujarati templates marked as needs native-speaker review.
 */
export const DEFAULT_REMINDER_TEMPLATES = Object.freeze({
  // Note: English templates need native-speaker review
  en: Object.freeze({
    friendly:
      "Dear {customerName}, greetings from {companyName}! 🙏 This is a gentle reminder regarding your booking #{invoiceNo} for {tourName} (Journey: {journeyDate}). The total amount is {totalAmount}, with {paidAmount} received. The remaining balance is {balance}. Please settle before departure. For UPI payments, use UPI ID: {upiId}. For assistance, contact {companyPhone}. Thank you!",
    "due-soon":
      "Dear {customerName}, greetings from {companyName}! 🙏 Your journey for {tourName} is scheduled on {journeyDate} (Booking #{invoiceNo}). Kindly settle the pending balance of {balance} (Total: {totalAmount}, Paid: {paidAmount}). UPI ID: {upiId}. Please call {companyPhone} for any help. Wishing you a pleasant yatra!",
    overdue:
      "Dear {customerName}, this is a payment reminder from {companyName}. 🙏 Balance of {balance} on booking #{invoiceNo} for {tourName} is overdue by {daysOverdue} days. Kindly clear the outstanding amount via UPI ID: {upiId} or call {companyPhone} to confirm your payment. Thank you!",
  }),
  // Note: Hindi templates need native-speaker review
  hi: Object.freeze({
    friendly:
      "नमस्ते {customerName} जी, {companyName} की ओर से सादर प्रणाम! 🙏 {tourName} (यात्रा तिथि: {journeyDate}) की बुकिंग #{invoiceNo} का कुल किराया {totalAmount} है, जिसमें से {paidAmount} प्राप्त हुआ है। शेष राशि {balance} यात्रा से पहले जमा करने का कष्ट करें। UPI भुगतान के लिए UPI ID: {upiId} का उपयोग करें। सहायता के लिए {companyPhone} पर संपर्क करें। धन्यवाद!",
    "due-soon":
      "नमस्ते {customerName} जी, {companyName} की ओर से सादर प्रणाम! 🙏 आपकी {tourName} की यात्रा {journeyDate} को निर्धारित है (बुकिंग #{invoiceNo})। कृपया अपनी बकाया राशि {balance} (कुल: {totalAmount}, जमा: {paidAmount}) का शीघ्र भुगतान करें। UPI ID: {upiId}। किसी भी सहायता के लिए {companyPhone} पर संपर्क करें। आपकी यात्रा मंगलमय हो!",
    overdue:
      "नमस्ते {customerName} जी, {companyName} की ओर से आवश्यक भुगतान सूचना। 🙏 {tourName} की बुकिंग #{invoiceNo} पर {balance} का भुगतान {daysOverdue} दिनों से बकाया है। कृपया बकाया राशि का भुगतान तुरंत UPI ID: {upiId} पर करें या {companyPhone} पर संपर्क करें। धन्यवाद!",
  }),
  // Note: Gujarati templates need native-speaker review
  gu: Object.freeze({
    friendly:
      "નમસ્તે {customerName} જી, {companyName} તરફથી સાદર પ્રણામ! 🙏 {tourName} (પ્રવાસ તારીખ: {journeyDate}) માટે બુકિંગ #{invoiceNo} ની કુલ રકમ {totalAmount} છે, જેમાંથી {paidAmount} મળેલ છે. બાકી રકમ {balance} પ્રવાસ પહેલાં જમા કરવા વિનંતી. UPI ચુકવણી માટે UPI ID: {upiId} નો ઉપયોગ કરો. વધુ વિગત માટે {companyPhone} પર સંપર્ક કરો. આભાર!",
    "due-soon":
      "નમસ્તે {customerName} જી, {companyName} તરફથી સાદર પ્રણામ! 🙏 આપનો {tourName} નો પ્રવાસ {journeyDate} ના રોજ છે (બુકિંગ #{invoiceNo}). કૃપા કરીને આપની બાકી રકમ {balance} (કુલ: {totalAmount}, જમા: {paidAmount}) સમયસર ચૂકવવા વિનંતી. UPI ID: {upiId}। સહાય માટે {companyPhone} પર સંપર્ક કરો. આપની યાત્રા સુખદ રહે!",
    overdue:
      "નમસ્તે {customerName} જી, {companyName} તરફથી ચુકવણી માટે જરૂરી યાદી. 🙏 {tourName} ના બુકિંગ #{invoiceNo} પેટે {balance} ની રકમ {daysOverdue} દિવસથી બાકી છે. કૃપા કરીને આ રકમ તાત્કાલિક UPI ID: {upiId} પર જમા કરો અથવા {companyPhone} પર સંપર્ક કરો. આભાર!",
  }),
})

/**
 * Validates a reminder template text.
 * Checks for max length (600 chars), balanced braces, known placeholders, and control characters.
 *
 * @param {string} text
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTemplate(text) {
  const errors = []
  if (typeof text !== "string" || !text.trim()) {
    return { valid: false, errors: ["EMPTY_TEMPLATE"] }
  }

  if (text.length > 600) {
    errors.push("TEMPLATE_TOO_LONG")
  }

  // Check for control characters (ASCII 0-8, 11-12, 14-31, 127)
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text)) {
    errors.push("CONTROL_CHARACTERS")
  }

  // Check balanced braces and extract placeholder names
  let openCount = 0
  let currentPlaceholder = ""
  let inPlaceholder = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === "{") {
      if (inPlaceholder) {
        errors.push("UNBALANCED_BRACES")
        break
      }
      inPlaceholder = true
      currentPlaceholder = ""
      openCount++
    } else if (char === "}") {
      if (!inPlaceholder) {
        errors.push("UNBALANCED_BRACES")
        break
      }
      inPlaceholder = false
      openCount--
      const trimmedName = currentPlaceholder.trim()
      if (!REMINDER_PLACEHOLDERS.includes(trimmedName)) {
        errors.push(`UNKNOWN_PLACEHOLDER:${trimmedName}`)
      }
    } else if (inPlaceholder) {
      currentPlaceholder += char
    }
  }

  if (inPlaceholder || openCount !== 0) {
    if (!errors.includes("UNBALANCED_BRACES")) {
      errors.push("UNBALANCED_BRACES")
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Strips control characters, bidirectional-override characters, and zero-width characters.
 * Collapses whitespace, trims, and truncates to 120 characters.
 *
 * @param {*} v
 * @returns {string}
 */
export function sanitizeValue(v) {
  if (v === null || v === undefined) return ""
  let str = String(v)

  // Strip control characters
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")

  // Strip bidirectional overrides (U+202A to U+202E, U+2066 to U+2069)
  str = str.replace(/[\u202A-\u202E\u2066-\u2069]/g, "")

  // Strip zero-width characters (U+200B, U+200C, U+200D, U+FEFF)
  str = str.replace(/[\u200B-\u200D\uFEFF]/g, "")

  // Collapse multiple whitespace characters into a single space
  str = str.replace(/\s+/g, " ")

  return str.trim().slice(0, 120)
}

/**
 * Formats a monetary number into Indian Rupee format (e.g. ₹12,000 or ₹1,23,456).
 * @param {number|string|null|undefined} amount
 * @returns {string}
 */
export function formatRupees(amount) {
  const num = Number(amount)
  if (!Number.isFinite(num)) return "₹0"
  const isNeg = num < 0
  const abs = Math.round(Math.abs(num))
  const str = abs.toString()
  if (str.length <= 3) {
    return `${isNeg ? "-" : ""}₹${str}`
  }
  const lastThree = str.slice(-3)
  const otherDigits = str.slice(0, -3)
  const grouped = otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ",")
  return `${isNeg ? "-" : ""}₹${grouped},${lastThree}`
}

/**
 * Normalizes date to DD-MM-YYYY format for customer messages.
 * @param {string|Date|null|undefined} d
 * @returns {string}
 */
export function formatDisplayDate(d) {
  if (!d) return ""
  if (typeof d === "string") {
    // If already DD-MM-YYYY
    if (/^\d{2}-\d{2}-\d{4}$/.test(d.trim())) return d.trim()
    // If YYYY-MM-DD
    const isoMatch = d.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) {
      return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`
    }
  }
  const dateObj = new Date(d)
  if (isNaN(dateObj.getTime())) return String(d)
  const day = String(dateObj.getUTCDate()).padStart(2, "0")
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, "0")
  const year = dateObj.getUTCFullYear()
  return `${day}-${month}-${year}`
}

/**
 * Renders a reminder message substituting placeholders.
 * - Replaces only allowed placeholders.
 * - Omits optional UPI clause when upiId is empty.
 * - Formats money values with Indian rupee grouping (₹12,000).
 * - Formats dates as DD-MM-YYYY.
 * - Removes unfulfilled placeholders and dangling punctuation so no '{...}' or 'undefined' remains.
 * - Truncates at word boundary to max 900 characters.
 *
 * @param {Object} params
 * @param {string} params.template
 * @param {Object} params.values
 * @returns {string}
 */
export function renderReminder({ template, values = {} }) {
  if (!template || typeof template !== "string") return ""
  let result = template

  // 1. Handle optional UPI clause: if upiId is empty, cleanly omit the UPI sentence/clause
  const hasUpi = Boolean(values.upiId && String(values.upiId).trim())
  if (!hasUpi) {
    result = result.replace(
      /(?:For UPI payments,\s*use UPI ID:\s*\{upiId\}\.?\s*|UPI भुगतान के लिए UPI ID:\s*\{upiId\} का उपयोग करें[।.]?\s*|UPI ચુકવણી માટે UPI ID:\s*\{upiId\} નો ઉપયોગ કરો[।.]?\s*|via UPI ID:\s*\{upiId\}\s*(?:or|या|અથવા)?\s*|UPI ID:\s*\{upiId\}\s*(?:पर करें या|पर या|પર જમા કરો અથવા)?[।.]?\s*)/gi,
      "",
    )
    // Generic fallback for any remaining {upiId} clause
    result = result.replace(/[^.!?।\n]*\{upiId\}[^.!?।\n]*[.!?।]?\s*/gi, "")
  }

  // 2. Prepare formatted & sanitized values
  const sanitizedValues = {}
  for (const key of REMINDER_PLACEHOLDERS) {
    const rawVal = values[key]
    if (rawVal === undefined || rawVal === null || rawVal === "") {
      sanitizedValues[key] = ""
    } else if (key === "balance" || key === "totalAmount" || key === "paidAmount") {
      sanitizedValues[key] = formatRupees(rawVal)
    } else if (key === "journeyDate") {
      sanitizedValues[key] = formatDisplayDate(rawVal)
    } else {
      sanitizedValues[key] = sanitizeValue(rawVal)
    }
  }

  // 3. Substitute placeholders
  for (const key of REMINDER_PLACEHOLDERS) {
    const placeholder = `{${key}}`
    const val = sanitizedValues[key]
    if (val) {
      result = result.replaceAll(placeholder, val)
    } else {
      // Remove placeholder along with preceding colon, dash or comma if dangling
      result = result.replaceAll(new RegExp(`[:\\-,]?\\s*\\{${key}\\}`, "g"), "")
      result = result.replaceAll(placeholder, "")
    }
  }

  // 4. Clean up any remaining dangling braces or artifacts
  result = result.replace(/\{[a-zA-Z0-9_-]+\}/g, "")
  result = result.replace(/\s+/g, " ").trim()

  // 5. Truncate at word boundary to max 900 characters
  if (result.length > 900) {
    const sub = result.slice(0, 900)
    const lastSpace = sub.lastIndexOf(" ")
    result = lastSpace > 800 ? sub.slice(0, lastSpace).trim() : sub.trim()
  }

  return result
}

/**
 * Builds a direct WhatsApp click-to-chat URL (https://wa.me/91<10 digits>?text=...).
 * Validates that phone is a valid 10-digit Indian mobile number.
 * Returns null if phone or text is invalid/empty.
 *
 * @param {string|number} phone
 * @param {string} text
 * @returns {string|null}
 */
export function buildWhatsAppUrl(phone, text) {
  if (!text || typeof text !== "string" || !text.trim()) {
    return null
  }

  const normalized = normalizeIndianMobile(phone)
  if (!normalized.valid || !normalized.normalized) {
    return null
  }

  const encodedText = encodeURIComponent(text.trim())
  return `https://wa.me/91${normalized.normalized}?text=${encodedText}`
}

/**
 * Suggests an appropriate reminder tone based on financial and journey context.
 *
 * @param {Object} params
 * @param {number} [params.daysOverdue=0]
 * @param {number|null} [params.daysToJourney=null]
 * @param {number} [params.remindersSent=0]
 * @returns {"friendly"|"due-soon"|"overdue"}
 */
export function suggestTone({ daysOverdue = 0, daysToJourney = null, remindersSent = 0 } = {}) {
  if (daysOverdue > 0) {
    return "overdue"
  }
  if (typeof daysToJourney === "number" && daysToJourney >= 0 && daysToJourney <= 7) {
    return "due-soon"
  }
  return "friendly"
}
