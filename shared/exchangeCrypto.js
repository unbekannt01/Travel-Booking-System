/**
 * Pure ESM Exchange Crypto for yatriDesk / TBS Envelope (AES-GCM + PBKDF2)
 *
 * Implements the shared password encryption envelope contract:
 * { "yatriDesk": 1, "enc": "AES-GCM", "kdf": "PBKDF2-SHA256", "it": 250000, "salt": "<base64>", "iv": "<base64>", "data": "<base64>" }
 *
 * Zero external dependencies. Uses standard globalThis.crypto.subtle.
 * Works consistently in modern browsers and Node 20+.
 */

const ITERATIONS = 250000

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

  return globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: iterations || ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  )
}

/**
 * Encrypt an exchange object into a password-protected envelope.
 *
 * @param {Object} obj - The plain exchange object
 * @param {string} password - Minimum 8 character password
 * @returns {Promise<Object>} Envelope object
 */
export async function encryptExchange(obj, password) {
  if (!password || typeof password !== "string" || password.length < 6) {
    throw new Error("Encryption password must be at least 6 characters.")
  }

  const saltBytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(saltBytes)

  const ivBytes = new Uint8Array(12)
  globalThis.crypto.getRandomValues(ivBytes)

  const key = await deriveKey(password, saltBytes, ITERATIONS, "encrypt")

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
    it: ITERATIONS,
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
  if (!envelope.yatriDesk || envelope.enc !== "AES-GCM" || !envelope.data || !envelope.salt || !envelope.iv) {
    throw new Error("Unrecognized encryption envelope format.")
  }
  if (!password || typeof password !== "string") {
    throw new Error("Password is required to decrypt this file.")
  }

  try {
    const saltBytes = base64ToBytes(envelope.salt)
    const ivBytes = base64ToBytes(envelope.iv)
    const dataBytes = base64ToBytes(envelope.data)

    const key = await deriveKey(password, saltBytes, envelope.it || ITERATIONS, "decrypt")

    const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes },
      key,
      dataBytes
    )

    const dec = new TextDecoder()
    const jsonStr = dec.decode(decryptedBuffer)
    return JSON.parse(jsonStr)
  } catch (err) {
    if (err.name === "OperationError" || err.message?.includes("operation failed") || err.message?.includes("bad tag")) {
      throw new Error("Incorrect password. Unable to decrypt passenger file.")
    }
    throw new Error(`Decryption failed: ${err.message}`)
  }
}
