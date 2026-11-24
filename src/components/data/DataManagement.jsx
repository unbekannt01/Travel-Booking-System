import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Card,
  Button,
  StatCard,
  Badge,
  Spinner,
  Input,
  Select,
  ConfirmDialog,
  Tabs,
  Field,
} from "../ui"
import { PanelErrorBoundary } from "../common/PanelErrorBoundary"
import { RateLimitNotice } from "../common/RateLimitNotice"
import {
  downloadExportCsv,
  previewImportCsv,
  commitImportCsv,
  undoImportBatch,
  getImportBatches,
} from "../../data/importExport"
import {
  toCsv,
  CUSTOMER_IMPORT_SPEC,
  EXPENSE_IMPORT_SPEC,
  mapHeaders,
  parseCsv,
} from "../../../shared/csv.js"
import { EXPENSE_CATEGORIES } from "../../../shared/expenses.js"
import { useToast } from "../common/ToastContext"
import {
  Download,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ReceiptText,
  Users,
  BookOpen,
  ReceiptIndianRupee,
  FileText,
  Check,
  Info,
  ShieldAlert,
  CreditCard,
  TrendingUp,
} from "lucide-react"

export default function DataManagement({ user = null, tours = [], initialTab = "export" }) {
  const { toast } = useToast()

  // Main navigation tabs: "export" | "import" | "batches"
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const match = window.location.hash.match(/[?&]tab=([^&]+)/)
      if (match && ["export", "import", "batches"].includes(match[1])) {
        return match[1]
      }
    }
    return initialTab
  })
  const [wizardStep, setWizardStep] = useState(1) // 1: Type/Template, 2: Upload, 3: Map, 4: Preview/Commit

  useEffect(() => {
    const handleHashChange = () => {
      if (typeof window !== "undefined" && window.location.hash) {
        const match = window.location.hash.match(/[?&]tab=([^&]+)/)
        if (match && ["export", "import", "batches"].includes(match[1])) {
          setActiveTab(match[1])
          if (match[1] === "import") {
            setWizardStep(1)
          }
        }
      }
    }
    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [])

  // ---------------------------------------------------------------------------
  // EXPORT SECTION STATE
  // ---------------------------------------------------------------------------
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  // Filters for exports
  const [expenseStartDate, setExpenseStartDate] = useState("")
  const [expenseEndDate, setExpenseEndDate] = useState("")
  const [expenseCategory, setExpenseCategory] = useState("all")

  const [bookingStartDate, setBookingStartDate] = useState("")
  const [bookingEndDate, setBookingEndDate] = useState("")
  const [bookingTour, setBookingTour] = useState("all")

  const [passengerStartDate, setPassengerStartDate] = useState("")
  const [passengerEndDate, setPassengerEndDate] = useState("")
  const [passengerTour, setPassengerTour] = useState("all")

  const [paymentStartDate, setPaymentStartDate] = useState("")
  const [paymentEndDate, setPaymentEndDate] = useState("")

  const [pnlStartDate, setPnlStartDate] = useState("")
  const [pnlEndDate, setPnlEndDate] = useState("")
  const [pnlTour, setPnlTour] = useState("all")

  const [cashbookStartDate, setCashbookStartDate] = useState("")
  const [cashbookEndDate, setCashbookEndDate] = useState("")

  const handleExport = async (type, params = {}) => {
    setIsExporting(true)
    setExportError(null)
    try {
      const result = await downloadExportCsv(type, params)
      toast.success(`Export downloaded: ${result.filename}`)
    } catch (err) {
      console.error("Export error:", err)
      setExportError(err)
      toast.error(err.message || "Failed to download export.")
    } finally {
      setIsExporting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // IMPORT WIZARD STATE
  // ---------------------------------------------------------------------------
  const [importType, setImportType] = useState("customers") // "customers" | "expenses"

  const [csvFile, setCsvFile] = useState(null)
  const [csvText, setCsvText] = useState("")
  const [parsedHeaders, setParsedHeaders] = useState([])
  const [parsedRowCount, setParsedRowCount] = useState(0)
  const [columnMapping, setColumnMapping] = useState({})
  const [unmappedHeaders, setUnmappedHeaders] = useState([])
  const [hasAadhaarError, setHasAadhaarError] = useState(false)

  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [previewError, setPreviewError] = useState(null)

  const [isCommitting, setIsCommitting] = useState(false)

  // ---------------------------------------------------------------------------
  // BATCHES & UNDO STATE
  // ---------------------------------------------------------------------------
  const [batches, setBatches] = useState([])
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [undoBatchTarget, setUndoBatchTarget] = useState(null)
  const [isUndoing, setIsUndoing] = useState(false)

  const loadBatches = useCallback(async () => {
    setLoadingBatches(true)
    try {
      const res = await getImportBatches()
      setBatches(res.batches || [])
    } catch (err) {
      console.error("Load batches error:", err)
    } finally {
      setLoadingBatches(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === "batches") {
      loadBatches()
    }
  }, [activeTab, loadBatches])

  // Template download generator
  const handleDownloadTemplate = (type) => {
    try {
      let columns = []
      let rows = []
      let filename = `yatrahub-${type}-template.csv`

      if (type === "customers") {
        columns = [
          { key: "name", label: "Customer Name" },
          { key: "phone", label: "Mobile Number" },
          { key: "city", label: "City / Village" },
          { key: "email", label: "Email Address" },
          { key: "emergencyContact", label: "Emergency Contact" },
          { key: "bloodGroup", label: "Blood Group" },
          { key: "notes", label: "Notes" },
        ]
        rows = [
          {
            name: "Ramesh Patel",
            phone: "9825012345",
            city: "Surat",
            email: "ramesh@example.com",
            emergencyContact: "9825099999",
            bloodGroup: "B+",
            notes: "Frequent pilgrim traveler",
          },
          {
            name: "Suresh Shah",
            phone: "9825067890",
            city: "Ahmedabad",
            email: "suresh@example.com",
            emergencyContact: "",
            bloodGroup: "O+",
            notes: "Family group leader",
          },
        ]
      } else {
        columns = [
          { key: "date", label: "Date" },
          { key: "category", label: "Category" },
          { key: "amount", label: "Amount" },
          { key: "paymentMode", label: "Payment Mode" },
          { key: "vendor", label: "Vendor / Payee" },
          { key: "notes", label: "Notes" },
        ]
        rows = [
          {
            date: "2026-11-24",
            category: "fuel",
            amount: "2500.00",
            paymentMode: "cash",
            vendor: "Shreeji Petroleum",
            notes: "Diesel refill for Somnath coach",
          },
          {
            date: "2026-11-24",
            category: "toll",
            amount: "450.00",
            paymentMode: "upi",
            vendor: "NH48 Toll Plaza",
            notes: "Fastag toll charge",
          },
        ]
      }

      const csvContent = toCsv({ columns, rows, bom: true, eol: "\r\n" })
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.info(`Downloaded template: ${filename}`)
    } catch (err) {
      console.error("Template error:", err)
      toast.error("Failed to generate CSV template.")
    }
  }

  // Handle File Upload & Parse
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".csv") && file.type && !file.type.includes("csv")) {
      toast.error("Please select a valid CSV file.")
      return
    }

    if (file.size > 1000000) {
      toast.error("File exceeds maximum allowed size of 1 MB.")
      return
    }

    setCsvFile(file)
    setPreviewError(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result || ""
      setCsvText(text)
      try {
        const parsed = parseCsv(text)
        setParsedHeaders(parsed.headers)
        setParsedRowCount(parsed.rowCount)

        const spec = importType === "customers" ? CUSTOMER_IMPORT_SPEC : EXPENSE_IMPORT_SPEC
        const mapped = mapHeaders(parsed.headers, spec)

        setColumnMapping(mapped.mapping)
        setUnmappedHeaders(mapped.unmapped)
        setHasAadhaarError(mapped.hasUnsafeAadhaarHeader)

        if (mapped.hasUnsafeAadhaarHeader) {
          toast.error("Aadhaar column detected in CSV! Aadhaar data is not accepted.")
        } else {
          setWizardStep(3)
        }
      } catch (err) {
        console.error("CSV parse error:", err)
        toast.error(`CSV Parse Error: ${err.message}`)
      }
    }
    reader.readAsText(file, "UTF-8")
  }

  // Handle Preview Request
  const handleRequestPreview = async () => {
    setIsPreviewing(true)
    setPreviewError(null)
    try {
      const res = await previewImportCsv(importType, {
        csvText,
        mapping: columnMapping,
      })
      setPreviewData(res)
      setWizardStep(4)
    } catch (err) {
      console.error("Preview error:", err)
      setPreviewError(err)
      toast.error(err.message || "Failed to preview import.")
    } finally {
      setIsPreviewing(false)
    }
  }

  // Handle Commit Import
  const handleCommitImport = async () => {
    if (!previewData?.token) return
    setIsCommitting(true)
    try {
      const res = await commitImportCsv(importType, {
        csvText,
        mapping: columnMapping,
        token: previewData.token,
      })
      toast.success(res.message || `Successfully imported ${res.counts?.imported || 0} ${importType}!`)
      // Reset wizard
      setWizardStep(1)
      setCsvFile(null)
      setCsvText("")
      setPreviewData(null)
      setActiveTab("batches")
      loadBatches()
    } catch (err) {
      console.error("Commit error:", err)
      toast.error(err.message || "Failed to commit import.")
    } finally {
      setIsCommitting(false)
    }
  }

  // Handle Undo Batch
  const handleConfirmUndo = async () => {
    if (!undoBatchTarget) return
    setIsUndoing(true)
    try {
      const res = await undoImportBatch(undoBatchTarget._id)
      const summary = res.summary || {}
      if (res.revertedCount > 0 && res.skippedCount === 0) {
        toast.success(`Successfully reverted all ${res.revertedCount} records.`)
      } else if (res.revertedCount > 0 && res.skippedCount > 0) {
        toast.warning(
          `Reverted ${res.revertedCount} records. Skipped ${res.skippedCount} (Locked: ${summary.booksLocked || 0}, In-use: ${summary.inUse || 0}, Deleted: ${summary.alreadyDeleted || 0}).`
        )
      } else {
        toast.warning(
          `No records reverted. Skipped ${res.skippedCount || 0} (Locked: ${summary.booksLocked || 0}, In-use: ${summary.inUse || 0}, Deleted: ${summary.alreadyDeleted || 0}).`
        )
      }
      setUndoBatchTarget(null)
      loadBatches()
    } catch (err) {
      console.error("Undo error:", err)
      toast.error(err.message || "Failed to revert import batch.")
    } finally {
      setIsUndoing(false)
    }
  }

  const spec = importType === "customers" ? CUSTOMER_IMPORT_SPEC : EXPENSE_IMPORT_SPEC

  const tabItems = useMemo(
    () => [
      { id: "export", label: "Export System Data" },
      { id: "import", label: "Import CSV Data" },
      { id: "batches", label: `Recent Batches (${batches.length})` },
    ],
    [batches.length],
  )

  return (
    <PanelErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-brand" aria-hidden="true" />
              <span>Data Import & Export</span>
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Download clean Excel-ready CSV files with formula defense, or import verified customer and expense spreadsheets{user?.companyName ? ` for ${user.companyName}` : ""}.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs
          items={tabItems}
          value={activeTab}
          onChange={setActiveTab}
          ariaLabel="Data Management Sections"
        />

        {/* RATE LIMIT NOTICE */}
        {exportError && exportError.status === 429 && (
          <RateLimitNotice
            error={exportError}
            title="Export rate limit reached"
            message="You have made too many export requests. Please wait a few minutes before requesting another export."
          />
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 1: EXPORT SYSTEM DATA */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === "export" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Card 1: Customers */}
              <Card className="p-5 flex flex-col justify-between border-border-subtle hover:border-brand/40 transition-colors">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                      <Users className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <Badge variant="primary">Active Directory</Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink text-base">Customers Master</h3>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                      Export complete customer profiles including mobile numbers, cities, blood groups, and notes. Excludes soft-deleted profiles.
                    </p>
                  </div>
                </div>
                <div className="pt-5 mt-4 border-t border-border-subtle">
                  <Button
                    variant="secondary"
                    className="w-full gap-2 min-h-11"
                    onClick={() => handleExport("customers")}
                    disabled={isExporting}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>Export Customers CSV</span>
                  </Button>
                </div>
              </Card>

              {/* Card 2: Expenses */}
              <Card className="p-5 flex flex-col justify-between border-border-subtle hover:border-brand/40 transition-colors">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                      <ReceiptText className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <Badge variant="warning">Operational Costs</Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink text-base">Expense Records</h3>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                      Download fuel, toll, driver bhatta, bus lease, and vendor expenses with category and payment mode tags.
                    </p>
                  </div>
                  {/* Filters */}
                  <div className="space-y-2 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="From">
                        <Input
                          type="date"
                          value={expenseStartDate}
                          onChange={(e) => setExpenseStartDate(e.target.value)}
                          className="text-xs"
                          aria-label="From Date"
                        />
                      </Field>
                      <Field label="To">
                        <Input
                          type="date"
                          value={expenseEndDate}
                          onChange={(e) => setExpenseEndDate(e.target.value)}
                          className="text-xs"
                          aria-label="To Date"
                        />
                      </Field>
                    </div>
                    <Select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="text-xs"
                      aria-label="Expense Category Filter"
                    >
                      <option value="all">All Categories</option>
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="pt-5 mt-4 border-t border-border-subtle">
                  <Button
                    variant="secondary"
                    className="w-full gap-2 min-h-11"
                    onClick={() =>
                      handleExport("expenses", {
                        startDate: expenseStartDate,
                        endDate: expenseEndDate,
                        category: expenseCategory,
                      })
                    }
                    disabled={isExporting}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>Export Expenses CSV</span>
                  </Button>
                </div>
              </Card>

              {/* Card 3: Bookings */}
              <Card className="p-5 flex flex-col justify-between border-border-subtle hover:border-brand/40 transition-colors">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                      <FileText className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <Badge variant="success">Reservations</Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink text-base">Bookings & Invoices</h3>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                      Export invoice numbers, tour departures, seat allocations, advances, and outstanding ticket amounts.
                    </p>
                  </div>
                  {/* Filters */}
                  <div className="space-y-2 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="From">
                        <Input
                          type="date"
                          value={bookingStartDate}
                          onChange={(e) => setBookingStartDate(e.target.value)}
                          className="text-xs"
                          aria-label="From Date"
                        />
                      </Field>
                      <Field label="To">
                        <Input
                          type="date"
                          value={bookingEndDate}
                          onChange={(e) => setBookingEndDate(e.target.value)}
                          className="text-xs"
                          aria-label="To Date"
                        />
                      </Field>
                    </div>
                    {tours && tours.length > 0 && (
                      <Select
                        aria-label="Booking Tour Filter"
                        value={bookingTour}
                        onChange={(e) => setBookingTour(e.target.value)}
                        className="text-xs"
                      >
                        <option value="all">All Tours</option>
                        {tours.map((t) => {
                          const name = typeof t === "string" ? t : t.tourName || t.name
                          return (
                            <option key={t._id || name} value={name}>
                              {name}
                            </option>
                          )
                        })}
                      </Select>
                    )}
                  </div>
                  <div className="p-2 rounded-md bg-surface-muted text-[11px] text-ink-muted flex items-start gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                    <span>Privacy Notice: Passenger Aadhaar numbers are never included in exports.</span>
                  </div>
                </div>
                <div className="pt-5 mt-4 border-t border-border-subtle">
                  <Button
                    variant="secondary"
                    className="w-full gap-2 min-h-11"
                    onClick={() =>
                      handleExport("bookings", {
                        startDate: bookingStartDate,
                        endDate: bookingEndDate,
                        tourName: bookingTour,
                      })
                    }
                    disabled={isExporting}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>Export Bookings CSV</span>
                  </Button>
                </div>
              </Card>

              {/* Card 4: Cash Book */}
              <Card className="p-5 flex flex-col justify-between border-border-subtle hover:border-brand/40 transition-colors">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                      <BookOpen className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <Badge variant="neutral">Daily Ledger</Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink text-base">Cash Book Day Book</h3>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                      Download chronologically unified cash and bank receipts, payments, owner entries, and running account balances.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Field label="From">
                      <Input
                        type="date"
                        value={cashbookStartDate}
                        onChange={(e) => setCashbookStartDate(e.target.value)}
                        className="text-xs"
                        aria-label="From Date"
                      />
                    </Field>
                    <Field label="To">
                      <Input
                        type="date"
                        value={cashbookEndDate}
                        onChange={(e) => setCashbookEndDate(e.target.value)}
                        className="text-xs"
                        aria-label="To Date"
                      />
                    </Field>
                  </div>
                </div>
                <div className="pt-5 mt-4 border-t border-border-subtle">
                  <Button
                    variant="secondary"
                    className="w-full gap-2 min-h-11"
                    onClick={() =>
                      handleExport("cashbook", {
                        startDate: cashbookStartDate,
                        endDate: cashbookEndDate,
                      })
                    }
                    disabled={isExporting}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>Export Day Book CSV</span>
                  </Button>
                </div>
              </Card>

              {/* Card 5: Outstanding Receivables */}
              <Card className="p-5 flex flex-col justify-between border-border-subtle hover:border-brand/40 transition-colors">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                      <ReceiptIndianRupee className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <Badge variant="danger">Aging Balances</Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink text-base">Receivables & Aging</h3>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                      Export customer-wise balances, total active bookings, amount received, and oldest overdue trip dates.
                    </p>
                  </div>
                </div>
                <div className="pt-5 mt-4 border-t border-border-subtle">
                  <Button
                    variant="secondary"
                    className="w-full gap-2 min-h-11"
                    onClick={() => handleExport("receivables")}
                    disabled={isExporting}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>Export Receivables CSV</span>
                  </Button>
                </div>
              </Card>

              {/* Card 6: Passenger List */}
              <Card className="p-5 flex flex-col justify-between border-border-subtle hover:border-brand/40 transition-colors">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
                      <Users className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <Badge variant="success">Traveler Manifest</Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink text-base">Passenger List</h3>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                      Export individual passenger rosters with seat numbers, journey dates, age, and gender. Zero Aadhaar data.
                    </p>
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="From">
                        <Input
                          type="date"
                          value={passengerStartDate}
                          onChange={(e) => setPassengerStartDate(e.target.value)}
                          className="text-xs"
                          aria-label="Passenger From Date"
                        />
                      </Field>
                      <Field label="To">
                        <Input
                          type="date"
                          value={passengerEndDate}
                          onChange={(e) => setPassengerEndDate(e.target.value)}
                          className="text-xs"
                          aria-label="Passenger To Date"
                        />
                      </Field>
                    </div>
                    {tours && tours.length > 0 && (
                      <Select
                        aria-label="Passenger Tour Filter"
                        value={passengerTour}
                        onChange={(e) => setPassengerTour(e.target.value)}
                        className="text-xs"
                      >
                        <option value="all">All Tours</option>
                        {tours.map((t) => {
                          const name = typeof t === "string" ? t : t.tourName || t.name
                          return (
                            <option key={t._id || name} value={name}>
                              {name}
                            </option>
                          )
                        })}
                      </Select>
                    )}
                  </div>
                </div>
                <div className="pt-5 mt-4 border-t border-border-subtle">
                  <Button
                    variant="secondary"
                    className="w-full gap-2 min-h-11"
                    onClick={() =>
                      handleExport("passengers", {
                        startDate: passengerStartDate,
                        endDate: passengerEndDate,
                        tourName: passengerTour,
                      })
                    }
                    disabled={isExporting}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>Export Passengers CSV</span>
                  </Button>
                </div>
              </Card>

              {/* Card 7: Payments Ledger */}
              <Card className="p-5 flex flex-col justify-between border-border-subtle hover:border-brand/40 transition-colors">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
                      <CreditCard className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <Badge variant="primary">Receipts & Refunds</Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink text-base">Payments Ledger</h3>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                      Download complete payment receipts and refund records with invoice numbers, payment modes, and void flags.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Field label="From">
                      <Input
                        type="date"
                        value={paymentStartDate}
                        onChange={(e) => setPaymentStartDate(e.target.value)}
                        className="text-xs"
                        aria-label="Payment From Date"
                      />
                    </Field>
                    <Field label="To">
                      <Input
                        type="date"
                        value={paymentEndDate}
                        onChange={(e) => setPaymentEndDate(e.target.value)}
                        className="text-xs"
                        aria-label="Payment To Date"
                      />
                    </Field>
                  </div>
                </div>
                <div className="pt-5 mt-4 border-t border-border-subtle">
                  <Button
                    variant="secondary"
                    className="w-full gap-2 min-h-11"
                    onClick={() =>
                      handleExport("payments", {
                        startDate: paymentStartDate,
                        endDate: paymentEndDate,
                      })
                    }
                    disabled={isExporting}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>Export Payments CSV</span>
                  </Button>
                </div>
              </Card>

              {/* Card 8: Tour-wise Profit & Loss */}
              <Card className="p-5 flex flex-col justify-between border-border-subtle hover:border-brand/40 transition-colors">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                      <TrendingUp className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <Badge variant="neutral">P&L Intelligence</Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink text-base">Tour-wise Profit / Loss</h3>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                      Export tour-wise booked revenue, collections, outstanding, allocated expenses, and operating margins.
                    </p>
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="From">
                        <Input
                          type="date"
                          value={pnlStartDate}
                          onChange={(e) => setPnlStartDate(e.target.value)}
                          className="text-xs"
                          aria-label="P&L From Date"
                        />
                      </Field>
                      <Field label="To">
                        <Input
                          type="date"
                          value={pnlEndDate}
                          onChange={(e) => setPnlEndDate(e.target.value)}
                          className="text-xs"
                          aria-label="P&L To Date"
                        />
                      </Field>
                    </div>
                    {tours && tours.length > 0 && (
                      <Select
                        aria-label="P&L Tour Filter"
                        value={pnlTour}
                        onChange={(e) => setPnlTour(e.target.value)}
                        className="text-xs"
                      >
                        <option value="all">All Tours</option>
                        {tours.map((t) => {
                          const name = typeof t === "string" ? t : t.tourName || t.name
                          return (
                            <option key={t._id || name} value={name}>
                              {name}
                            </option>
                          )
                        })}
                      </Select>
                    )}
                  </div>
                </div>
                <div className="pt-5 mt-4 border-t border-border-subtle">
                  <Button
                    variant="secondary"
                    className="w-full gap-2 min-h-11"
                    onClick={() =>
                      handleExport("tour-pnl", {
                        startDate: pnlStartDate,
                        endDate: pnlEndDate,
                        tourName: pnlTour,
                      })
                    }
                    disabled={isExporting}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>Export Tour P&L CSV</span>
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 2: IMPORT CSV WIZARD */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === "import" && (
          <div className="space-y-6">
            {/* Wizard Step Progress Tracker */}
            <div className="flex items-center justify-between max-w-2xl mx-auto py-2">
              {[
                { step: 1, label: "Type & Template" },
                { step: 2, label: "Upload File" },
                { step: 3, label: "Map Columns" },
                { step: 4, label: "Preview & Commit" },
              ].map((item, idx) => {
                const isActive = wizardStep === item.step
                const isPast = wizardStep > item.step
                return (
                  <div key={item.step} className="flex items-center gap-2">
                    <span
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        isPast
                          ? "bg-brand text-brand-fg"
                          : isActive
                            ? "bg-brand/10 text-brand border-2 border-brand"
                            : "bg-surface-muted text-ink-muted"
                      }`}
                    >
                      {isPast ? <Check className="h-4 w-4" /> : item.step}
                    </span>
                    <span className={`text-xs font-medium hidden sm:inline ${isActive ? "text-ink font-semibold" : "text-ink-muted"}`}>
                      {item.label}
                    </span>
                    {idx < 3 && <div className="w-8 sm:w-12 h-0.5 bg-border-subtle mx-1" />}
                  </div>
                )
              })}
            </div>

            {/* STEP 1: Select Type & Download Template */}
            {wizardStep === 1 && (
              <Card className="max-w-2xl mx-auto p-6 space-y-6 border-border-subtle">
                <div>
                  <h2 className="text-base font-semibold text-ink">Step 1: Choose Data Type & Download Template</h2>
                  <p className="text-xs text-ink-muted mt-1">
                    Select whether you are importing Customer profiles or Expense records. Download the starter CSV template to ensure your spreadsheet columns match standard formats.
                  </p>
                </div>

                {/* Type Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setImportType("customers")}
                    className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all min-h-24 ${
                      importType === "customers"
                        ? "border-brand bg-brand/5 ring-2 ring-brand/20"
                        : "border-border-subtle hover:border-border hover:bg-surface-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium text-ink">
                      <Users className="h-4 w-4 text-brand" />
                      <span>Customers</span>
                    </div>
                    <p className="text-xs text-ink-muted mt-2">
                      Names, 10-digit mobile numbers, city, email, notes, and tags.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportType("expenses")}
                    className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all min-h-24 ${
                      importType === "expenses"
                        ? "border-brand bg-brand/5 ring-2 ring-brand/20"
                        : "border-border-subtle hover:border-border hover:bg-surface-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium text-ink">
                      <ReceiptText className="h-4 w-4 text-brand" />
                      <span>Expenses</span>
                    </div>
                    <p className="text-xs text-ink-muted mt-2">
                      Dates, categories (fuel, toll, bhatta, hire), amounts, and vendors.
                    </p>
                  </button>
                </div>

                {/* Required Fields Info */}
                <div className="p-4 rounded-xl bg-surface-muted text-xs space-y-2 border border-border-subtle">
                  <div className="font-semibold text-ink flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-brand" />
                    <span>Required Format & Guidelines:</span>
                  </div>
                  {importType === "customers" ? (
                    <ul className="list-disc list-inside text-ink-muted space-y-1">
                      <li><strong>Customer Name</strong>: Minimum 2 characters.</li>
                      <li><strong>Mobile Number</strong>: Valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9).</li>
                      <li>Duplicate phone numbers in the database will be safely skipped.</li>
                      <li><strong>Aadhaar numbers are never imported</strong> for privacy and compliance.</li>
                    </ul>
                  ) : (
                    <ul className="list-disc list-inside text-ink-muted space-y-1">
                      <li><strong>Date</strong>: Standard formats supported (YYYY-MM-DD or DD-MM-YYYY).</li>
                      <li><strong>Amount</strong>: Non-negative currency amount (e.g. 1500 or 1500.50).</li>
                      <li><strong>Category</strong>: Fuel, toll, driver bhatta, bus lease, food, hotel, maintenance, etc.</li>
                      <li>Expenses with dates in closed books periods will be skipped automatically.</li>
                    </ul>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
                  <Button
                    variant="outline"
                    className="gap-2 min-h-11"
                    onClick={() => handleDownloadTemplate(importType)}
                  >
                    <Download className="h-4 w-4" />
                    <span>Download {importType === "customers" ? "Customer" : "Expense"} Template</span>
                  </Button>
                  <Button
                    variant="accent"
                    className="gap-2 min-h-11 px-6"
                    onClick={() => setWizardStep(2)}
                  >
                    <span>Next: Upload File</span>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            )}

            {/* STEP 2: Upload File */}
            {wizardStep === 2 && (
              <Card className="max-w-2xl mx-auto p-6 space-y-6 border-border-subtle">
                <div>
                  <h2 className="text-base font-semibold text-ink">Step 2: Upload CSV File</h2>
                  <p className="text-xs text-ink-muted mt-1">
                    Upload your UTF-8 encoded .csv spreadsheet. Maximum file size is 1 MB (up to 2,000 rows, 30 columns, 500 characters per cell).
                  </p>
                </div>

                <div className="border-2 border-dashed border-border-subtle rounded-2xl p-8 text-center hover:border-brand/50 transition-colors bg-surface-muted/30">
                  <Upload className="h-10 w-10 text-brand mx-auto mb-3" aria-hidden="true" />
                  <p className="text-sm font-medium text-ink">Choose a CSV file from your computer</p>
                  <p className="text-xs text-ink-muted mt-1">Supports standard CSV with UTF-8 encoding</p>
                  <div className="mt-4">
                    <input
                      type="file"
                      id="csv-file-input"
                      accept=".csv,text/csv"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                    <label
                      htmlFor="csv-file-input"
                      className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-brand text-brand-fg font-medium text-xs cursor-pointer hover:bg-brand/90 transition-colors min-h-11 shadow-sm"
                    >
                      Browse Files
                    </label>
                  </div>
                </div>

                {csvFile && (
                  <div className="p-3 rounded-lg bg-surface-muted text-xs text-ink flex items-center justify-between">
                    <span>Loaded: <strong>{csvFile.name}</strong> ({parsedRowCount} data rows)</span>
                    <Badge variant="neutral">{(csvFile.size / 1024).toFixed(1)} KB</Badge>
                  </div>
                )}

                {hasAadhaarError && (
                  <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Security Alert: Aadhaar / UID Column Detected</p>
                      <p className="mt-0.5">For citizen privacy and data minimization, Aadhaar numbers are never imported into YatraHub. Please remove this column from your CSV file to continue.</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
                  <Button variant="ghost" className="min-h-11" onClick={() => setWizardStep(1)}>
                    Back
                  </Button>
                </div>
              </Card>
            )}

            {/* STEP 3: Map Columns */}
            {wizardStep === 3 && (
              <Card className="max-w-2xl mx-auto p-6 space-y-6 border-border-subtle">
                <div>
                  <h2 className="text-base font-semibold text-ink">Step 3: Map CSV Columns</h2>
                  <p className="text-xs text-ink-muted mt-1">
                    Match each field required by YatraHub with the corresponding column header in your uploaded CSV file ({csvFile?.name}).
                  </p>
                </div>

                {/* Column Mapping Table */}
                <div
                  role="region"
                  aria-label="Column mapping table, scrollable"
                  /* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WCAG 2.1 SC 2.1.1: scrollable data region must be keyboard focusable */
                  tabIndex={0}
                  className="overflow-x-auto rounded-xl border border-border-subtle"
                >
                  <table className="w-full text-xs text-left" role="table">
                    <thead className="bg-surface-muted text-ink-muted font-semibold uppercase tracking-wider border-b border-border-subtle">
                      <tr>
                        <th className="p-3">Target Field</th>
                        <th className="p-3">Required?</th>
                        <th className="p-3">CSV File Header</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {Object.entries(spec.fields).map(([fieldKey, fieldDef]) => {
                        // Current header assigned to this target field
                        const selectedHeader =
                          Object.entries(columnMapping).find(([, f]) => f === fieldKey)?.[0] || ""

                        return (
                          <tr key={fieldKey} className="hover:bg-surface-muted/40 transition-colors">
                            <td className="p-3 font-medium text-ink">{fieldDef.label}</td>
                            <td className="p-3">
                              {fieldDef.required ? (
                                <Badge variant="danger">Required</Badge>
                              ) : (
                                <Badge variant="neutral">Optional</Badge>
                              )}
                            </td>
                            <td className="p-3">
                              <Select
                                value={selectedHeader}
                                onChange={(e) => {
                                  const newHeader = e.target.value
                                  const updated = { ...columnMapping }
                                  // remove old assignment
                                  for (const [h, f] of Object.entries(updated)) {
                                    if (f === fieldKey) delete updated[h]
                                  }
                                  if (newHeader) {
                                    updated[newHeader] = fieldKey
                                  }
                                  setColumnMapping(updated)
                                }}
                                className="text-xs py-1.5"
                                aria-label={`Map column for ${fieldDef.label}`}
                              >
                                <option value="">— Select Column —</option>
                                {parsedHeaders.map((h) => (
                                  <option key={h} value={h}>
                                    {h}
                                  </option>
                                ))}
                              </Select>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Validation Warnings */}
                {Object.entries(spec.fields).some(
                  ([k, d]) => d.required && !Object.values(columnMapping).includes(k),
                ) && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Please map all required fields before proceeding to preview.</span>
                  </div>
                )}

                {unmappedHeaders.length > 0 && (
                  <p className="text-xs text-ink-muted">
                    Ignored CSV columns: {unmappedHeaders.join(", ")}
                  </p>
                )}

                {previewError && (
                  <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{previewError.message || "Failed to validate CSV data. Please check column mapping."}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
                  <Button variant="ghost" className="min-h-11" onClick={() => setWizardStep(2)}>
                    Back
                  </Button>
                  <Button
                    variant="accent"
                    className="gap-2 min-h-11 px-6"
                    onClick={handleRequestPreview}
                    disabled={
                      isPreviewing ||
                      Object.entries(spec.fields).some(
                        ([k, d]) => d.required && !Object.values(columnMapping).includes(k),
                      )
                    }
                  >
                    {isPreviewing && <Spinner size="sm" />}
                    <span>Next: Validate & Preview</span>
                  </Button>
                </div>
              </Card>
            )}

            {/* STEP 4: Preview & Commit */}
            {wizardStep === 4 && previewData && (
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Summary StatCards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard
                    title="Total Rows in File"
                    value={previewData.counts.total}
                    variant="neutral"
                    icon={<FileSpreadsheet className="h-5 w-5" />}
                  />
                  <StatCard
                    title="Valid Rows to Import"
                    value={previewData.counts.valid}
                    variant="success"
                    icon={<CheckCircle2 className="h-5 w-5" />}
                  />
                  <StatCard
                    title="Invalid / Skipped Rows"
                    value={previewData.counts.invalid}
                    variant={previewData.counts.invalid > 0 ? "danger" : "neutral"}
                    icon={<XCircle className="h-5 w-5" />}
                  />
                </div>

                {/* Valid Rows Preview Table */}
                <Card className="p-5 border-border-subtle space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-ink text-base">Sample Valid Records</h3>
                      <p className="text-xs text-ink-muted">
                        Showing first {previewData.sampleValid.length} valid rows verified against format and books lock rules.
                      </p>
                    </div>
                    <Badge variant="success">Ready for Import</Badge>
                  </div>

                  <div
                    role="region"
                    aria-label="Import data preview, scrollable"
                    /* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WCAG 2.1 SC 2.1.1: scrollable data region must be keyboard focusable */
                    tabIndex={0}
                    className="overflow-x-auto rounded-xl border border-border-subtle"
                  >
                    <table className="w-full text-xs text-left" role="table">
                      <thead className="bg-surface-muted text-ink-muted font-semibold uppercase tracking-wider border-b border-border-subtle">
                        <tr>
                          <th className="p-3">#</th>
                          {importType === "customers" ? (
                            <>
                              <th className="p-3">Name</th>
                              <th className="p-3">Phone</th>
                              <th className="p-3">City</th>
                              <th className="p-3">Status</th>
                            </>
                          ) : (
                            <>
                              <th className="p-3">Date</th>
                              <th className="p-3">Category</th>
                              <th className="p-3 text-right">Amount (₹)</th>
                              <th className="p-3">Vendor</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {previewData.sampleValid.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-ink-muted">
                              No valid rows found in file.
                            </td>
                          </tr>
                        ) : (
                          previewData.sampleValid.map((item) => (
                            <tr key={item.rowNumber} className="hover:bg-surface-muted/30">
                              <td className="p-3 font-mono text-ink-muted">{item.rowNumber}</td>
                              {importType === "customers" ? (
                                <>
                                  <td className="p-3 font-medium text-ink">{item.data.name}</td>
                                  <td className="p-3 font-mono text-ink-muted">{item.data.phone}</td>
                                  <td className="p-3 text-ink-muted">{item.data.city || "—"}</td>
                                  <td className="p-3">
                                    {item.isExisting ? (
                                      <Badge variant="neutral">Existing (Skip)</Badge>
                                    ) : (
                                      <Badge variant="success">New</Badge>
                                    )}
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="p-3 text-ink">{item.data.date}</td>
                                  <td className="p-3">
                                    <Badge variant="neutral">{item.data.category}</Badge>
                                  </td>
                                  <td className="p-3 text-right font-mono font-medium text-ink">
                                    ₹{Number(item.data.amount).toFixed(2)}
                                  </td>
                                  <td className="p-3 text-ink-muted">{item.data.vendor || "—"}</td>
                                </>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Errors Preview if any */}
                {previewData.sampleInvalid.length > 0 && (
                  <Card className="p-5 border-border-subtle space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-danger text-base">Invalid Rows with Errors</h3>
                        <p className="text-xs text-ink-muted">
                          These rows will be skipped during import to protect data integrity.
                        </p>
                      </div>
                      <Badge variant="danger">{previewData.sampleInvalid.length} Errors</Badge>
                    </div>

                    <div
                      role="region"
                      aria-label="Import error rows, scrollable"
                      /* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WCAG 2.1 SC 2.1.1: scrollable data region must be keyboard focusable */
                      tabIndex={0}
                      className="overflow-x-auto rounded-xl border border-danger/20"
                    >
                      <table className="w-full text-xs text-left" role="table">
                        <thead className="bg-danger/5 text-danger font-semibold uppercase tracking-wider border-b border-danger/20">
                          <tr>
                            <th className="p-3 w-16">Row</th>
                            <th className="p-3">Field</th>
                            <th className="p-3">Reason / Error</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-danger/10">
                          {previewData.sampleInvalid.map((item, idx) => (
                            <tr key={idx} className="hover:bg-danger/5">
                              <td className="p-3 font-mono font-bold text-danger">{item.row ?? item.rowNumber ?? "—"}</td>
                              <td className="p-3 font-mono text-danger">{item.field || "—"}</td>
                              <td className="p-3 text-danger">
                                {item.code || (Array.isArray(item.errors) ? item.errors.join(", ") : JSON.stringify(item))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {/* Commit Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
                  <Button variant="ghost" className="min-h-11" onClick={() => setWizardStep(3)}>
                    Back to Column Mapping
                  </Button>
                  <Button
                    variant="accent"
                    className="gap-2 min-h-11 px-8 text-sm font-semibold"
                    onClick={handleCommitImport}
                    disabled={isCommitting || previewData.counts.valid === 0}
                  >
                    {isCommitting && <Spinner size="sm" />}
                    <span>Commit Import ({previewData.counts.valid} records)</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 3: RECENT IMPORT BATCHES */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === "batches" && (
          <Card className="p-5 border-border-subtle space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink">Recent Import Batches</h2>
                <p className="text-xs text-ink-muted">
                  Audit log of previous spreadsheet imports with undo capability.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadBatches}
                disabled={loadingBatches}
                className="gap-1.5"
              >
                {loadingBatches && <Spinner size="sm" />}
                <span>Refresh</span>
              </Button>
            </div>

            <div
              role="region"
              aria-label="Recent import batches table, scrollable"
              /* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WCAG 2.1 SC 2.1.1: scrollable data region must be keyboard focusable */
              tabIndex={0}
              className="overflow-x-auto rounded-xl border border-border-subtle"
            >
              <table className="w-full text-xs text-left" role="table">
                <thead className="bg-surface-muted text-ink-muted font-semibold uppercase tracking-wider border-b border-border-subtle">
                  <tr>
                    <th className="p-3">Import Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Imported</th>
                    <th className="p-3 text-right">Skipped</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-ink-muted">
                        No import batches found for this account.
                      </td>
                    </tr>
                  ) : (
                    batches.map((batch) => {
                      const isReverted = batch.status === "reverted"
                      const isPartial = batch.status === "partially_reverted"

                      return (
                        <tr key={batch._id} className="hover:bg-surface-muted/30">
                          <td className="p-3 text-ink font-mono">
                            {new Date(batch.createdAt).toLocaleString()}
                          </td>
                          <td className="p-3">
                            <Badge variant={batch.type === "customers" ? "primary" : "warning"}>
                              {batch.type}
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-mono font-medium text-ink">
                            {batch.successCount}
                          </td>
                          <td className="p-3 text-right font-mono text-ink-muted">
                            {batch.skippedCount || 0}
                          </td>
                          <td className="p-3">
                            {isReverted ? (
                              <Badge variant="neutral">Reverted</Badge>
                            ) : isPartial ? (
                              <Badge variant="warning">Partially Reverted</Badge>
                            ) : (
                              <Badge variant="success">Committed</Badge>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {!isReverted && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setUndoBatchTarget(batch)}
                                className="text-danger hover:bg-danger/10 gap-1 min-h-9"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Undo</span>
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Undo Confirm Dialog */}
        <ConfirmDialog
          isOpen={Boolean(undoBatchTarget)}
          onClose={() => setUndoBatchTarget(null)}
          onConfirm={handleConfirmUndo}
          title="Undo Import Batch?"
          message={`Are you sure you want to revert this ${undoBatchTarget?.type || ""} import batch (${undoBatchTarget?.successCount || 0} records)? Records not locked by closed books will be removed.`}
          confirmText={isUndoing ? "Reverting..." : "Undo Batch"}
          cancelText="Cancel"
          isDestructive={true}
        />
      </div>
    </PanelErrorBoundary>
  )
}
