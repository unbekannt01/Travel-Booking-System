/**
 * Validates 10-digit Indian mobile number
 * Accepts formats: 9876543210, +919876543210, 09876543210, 919876543210
 */
export function isValidIndianPhone(phone) {
  if (!phone) return false
  const clean = phone.toString().replace(/[\s\-()+]/g, "")
  if (clean.length === 12 && clean.startsWith("91")) {
    return /^[6-9]\d{9}$/.test(clean.slice(2))
  }
  if (clean.length === 11 && clean.startsWith("0")) {
    return /^[6-9]\d{9}$/.test(clean.slice(1))
  }
  return /^[6-9]\d{9}$/.test(clean)
}

/**
 * Checks if a value is a masked Aadhaar (e.g. XXXX XXXX 1234) or unchanged placeholder.
 */
export function isMaskedAadhaar(aadhar) {
  if (!aadhar || typeof aadhar !== "string") return false
  const trimmed = aadhar.trim()
  if (trimmed === "[UNCHANGED]" || trimmed === "[unchanged]") return true
  return /^X{4}[\s-]?X{4}[\s-]?\d{4}$/i.test(trimmed)
}

/**
 * Validates 12-digit Aadhaar number
 * Optional (returns true if empty/falsy). If provided, must have exactly 12 digits,
 * or match masked format when allowMasked is true.
 */
export function isValidAadhaar(aadhar, { allowMasked = false } = {}) {
  if (!aadhar) return true
  const clean = aadhar.toString().replace(/\s+/g, "")
  if (allowMasked && isMaskedAadhaar(aadhar)) return true
  return /^\d{12}$/.test(clean)
}
