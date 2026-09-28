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
 * Validates 12-digit Aadhaar number
 * Optional (returns true if empty/falsy). If provided, must have exactly 12 digits.
 */
export function isValidAadhaar(aadhar) {
  if (!aadhar) return true
  const clean = aadhar.toString().replace(/\s+/g, "")
  return /^\d{12}$/.test(clean)
}
