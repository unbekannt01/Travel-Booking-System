// PII-masking logger utility (SEC-014)

export const maskPiiString = (str) => {
  if (typeof str !== "string") return str
  // Mask 12-digit Aadhaar numbers (spaced or unspaced)
  let masked = str.replace(/\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g, "XXXX-XXXX-$3")
  // Mask 10-digit Indian phone numbers
  masked = masked.replace(/\b([6-9]\d{5})(\d{4})\b/g, "XXXXXX$2")
  // Mask Bearer tokens
  masked = masked.replace(/(Bearer\s+)[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, "$1[REDACTED_JWT]")
  // Mask passwords/secrets in query or json
  masked = masked.replace(/(["']?(?:password|token|secret|twoFactorSecret)["']?\s*[:=]\s*["'])([^"']+)(["'])/gi, "$1[REDACTED]$3")
  return masked
}

export const maskPiiObject = (obj) => {
  if (!obj || typeof obj !== "object") return obj
  if (Array.isArray(obj)) return obj.map(maskPiiObject)

  const sanitized = {}
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    if (
      lowerKey.includes("password") ||
      lowerKey.includes("token") ||
      lowerKey.includes("secret")
    ) {
      sanitized[key] = "[REDACTED]"
    } else if (lowerKey.includes("aadhar") || lowerKey.includes("aadhaar")) {
      sanitized[key] = typeof value === "string" ? maskPiiString(value) : "[REDACTED_AADHAAR]"
    } else if (typeof value === "string") {
      sanitized[key] = maskPiiString(value)
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = maskPiiObject(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

export const logger = {
  info: (msg, ...args) => {
    const cleanMsg = typeof msg === "string" ? maskPiiString(msg) : maskPiiObject(msg)
    const cleanArgs = args.map((a) => (typeof a === "object" ? maskPiiObject(a) : maskPiiString(String(a))))
    console.log(cleanMsg, ...cleanArgs)
  },
  warn: (msg, ...args) => {
    const cleanMsg = typeof msg === "string" ? maskPiiString(msg) : maskPiiObject(msg)
    const cleanArgs = args.map((a) => (typeof a === "object" ? maskPiiObject(a) : maskPiiString(String(a))))
    console.warn(cleanMsg, ...cleanArgs)
  },
  error: (msg, ...args) => {
    const cleanMsg = typeof msg === "string" ? maskPiiString(msg) : maskPiiObject(msg)
    const cleanArgs = args.map((a) => (typeof a === "object" ? maskPiiObject(a) : maskPiiString(String(a))))
    console.error(cleanMsg, ...cleanArgs)
  },
}

export default logger
