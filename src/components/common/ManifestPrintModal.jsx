import { useState, useEffect, useMemo, useRef } from "react"
import {
  Printer,
  ShieldAlert,
  Settings2,
  RotateCcw,
  AlertTriangle,
  FileText,
  Bus,
  Info,
  Copy,
} from "lucide-react"
import {
  MANIFEST_COLUMNS,
  MANIFEST_PRESETS,
  normalizeColumnSelection,
  renderManifestHtml,
  buildPickupWiseWhatsAppText,
} from "../../../shared/manifest.js"
import { getDepartureManifest, listDepartures } from "../../data/departures"
import { formatDisplayDate } from "../../utils/date"
import { cn } from "../../utils/cn"
import { useToast } from "./ToastContext"
import {
  Modal,
  Button,
  Checkbox,
  Switch,
  Select,
  Badge,
  Spinner,
} from "../ui"

const STORAGE_KEY = "yh_manifest_preferences"

const DEFAULT_SETTINGS = {
  columns: [...MANIFEST_PRESETS["without-aadhaar"]],
  sort: "seat",
  orientation: "auto",
  language: "en",
  showCompanyHeader: true,
  groupByPickup: false,
  aadhaarMode: "last4",
}

function loadSavedPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    const cleanedCols = Array.isArray(parsed.columns)
      ? parsed.columns.filter((c) => c !== "aadhaar")
      : DEFAULT_SETTINGS.columns

    return {
      columns: normalizeColumnSelection(cleanedCols),
      sort: ["seat", "name", "booking"].includes(parsed.sort) ? parsed.sort : "seat",
      orientation: ["auto", "portrait", "landscape"].includes(parsed.orientation)
        ? parsed.orientation
        : "auto",
      language: ["en", "hi", "gu"].includes(parsed.language) ? parsed.language : "en",
      showCompanyHeader:
        typeof parsed.showCompanyHeader === "boolean" ? parsed.showCompanyHeader : true,
      groupByPickup: typeof parsed.groupByPickup === "boolean" ? parsed.groupByPickup : false,
      aadhaarMode: ["full", "last4"].includes(parsed.aadhaarMode)
        ? parsed.aadhaarMode
        : "last4",
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function savePreferences(settings) {
  try {
    // Strip Aadhaar column before storing in localStorage for privacy & compliance
    const safeCols = settings.columns.filter((c) => c !== "aadhaar")
    const payload = {
      columns: safeCols,
      sort: settings.sort,
      orientation: settings.orientation,
      language: settings.language,
      showCompanyHeader: settings.showCompanyHeader,
      groupByPickup: settings.groupByPickup,
      aadhaarMode: settings.aadhaarMode,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage quota / private browsing errors
  }
}

export default function ManifestPrintModal({
  isOpen,
  onClose,
  departureKey,
  departures: initialDepartures = [],
  user,
  initialPreset = "without-aadhaar",
  initialGroupByPickup = false,
}) {
  const iframeRef = useRef(null)
  const saved = useMemo(() => loadSavedPreferences(), [])
  const { toast } = useToast()

  const [availableDepartures, setAvailableDepartures] = useState(initialDepartures)
  const [selectedKey, setSelectedKey] = useState(departureKey || "")
  const [columns, setColumns] = useState(() => {
    if (initialPreset === "with-aadhaar") {
      return [...MANIFEST_PRESETS["with-aadhaar"]]
    }
    if (initialPreset === "pickup-wise") {
      return [...MANIFEST_PRESETS["pickup-wise"]]
    }
    return saved.columns
  })
  const [groupByPickup, setGroupByPickup] = useState(() => {
    if (initialPreset === "pickup-wise" || initialGroupByPickup) return true
    return Boolean(saved.groupByPickup)
  })
  const [sort, setSort] = useState(saved.sort)
  const [orientation, setOrientation] = useState(saved.orientation)
  const [language, setLanguage] = useState(saved.language)
  const [showCompanyHeader, setShowCompanyHeader] = useState(saved.showCompanyHeader)
  const [aadhaarMode, setAadhaarMode] = useState(saved.aadhaarMode)

  const [aadhaarSafetyConfirmed, setAadhaarSafetyConfirmed] = useState(false)
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
        .then((deps) => {
          if (Array.isArray(deps) && deps.length > 0) {
            setAvailableDepartures(deps)
            if (!selectedKey) {
              setSelectedKey(deps[0].key)
            }
          }
        })
        .catch(() => {})
    }
  }, [initialDepartures, isOpen, selectedKey])

  // Synchronize selectedKey when departureKey prop changes
  useEffect(() => {
    if (departureKey) {
      setSelectedKey(departureKey)
    }
  }, [departureKey])

  // Configure preset when opening
  useEffect(() => {
    if (isOpen) {
      if (initialPreset === "with-aadhaar") {
        setColumns([...MANIFEST_PRESETS["with-aadhaar"]])
        setGroupByPickup(false)
      } else if (initialPreset === "without-aadhaar") {
        setColumns([...MANIFEST_PRESETS["without-aadhaar"]])
        setGroupByPickup(false)
      } else if (initialPreset === "pickup-wise") {
        setColumns([...MANIFEST_PRESETS["pickup-wise"]])
        setGroupByPickup(true)
      } else if (initialGroupByPickup) {
        setGroupByPickup(true)
      }
      setAadhaarSafetyConfirmed(false)
      setError(null)
    }
  }, [isOpen, initialPreset, initialGroupByPickup])

  const hasAadhaar = columns.includes("aadhaar")

  // Fetch departure manifest data
  useEffect(() => {
    if (!isOpen || !selectedKey) return

    let cancelled = false
    setLoading(true)
    setError(null)

    getDepartureManifest(selectedKey, {
      aadhaar: hasAadhaar,
    })
      .then((res) => {
        if (cancelled) return
        if (res && res.success) {
          setDepartureMeta(res.departure)
          setPassengers(res.passengers || [])
        } else {
          setError(res?.error || "Could not load manifest for this departure.")
        }
      })
      .catch((err) => {
        if (cancelled) return
        console.error("Error loading manifest:", err)
        setError(err.message || "Failed to load departure manifest")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, selectedKey, hasAadhaar])

  // Persist non-sensitive preferences
  useEffect(() => {
    if (isOpen) {
      savePreferences({
        columns,
        sort,
        orientation,
        language,
        showCompanyHeader,
        groupByPickup,
        aadhaarMode,
      })
    }
  }, [isOpen, columns, sort, orientation, language, showCompanyHeader, groupByPickup, aadhaarMode])

  // Active preset detection
  const activePreset = useMemo(() => {
    const norm = normalizeColumnSelection(columns).sort().join(",")
    const withoutAadhaarNorm = [...MANIFEST_PRESETS["without-aadhaar"]].sort().join(",")
    const withAadhaarNorm = [...MANIFEST_PRESETS["with-aadhaar"]].sort().join(",")
    const pickupWiseNorm = [...MANIFEST_PRESETS["pickup-wise"]].sort().join(",")
    const minimalNorm = [...MANIFEST_PRESETS.minimal].sort().join(",")

    if (groupByPickup && norm === pickupWiseNorm) return "pickup-wise"
    if (!groupByPickup && norm === withoutAadhaarNorm) return "without-aadhaar"
    if (!groupByPickup && norm === withAadhaarNorm) return "with-aadhaar"
    if (!groupByPickup && norm === minimalNorm) return "minimal"
    return "custom"
  }, [columns, groupByPickup])

  const handleApplyPreset = (presetKey) => {
    if (presetKey === "without-aadhaar") {
      setColumns([...MANIFEST_PRESETS["without-aadhaar"]])
      setAadhaarSafetyConfirmed(false)
      setGroupByPickup(false)
    } else if (presetKey === "with-aadhaar") {
      setColumns([...MANIFEST_PRESETS["with-aadhaar"]])
      setGroupByPickup(false)
    } else if (presetKey === "pickup-wise") {
      setColumns([...MANIFEST_PRESETS["pickup-wise"]])
      setGroupByPickup(true)
      setAadhaarSafetyConfirmed(false)
    } else if (presetKey === "minimal") {
      setColumns([...MANIFEST_PRESETS.minimal])
      setAadhaarSafetyConfirmed(false)
      setGroupByPickup(false)
    }
  }

  const handleToggleColumn = (colId) => {
    if (colId === "srNo" || colId === "name") return // Locked required columns
    setColumns((prev) => {
      if (prev.includes(colId)) {
        return prev.filter((id) => id !== colId)
      }
      return [...prev, colId]
    })
  }

  const handleResetDefaults = () => {
    setColumns([...MANIFEST_PRESETS["without-aadhaar"]])
    setSort("seat")
    setOrientation("auto")
    setLanguage("en")
    setShowCompanyHeader(true)
    setGroupByPickup(false)
    setAadhaarMode("last4")
    setAadhaarSafetyConfirmed(false)
  }

  const handlePrint = () => {
    if (hasAadhaar && !aadhaarSafetyConfirmed) return
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.focus()
      iframeRef.current.contentWindow.print()
    }
  }

  const handleCopyWhatsAppText = async () => {
    try {
      const text = buildPickupWiseWhatsAppText({
        manifest: departureMeta || {
          tourName: "Tour Departure",
          dateStr: new Date().toISOString().slice(0, 10),
          busType: "2x1 Sleeper Luxury",
          companyName: user?.companyName || "YATRA HUB",
          companyPhone: user?.phone || "",
        },
        passengers,
        columns,
      })
      await navigator.clipboard.writeText(text)
      toast.success("Driver WhatsApp pickup list copied to clipboard!")
    } catch {
      toast.error("Failed to copy WhatsApp text")
    }
  }

  // Generate HTML for live sandboxed preview
  const renderedHtml = useMemo(() => {
    const meta = departureMeta || {
      tourName: "Tour Departure",
      dateStr: new Date().toISOString().slice(0, 10),
      busType: "2x1 Sleeper Luxury",
      companyName: user?.companyName || "YATRA HUB",
      companyPhone: user?.phone || "",
      companyAddress: user?.address || "",
      totalPax: passengers.length,
    }

    return renderManifestHtml({
      manifest: meta,
      passengers,
      columns,
      language,
      sort,
      aadhaarMode,
      orientation,
      showCompanyHeader,
      groupByPickup,
    })
  }, [
    departureMeta,
    user,
    passengers,
    columns,
    language,
    sort,
    aadhaarMode,
    orientation,
    showCompanyHeader,
    groupByPickup,
  ])

  const isPrintDisabled =
    loading ||
    passengers.length === 0 ||
    (hasAadhaar && !aadhaarSafetyConfirmed)

  const disabledReason = useMemo(() => {
    if (loading) return "Loading passengers..."
    if (passengers.length === 0) return "No passengers on this departure"
    if (hasAadhaar && !aadhaarSafetyConfirmed) return "Safety acknowledgment required to print Aadhaar"
    return null
  }, [loading, passengers.length, hasAadhaar, aadhaarSafetyConfirmed])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      className="max-w-6xl max-h-[92vh] flex flex-col"
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-[var(--yh-radius-md)] bg-brand text-brand-fg shrink-0">
            <Printer size={18} />
          </div>
          <div>
            <span className="text-base font-bold text-ink">Passenger Manifest Print Builder</span>
            <p className="text-xs text-ink-muted font-normal mt-0.5">
              Customize columns, formatting, and print verified passenger manifests for conductor operations
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<RotateCcw size={14} />}
            onClick={handleResetDefaults}
          >
            Reset Defaults
          </Button>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
            {isPrintDisabled && disabledReason && (
              <span
                id="manifest-print-disabled-reason"
                className={cn(
                  "text-xs font-medium flex items-center gap-1",
                  hasAadhaar && !aadhaarSafetyConfirmed ? "text-warning" : "text-ink-muted",
                )}
                role="status"
              >
                {hasAadhaar && !aadhaarSafetyConfirmed ? (
                  <AlertTriangle size={13} aria-hidden="true" />
                ) : loading ? (
                  <Spinner size="sm" aria-hidden="true" className="h-3.5 w-3.5 border" />
                ) : (
                  <Info size={13} aria-hidden="true" />
                )}
                <span>{disabledReason}</span>
              </span>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Copy size={15} />}
                onClick={handleCopyWhatsAppText}
                disabled={loading || passengers.length === 0}
                title="Copy driver pickup list formatted for WhatsApp"
              >
                Copy as WhatsApp text
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                leftIcon={<Printer size={16} />}
                disabled={isPrintDisabled}
                aria-describedby={isPrintDisabled && disabledReason ? "manifest-print-disabled-reason" : undefined}
                onClick={handlePrint}
              >
                Print Manifest
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto pr-1">
        {/* LEFT COLUMN: Controls & Column Selector */}
        <div className="lg:col-span-5 space-y-5">
          {/* Departure Selector (if multiple available) */}
          {availableDepartures.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="manifest-departure-select" className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <Bus size={14} className="text-brand" />
                <span>Coach Departure</span>
              </label>
              <Select
                id="manifest-departure-select"
                size="sm"
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
              >
                {availableDepartures.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.tourName} — {formatDisplayDate(d.journeyDate)} ({d.busType}) [{d.totalPax || 0} PAX]
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <Settings2 size={14} className="text-brand" />
              <span>Manifest Presets</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={activePreset === "without-aadhaar" ? "primary" : "outline"}
                className="justify-start text-xs h-9 px-2.5"
                onClick={() => handleApplyPreset("without-aadhaar")}
              >
                Without Aadhaar
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activePreset === "with-aadhaar" ? "primary" : "outline"}
                className="justify-start text-xs h-9 px-2.5"
                onClick={() => handleApplyPreset("with-aadhaar")}
              >
                With Aadhaar
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activePreset === "pickup-wise" ? "primary" : "outline"}
                className="justify-start text-xs h-9 px-2.5"
                onClick={() => handleApplyPreset("pickup-wise")}
              >
                📍 Pickup-Wise
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activePreset === "minimal" ? "primary" : "outline"}
                className="justify-start text-xs h-9 px-2.5"
                onClick={() => handleApplyPreset("minimal")}
              >
                Minimal
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activePreset === "custom" ? "secondary" : "ghost"}
                className="justify-start text-xs h-9 px-2.5"
                disabled
              >
                {activePreset === "custom" ? "Custom Selected" : "Custom"}
              </Button>
            </div>
          </div>

          {/* Column Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <FileText size={14} className="text-brand" />
                <span>Select Columns</span>
              </span>
              <span className="text-[11px] text-ink-muted">
                {columns.length} / {MANIFEST_COLUMNS.length} active
              </span>
            </div>

            <div className="p-3 bg-surface-muted/50 rounded-[var(--yh-radius-md)] border border-border-subtle max-h-56 overflow-y-auto space-y-1.5">
              {MANIFEST_COLUMNS.map((col) => {
                const isSelected = columns.includes(col.id)
                const isLocked = col.required

                return (
                  <div
                    key={col.id}
                    className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-surface transition-colors"
                  >
                    <Checkbox
                      id={`col-chk-${col.id}`}
                      checked={isSelected}
                      disabled={isLocked}
                      onChange={() => handleToggleColumn(col.id)}
                      label={
                        <span className="text-xs font-medium text-ink flex items-center gap-1.5">
                          <span>{col.label}</span>
                          {isLocked && (
                            <span className="text-[10px] text-ink-muted">(Required)</span>
                          )}
                        </span>
                      }
                    />
                    {col.sensitive && (
                      <Badge variant="warning" size="sm">
                        Sensitive
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Aadhaar Guard Section (When Aadhaar column is enabled) */}
          {hasAadhaar && (
            <div className="p-3.5 bg-warning-soft/30 border border-warning-border rounded-[var(--yh-radius-md)] space-y-3">
              <div className="flex items-start gap-2">
                <ShieldAlert size={16} className="text-warning shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-warning-fg">Aadhaar Privacy Guard</h4>
                  <p className="text-[11px] text-warning-fg/80 mt-0.5">
                    Aadhaar numbers are sensitive personal data. This printout is for operational boarding only.
                  </p>
                </div>
              </div>

              {/* Masking mode selector */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-ink">Display Format:</span>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 text-xs text-ink cursor-pointer">
                    <input
                      type="radio"
                      name="aadhaarMode"
                      value="last4"
                      checked={aadhaarMode === "last4"}
                      onChange={() => setAadhaarMode("last4")}
                      className="text-brand focus:ring-brand"
                    />
                    <span>Last 4 digits (XXXX XXXX 1234)</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs text-ink cursor-pointer">
                    <input
                      type="radio"
                      name="aadhaarMode"
                      value="full"
                      checked={aadhaarMode === "full"}
                      onChange={() => setAadhaarMode("full")}
                      className="text-brand focus:ring-brand"
                    />
                    <span>Full 12 digits</span>
                  </label>
                </div>
              </div>

              {/* Mandatory safety confirmation checkbox */}
              <div className="pt-2 border-t border-warning-border">
                <Checkbox
                  id="aadhaar-safety-ack"
                  checked={aadhaarSafetyConfirmed}
                  onChange={(e) => setAadhaarSafetyConfirmed(e.target.checked)}
                  label={
                    <span className="text-xs font-semibold text-ink">
                      This printout will contain Aadhaar numbers. I will keep it safe.
                    </span>
                  }
                />
              </div>
            </div>
          )}

          {/* Sort, Orientation, Language Controls */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label htmlFor="manifest-sort-select" className="text-xs font-semibold text-ink">Sort Order</label>
              <Select
                id="manifest-sort-select"
                size="sm"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="seat">Seat No (Natural)</option>
                <option value="name">Passenger Name</option>
                <option value="booking">Booking Reference</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label htmlFor="manifest-orient-select" className="text-xs font-semibold text-ink">Orientation</label>
              <Select
                id="manifest-orient-select"
                size="sm"
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
              >
                <option value="auto">Auto ({columns.length > 7 ? "Landscape" : "Portrait"})</option>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="manifest-lang-select" className="text-xs font-semibold text-ink">Language</label>
              <Select
                id="manifest-lang-select"
                size="sm"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="gu">ગુજરાતી (Gujarati)</option>
              </Select>
            </div>

            <div className="flex flex-col justify-end pb-1 space-y-2">
              <Switch
                id="manifest-company-header"
                checked={showCompanyHeader}
                onChange={setShowCompanyHeader}
                label="Company Header"
                size="sm"
              />
              <Switch
                id="manifest-group-pickup"
                checked={groupByPickup}
                onChange={setGroupByPickup}
                label="Group by Pickup"
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Sandboxed Live Print Preview */}
        <div className="lg:col-span-7 flex flex-col space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink">Live Print Preview</span>
              <Badge variant="neutral" size="sm">
                A4 {orientation === "landscape" || (orientation === "auto" && columns.length > 7) ? "Landscape" : "Portrait"}
              </Badge>
              {loading && <Spinner size="sm" />}
            </div>
            <span className="text-xs text-ink-muted">
              {passengers.length} Passengers loaded
            </span>
          </div>

          {error && (
            <div className="p-3 bg-danger-soft/30 border border-danger-border rounded-[var(--yh-radius-md)] text-xs text-danger flex items-center gap-2">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="relative flex-1 min-h-[460px] rounded-[var(--yh-radius-md)] border border-border-subtle bg-slate-100 overflow-hidden shadow-inner flex items-center justify-center">
            {loading && passengers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 text-ink-muted">
                <Spinner size="md" />
                <span className="text-xs">Preparing manifest preview...</span>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                title="Manifest Print Preview"
                sandbox="allow-same-origin allow-modals"
                srcDoc={renderedHtml}
                className="w-full h-full min-h-[480px] bg-white border-0"
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
