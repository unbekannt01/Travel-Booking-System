/**
 * PassengerExchange.jsx — TBS & yatriDesk (SeatDesk) Passenger Exchange (Part 6X)
 *
 * Implements bidirectional exchange:
 * 1. Export 48-berth sleeper passenger records to JSON (plain or AES-GCM encrypted envelope if Aadhaar included).
 * 2. Import 4-step wizard: Choose & Decrypt File -> Trip Mapping -> Merge Preview -> Commit & Batch.
 *
 * Fully keyboard accessible, dark-mode safe, zero dangerouslySetInnerHTML.
 */

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Card,
  Button,
  Badge,
  Spinner,
  Input,
  Select,
  Field,
  Tabs,
  Switch,
} from "../ui"
import { useToast } from "../common/ToastContext"
import {
  fetchExchangeDepartures,
  exportPassengersExchange,
  previewPassengerImport,
  commitPassengerImport,
} from "../../data/exchange.js"
import { encryptExchange, decryptExchange } from "../../../shared/exchangeCrypto.js"
import {
  validateExchangeFile,
  SUPPORTED_LAYOUT,
  CANONICAL_BUS_TYPE,
} from "../../../shared/passengerExchange.js"
import { formatINR } from "../../utils/formatters.js"
import { formatDisplayDate } from "../../utils/date"
import {
  ArrowRight,
  Download,
  Upload,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Users,
  Bus,
  Calendar,
  Layers,
  FileCheck,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  FolderSync,
} from "lucide-react"

