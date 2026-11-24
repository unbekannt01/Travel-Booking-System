/**
 * Formats a raw tab button string into a clean label with count badge in parentheses.
 * e.g. "Bookings Table\n4" -> "Bookings Table (4)", "All 12" -> "All (12)"
 * @param {string} raw
 * @returns {string}
 */
export function formatTabLabel(raw) {
  if (!raw) return ""
  const parts = String(raw)
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]
    if (/^\d+$/.test(last)) {
      const mainLabel = parts.slice(0, parts.length - 1).join(" ")
      return `${mainLabel} (${last})`
    }
    return parts.join(" ")
  }
  const single = parts[0]
  const match = single.match(/^(.+?)\s+(\d+)$/)
  if (match && !/^\d+$/.test(match[1])) {
    return `${match[1]} (${match[2]})`
  }
  return single
}

/**
 * Formats a single atomic summary line for a completed screen run.
 * @param {object} params
 * @returns {string}
 */
export function formatScreenSummary({
  screenLabel,
  viewportCount,
  themeCount,
  tabLabel,
  statesCount,
  errorCount,
  breachCount,
  durationMs,
  budgetExceeded,
}) {
  const isOk = errorCount === 0 && breachCount === 0 && !budgetExceeded
  const seconds = (durationMs / 1000).toFixed(1)
  if (isOk) {
    return `[ui:smoke] ✓ ${screenLabel} (${viewportCount} viewports, ${themeCount} themes, ${tabLabel}): ${statesCount} states, 0 errors, ${seconds}s`
  }
  const parts = []
  if (errorCount > 0) parts.push(`${errorCount} error${errorCount > 1 ? "s" : ""}`)
  if (breachCount > 0) parts.push(`${breachCount} budget breach${breachCount > 1 ? "es" : ""}`)
  if (budgetExceeded && breachCount === 0) parts.push("budget exceeded")
  return `[ui:smoke] ✗ ${screenLabel} (${viewportCount} viewports, ${themeCount} themes, ${tabLabel}): ${statesCount} states, ${parts.join(", ")}, ${seconds}s`
}
