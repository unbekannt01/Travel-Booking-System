/**
 * Seat formatting utilities for human-readable sleeper berths and coach layouts.
 */

/**
 * Formats a raw coach seat ID (e.g. "lower-L1-1", "upper-R2-2", "lower-L3")
 * into a human-friendly string (e.g. "Lower L1-1", "Upper R2-2", "Lower L3").
 *
 * @param {string | null | undefined} seatId
 * @param {{ fallback?: string }} [options]
 * @returns {string}
 */
export function formatSeatLabel(seatId, { fallback = "Unassigned" } = {}) {
  if (!seatId || typeof seatId !== "string" || !seatId.trim()) {
    return fallback
  }
  const clean = seatId.trim()
  const match = clean.match(/^(lower|upper)-([A-Za-z0-9-]+)$/i)
  if (match) {
    const deck = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
    return `${deck} ${match[2]}`
  }
  return clean
}

/**
 * Formats an array of seat IDs into a concise comma-separated string,
 * optionally truncating with "+N" for dense displays.
 *
 * @param {Array<string | null | undefined>} seatIds
 * @param {{ max?: number, fallback?: string }} [options]
 * @returns {string}
 */
export function formatSeatList(seatIds, { max = 3, fallback = "Unassigned" } = {}) {
  if (!Array.isArray(seatIds)) return fallback
  const valid = seatIds.filter(Boolean)
  if (valid.length === 0) return fallback

  const formatted = valid.map((s) => formatSeatLabel(s))
  if (max > 0 && formatted.length > max) {
    return `${formatted.slice(0, max).join(", ")} +${formatted.length - max}`
  }
  return formatted.join(", ")
}
