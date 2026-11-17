import crypto from "crypto"

function getTotpKey() {
  const raw = process.env.TOTP_ENC_KEY || process.env.JWT_SECRET || "yatrahub_default_totp_key_32_bytes_!"
  return crypto.createHash("sha256").update(raw).digest()
}

/**
 * Encrypts TOTP secret with AES-256-GCM.
 * Output format: ivHex:authTagHex:ciphertextHex
 */
export function encryptTotp(plaintext) {
  if (!plaintext || typeof plaintext !== "string") return null
  const key = getTotpKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  let encrypted = cipher.update(plaintext, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag().toString("hex")
  return `${iv.toString("hex")}:${authTag}:${encrypted}`
}

/**
 * Decrypts TOTP secret from AES-256-GCM (ivHex:authTagHex:ciphertextHex).
 * If the string is unencrypted (legacy format), returns it as-is.
 */
export function decryptTotp(ciphertext) {
  if (!ciphertext || typeof ciphertext !== "string") return null
  const parts = ciphertext.split(":")
  if (parts.length !== 3) {
    return ciphertext
  }
  const [ivHex, authTagHex, encHex] = parts
  try {
    const key = getTotpKey()
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"))
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"))
    let decrypted = decipher.update(encHex, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch (err) {
    console.error("Warning: Failed to decrypt TOTP secret:", err.message)
    return null
  }
}
