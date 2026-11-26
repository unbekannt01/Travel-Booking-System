import { useState, useEffect, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import {
  Printer,
  Settings2,
  RotateCcw,
  FileSpreadsheet,
  Bus,
  FileText,
  Languages,
  X,
  Check,
} from "lucide-react"
import {
  PAYMENT_SHEET_COLUMNS,
  PAYMENT_SHEET_DEFAULTS,
  normalizePaymentSheetColumns,
  renderPaymentSheetHtml,
} from "../../../shared/paymentSheet.js"
import { getDepartureManifest, listDepartures } from "../../data/departures"
import { formatDisplayDate } from "../../utils/date"
import { useToast } from "./ToastContext"
import {
  Button,
  Checkbox,
  Switch,
  Select,
  Spinner,
} from "../ui"

const STORAGE_KEY = "yh_paysheet_preferences"

const DEFAULT_SETTINGS = {
  columns: [...PAYMENT_SHEET_DEFAULTS],
  sort: "seat",
  orientation: "auto",
  language: "en",
  showCompanyHeader: true,
  nameScript: "en",
  showDeckBreakdown: true,
  showTotalsSummary: true,
}

function loadSavedPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      columns: normalizePaymentSheetColumns(parsed.columns),
      sort: ["seat", "name", "booking"].includes(parsed.sort) ? parsed.sort : "seat",
      orientation: ["auto", "portrait", "landscape"].includes(parsed.orientation)
        ? parsed.orientation
        : "auto",
      language: ["en", "hi", "gu"].includes(parsed.language) ? parsed.language : "en",
      showCompanyHeader:
        typeof parsed.showCompanyHeader === "boolean" ? parsed.showCompanyHeader : true,
      nameScript: ["en", "gu", "both"].includes(parsed.nameScript) ? parsed.nameScript : "en",
      showDeckBreakdown:
        typeof parsed.showDeckBreakdown === "boolean" ? parsed.showDeckBreakdown : true,
      showTotalsSummary:
        typeof parsed.showTotalsSummary === "boolean" ? parsed.showTotalsSummary : true,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function savePreferences(settings) {
  try {
    const payload = {
      columns: settings.columns,
      sort: settings.sort,
      orientation: settings.orientation,
      language: settings.language,
      showCompanyHeader: settings.showCompanyHeader,
      nameScript: settings.nameScript,
      showDeckBreakdown: settings.showDeckBreakdown,
      showTotalsSummary: settings.showTotalsSummary,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Non-blocking quota error
  }
}

export default function PaymentSheetModal({
  isOpen,
  onClose,
  departureKey,
  departures: initialDepartures = [],
  user = null,
}) {
  const iframeRef = useRef(null)
  const saved = useMemo(() => loadSavedPreferences(), [])
  const { toast } = useToast()

  const [availableDepartures, setAvailableDepartures] = useState(initialDepartures)
  const [selectedKey, setSelectedKey] = useState(departureKey || "")
  const [columns, setColumns] = useState(saved.columns)
  const [sort, setSort] = useState(saved.sort)
  const [orientation, setOrientation] = useState(saved.orientation)
  const [language, setLanguage] = useState(saved.language)
  const [showCompanyHeader, setShowCompanyHeader] = useState(saved.showCompanyHeader)
  const [nameScript, setNameScript] = useState(saved.nameScript)
  const [showDeckBreakdown, setShowDeckBreakdown] = useState(saved.showDeckBreakdown)
  const [showTotalsSummary, setShowTotalsSummary] = useState(saved.showTotalsSummary)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [departureMeta, setDepartureMeta] = useState(null)
  const [passengers, setPassengers] = useState([])

  // Synchronize available departures when props change or load from backend
  useEffect(() => {
    if (initialDepartures.length > 0) {
      setAvailableDepartures(initialDepartures)
      if (!selectedKey && initialDepartures[0]?.key) {
        setSelectedKey(initialDepartures[0].key)
      }
    } else if (isOpen) {
      listDepartures()
        .then((res) => {
          const list = res.departures || res || []
          setAvailableDepartures(list)
          if (!selectedKey && list.length > 0) {
            setSelectedKey(list[0].key)
          }
        })
        .catch(() => {})
    }
  }, [initialDepartures, isOpen, selectedKey])

  useEffect(() => {
    if (departureKey) {
      setSelectedKey(departureKey)
    }
  }, [departureKey])

  // Save preferences when settings change
  useEffect(() => {
    savePreferences({
      columns,
      sort,
      orientation,
      language,
      showCompanyHeader,
      nameScript,
      showDeckBreakdown,
      showTotalsSummary,
    })
  }, [
    columns,
    sort,
    orientation,
    language,
    showCompanyHeader,
    nameScript,
    showDeckBreakdown,
    showTotalsSummary,
  ])

  // Fetch departure passenger data when selected departure key changes
  useEffect(() => {
    if (!isOpen || !selectedKey) return

    setLoading(true)
    setError(null)

    getDepartureManifest(selectedKey)
      .then((data) => {
        setDepartureMeta(data.departure || {})
        setPassengers(data.passengers || [])
      })
      .catch((err) => {
        console.error("Failed to load departure for payment sheet:", err)
        setError("Failed to load departure passenger data.")
        toast.error("Failed to load departure passengers.")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [isOpen, selectedKey, toast])

  // Handle column toggle
  const handleToggleColumn = (colId) => {
    const colDef = PAYMENT_SHEET_COLUMNS.find((c) => c.id === colId)
    if (colDef?.required) {
      toast.info(`${colDef.label} is required and cannot be removed.`)
      return
    }

    setColumns((prev) => {
      const isSelected = prev.includes(colId)
      const next = isSelected ? prev.filter((id) => id !== colId) : [...prev, colId]
      return normalizePaymentSheetColumns(next)
    })
  }

  // Reset to default settings
  const handleResetDefaults = () => {
    setColumns([...PAYMENT_SHEET_DEFAULTS])
    setSort(DEFAULT_SETTINGS.sort)
    setOrientation(DEFAULT_SETTINGS.orientation)
    setLanguage(DEFAULT_SETTINGS.language)
    setShowCompanyHeader(DEFAULT_SETTINGS.showCompanyHeader)
    setNameScript(DEFAULT_SETTINGS.nameScript)
    setShowDeckBreakdown(DEFAULT_SETTINGS.showDeckBreakdown)
    setShowTotalsSummary(DEFAULT_SETTINGS.showTotalsSummary)
    toast.success("Reset to default columns and settings.")
  }

  // Company Info
  const companyInfo = useMemo(() => {
    return {
      companyName: user?.companyName || departureMeta?.companyName || "YATRA HUB",
      companyPhone: user?.companyPhone || user?.phone || departureMeta?.companyPhone || "",
      companyAddress: user?.address || user?.companyHeadquarters || departureMeta?.companyAddress || "",
    }
  }, [user, departureMeta])

  // Render sandboxed HTML
  const htmlContent = useMemo(() => {
    if (!isOpen || !departureMeta) return ""
    return renderPaymentSheetHtml({
      departure: departureMeta,
      passengers,
      columns,
      sort,
      orientation,
      language,
      showCompanyHeader,
      companyInfo,
      nameScript,
      showDeckBreakdown,
      showTotalsSummary,
    })
  }, [
    isOpen,
    departureMeta,
    passengers,
    columns,
    sort,
    orientation,
    language,
    showCompanyHeader,
    companyInfo,
    nameScript,
    showDeckBreakdown,
    showTotalsSummary,
  ])

  // Update preview iframe
  useEffect(() => {
    if (!isOpen || !iframeRef.current || loading || error) return
    const iframe = iframeRef.current
    iframe.srcdoc = htmlContent
  }, [isOpen, htmlContent, loading, error])

  // Handle direct print
  const handlePrint = () => {
    if (!htmlContent) return
    try {
      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        toast.error("Pop-up blocked. Please allow pop-ups to print payment sheet.")
        return
      }

      printWindow.document.open()
      printWindow.document.write(htmlContent)
      printWindow.document.close()

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.focus()
          printWindow.print()
        }, 250)
      }
    } catch (err) {
      console.error("Print payment sheet error:", err)
      toast.error("Failed to open print preview")
    }
  }

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-sheet-title"
    >
      <div className="relative w-full max-w-6xl bg-surface border border-border-subtle rounded-[var(--yh-radius-2xl)] shadow-2xl flex flex-col h-[94vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-surface-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet size={19} />
            </div>
            <div>
              <h2 id="payment-sheet-title" className="text-base sm:text-lg font-bold text-ink">
                Operator Payment &amp; Collection Sheet
              </h2>
              <p className="text-xs text-ink-muted">
                {departureMeta?.tourName || "Departure"} • {formatDisplayDate(departureMeta?.dateStr) || "Date"} • {passengers.length} PAX
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Departure Dropdown Selector */}
            {availableDepartures.length > 1 && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs">
                <Bus size={14} className="text-ink-muted" />
                <Select
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  className="text-xs py-1 px-2.5 rounded-lg border-border-subtle"
                >
                  {availableDepartures.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.tourName} ({formatDisplayDate(d.dateStr)}) - {d.busType || "Bus"}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body: Controls Sidebar (Left) + Live Preview (Right) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border-subtle">
          {/* Controls Column (3.5 / 12) */}
          <div className="lg:col-span-4 p-4 sm:p-5 overflow-y-auto space-y-4 bg-surface-muted/10">
            {/* 1. Language & Orientation Controls */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="paysheet-language-select"
                  className="text-[11px] font-bold text-ink uppercase tracking-wider block mb-1"
                >
                  Language
                </label>
                <Select
                  id="paysheet-language-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full text-xs py-1.5 px-2.5 rounded-lg border-border-subtle"
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="gu">ગુજરાતી (Gujarati)</option>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="paysheet-orientation-select"
                  className="text-[11px] font-bold text-ink uppercase tracking-wider block mb-1"
                >
                  Orientation
                </label>
                <Select
                  id="paysheet-orientation-select"
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value)}
                  className="w-full text-xs py-1.5 px-2.5 rounded-lg border-border-subtle"
                >
                  <option value="auto">Auto (Smart)</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </Select>
              </div>
            </div>

            {/* 2. Sorting & Company Header */}
            <div className="space-y-2">
              <div>
                <span className="text-[11px] font-bold text-ink uppercase tracking-wider block mb-1">
                  Sort Order
                </span>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-muted rounded-lg border border-border-subtle text-xs">
                  {[
                    { id: "seat", label: "Seat No" },
                    { id: "name", label: "Name" },
                    { id: "booking", label: "Booking" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSort(s.id)}
                      className={`py-1 px-2 rounded-md font-bold text-center transition-all cursor-pointer ${
                        sort === s.id
                          ? "bg-brand text-brand-fg shadow-xs"
                          : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name Script Selector */}
              <div>
                <span className="text-[11px] font-bold text-ink uppercase tracking-wider block mb-1">
                  Passenger Names
                </span>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-muted rounded-lg border border-border-subtle text-xs">
                  {[
                    { id: "en", label: "English" },
                    { id: "gu", label: "ગુજરાતી" },
                    { id: "both", label: "Both" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setNameScript(s.id)}
                      className={`py-1 px-1 rounded-md font-bold text-center text-[11px] transition-all cursor-pointer ${
                        nameScript === s.id
                          ? "bg-brand text-brand-fg shadow-xs"
                          : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-1 border-t border-border-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">Company Header</span>
                  <Switch
                    checked={showCompanyHeader}
                    onChange={setShowCompanyHeader}
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">🛏️ Upper/Lower Breakdown</span>
                  <Switch
                    checked={showDeckBreakdown}
                    onChange={setShowDeckBreakdown}
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">👥 Totals Summary</span>
                  <Switch
                    checked={showTotalsSummary}
                    onChange={setShowTotalsSummary}
                    size="sm"
                  />
                </div>
              </div>
            </div>

            {/* 3. Column Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink uppercase tracking-wider">
                  Columns ({columns.length} of {PAYMENT_SHEET_COLUMNS.length})
                </span>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="text-[11px] font-semibold text-brand hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={11} /> Reset Defaults
                </button>
              </div>

              <div className="p-2.5 rounded-xl border border-border-subtle bg-surface space-y-1.5 max-h-56 overflow-y-auto">
                {PAYMENT_SHEET_COLUMNS.map((col) => {
                  const isChecked = columns.includes(col.id)
                  const isRequired = col.required
                  const label = language === "gu" ? col.labelGu : language === "hi" ? col.labelHi : col.label

                  return (
                    <label
                      key={col.id}
                      className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        isChecked ? "bg-surface-hover" : "opacity-75 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isRequired}
                          onChange={() => handleToggleColumn(col.id)}
                          className="rounded border-border text-brand focus:ring-brand"
                        />
                        <span className={`font-medium ${isRequired ? "font-bold text-ink" : "text-ink"}`}>
                          {label}
                        </span>
                      </div>
                      {isRequired && (
                        <span className="text-[10px] text-ink-muted uppercase font-bold tracking-wider">
                          Required
                        </span>
                      )}
                      {col.id === "note" && (
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                          9mm Pen Row
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Helper Notice for Operator */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <span>Conductor / Cashier Copy</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                The Note column is always kept widest (&ge;28% width) with visible black borders for ballpen handwriting. Unpaid balances are marked with bold <strong>[DUE]</strong> or an asterisk (<strong>*</strong>) when the Balance column is hidden.
              </p>
            </div>
          </div>

          {/* Live Preview Column (8.5 / 12) */}
          <div className="lg:col-span-8 p-3 sm:p-4 bg-surface-muted/20 flex flex-col overflow-hidden">
            <div className="flex-1 w-full bg-white rounded-xl shadow-inner border border-border-subtle overflow-hidden relative">
              {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 gap-2">
                  <Spinner size="lg" />
                  <p className="text-xs text-ink-muted font-medium">Generating payment sheet...</p>
                </div>
              ) : error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white p-6 text-center gap-2">
                  <p className="text-xs text-rose-600 font-bold">{error}</p>
                  <Button variant="secondary" size="sm" onClick={() => setSelectedKey(selectedKey)}>
                    Retry
                  </Button>
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  title="Payment Sheet Preview"
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin allow-modals"
                />
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-border-subtle bg-surface-muted/40">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              disabled={loading || Boolean(error)}
              icon={<Printer size={15} />}
            >
              Print Payment Sheet (A4)
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
