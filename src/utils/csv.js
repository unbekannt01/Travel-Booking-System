/**
 * Utility for safe CSV generation and export.
 * - Adds UTF-8 Byte Order Mark (\uFEFF) for Excel compatibility.
 * - Safely quotes fields with commas, quotes, or newlines.
 * - Escapes double quotes as "".
 * - Sanitizes spreadsheet formula injection characters (=, +, -, @).
 */

/**
 * Escapes a single value for safe CSV output.
 * @param {any} value
 * @returns {string}
 */
export const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return '""'
  }
  let str = String(value)

  // Protect against spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }

  // If contains double quotes, commas, or newlines, quote and escape
  if (/[",\n\r]/.test(str) || str.startsWith("'")) {
    return `"${str.replace(/"/g, '""')}"`
  }

  return `"${str}"`
}

/**
 * Converts array of rows (each row is an array of values) into a CSV string.
 * @param {Array<Array<any>>} rows
 * @returns {string}
 */
export const toCsvString = (rows) => {
  const csvBody = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n")
  // Prefix with UTF-8 BOM so Excel decodes UTF-8 (Hindi, Gujarati, special characters) correctly
  return `\uFEFF${csvBody}`
}

/**
 * Triggers a client-side download of a CSV file.
 * @param {string} filename
 * @param {Array<Array<any>>} rows
 */
export const downloadCsv = (filename, rows) => {
  const csvContent = toCsvString(rows)
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
