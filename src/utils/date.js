/**
 * Safely extracts YYYY-MM-DD string without timezone day-shifting.
 * Works consistently across UTC and IST (UTC+5:30).
 */
export function toDateInputValue(dateInput) {
  if (!dateInput) return ""
  if (typeof dateInput === "string") {
    const match = dateInput.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) return match[1]
  }
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return ""
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Formats a date for display in Indian format (DD/MM/YYYY).
 */
export function formatDisplayDate(dateInput) {
  if (!dateInput) return "—"
  const dateStr = toDateInputValue(dateInput)
  if (!dateStr) return "—"
  const [year, month, day] = dateStr.split("-")
  return `${day}/${month}/${year}`
}
