/**
 * Seat formatting utilities for human-readable sleeper berths and coach layouts.
 */

import { resolveSeatId, formatSeatDisplayName } from "../../shared/seatLayouts.js"

/**
 * Formats a raw or canonical coach seat ID (e.g. "left-L1-1", "right-U3-2", "rear-B1", "seat-12", "lower-L2-1")
 * into a standardized human-friendly string (e.g. "Left L1-1", "Right U3-2", "Rear B1", "Seat 12").
 *
 * @param {string | number | null | undefined} seatId
 * @param {{ layoutKey?: string, busType?: string, fallback?: string }} [options]
 * @returns {string}
 */
export function formatSeatLabel(seatId, { layoutKey, busType, fallback = "Unassigned" } = {}) {
  if (seatId === undefined || seatId === null) return fallback
  const clean = String(seatId).trim()
  if (!clean) return fallback

  // If already formatted like "Seat 12" or "Left L1-1" or "Rear B1", return cleanly
  if (/^(?:Left|Right)\s+[LU]\d+-[12]$/.test(clean)) return clean
  if (/^Rear\s+B[12]$/.test(clean)) return clean
  if (/^Seat\s+\d+$/.test(clean)) return clean

  // Use shared formatter with layout resolution
  const targetLayoutKey = layoutKey || (busType ? undefined : "sleeper-2x1-38")
  const formatted = formatSeatDisplayName(targetLayoutKey, clean)
  if (formatted && formatted !== clean) {
    return formatted
  }

  // Direct canonical regex parsing fallback
  const canonMatch = clean.match(/^(left|right)-([LU]\d+)-([12])$/i)
  if (canonMatch) {
    const side = canonMatch[1].charAt(0).toUpperCase() + canonMatch[1].slice(1).toLowerCase()
    return `${side} ${canonMatch[2].toUpperCase()}-${canonMatch[3]}`
  }
  if (/^rear-B[12]$/i.test(clean)) {
    return `Rear ${clean.slice(-2).toUpperCase()}`
  }
  if (/^seat-\d+$/i.test(clean)) {
    return `Seat ${clean.slice(5)}`
  }
  if (/^\d+$/.test(clean)) {
    return `Seat ${clean}`
  }

  // Legacy lower/upper format
  const legMatch = clean.match(/^(lower|upper)-([A-Za-z0-9-]+)$/i)
  if (legMatch) {
    const resolved = resolveSeatId(targetLayoutKey, clean)
    if (resolved && resolved !== clean) {
      return formatSeatLabel(resolved, { layoutKey: targetLayoutKey, fallback })
    }
    const deck = legMatch[1].charAt(0).toUpperCase() + legMatch[1].slice(1).toLowerCase()
    return `${deck} ${legMatch[2]}`
  }

  return clean
}

/**
 * Formats an array of seat IDs into a concise comma-separated string,
 * optionally truncating with "+N" for dense displays.
 *
 * @param {Array<string | null | undefined>} seatIds
 * @param {{ max?: number, layoutKey?: string, busType?: string, fallback?: string }} [options]
 * @returns {string}
 */
export function formatSeatList(seatIds, { max = 3, layoutKey, busType, fallback = "Unassigned" } = {}) {
  if (!Array.isArray(seatIds)) return fallback
  const valid = seatIds.filter(Boolean)
  if (valid.length === 0) return fallback

  const formatted = valid.map((s) => formatSeatLabel(s, { layoutKey, busType, fallback }))
  if (max > 0 && formatted.length > max) {
    return `${formatted.slice(0, max).join(", ")} +${formatted.length - max}`
  }
  return formatted.join(", ")
}

/**
 * Formats a passenger name to show Last Name + First Name (e.g. "Ghetiya Bipinbhai").
 * Does NOT use the middle name.
 * e.g., "Ghetiya Bipinchandra Devrajbhai" -> "Ghetiya Bipinchandra"
 * e.g., "Hansaliya Sarojben Gandubhai"   -> "Hansaliya Sarojben"
 * e.g., "Ghetiya Bipinbhai"              -> "Ghetiya Bipinbhai"
 *
 * @param {string | null | undefined} fullName
 * @returns {string}
 */
export function formatShortPassengerName(fullName) {
  if (!fullName || typeof fullName !== "string") return ""
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] || ""
  // Display Last Name (parts[0]) + First Name (parts[1]), omitting middle name
  return `${parts[0]} ${parts[1]}`
}


