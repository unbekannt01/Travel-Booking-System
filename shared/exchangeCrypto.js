/**
 * Pure ESM Exchange Crypto for yatriDesk (SeatDesk v18) / TBS Envelope (AES-GCM + PBKDF2)
 *
 * Implements the shared password encryption envelope contract:
 * { "yatriDesk": 1, "enc": "AES-GCM", "kdf": "PBKDF2-SHA256", "it": 250000, "salt": "<base64, 16 bytes>", "iv": "<base64, 12 bytes>", "data": "<base64>" }
 *
 * Zero external dependencies. Uses standard globalThis.crypto.subtle.
 * Works consistently in modern browsers and Node 20+.
 */

export const DEFAULT_ITERATIONS = 250000
export const MIN_ITERATIONS = 100000
export const MAX_ITERATIONS = 1000000

export function isEncryptedEnvelope(obj) {
  return Boolean(obj && typeof obj === "object" && obj.enc)
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64")
  }
  let binary = ""
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBytes(b64) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"))
  }
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function deriveKey(password, saltBytes, iterations, usage) {
  const enc = new TextEncoder()
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  )

  const clampedIterations = Math.max(
    MIN_ITERATIONS,
    Math.min(MAX_ITERATIONS, Number(iterations) || DEFAULT_ITERATIONS)
  )

  return globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: clampedIterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  )
}

/**
 * Recursively rejects prototype pollution / dangerous keys in decrypted objects.
 */
function assertNoProhibitedKeys(obj) {
  if (!obj || typeof obj !== "object") return
  for (const k of Object.keys(obj)) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") {
      throw new Error("Security violation: decrypted payload contains prohibited object keys.")
    }
    if (typeof obj[k] === "object") {
      assertNoProhibitedKeys(obj[k])
    }
  }
}

/**
 * Encrypt an exchange object into a password-protected envelope.
 *
 * @param {Object} obj - The plain exchange object
 * @param {string} password - Minimum 8 character password
 * @returns {Promise<Object>} Envelope object
 */
export async function encryptExchange(obj, password) {
  if (!password || typeof password !== "string" || password.length < 8) {
    throw new Error("Encryption password must be at least 8 characters.")
  }

  const saltBytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(saltBytes)

  const ivBytes = new Uint8Array(12)
  globalThis.crypto.getRandomValues(ivBytes)

  const key = await deriveKey(password, saltBytes, DEFAULT_ITERATIONS, "encrypt")

  const plainText = JSON.stringify(obj)
  const plainBytes = new TextEncoder().encode(plainText)

  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    plainBytes
  )

  return {
    yatriDesk: 1,
    enc: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    it: DEFAULT_ITERATIONS,
    salt: bytesToBase64(saltBytes),
    iv: bytesToBase64(ivBytes),
    data: bytesToBase64(new Uint8Array(cipherBuffer)),
  }
}

/**
 * Decrypt a password-protected exchange envelope.
 *
 * @param {Object} envelope - The encrypted envelope object
 * @param {string} password - Operator provided password
 * @returns {Promise<Object>} The decrypted plain exchange object
 */
export async function decryptExchange(envelope, password) {
  if (!envelope || typeof envelope !== "object") {
    throw new Error("Invalid envelope format.")
  }
  if (!envelope.enc) {
    throw new Error("Unrecognized encryption envelope format: missing 'enc' attribute.")
  }
  if (envelope.enc !== "AES-GCM") {
    throw new Error(`Unsupported encryption algorithm '${envelope.enc}'. Expected 'AES-GCM'.`)
  }
  if (!envelope.data || !envelope.salt || !envelope.iv) {
    throw new Error("Corrupted envelope: missing data, salt, or IV.")
  }
  if (!password || typeof password !== "string") {
    throw new Error("Password is required to decrypt this file.")
  }

  try {
    const saltBytes = base64ToBytes(envelope.salt)
    const ivBytes = base64ToBytes(envelope.iv)

    if (saltBytes.length !== 16) {
      throw new Error("Invalid envelope: salt must be exactly 16 bytes.")
    }
    if (ivBytes.length !== 12) {
      throw new Error("Invalid envelope: IV must be exactly 12 bytes.")
    }

    const dataBytes = base64ToBytes(envelope.data)
    const key = await deriveKey(password, saltBytes, envelope.it, "decrypt")

    const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes },
      key,
      dataBytes
    )

    const dec = new TextDecoder()
    const jsonStr = dec.decode(decryptedBuffer)

    // Check for prohibited keys in raw string before and after parsing
    if (jsonStr.includes("__proto__") || jsonStr.includes("constructor") || jsonStr.includes("prototype")) {
      const tempParsed = JSON.parse(jsonStr)
      assertNoProhibitedKeys(tempParsed)
      return tempParsed
    }

    return JSON.parse(jsonStr)
  } catch (err) {
    if (err.message?.includes("Security violation") || err.message?.includes("Invalid envelope")) {
      throw err
    }
    // Standard WebCrypto authentication tag or password mismatch
    throw new Error("Decryption failed: Incorrect password or corrupted file.")
  }
}
