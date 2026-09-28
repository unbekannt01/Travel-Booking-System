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
 * Formats amount in Indian Rupee format
 */
export function formatINR(amount) {
  const num = Number(amount) || 0
  return `₹${num.toLocaleString("en-IN")}`
}