export default function PassengerExchange({ tours = [], onViewBatches }) {
  const { toast } = useToast()

  // Main mode: "export" | "import"
  const [exchangeMode, setExchangeMode] = useState("export")

  // ==========================================
  // EXPORT SECTION STATE
  // ==========================================
  const [departures, setDepartures] = useState([])
  const [loadingDepartures, setLoadingDepartures] = useState(false)
  const [selectedDepartureKey, setSelectedDepartureKey] = useState("all")
  const [selectedTour, setSelectedTour] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Aadhaar encryption toggle & password
  const [includeAadhaar, setIncludeAadhaar] = useState(false)
  const [exportPassword, setExportPassword] = useState("")
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState("")
  const [isExporting, setIsExporting] = useState(false)
  const [exportResultMeta, setExportResultMeta] = useState(null)

  // Load eligible 48-berth departures
  const loadDepartures = useCallback(async () => {
    setLoadingDepartures(true)
    try {
      const res = await fetchExchangeDepartures()
      setDepartures(res.departures || [])
    } catch (err) {
      toast.error(err.message || "Failed to load exchange departures.")
    } finally {
      setLoadingDepartures(false)
    }
  }, [toast])

  useEffect(() => {
    loadDepartures()
  }, [loadDepartures])

  // Handle Export
  const handleExport = async () => {
    if (includeAadhaar) {
      if (!exportPassword || exportPassword.length < 8) {
        toast.error("Encryption password must be at least 8 characters.")
        return
      }
      if (exportPassword !== exportPasswordConfirm) {
        toast.error("Encryption passwords do not match. Please verify.")
        return
      }
    }

    setIsExporting(true)
    setExportResultMeta(null)

    try {
      const res = await exportPassengersExchange({
        tourName: selectedTour !== "all" ? selectedTour : "",
        startDate,
        endDate,
        departureKey: selectedDepartureKey !== "all" ? selectedDepartureKey : "",
        includeAadhaar,
      })

      let fileToDownload = res.file
      const filename = `yatrahub-passengers-${new Date().toISOString().slice(0, 10)}.json`

      if (includeAadhaar) {
        fileToDownload = await encryptExchange(res.file, exportPassword)
      }

      // Trigger browser download
      const jsonStr = JSON.stringify(fileToDownload, null, 2)
      const blob = new Blob([jsonStr], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExportResultMeta(res.meta)
      toast.success(
        includeAadhaar
          ? "Passenger file encrypted and exported successfully!"
          : "Passenger file exported successfully!"
      )
    } catch (err) {
      toast.error(err.message || "Failed to export passenger file.")
    } finally {
      setIsExporting(false)
    }
  }

  // ==========================================
  // IMPORT WIZARD STATE (4 STEPS)
  // ==========================================
  const [importStep, setImportStep] = useState(1) // 1: File, 2: Mapping, 3: Preview, 4: Result
  const [uploadedFile, setUploadedFile] = useState(null)
  const [parsedExchange, setParsedExchange] = useState(null)
  const [isEncryptedFile, setIsEncryptedFile] = useState(false)
  const [decryptPassword, setDecryptPassword] = useState("")
  const [rawEnvelope, setRawEnvelope] = useState(null)
  const [decrypting, setDecrypting] = useState(false)

  // Trip mapping: tripXid -> { tourName, journeyDateStr, busType, isNew }
  const [tripMappings, setTripMappings] = useState({})

  // Merge options
  const [preferOption, setPreferOption] = useState("keep") // "keep" | "file"
  const [defaultAge, setDefaultAge] = useState(30)
  const [defaultCity, setDefaultCity] = useState("Ahmedabad")
  const [fallbackPhone, setFallbackPhone] = useState("")
  const [importPayments, setImportPayments] = useState(true)

  // Preview & commit results
  const [previewPlan, setPreviewPlan] = useState(null)
  const [previewToken, setPreviewToken] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState(null)

  const fileInputRef = useRef(null)

  // Handle file select
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File exceeds maximum allowed size of 5 MB.")
      return
    }

    setUploadedFile(file)
    setParsedExchange(null)
    setIsEncryptedFile(false)
    setRawEnvelope(null)

    try {
      const text = await file.text()
      const json = JSON.parse(text)

      // Check if encrypted envelope
      if (json && json.enc) {
        setIsEncryptedFile(true)
        setRawEnvelope(json)
        return
      }

      // Plain exchange file
      const validation = validateExchangeFile(json)
      if (!validation.valid) {
        toast.error(validation.errors?.[0] || "Invalid exchange file format.")
        return
      }

      setParsedExchange(validation.sanitized)
      toast.success(`Loaded file with ${validation.stats.totalPassengers} passengers.`)
    } catch {
      toast.error("Unable to parse file. Please upload a valid JSON exchange file.")
    }
  }

  // Handle Decrypt button
  const handleDecryptFile = async () => {
    if (!decryptPassword) {
      toast.error("Please enter the decryption password.")
      return
    }

    setDecrypting(true)
    try {
      const decrypted = await decryptExchange(rawEnvelope, decryptPassword)
      const validation = validateExchangeFile(decrypted)
      if (!validation.valid) {
        toast.error(validation.errors?.[0] || "Decrypted content is invalid.")
        return
      }

      setParsedExchange(validation.sanitized)
      setIsEncryptedFile(false)
      toast.success(`Decrypted successfully! Loaded ${validation.stats.totalPassengers} passengers.`)
    } catch (err) {
      toast.error(err.message || "Decryption failed. Check password.")
    } finally {
      setDecrypting(false)
    }
  }

  // Advance to Step 2 (Trip Mapping)
  const handleProceedToMapping = () => {
    if (!parsedExchange) return

    // Pre-populate default trip mappings
    const initialMap = {}
    for (const trip of parsedExchange.trips || []) {
      const matched = departures.find(
        (d) => d.tourName.toLowerCase() === trip.route.toLowerCase() && d.journeyDate === trip.date
      )
      if (matched) {
        initialMap[trip.xid] = {
          tourName: matched.tourName,
          journeyDateStr: matched.journeyDate,
          busType: CANONICAL_BUS_TYPE,
          isExisting: true,
        }
      } else {
        initialMap[trip.xid] = {
          tourName: trip.route,
          journeyDateStr: trip.date,
          busType: CANONICAL_BUS_TYPE,
          isNew: true,
        }
      }
    }
    setTripMappings(initialMap)
    setImportStep(2)
  }

  // Advance to Step 3 (Merge Preview)
  const handleProceedToPreview = async () => {
    if (!parsedExchange) return
    setLoadingPreview(true)

    try {
      const res = await previewPassengerImport({
        exchange: parsedExchange,
        mapping: tripMappings,
        options: {
          prefer: preferOption,
          defaultAge,
          defaultCity,
          fallbackPhone,
          importPayments,
        },
      })

      setPreviewPlan(res)
      setPreviewToken(res.previewToken)
      setImportStep(3)
    } catch (err) {
      toast.error(err.message || "Failed to generate merge preview.")
    } finally {
      setLoadingPreview(false)
    }
  }

  // Re-run preview when options change
  const handleRefreshPreview = async () => {
    await handleProceedToPreview()
  }

  // Execute Commit (Step 4)
  const handleCommitImport = async () => {
    if (!parsedExchange || !previewToken) return
    setCommitting(true)

    try {
      const res = await commitPassengerImport({
        exchange: parsedExchange,
        mapping: tripMappings,
        options: {
          prefer: preferOption,
          defaultAge,
          defaultCity,
          fallbackPhone,
          importPayments,
        },
        previewToken,
      })

      setCommitResult(res)
      setImportStep(4)
      toast.success(res.message || "Passenger import completed successfully!")
    } catch (err) {
      toast.error(err.message || "Failed to commit passenger import.")
    } finally {
      setCommitting(false)
    }
  }

  // Reset import flow
  const handleResetImport = () => {
    setImportStep(1)
    setUploadedFile(null)
    setParsedExchange(null)
    setIsEncryptedFile(false)
    setRawEnvelope(null)
    setDecryptPassword("")
    setTripMappings({})
    setPreviewPlan(null)
    setPreviewToken(null)
    setCommitResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="space-y-6">
      {/* Top Toggle: Export vs Import */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <h2 className="text-lg font-bold text-ink flex items-center gap-2">
            <FolderSync className="w-5 h-5 text-brand" />
            <span>Passenger Exchange with yatriDesk (SeatDesk)</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Safely exchange passenger rosters and payments between YatraHub and yatriDesk (48-berth sleeper).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-surface-muted p-1 rounded-xl border border-border-subtle self-start">
          <Button
            variant={exchangeMode === "export" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setExchangeMode("export")}
            icon={<Download size={14} />}
          >
            Export to yatriDesk
          </Button>
          <Button
            variant={exchangeMode === "import" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setExchangeMode("import")}
            icon={<Upload size={14} />}
          >
            Import from yatriDesk
          </Button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODE 1: EXPORT SECTION */}
      {/* =================================================================== */}
      {exchangeMode === "export" && (
        <div className="space-y-6">
          <Card className="p-5 border-border-subtle space-y-5">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                  <Download className="w-4 h-4 text-brand" />
                  <span>Export 48-Berth Departures</span>
                </h3>
                <p className="text-xs text-ink-muted">
                  Exports confirmed passengers and payment ledgers in standard <code>yatri-passengers</code> format.
                </p>
              </div>
              <Badge variant="brand">2x2 Sleeper (48 berths)</Badge>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Specific Departure">
                <Select
                  value={selectedDepartureKey}
                  onChange={(e) => setSelectedDepartureKey(e.target.value)}
                  className="w-full text-xs"
                >
                  <option value="all">All 48-Berth Departures</option>
                  {departures.map((d) => (
                    <option key={d.departureKey} value={d.departureKey}>
                      {d.tourName} ({formatDisplayDate(d.journeyDate)}) - {d.passengerCount} pax
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Tour / Route Filter">
                <Select
                  value={selectedTour}
                  onChange={(e) => setSelectedTour(e.target.value)}
                  className="w-full text-xs"
                >
                  <option value="all">All Tours</option>
                  {tours.map((t) => (
                    <option key={t._id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Journey Start Date">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs"
                />
              </Field>

              <Field label="Journey End Date">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs"
                />
              </Field>
            </div>

            {/* Aadhaar Security Encryption Option */}
            <div className="p-4 rounded-xl border border-border-subtle bg-surface-muted/30 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {includeAadhaar ? (
                      <Lock className="w-4 h-4 text-brand" />
                    ) : (
                      <Unlock className="w-4 h-4 text-ink-muted" />
                    )}
                    <span className="text-xs font-bold text-ink">
                      Include Decrypted Aadhaar Numbers
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted">
                    When checked, the file is automatically wrapped inside a secure AES-256-GCM password-encrypted envelope.
                    A plain unencrypted file never contains Aadhaar numbers.
                  </p>
                </div>

                <Switch
                  checked={includeAadhaar}
                  onCheckedChange={setIncludeAadhaar}
                  aria-label="Toggle Aadhaar encryption in export"
                />
              </div>

              {includeAadhaar && (
                <div className="pt-3 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="File Password (min 8 characters)">
                    <Input
                      type="password"
                      placeholder="Enter strong password (min 8 chars)..."
                      value={exportPassword}
                      onChange={(e) => setExportPassword(e.target.value)}
                      className="text-xs"
                    />
                  </Field>

                  <Field label="Confirm Password">
                    <Input
                      type="password"
                      placeholder="Re-type password..."
                      value={exportPasswordConfirm}
                      onChange={(e) => setExportPasswordConfirm(e.target.value)}
                      className="text-xs"
                    />
                  </Field>
                </div>
              )}
            </div>

            {/* Action & Feedback */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border-subtle">
              <div className="text-xs text-ink-muted">
                {departures.length === 0 && !loadingDepartures && (
                  <span>No 48-berth departures found matching the filter criteria.</span>
                )}
                {departures.length > 0 && (
                  <span>
                    Ready to export from <strong>{departures.length}</strong> eligible 48-berth departure(s).
                  </span>
                )}
              </div>

              <Button
                variant="primary"
                onClick={handleExport}
                loading={isExporting}
                disabled={isExporting}
                icon={<Download size={14} />}
              >
                {includeAadhaar ? "Encrypt & Download (.json)" : "Download Plain JSON"}
              </Button>
            </div>
          </Card>

          {/* Export Result Summary */}
          {exportResultMeta && (
            <Card className="p-5 border-emerald-500/20 bg-emerald-500/5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Export Successfully Generated</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 bg-surface rounded-lg border border-border-subtle">
                  <span className="text-ink-muted block text-[10px] uppercase font-bold">Departures Exported</span>
                  <span className="text-lg font-bold text-ink">{exportResultMeta.trips}</span>
                </div>
                <div className="p-2.5 bg-surface rounded-lg border border-border-subtle">
                  <span className="text-ink-muted block text-[10px] uppercase font-bold">Passengers Exported</span>
                  <span className="text-lg font-bold text-ink">{exportResultMeta.passengers}</span>
                </div>
                <div className="p-2.5 bg-surface rounded-lg border border-border-subtle">
                  <span className="text-ink-muted block text-[10px] uppercase font-bold">Skipped (Other Layouts)</span>
                  <span className="text-lg font-bold text-ink">{exportResultMeta.skippedBookingsLayout}</span>
                </div>
                <div className="p-2.5 bg-surface rounded-lg border border-border-subtle">
                  <span className="text-ink-muted block text-[10px] uppercase font-bold">Skipped (No Seat)</span>
                  <span className="text-lg font-bold text-ink">{exportResultMeta.skippedBookingsNoSeat}</span>
                </div>
              </div>
              {exportResultMeta.skippedBookingsLayout > 0 && (
                <p className="text-[11px] text-ink-muted">
                  Note: {exportResultMeta.skippedBookingsLayout} booking(s) skipped because their bus layout is not supported by yatriDesk (only 48-berth sleeper is supported).
                </p>
              )}
            </Card>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODE 2: IMPORT WIZARD (4 STEPS) */}
      {/* =================================================================== */}
      {exchangeMode === "import" && (
        <div className="space-y-6">
          {/* Stepper Header */}
          <div className="grid grid-cols-4 gap-2 text-xs font-semibold">
            {[
              { num: 1, label: "1. Choose File" },
              { num: 2, label: "2. Trip Mapping" },
              { num: 3, label: "3. Merge Preview" },
              { num: 4, label: "4. Complete" },
            ].map((s) => (
              <div
                key={s.num}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  importStep === s.num
                    ? "bg-brand text-brand-fg border-brand font-bold shadow-xs"
                    : importStep > s.num
                    ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/25"
                    : "bg-surface text-ink-muted border-border-subtle"
                }`}
              >
                {s.label}
              </div>
            ))}
          </div>

          {/* Short Policy Notice */}
          <div className="p-3 bg-surface-muted/60 rounded-xl border border-border-subtle text-xs text-ink flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-brand shrink-0" />
            <span>
              Passenger data from yatriDesk is merged into YatraHub. Nothing existing is overwritten unless you choose &quot;Use file value&quot;.
            </span>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* STEP 1: CHOOSE FILE & DECRYPT */}
          {/* ------------------------------------------------------------- */}
          {importStep === 1 && (
            <Card className="p-6 border-border-subtle space-y-5">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-ink">Select yatriDesk Exchange File</h3>
                <p className="text-xs text-ink-muted">
                  Upload a <code>.json</code> exchange file (plain or password-encrypted, max 5 MB).
                </p>
              </div>

              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border-subtle hover:border-brand/50 rounded-2xl bg-surface-muted/20 transition-colors">
                <Upload className="w-8 h-8 text-ink-muted mb-2" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="exchange-file-upload"
                />
                <label
                  htmlFor="exchange-file-upload"
                  className="px-4 py-2 bg-brand text-brand-fg rounded-xl text-xs font-semibold cursor-pointer shadow-xs hover:bg-brand/90 transition-all"
                >
                  Choose File from Computer
                </label>
                {uploadedFile && (
                  <p className="text-xs text-ink font-semibold mt-3">
                    Selected: {uploadedFile.name} ({Math.round(uploadedFile.size / 1024)} KB)
                  </p>
                )}
              </div>

              {/* Password Prompt if Encrypted File */}
              {isEncryptedFile && (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-3">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                    <Lock className="w-4 h-4" />
                    <span>Password Protected File</span>
                  </div>
                  <p className="text-[11px] text-ink-muted">
                    This file is encrypted with AES-256-GCM. Decryption runs locally in your browser; your password is never sent to any server.
                  </p>
                  <div className="flex items-center gap-2 max-w-md">
                    <Input
                      type="password"
                      placeholder="Enter file password..."
                      value={decryptPassword}
                      onChange={(e) => setDecryptPassword(e.target.value)}
                      className="text-xs"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleDecryptFile}
                      loading={decrypting}
                      disabled={decrypting || !decryptPassword}
                    >
                      Decrypt
                    </Button>
                  </div>
                </div>
              )}

              {/* Parsed File Preview Details */}
              {parsedExchange && (
                <div className="p-4 rounded-xl border border-border-subtle bg-surface space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-ink">
                        File Validated: Source {parsedExchange.source} (Format {parsedExchange.format} v{parsedExchange.version})
                      </span>
                    </div>
                    {parsedExchange.aadhaarIncluded && (
                      <Badge variant="brand">Aadhaar Included</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="p-2.5 bg-surface-muted/40 rounded-lg">
                      <span className="text-ink-muted block text-[10px] uppercase font-bold">Trips Found</span>
                      <span className="text-base font-bold text-ink">{parsedExchange.trips.length}</span>
                    </div>
                    <div className="p-2.5 bg-surface-muted/40 rounded-lg">
                      <span className="text-ink-muted block text-[10px] uppercase font-bold">Total Passengers</span>
                      <span className="text-base font-bold text-ink">
                        {parsedExchange.trips.reduce((acc, t) => acc + (t.passengers?.length || 0), 0)}
                      </span>
                    </div>
                    <div className="p-2.5 bg-surface-muted/40 rounded-lg">
                      <span className="text-ink-muted block text-[10px] uppercase font-bold">Total Payments</span>
                      <span className="text-base font-bold text-ink">
                        {parsedExchange.trips.reduce(
                          (acc, t) =>
                            acc +
                            (t.passengers || []).reduce((pAcc, p) => pAcc + (p.payments?.length || 0), 0),
                          0
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t border-border-subtle">
                    <Button
                      variant="primary"
                      onClick={handleProceedToMapping}
                      icon={<ArrowRight size={14} />}
                    >
                      Next: Trip Mapping
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 2: TRIP MAPPING */}
          {/* ------------------------------------------------------------- */}
          {importStep === 2 && (
            <Card className="p-6 border-border-subtle space-y-5">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div>
                  <h3 className="text-base font-semibold text-ink">Map Trips to TBS Departures</h3>
                  <p className="text-xs text-ink-muted">
                    Assign each trip from the exchange file to an existing departure or create under an existing tour route.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setImportStep(1)}>
                  Back
                </Button>
              </div>

              <div className="space-y-4">
                {parsedExchange?.trips?.map((trip, idx) => {
                  const currentMapping = tripMappings[trip.xid] || {}

                  return (
                    <div
                      key={trip.xid || idx}
                      className="p-4 rounded-xl border border-border-subtle bg-surface-muted/20 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Bus className="w-4 h-4 text-brand" />
                          <span className="text-xs font-bold text-ink">{trip.route}</span>
                          <span className="text-ink-muted text-xs">•</span>
                          <span className="text-xs text-ink font-mono">{formatDisplayDate(trip.date)}</span>
                        </div>
                        <Badge variant="primary">{trip.passengers?.length || 0} passengers</Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <Field label="Target Tour / Route in YatraHub">
                          <Select
                            value={currentMapping.tourName || trip.route}
                            onChange={(e) => {
                              const val = e.target.value
                              setTripMappings((prev) => ({
                                ...prev,
                                [trip.xid]: {
                                  ...prev[trip.xid],
                                  tourName: val,
                                  journeyDateStr: trip.date,
                                  busType: CANONICAL_BUS_TYPE,
                                },
                              }))
                            }}
                            className="text-xs"
                          >
                            <option value={trip.route}>Same as file: {trip.route}</option>
                            {tours.map((t) => (
                              <option key={t._id} value={t.name}>
                                {t.name}
                              </option>
                            ))}
                          </Select>
                        </Field>

                        <Field label="Journey Date">
                          <Input
                            type="date"
                            value={currentMapping.journeyDateStr || trip.date}
                            onChange={(e) => {
                              const val = e.target.value
                              setTripMappings((prev) => ({
                                ...prev,
                                [trip.xid]: {
                                  ...prev[trip.xid],
                                  journeyDateStr: val,
                                },
                              }))
                            }}
                            className="text-xs"
                          />
                        </Field>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
                <Button variant="ghost" onClick={() => setImportStep(1)}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={handleProceedToPreview}
                  loading={loadingPreview}
                  disabled={loadingPreview}
                  icon={<ArrowRight size={14} />}
                >
                  Generate Merge Preview
                </Button>
              </div>
            </Card>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 3: MERGE PREVIEW & OPTIONS */}
          {/* ------------------------------------------------------------- */}
          {importStep === 3 && previewPlan && (
            <div className="space-y-6">
              {/* Summary Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
                <div className="p-3 bg-surface rounded-xl border border-border-subtle shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-ink-muted block">In File</span>
                  <span className="text-xl font-bold text-ink tabular-nums">{previewPlan.summary.totalPassengers}</span>
                </div>

                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/25 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 block">New Bookings (ADD)</span>
                  <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{previewPlan.summary.add}</span>
                </div>

                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/25 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-blue-800 dark:text-blue-300 block">Merge Existing</span>
                  <span className="text-xl font-bold text-blue-700 dark:text-blue-300 tabular-nums">{previewPlan.summary.merge}</span>
                </div>

                <div className="p-3 bg-surface-muted rounded-xl border border-border-subtle shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-ink-muted block">Identical (SAME)</span>
                  <span className="text-xl font-bold text-ink tabular-nums">{previewPlan.summary.same}</span>
                </div>

                <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/25 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-rose-800 dark:text-rose-300 block">Conflicts (Skipped)</span>
                  <span className="text-xl font-bold text-rose-700 dark:text-rose-300 tabular-nums">{previewPlan.summary.conflict}</span>
                </div>

                <div className="p-3 bg-amber-500/15 rounded-xl border border-amber-500/30 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300 block">Active Holds</span>
                  <span className="text-xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">{previewPlan.summary.hold}</span>
                </div>
              </div>

              {/* Financial Totals Preview */}
              <div className="p-4 rounded-xl border border-border-subtle bg-surface flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-ink-muted block text-[11px]">Total New Fares Added</span>
                    <span className="text-base font-bold text-ink">{formatINR(previewPlan.summary.totalNewFares)}</span>
                  </div>
                  <div>
                    <span className="text-ink-muted block text-[11px]">Total Payments to Record</span>
                    <span className="text-base font-bold text-emerald-600">{formatINR(previewPlan.summary.totalNewPayments)}</span>
                  </div>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRefreshPreview}
                  loading={loadingPreview}
                  icon={<RefreshCw size={13} />}
                >
                  Recalculate Preview
                </Button>
              </div>

              {/* Import Options Controls */}
              <Card className="p-5 border-border-subtle space-y-4">
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                  Merge &amp; Data Completion Options
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <Field label="Differing Fields Preference">
                    <Select
                      value={preferOption}
                      onChange={(e) => setPreferOption(e.target.value)}
                      className="text-xs"
                    >
                      <option value="keep">Keep TBS value (Recommended)</option>
                      <option value="file">Use file value</option>
                    </Select>
                  </Field>

                  <Field label="Default Age (if empty in file)">
                    <Input
                      type="number"
                      min="1"
                      max="120"
                      value={defaultAge}
                      onChange={(e) => setDefaultAge(e.target.value)}
                      className="text-xs"
                    />
                  </Field>

                  <Field label="Default City (if empty in file)">
                    <Input
                      type="text"
                      value={defaultCity}
                      onChange={(e) => setDefaultCity(e.target.value)}
                      className="text-xs"
                    />
                  </Field>

                  <Field label="Fallback Phone (for bookings lacking phone)">
                    <Input
                      type="text"
                      placeholder="10-digit mobile..."
                      value={fallbackPhone}
                      onChange={(e) => setFallbackPhone(e.target.value)}
                      className="text-xs"
                    />
                  </Field>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-border-subtle">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-ink">Import Payments to Financial Ledger</span>
                    <p className="text-[11px] text-ink-muted">
                      Creates verified Payment records synchronized with booking balances (deduplicates against existing receipts).
                    </p>
                  </div>
                  <Switch
                    checked={importPayments}
                    onCheckedChange={setImportPayments}
                    aria-label="Toggle importing payments"
                  />
                </div>
              </Card>

              {/* Preview Table of Passengers */}
              <Card className="p-5 border-border-subtle space-y-3">
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                  Passenger Action Breakdown
                </h4>

                <div className="overflow-x-auto rounded-xl border border-border-subtle max-h-96">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-surface-muted text-ink-muted font-bold uppercase tracking-wider border-b border-border-subtle sticky top-0">
                      <tr>
                        <th className="p-2.5">Seat</th>
                        <th className="p-2.5">Passenger Name</th>
                        <th className="p-2.5">Phone</th>
                        <th className="p-2.5">City</th>
                        <th className="p-2.5">Fare</th>
                        <th className="p-2.5">Action</th>
                        <th className="p-2.5">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {previewPlan.tripsPlan?.flatMap((tp) =>
                        tp.plan?.results?.map((res, rIdx) => {
                          const p = res.passenger || {}
                          const isAdd = res.action === "ADD"
                          const isMerge = res.action === "MERGE"
                          const isSame = res.action === "SAME"
                          const isConflict = res.action === "CONFLICT"
                          const isHold = res.action === "HOLD"

                          const badgeVariant = isAdd
                            ? "success"
                            : isMerge
                            ? "primary"
                            : isSame
                            ? "neutral"
                            : isConflict
                            ? "danger"
                            : isHold
                            ? "warning"
                            : "outline"

                          return (
                            <tr key={`${res.seatId}_${rIdx}`} className="hover:bg-surface-muted/30">
                              <td className="p-2.5 font-bold font-mono text-ink">{res.seatId}</td>
                              <td className="p-2.5 font-semibold text-ink">{p.name || "—"}</td>
                              <td className="p-2.5 font-mono text-ink-muted">{p.phone || fallbackPhone || "—"}</td>
                              <td className="p-2.5 text-ink-muted">{p.city || defaultCity || "—"}</td>
                              <td className="p-2.5 font-medium tabular-nums text-ink">
                                {formatINR(p.fare || 0)}
                              </td>
                              <td className="p-2.5">
                                <Badge variant={badgeVariant}>{res.action}</Badge>
                              </td>
                              <td className="p-2.5 text-ink-muted text-[11px]">
                                {res.reason ||
                                  (isMerge && `Fills: ${Object.keys(res.fills || {}).join(", ") || "none"}`) ||
                                  (isSame && "Matches existing booking verbatim")}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
                  <Button variant="ghost" onClick={() => setImportStep(2)}>
                    Back to Mapping
                  </Button>
                  <Button
                    variant="accent"
                    onClick={handleCommitImport}
                    loading={committing}
                    disabled={committing || (previewPlan.summary.add === 0 && previewPlan.summary.merge === 0)}
                    icon={<FileCheck size={14} />}
                  >
                    Commit Passenger Import ({previewPlan.summary.add + previewPlan.summary.merge} changes)
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 4: COMMIT RESULT */}
          {/* ------------------------------------------------------------- */}
          {importStep === 4 && commitResult && (
            <Card className="p-6 border-emerald-500/20 bg-emerald-500/5 space-y-5 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mx-auto">
                <CheckCircle2 size={24} />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-ink">Passenger Import Successfully Committed</h3>
                <p className="text-xs text-ink-muted">
                  All new bookings, seat assignments, and payment records are synchronized.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto text-xs">
                <div className="p-3 bg-surface rounded-xl border border-border-subtle">
                  <span className="text-ink-muted block text-[10px] uppercase font-bold">New Bookings Created</span>
                  <span className="text-xl font-bold text-ink">{commitResult.summary.createdBookingsCount || 0}</span>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-border-subtle">
                  <span className="text-ink-muted block text-[10px] uppercase font-bold">Existing Bookings Merged</span>
                  <span className="text-xl font-bold text-ink">{commitResult.summary.mergedBookingsCount || 0}</span>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-border-subtle">
                  <span className="text-ink-muted block text-[10px] uppercase font-bold">Payments Recorded</span>
                  <span className="text-xl font-bold text-emerald-600">{commitResult.summary.importedPaymentsCount || 0}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-4 border-t border-border-subtle">
                <Button variant="secondary" onClick={handleResetImport}>
                  Import Another File
                </Button>
                {onViewBatches && (
                  <Button variant="primary" onClick={onViewBatches}>
                    View in Recent Batches
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
