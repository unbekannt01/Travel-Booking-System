import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Card,
  Button,
  IconButton,
  StatCard,
  Badge,
  Spinner,
  Input,
} from "../ui"
import {
  getCashBook,
  getCashBookSetup,
  deleteCashEntry,
  formatINR,
  toDateString,
} from "../../data/cashbook"
import { downloadCsv } from "../../utils/csv"
import { useToast } from "../common/ToastContext"
import DayBookTable from "./DayBookTable"
import ManualEntryModal from "./ManualEntryModal"
import CloseDayModal from "./CloseDayModal"
import ReopenCloseModal from "./ReopenCloseModal"
import SetupModal from "./SetupModal"
import PrintDayBookModal from "./PrintDayBookModal"
import {
  Plus,
  Lock,
  Unlock,
  Printer,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Settings,
  AlertCircle,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
} from "lucide-react"

export default function CashBook({ user = null }) {
  const { toast } = useToast()

  // Stable today date for React 19 purity
  const [today] = useState(() => new Date().toISOString().slice(0, 10))

  const [viewMode, setViewMode] = useState("day") // "day" | "range"
  const [selectedDate, setSelectedDate] = useState(today)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [accountFilter, setAccountFilter] = useState("all") // "all" | "cash" | "bank"

  const [data, setData] = useState(null)
  const [setup, setSetup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modals state
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false)
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)

  // Fetch Cash Book data
  const loadCashBook = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const start = viewMode === "day" ? selectedDate : startDate
      const end = viewMode === "day" ? selectedDate : endDate

      const res = await getCashBook({
        startDate: start,
        endDate: end,
        account: accountFilter,
      })

      setData(res)
      if (res.setup) setSetup(res.setup)
    } catch (err) {
      console.error("Load cash book error:", err)
      setError(err.message || "Failed to load cash book data.")
    } finally {
      setLoading(false)
    }
  }, [viewMode, selectedDate, startDate, endDate, accountFilter])

  // Initial load
  useEffect(() => {
    loadCashBook()
  }, [loadCashBook])

  // Also load setup
  useEffect(() => {
    getCashBookSetup()
      .then((res) => {
        if (res?.setup) setSetup(res.setup)
      })
      .catch(() => {})
  }, [])

  // Date stepper handlers
  const handleStepDay = (delta) => {
    const current = new Date(`${selectedDate}T12:00:00.000Z`)
    current.setDate(current.getDate() + delta)
    const nextStr = toDateString(current)
    setSelectedDate(nextStr)
  }

  // Quick preset ranges
  const applyRangePreset = (preset) => {
    const now = new Date()
    if (preset === "today") {
      setStartDate(today)
      setEndDate(today)
    } else if (preset === "yesterday") {
      const y = new Date()
      y.setDate(y.getDate() - 1)
      const yStr = toDateString(y)
      setStartDate(yStr)
      setEndDate(yStr)
    } else if (preset === "week") {
      const w = new Date()
      w.setDate(w.getDate() - 7)
      setStartDate(toDateString(w))
      setEndDate(today)
    } else if (preset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      setStartDate(toDateString(firstDay))
      setEndDate(today)
    }
  }

  // Delete manual entry handler
  const handleDeleteEntry = async (entry) => {
    if (!window.confirm(`Are you sure you want to delete this ${entry.type} entry of ${formatINR(entry.amount)}?`)) {
      return
    }
    try {
      await deleteCashEntry(entry.sourceId || entry.id)
      toast.success("Entry deleted successfully.")
      loadCashBook()
    } catch (err) {
      console.error("Delete cash entry error:", err)
      if (err.status === 423) {
        toast.error("Books are closed up to this date. Action locked.")
      } else {
        toast.error(err.message || "Failed to delete entry.")
      }
    }
  }

  // Export RFC4180 CSV
  const handleExportCsv = () => {
    if (!data?.dayBook) return
    const db = data.dayBook
    const filename = `DayBook-${db.startDate}${db.startDate !== db.endDate ? `-to-${db.endDate}` : ""}.csv`

    const rows = [
      ["#", "Date", "Voucher/Ref", "Particulars", "Party", "Account", "In (+)", "Out (-)", "Cash Balance", "Bank Balance", "Total Balance"],
      ["", "Opening", "", "OPENING BALANCE", "", "All", "", "", db.opening.cash, db.opening.bank, db.opening.total],
    ]

    for (let i = 0; i < db.entries.length; i++) {
      const e = db.entries[i]
      const inAmt = e.cashDelta > 0 ? e.cashDelta : e.bankDelta > 0 ? e.bankDelta : ""
      const outAmt = e.cashDelta < 0 ? Math.abs(e.cashDelta) : e.bankDelta < 0 ? Math.abs(e.bankDelta) : ""

      rows.push([
        i + 1,
        e.date,
        e.voucherNo || e.invoiceNo || "",
        e.description || "",
        e.partyName || "",
        e.account,
        inAmt,
        outAmt,
        e.cashBalance,
        e.bankBalance,
        e.totalBalance,
      ])
    }

    rows.push(["", "Closing", "", "CLOSING BALANCE", "", "All", db.totals.receipts.total, db.totals.expenses.total + db.totals.refunds.total, db.closing.cash, db.closing.bank, db.closing.total])

    downloadCsv(filename, rows)
    toast.success("CSV exported successfully.")
  }

  const lockDate = data?.lockDate || null
  const lastClose = data?.lastClose || null
  const dayBook = data?.dayBook || null

  const isCurrentViewLocked = useMemo(() => {
    if (!lockDate) return false
    const activeDate = viewMode === "day" ? selectedDate : endDate
    return activeDate <= lockDate
  }, [lockDate, viewMode, selectedDate, endDate])

  return (
    <div className="space-y-6">
      {/* Page Title & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink flex items-center gap-2">
            <span>Daily Cash & Bank Book</span>
            {isCurrentViewLocked && (
              <Badge variant="neutral" size="sm" className="gap-1 text-ink-muted">
                <Lock className="w-3 h-3" />
                Books Closed
              </Badge>
            )}
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Track daily cash-in-hand, bank deposits, digital receipts, trip expenses, and perform daily books close.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSetupModalOpen(true)}
            className="gap-1.5"
            aria-label="Opening setup"
          >
            <Settings className="w-3.5 h-3.5 text-ink-muted" />
            <span>Setup</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPrintModalOpen(true)}
            className="gap-1.5"
            disabled={!dayBook}
            aria-label="Print day book"
          >
            <Printer className="w-3.5 h-3.5 text-ink-muted" />
            <span>Print</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-1.5"
            disabled={!dayBook || dayBook.entriesCount === 0}
            aria-label="Export CSV"
          >
            <Download className="w-3.5 h-3.5 text-ink-muted" />
            <span>Export CSV</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingEntry(null)
              setIsEntryModalOpen(true)
            }}
            className="gap-1.5"
            aria-label="Add entry"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Entry</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsCloseModalOpen(true)}
            className="gap-1.5"
            aria-label="Close day"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Close Day</span>
          </Button>
        </div>
      </div>

      {/* Lock Notification Banner */}
      {lockDate && (
        <div className="p-3.5 rounded-xl border border-border-subtle bg-surface-subtle text-xs text-ink flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-brand shrink-0" />
            <span>
              Books are officially closed up to <strong>{lockDate}</strong>. Transactions on or
              before this date are locked against modification.
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsReopenModalOpen(true)}
            className="text-brand hover:text-brand-dark gap-1 text-xs shrink-0"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Reopen Last Close</span>
          </Button>
        </div>
      )}

      {/* Date & Filter Navigation Bar */}
      <Card elevation="sm" className="p-4 rounded-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* View Mode Selector: Single Day vs Date Range */}
          <div className="flex items-center gap-2">
            <div
              className="flex items-center rounded-lg border border-border p-0.5 bg-surface-subtle h-8"
              role="radiogroup"
              aria-label="View Mode"
            >
              <button
                type="button"
                role="radio"
                aria-checked={viewMode === "day"}
                onClick={() => setViewMode("day")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === "day"
                    ? "bg-surface text-ink shadow-xs"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                Single Day
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={viewMode === "range"}
                onClick={() => setViewMode("range")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === "range"
                    ? "bg-surface text-ink shadow-xs"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                Date Range
              </button>
            </div>

            {/* Stepper for Single Day */}
            {viewMode === "day" ? (
              <div className="flex items-center gap-1.5">
                <IconButton
                  size="sm"
                  variant="outline"
                  onClick={() => handleStepDay(-1)}
                  aria-label="Previous day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </IconButton>

                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-ink-muted" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-auto py-1 text-xs"
                    aria-label="Select date"
                  />
                </div>


                <IconButton
                  size="sm"
                  variant="outline"
                  onClick={() => handleStepDay(1)}
                  aria-label="Next day"
                >
                  <ChevronRight className="w-4 h-4" />
                </IconButton>

                {selectedDate !== today && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDate(today)}
                    className="text-xs text-brand"
                  >
                    Today
                  </Button>
                )}
              </div>
            ) : (
              /* Range Pickers & Presets */
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-auto py-1 text-xs"
                  aria-label="Start date"
                />
                <span className="text-xs text-ink-muted">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-auto py-1 text-xs"
                  aria-label="End date"
                />

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => applyRangePreset("today")}
                    className="px-2 py-0.5 text-[11px] font-medium rounded border border-border-subtle bg-surface hover:bg-surface-subtle"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRangePreset("yesterday")}
                    className="px-2 py-0.5 text-[11px] font-medium rounded border border-border-subtle bg-surface hover:bg-surface-subtle"
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRangePreset("week")}
                    className="px-2 py-0.5 text-[11px] font-medium rounded border border-border-subtle bg-surface hover:bg-surface-subtle"
                  >
                    7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRangePreset("month")}
                    className="px-2 py-0.5 text-[11px] font-medium rounded border border-border-subtle bg-surface hover:bg-surface-subtle"
                  >
                    This Month
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Account Filter Segments */}
          <div
            className="flex items-center rounded-lg border border-border p-0.5 bg-surface-subtle h-8"
            role="radiogroup"
            aria-label="Account Filter"
          >
            <button
              type="button"
              role="radio"
              aria-checked={accountFilter === "all"}
              onClick={() => setAccountFilter("all")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                accountFilter === "all"
                  ? "bg-surface text-ink shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              All Accounts
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={accountFilter === "cash"}
              onClick={() => setAccountFilter("cash")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                accountFilter === "cash"
                  ? "bg-surface text-ink shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Cash Only
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={accountFilter === "bank"}
              onClick={() => setAccountFilter("bank")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                accountFilter === "bank"
                  ? "bg-surface text-ink shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Bank / Digital
            </button>
          </div>
        </div>
      </Card>

      {/* KPI StatCards */}
      {dayBook && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Opening Balance"
            value={formatINR(dayBook.opening.total)}
            description={`Cash: ${formatINR(dayBook.opening.cash)} | Bank: ${formatINR(dayBook.opening.bank)}`}
            icon={Coins}
          />

          <StatCard
            label="Total Receipts / Inflow"
            value={formatINR(dayBook.totals.receipts.total)}
            description={`Cash: ${formatINR(dayBook.totals.receipts.cash)} | Bank: ${formatINR(dayBook.totals.receipts.bank)}`}
            icon={ArrowDownLeft}
          />

          <StatCard
            label="Total Payments / Outflow"
            value={formatINR(dayBook.totals.expenses.total + dayBook.totals.refunds.total)}
            description={`Expenses: ${formatINR(dayBook.totals.expenses.total)} | Refunds: ${formatINR(dayBook.totals.refunds.total)}`}
            icon={ArrowUpRight}
          />

          <StatCard
            label="Closing Balance"
            value={formatINR(dayBook.closing.total)}
            description={`Cash in Hand: ${formatINR(dayBook.closing.cash)} | Bank: ${formatINR(dayBook.closing.bank)}`}
            icon={Wallet}
          />
        </div>
      )}

      {/* Main Day Book Table Area */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-ink-muted">
          <Spinner size="md" />
        </div>
      ) : error ? (
        <div
          role="alert"
          className="p-6 rounded-xl border border-danger-border bg-danger-soft text-danger-text space-y-2 text-center"
        >
          <AlertCircle className="w-6 h-6 mx-auto text-danger" />
          <h4 className="font-bold text-sm">Failed to Load Cash Book</h4>
          <p className="text-xs">{error}</p>
          <Button variant="outline" size="sm" onClick={loadCashBook} className="mt-2">
            Retry
          </Button>
        </div>
      ) : (
        <DayBookTable
          entries={dayBook?.entries || []}
          opening={dayBook?.opening || { cash: 0, bank: 0, total: 0 }}
          totals={dayBook?.totals}
          closing={dayBook?.closing || { cash: 0, bank: 0, total: 0 }}
          accountFilter={accountFilter}
          lockDate={lockDate}
          onEditEntry={(entry) => {
            setEditingEntry(entry)
            setIsEntryModalOpen(true)
          }}
          onDeleteEntry={handleDeleteEntry}
        />
      )}

      {/* Modals */}
      <ManualEntryModal
        isOpen={isEntryModalOpen}
        onClose={() => {
          setIsEntryModalOpen(false)
          setEditingEntry(null)
        }}
        onSaved={loadCashBook}
        entry={editingEntry}
        defaultDate={viewMode === "day" ? selectedDate : endDate}
        lockDate={lockDate}
      />

      <CloseDayModal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        onClosed={() => {
          loadCashBook()
        }}
        defaultDate={viewMode === "day" ? selectedDate : endDate}
        user={user}
        dayBook={dayBook}
        lockDate={lockDate}
      />

      <ReopenCloseModal
        isOpen={isReopenModalOpen}
        onClose={() => setIsReopenModalOpen(false)}
        onReopened={() => {
          loadCashBook()
        }}
        lastClose={lastClose}
        user={user}
      />

      <SetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        onSaved={() => {
          loadCashBook()
        }}
        setup={setup}
        isEditable={!lastClose}
      />

      <PrintDayBookModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        dayBook={dayBook}
        company={{
          companyName: user?.companyName || "Yatra Tour Operator",
          companyPhone: user?.companyPhone || "",
        }}
      />
    </div>
  )
}
