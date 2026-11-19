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

/**
 * Evaluates password against security complexity policy (SEC-010).
 * Requires: length >= 10, uppercase, lowercase, number, symbol.
 */
export function checkPasswordCriteria(password) {
  const pwd = typeof password === "string" ? password : ""
  return {
    minLength: pwd.length >= 10,
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
    hasDigit: /[0-9]/.test(pwd),
    hasSpecial: /[^A-Za-z0-9]/.test(pwd),
    isValid:
      pwd.length >= 10 &&
      /[A-Z]/.test(pwd) &&
      /[a-z]/.test(pwd) &&
      /[0-9]/.test(pwd) &&
      /[^A-Za-z0-9]/.test(pwd),
  }
}

/**
 * Maps authentication errors, lockouts, and rate limits to human-readable guidance.
 */
export function formatAuthError(error) {
  if (!error) return "An unexpected error occurred. Please try again."
  const msg = typeof error === "string" ? error : error.message || ""
  const lower = msg.toLowerCase()

  if (lower.includes("locked") || lower.includes("lockout")) {
    return msg
  }
  if (lower.includes("too many") || lower.includes("rate limit") || lower.includes("429")) {
    return "Too many requests. Please wait a moment before trying again."
  }
  if (
    lower.includes("invalid") &&
    (lower.includes("credential") ||
      lower.includes("password") ||
      lower.includes("email") ||
      lower.includes("username"))
  ) {
    return "Invalid username or password. Please verify and try again."
  }
  if (lower.includes("expired") || lower.includes("token")) {
    return msg || "This security link or token has expired. Please request a new one."
  }
  return msg || "Authentication failed. Please verify your connection and try again."
}
