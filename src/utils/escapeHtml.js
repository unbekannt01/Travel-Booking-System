/**
 * HTML Output Encoding & Sanitization Helpers
 * Strictly neutralizes XSS vectors when interpolating data into HTML template strings.
 */

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

/**
 * Escapes characters with special meaning in HTML (&, <, >, ", ').
 * Safely handles null, undefined, numbers, and boolean values.
 * @param {any} val
 * @returns {string}
 */
export function escapeHtml(val) {
  if (val === null || val === undefined) return ""
  if (typeof val === "number" || typeof val === "boolean") return String(val)
  return String(val).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
}

/**
 * Validates and sanitizes a CSS color string to only allow standard 3, 4, 6, or 8-digit #hex colors.
 * Reverts to a safe fallback color if invalid or malicious (e.g. `red; behavior: url(...)`).
 * @param {string} color
 * @param {string} [fallback="#4f46e5"]
 * @returns {string}
 */
export function sanitizeHexColor(color, fallback = "#4f46e5") {
  if (typeof color !== "string") return fallback
  const trimmed = color.trim()
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return trimmed
  }
  return fallback
}

/**
 * Validates and sanitizes image source URLs.
 * Allows safe data URIs (PNG, JPEG, WebP, SVG) or relative paths / same-origin URLs.
 * Rejects javascript:, vbscript:, or external unvetted origins.
 * @param {string} url
 * @returns {string}
 */
export function sanitizeImageUrl(url) {
  if (!url || typeof url !== "string") return ""
  const trimmed = url.trim()
  // Safe base64 image data URIs
  if (/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed
  }
  // Safe relative paths starting with /
  if (/^\/[a-zA-Z0-9_\-./]+\.(png|jpg|jpeg|svg|webp)$/i.test(trimmed)) {
    return trimmed
  }
  return ""
}
