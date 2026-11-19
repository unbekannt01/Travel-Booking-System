// Aadhaar encryption and Verhoeff validation utility (SEC-012)
import crypto from "crypto"

// Verhoeff multiplication table d
const d = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]

// Verhoeff permutation table p
const p = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

// Verhoeff inverse table
const inv = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]

/**
 * Validates a 12-digit Indian Aadhaar number using the Verhoeff checksum algorithm.
 * Falsy/empty input is accepted as valid (optional field).
 */
export function validateVerhoeff(aadhar) {
  if (!aadhar) return true
  const clean = aadhar.toString().replace(/\s+/g, "")
  if (!/^\d{12}$/.test(clean)) return false

  let c = 0
  const reversedArray = clean.split("").reverse().map(Number)
  for (let i = 0; i < reversedArray.length; i++) {
    c = d[c][p[i % 8][reversedArray[i]]]
  }
  return c === 0
}

/**
 * Generates the Verhoeff check digit for an 11-digit number.
 */
export function generateVerhoeff(str11) {
  if (!str11) return null
  const clean = str11.toString().replace(/\s+/g, "")
  if (!/^\d{11}$/.test(clean)) return null

  let c = 0
  const reversedArray = clean.split("").reverse().map(Number)
  for (let i = 0; i < reversedArray.length; i++) {
    c = d[c][p[(i + 1) % 8][reversedArray[i]]]
  }
  return inv[c]
}

const getAadhaarKey = () => {
  const secret = process.env.DATA_ENC_KEY || process.env.JWT_SECRET || "fallback_default_data_encryption_key_32"
  return crypto.createHash("sha256").update(secret).digest()
}

/**
 * Encrypts an Aadhaar number using AES-256-GCM.
 * Output format: ivHex:authTagHex:encryptedHex
 */
export function encryptAadhaar(rawAadhaar) {
  if (!rawAadhaar || typeof rawAadhaar !== "string") return rawAadhaar
  const clean = rawAadhaar.replace(/\s+/g, "")
  if (!clean) return clean

  const key = getAadhaarKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  let encrypted = cipher.update(clean, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag().toString("hex")

  return `${iv.toString("hex")}:${authTag}:${encrypted}`
}

/**
 * Decrypts an AES-256-GCM encrypted Aadhaar number.
 * If input is already plaintext or invalid format, returns safely.
 */
export function decryptAadhaar(cipherText) {
  if (!cipherText || typeof cipherText !== "string") return cipherText
  const parts = cipherText.split(":")
  if (parts.length !== 3) {
    return cipherText
  }

  const [ivHex, authTagHex, encryptedHex] = parts
  try {
    const key = getAadhaarKey()
    const iv = Buffer.from(ivHex, "hex")
    const authTag = Buffer.from(authTagHex, "hex")
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encryptedHex, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch (err) {
    console.error("Aadhaar decryption error:", err.message)
    return "[DECRYPTION_FAILED]"
  }
}

/**
 * Formats/masks an Aadhaar number to display only the last 4 digits (e.g. XXXX XXXX 1234).
 */
export function maskAadhaar(rawOrDecrypted) {
  if (!rawOrDecrypted || typeof rawOrDecrypted !== "string") return ""
  const clean = rawOrDecrypted.replace(/\s+/g, "")
  if (clean.length < 4) return clean
  const last4 = clean.slice(-4)
  return `XXXX XXXX ${last4}`
}

/**
 * Checks if a value represents a masked Aadhaar (e.g. XXXX XXXX 1234)
 * or the explicit unchanged sentinel token ("[UNCHANGED]").
 */
export function isMaskedOrUnchangedAadhaar(val) {
  if (!val || typeof val !== "string") return false
  const trimmed = val.trim()
  if (trimmed === "[UNCHANGED]" || trimmed === "[unchanged]") return true
  return /^X{4}[\s-]?X{4}[\s-]?\d{4}$/i.test(trimmed)
}
