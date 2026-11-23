import { useState, useEffect, useRef, useCallback } from "react"
import { Modal, Button, Spinner, Select } from "../ui"
import { RateLimitNotice } from "../common/RateLimitNotice"
import { getCustomerStatement } from "../../data/customers"
import { renderCustomerStatementHtml } from "../../../shared/statementRenderer"
import { downloadCsv } from "../../utils/csv"
import { Printer, Download, RefreshCw, Calendar, Globe } from "lucide-react"

/**
 * Calculates date range presets for financial periods.
 * @param {string} preset
 * @returns {{ from: string, to: string }}
 */
function getPresetDates(preset) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed: 0 = Jan, 3 = April

  const toDateStr = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }

  const today = toDateStr(now)

  switch (preset) {
    case "this-fy": {
      const startYear = month >= 3 ? year : year - 1
      return { from: `${startYear}-04-01`, to: today }
    }
    case "last-fy": {
      const startYear = month >= 3 ? year - 1 : year - 2
      const endYear = startYear + 1
      return { from: `${startYear}-04-01`, to: `${endYear}-03-31` }
    }
    case "this-month": {
      const mStr = String(month + 1).padStart(2, "0")
      return { from: `${year}-${mStr}-01`, to: today }
    }
    case "all-time":
    default:
      return { from: "", to: today }
  }
}

export default function StatementModal({
  isOpen,
  onClose,
  customer,
  initialPreset = "this-fy",
}) {
  const [preset, setPreset] = useState(initialPreset)
  const [fromDate, setFromDate] = useState(() => getPresetDates(initialPreset).from)
  const [toDate, setToDate] = useState(() => getPresetDates(initialPreset).to)
  const [lang, setLang] = useState("en")
  const [loading, setLoading] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)
  const [retryAfter, setRetryAfter] = useState(60)
  const [error, setError] = useState(null)
  const [statementData, setStatementData] = useState(null)
  const [operatorSettings, setOperatorSettings] = useState(null)

  const iframeRef = useRef(null)

  const customerId = customer?._id || customer?.id || customer?.customerId
  const customerName = customer?.name || customer?.customerName || "Customer"

  const fetchStatement = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    setError(null)
    setRateLimited(false)

    try {
      const res = await getCustomerStatement(customerId, {
        from: fromDate,
        to: toDate,
      })
      if (res?.success) {
        setStatementData(res.statement)
        setOperatorSettings(res.operatorSettings || {})
      } else {
        setError(res?.message || "Failed to load account statement")
      }
    } catch (err) {
      if (err.status === 429) {
        setRateLimited(true)
        setRetryAfter(err.retryAfter || 60)
      } else {
        setError(err.message || "Failed to retrieve statement data")
      }
    } finally {
      setLoading(false)
    }
  }, [customerId, fromDate, toDate])

  useEffect(() => {
    if (isOpen && customerId) {
      fetchStatement()
    }
  }, [isOpen, customerId, fetchStatement])

  const handlePresetChange = (newPreset) => {
    setPreset(newPreset)
    if (newPreset !== "custom") {
      const dates = getPresetDates(newPreset)
      setFromDate(dates.from)
      setToDate(dates.to)
    }
  }

  // Print iframe content
  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.focus()
      iframeRef.current.contentWindow.print()
    }
  }

  // Export statement lines to CSV with RFC4180 guarantees
  const handleExportCsv = () => {
    if (!statementData) return

    const rows = [
      ["Date", "Ref / Invoice", "Transaction Description", "Debit (INR)", "Credit (INR)", "Running Balance (INR)"],
      [
        statementData.period?.from || "Opening",
        "—",
        "Opening Balance",
        "",
        "",
        String(statementData.openingBalance || 0),
      ],
    ]

    for (const l of statementData.lines || []) {
      rows.push([
        l.date,
        l.ref,
        l.description,
        l.debit ? String(l.debit) : "",
        l.credit ? String(l.credit) : "",
        String(l.runningBalance),
      ])
    }

    rows.push([
      statementData.period?.to || "Closing",
      "—",
      "Closing Balance (Due)",
      String(statementData.totalDebits || 0),
      String(statementData.totalCredits || 0),
      String(statementData.closingBalance || 0),
    ])

    const safeName = (customer?.name || "Customer").replace(/[^a-zA-Z0-9_-]+/g, "_")
    const filename = `Statement_${safeName}_${fromDate || "all"}_to_${toDate || "today"}.csv`
    downloadCsv(filename, rows)
  }

  // Generate HTML for iframe preview
  const statementHtml = statementData
    ? renderCustomerStatementHtml({
        statement: statementData,
        operatorSettings: operatorSettings || {},
        lang,
      })
    : ""

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Customer Statement — ${customerName}`}
      size="xl"
    >
      <div className="space-y-4">
        {/* Controls bar: Presets, Custom Date Range, Language */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[var(--yh-radius-lg)] bg-surface-subtle border border-border-subtle">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Statement Period Presets">
            {[
              { id: "this-fy", label: "This FY" },
              { id: "last-fy", label: "Last FY" },
              { id: "this-month", label: "This Month" },
              { id: "all-time", label: "All Time" },
              { id: "custom", label: "Custom" },
            ].map((p) => {
              const active = preset === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetChange(p.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-[var(--yh-radius-md)] transition-colors cursor-pointer ${
                    active
                      ? "bg-brand text-brand-contrast shadow-xs"
                      : "bg-surface text-ink-muted hover:text-ink hover:bg-surface-hover border border-border"
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* Language Switcher */}
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-ink-muted" />
            <Select
              aria-label="Statement Language"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="text-xs py-1 px-2.5 h-8 min-w-[120px]"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
              <option value="gu">ગુજરાતી (Gujarati)</option>
            </Select>
          </div>
        </div>

        {/* Custom date range inputs when Custom preset is selected */}
        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-[var(--yh-radius-md)] bg-surface border border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink-muted">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1 text-xs rounded border border-border bg-surface text-ink"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink-muted">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1 text-xs rounded border border-border bg-surface text-ink"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchStatement}
              disabled={loading}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Apply
            </Button>
          </div>
        )}

        {/* Rate limit banner */}
        {rateLimited && (
          <RateLimitNotice
            retryAfter={retryAfter}
            onRetry={fetchStatement}
            className="my-2"
          />
        )}

        {/* Error message */}
        {error && !rateLimited && (
          <div className="p-4 rounded-[var(--yh-radius-md)] bg-danger-subtle text-danger text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={fetchStatement}>
              Retry
            </Button>
          </div>
        )}

        {/* Preview Frame */}
        <div className="relative min-h-[480px] rounded-lg border border-border overflow-hidden bg-white">
          {loading && (
            <div className="absolute inset-0 bg-surface/75 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-10">
              <Spinner size="lg" />
              <p className="text-xs font-medium text-ink-muted">Preparing statement ledger...</p>
            </div>
          )}

          {!loading && !error && statementHtml && (
            <iframe
              ref={iframeRef}
              title={`Statement Preview for ${customer?.name || "Customer"}`}
              sandbox="allow-same-origin allow-modals"
              srcDoc={statementHtml}
              className="w-full h-[520px] border-0"
            />
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border-subtle">
          <div className="text-xs text-ink-muted flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              Period: {fromDate || "Beginning"} to {toDate || "Today"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={loading || !statementData}
              className="gap-1.5"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handlePrint}
              disabled={loading || !statementData}
              className="gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </Button>

            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
