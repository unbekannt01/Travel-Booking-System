/**
 * Masks Aadhaar number to XXXX XXXX 1234
 */
export function maskAadhaar(aadhar) {
  if (!aadhar) return "—"
  const clean = aadhar.toString().replace(/\s+/g, "")
  if (clean.length === 12) {
    return `XXXX XXXX ${clean.slice(-4)}`
  }
  return aadhar
}

/**
 * Formats 12 digits as XXXX XXXX XXXX
 */
export function formatAadhaarInput(val) {
  if (!val) return ""
  const clean = val.toString().replace(/\D/g, "").slice(0, 12)
  const parts = []
  for (let i = 0; i < clean.length; i += 4) {
    parts.push(clean.slice(i, i + 4))
  }
  return parts.join(" ")
}

/**
 * Formats an amount in Indian Rupee format with Indian digit grouping (e.g. ₹1,23,456 or ₹1,23,456.50).
 * @param {number | string | null | undefined} amount
 * @param {{ decimals?: 0 | 2 } | 0 | 2} [options] - Specify 0 or 2 fixed decimals; omit for integer/natural precision.
 * @returns {string}
 */
export function formatINR(amount, options) {
  const parsed = Number(amount)
  const num = Number.isFinite(parsed) ? parsed : 0
  const isNegative = num < 0
  const abs = Math.abs(num)

  const decimals =
    typeof options === "number"
      ? options
      : options && typeof options.decimals === "number"
        ? options.decimals
        : undefined

  const formatOptions =
    decimals === 0 || decimals === 2
      ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
      : { maximumFractionDigits: 2 }

  const formatted = abs.toLocaleString("en-IN", formatOptions)
  return isNegative ? `-₹${formatted}` : `₹${formatted}`
}

export { formatSeatLabel, formatSeatList } from "./seatFormatting.js"
