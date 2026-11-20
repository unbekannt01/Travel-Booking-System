/**
 * YatraHub (TBS) — Asset Upload Magic Byte Validator (Part 3.7b)
 * Enforces magic-byte file signature verification, strict size limits (max 200 KB),
 * and completely rejects SVG images to prevent XSS script injection vectors.
 */

const MAX_ASSET_SIZE_BYTES = 200 * 1024 // 200 KB

/**
 * Validates an uploaded base64 image or Buffer using file magic bytes.
 *
 * Magic Byte Signatures:
 *  - PNG: 89 50 4E 47 (0x89 'PNG')
 *  - JPEG: FF D8 FF
 *  - WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
 *
 * SVG (and XML-based formats) are strictly rejected.
 *
 * @param {string|Buffer} input - Base64 data URI string or raw Buffer
 * @param {string} [assetType="logo"] - "logo" | "signature" | "stamp"
 * @returns {{ valid: boolean, mimeType?: string, dataUrl?: string, size?: number, error?: string }}
 */
export function validateUploadedAsset(input, assetType = "logo") {
  if (!input) {
    return { valid: false, error: "No asset data provided" }
  }

  let buffer
  let declaredMime = ""

  if (Buffer.isBuffer(input)) {
    buffer = input
  } else if (typeof input === "string") {
    const trimmed = input.trim()
    const dataUriMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/)
    if (dataUriMatch) {
      declaredMime = dataUriMatch[1].toLowerCase()
      buffer = Buffer.from(dataUriMatch[2], "base64")
    } else {
      buffer = Buffer.from(trimmed, "base64")
    }
  } else {
    return { valid: false, error: "Invalid asset data format" }
  }

  if (buffer.length === 0) {
    return { valid: false, error: "Empty asset data" }
  }

  if (buffer.length > MAX_ASSET_SIZE_BYTES) {
    return {
      valid: false,
      error: `Asset size (${Math.round(buffer.length / 1024)} KB) exceeds maximum allowed limit of 200 KB`,
    }
  }

  // Check for SVG / XML signatures in text or declared mime
  if (declaredMime.includes("svg") || declaredMime.includes("xml")) {
    return {
      valid: false,
      error: "SVG format is rejected for security. Please upload PNG, JPEG or WebP images only.",
    }
  }

  const prefix = buffer.slice(0, 100).toString("utf8").toLowerCase()
  if (prefix.includes("<svg") || prefix.includes("<?xml")) {
    return {
      valid: false,
      error: "SVG format is rejected for security. Please upload PNG, JPEG or WebP images only.",
    }
  }

  // Magic bytes checks
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a

  // JPEG: FF D8 FF
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff

  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  const isWebp =
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50

  let mimeType = ""
  if (isPng) {
    mimeType = "image/png"
  } else if (isJpeg) {
    mimeType = "image/jpeg"
  } else if (isWebp) {
    mimeType = "image/webp"
  } else {
    return {
      valid: false,
      error: "Invalid image format. Only PNG, JPEG, and WebP files with valid headers are accepted.",
    }
  }

  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`

  return {
    valid: true,
    mimeType,
    dataUrl,
    size: buffer.length,
    assetType,
  }
}
