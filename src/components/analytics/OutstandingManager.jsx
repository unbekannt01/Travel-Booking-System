import { useState, useEffect, useMemo, useCallback, Fragment } from "react"
import {
  StatCard,
  Button,
  Badge,
  Card,
  Field,
  Input,
  SearchInput,
  Select,
  Spinner,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../ui"
import { RateLimitNotice } from "../common/RateLimitNotice"
import { PanelErrorBoundary } from "../common/PanelErrorBoundary"
import { getOutstandingReport } from "../../data/reports"
import { formatINR } from "../../utils/formatters"
import { downloadCsv } from "../../utils/csv"
import {
  AGING_BUCKETS,
  AGING_BUCKET_LABELS,
  calculateReceivables,
  toDateString,
} from "../../../shared/receivables"
import StatementModal from "../customers/StatementModal"
import CustomerDrawer from "../customers/CustomerDrawer"
import ReminderModal from "../reminders/ReminderModal"
import {
  IndianRupee,
  Calendar,
  AlertTriangle,
  Clock,
  Users,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  UserCheck,
  HelpCircle,
  BarChart3,
  Table as TableIcon,
  RefreshCw,
  MessageSquare,
  Bell,
} from "lucide-react"

const BUCKET_COLORS = {
  "not-due": {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-300 dark:border-slate-700",
    bar: "bg-slate-400 dark:bg-slate-600",
    badge: "neutral",
  },
  "0-30": {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-800",
    bar: "bg-blue-500 dark:bg-blue-600",
    badge: "info",
  },
  "31-60": {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-800",
    bar: "bg-amber-500 dark:bg-amber-600",
    badge: "warning",
  },
  "61-90": {
    bg: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-300 dark:border-orange-800",
    bar: "bg-orange-500 dark:bg-orange-600",
    badge: "danger",
  },
  "90-plus": {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-300 dark:border-rose-800",
    bar: "bg-rose-600 dark:bg-rose-700",
    badge: "danger",
  },
}

function formatTimeAgo(date) {
  if (!date) return ""
  const diffMs = Date.now() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / (60 * 1000))
  if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export function OutstandingManagerContent({
  bookings = [],
  tours = [],
  user = null,
}) {
  const [now] = useState(() => Date.now())
  const todayStr = useMemo(() => toDateString(new Date(now)), [now])

  // Filters state
  const [asOf, setAsOf] = useState(todayStr)
  const [basis, setBasis] = useState("journey") // "journey" | "booking"
  const [tourFilter, setTourFilter] = useState("all")
  const [bucketFilter, setBucketFilter] = useState("all")
  const [groupBy, setGroupBy] = useState("customer") // "customer" | "booking"
  const [searchQuery, setSearchQuery] = useState("")

  // UI state
  const [expandedCustomerKeys, setExpandedCustomerKeys] = useState(new Set())
  const [showTableView, setShowTableView] = useState(false)
  const [activeStatementCustomer, setActiveStatementCustomer] = useState(null)
  const [activeDrawerCustomerId, setActiveDrawerCustomerId] = useState(null)
  const [activeReminderCustomer, setActiveReminderCustomer] = useState(null)
  const [activeReminderBookings, setActiveReminderBookings] = useState([])
  const [reminderQueue, setReminderQueue] = useState(null)
  const [filterNotReminded7d, setFilterNotReminded7d] = useState(false)

  // Server data & loading
  const [loading, setLoading] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)
  const [retryAfter, setRetryAfter] = useState(60)
  const [serverReport, setServerReport] = useState(null)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setRateLimited(false)
    try {
      const res = await getOutstandingReport({
        asOf,
        basis,
        tourName: tourFilter !== "all" ? tourFilter : undefined,
        bucket: bucketFilter !== "all" ? bucketFilter : undefined,
        groupBy,
        limit: 200,
      })
      if (res?.success) {
        setServerReport(res)
      }
    } catch (err) {
      if (err.status === 429) {
        setRateLimited(true)
        setRetryAfter(err.retryAfter || 60)
      }
    } finally {
      setLoading(false)
    }
  }, [asOf, basis, tourFilter, bucketFilter, groupBy])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  // Pure client-side calculations as reliable fallback / live search filter
  const localReport = useMemo(() => {
    return calculateReceivables({
      bookings,
      asOfDate: asOf,
      basis,
      tourName: tourFilter,
      bucket: bucketFilter,
    })
  }, [bookings, asOf, basis, tourFilter, bucketFilter])

  // Active report summary (server preferred, local fallback)
  const summary = serverReport?.summary || localReport

  // Filtered customer groups based on search query & 7-day reminder filter
  const displayedCustomers = useMemo(() => {
    let list = serverReport?.customers || localReport.customers || []
    if (filterNotReminded7d) {
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
      list = list.filter((c) => !c.lastReminderAt || new Date(c.lastReminderAt).getTime() < sevenDaysAgo)
    }
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase().trim()
    return list.filter((c) => {
      const nameMatch = (c.customerName || "").toLowerCase().includes(q)
      const phoneMatch = (c.customerPhone || "").includes(q)
      const cityMatch = (c.customerCity || "").toLowerCase().includes(q)
      const bookingMatch = (c.bookings || []).some(
        (b) =>
          (b.invoiceNo || "").toLowerCase().includes(q) ||
          (b.tourName || "").toLowerCase().includes(q),
      )
      return nameMatch || phoneMatch || cityMatch || bookingMatch
    })
  }, [serverReport, localReport, searchQuery, filterNotReminded7d, now])

  // Filtered booking rows based on search query & 7-day reminder filter
  const displayedRows = useMemo(() => {
    let list = serverReport?.rows || localReport.rows || []
    if (filterNotReminded7d) {
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
      list = list.filter((r) => !r.lastReminderAt || new Date(r.lastReminderAt).getTime() < sevenDaysAgo)
    }
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase().trim()
    return list.filter((r) => {
      return (
        (r.invoiceNo || "").toLowerCase().includes(q) ||
        (r.customerName || "").toLowerCase().includes(q) ||
        (r.customerPhone || "").includes(q) ||
        (r.tourName || "").toLowerCase().includes(q)
      )
    })
  }, [serverReport, localReport, searchQuery, filterNotReminded7d, now])

  // Queue candidates for semi-automated reminder workflow (max 30 customers)
  const queueCandidates = useMemo(() => {
    return displayedCustomers.filter((c) => !c.isUnlinked && c.totalOutstanding > 0).slice(0, 30)
  }, [displayedCustomers])

  // Expand / collapse customer row
  const toggleCustomerExpand = (key) => {
    setExpandedCustomerKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Handle Export CSV
  const handleExportCsv = () => {
    if (groupBy === "customer") {
      const headers = [
        "Customer Name",
        "Phone",
        "City",
        "Total Outstanding (INR)",
        "Overdue Amount (INR)",
        "Not Due (INR)",
        "Oldest Overdue (Days)",
        "Not Due Bucket",
        "0-30 Days Bucket",
        "31-60 Days Bucket",
        "61-90 Days Bucket",
        "90+ Days Bucket",
        "Bookings Count",
      ]
      const rows = [headers]
      for (const c of displayedCustomers) {
        rows.push([
          c.customerName,
          c.customerPhone,
          c.customerCity,
          String(c.totalOutstanding),
          String(c.overdueAmount),
          String(c.notDueAmount),
          String(c.oldestOverdueDays),
          String(c.bucketBreakdown?.["not-due"] || 0),
          String(c.bucketBreakdown?.["0-30"] || 0),
          String(c.bucketBreakdown?.["31-60"] || 0),
          String(c.bucketBreakdown?.["61-90"] || 0),
          String(c.bucketBreakdown?.["90-plus"] || 0),
          String(c.bookingsCount),
        ])
      }
      downloadCsv(`Outstanding_By_Customer_${asOf}.csv`, rows)
    } else {
      const headers = [
        "Invoice #",
        "Customer Name",
        "Phone",
        "Tour",
        "Journey Date",
        "Booking Date",
        "Total (INR)",
        "Paid (INR)",
        "Outstanding (INR)",
        "Days Overdue",
        "Aging Bucket",
      ]
      const rows = [headers]
      for (const r of displayedRows) {
        rows.push([
          r.invoiceNo,
          r.customerName,
          r.customerPhone,
          r.tourName,
          r.journeyDate,
          r.bookingDate,
          String(r.totalAmount),
          String(r.collected),
          String(r.outstanding),
          String(r.daysOverdue),
          r.bucket,
        ])
      }
      downloadCsv(`Outstanding_By_Booking_${asOf}.csv`, rows)
    }
  }

  // Unique tour names for filter
  const tourOptions = useMemo(() => {
    const set = new Set()
    for (const b of bookings || []) {
      if (b.tourName) set.add(b.tourName)
    }
    for (const t of tours || []) {
      if (t.name) set.add(t.name)
    }
    return Array.from(set).sort()
  }, [bookings, tours])

  const totalOutstanding = summary.totalOutstanding || 0
  const bucketTotals = summary.bucketTotals || {}
  const bucketCounts = summary.bucketCounts || {}

  return (
    <div className="space-y-6">
      {/* Rate limit banner */}
      {rateLimited && (
        <RateLimitNotice
          retryAfterSeconds={retryAfter}
          onRetry={fetchReport}
          className="mb-4"
        />
      )}

      {/* Top 4 StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Outstanding"
          value={formatINR(totalOutstanding)}
          icon={<IndianRupee className="w-5 h-5 text-brand" />}
          description="Total unpaid balance across active bookings"
        />
        <StatCard
          title="Overdue Receivables"
          value={formatINR(summary.totalOverdue || 0)}
          icon={<AlertTriangle className="w-5 h-5 text-warning" />}
          description={`${summary.totalOverdue > 0 ? "Past due date" : "All current"}`}
        />
        <StatCard
          title="Customers Owing"
          value={String(summary.customersOwingCount || 0)}
          icon={<Users className="w-5 h-5 text-info" />}
          description="Unique customers with balance due"
        />
        <StatCard
          title="Oldest Overdue"
          value={`${summary.oldestOverdueDays || 0} Days`}
          icon={<Clock className="w-5 h-5 text-danger" />}
          description="Maximum days past scheduled date"
        />
      </div>

      {/* 5 Aging Bucket Cards */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-ink">Aging Analysis (5 Buckets)</h2>
            <p className="text-xs text-ink-muted">
              Click any bucket card to filter rows below. Click again to show all.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowTableView(!showTableView)}
            className="gap-1.5 text-xs"
            aria-expanded={showTableView}
          >
            {showTableView ? <BarChart3 className="w-3.5 h-3.5" /> : <TableIcon className="w-3.5 h-3.5" />}
            {showTableView ? "Show Chart Bar" : "Accessible Table View"}
          </Button>
        </div>

        {/* Clickable 5 Bucket Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          {AGING_BUCKETS.map((bKey) => {
            const label = AGING_BUCKET_LABELS[bKey]
            const amount = bucketTotals[bKey] || 0
            const count = bucketCounts[bKey] || 0
            const percent = totalOutstanding > 0 ? Math.round((amount / totalOutstanding) * 100) : 0
            const isSelected = bucketFilter === bKey
            const style = BUCKET_COLORS[bKey]

            return (
              <button
                key={bKey}
                type="button"
                onClick={() => setBucketFilter(isSelected ? "all" : bKey)}
                aria-pressed={isSelected}
                className={`p-3.5 rounded-[var(--yh-radius-md)] text-left transition-all cursor-pointer border ${style.bg} ${
                  isSelected
                    ? "ring-2 ring-brand border-brand shadow-sm"
                    : `${style.border} hover:border-ink-muted`
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-bold ${style.text}`}>{label}</span>
                  <Badge variant={style.badge} size="sm">
                    {count} {count === 1 ? "booking" : "bookings"}
                  </Badge>
                </div>
                <div className="text-base font-bold text-ink font-tabular font-mono">
                  {formatINR(amount)}
                </div>
                <div className="text-[11px] text-ink-muted mt-1 flex items-center justify-between">
                  <span>{percent}% of total</span>
                  {isSelected && <span className="text-brand font-semibold text-[10px]">Active Filter</span>}
                </div>
              </button>
            )
          })}
        </div>

        {/* Visual Horizontal Stacked Bar */}
        {!showTableView && (
          <div className="space-y-2">
            <div
              className="w-full h-4 rounded-full overflow-hidden flex bg-surface-subtle border border-border-subtle"
              role="progressbar"
              aria-label="Aging distribution progress bar"
            >
              {AGING_BUCKETS.map((bKey) => {
                const amount = bucketTotals[bKey] || 0
                const percent = totalOutstanding > 0 ? (amount / totalOutstanding) * 100 : 0
                if (percent <= 0) return null
                const style = BUCKET_COLORS[bKey]

                return (
                  <div
                    key={bKey}
                    style={{ width: `${percent}%` }}
                    className={`${style.bar} h-full transition-all`}
                    title={`${AGING_BUCKET_LABELS[bKey]}: ${formatINR(amount)} (${Math.round(percent)}%)`}
                  />
                )
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between text-[11px] text-ink-muted px-1">
              <span>Current (Not Due): {formatINR(bucketTotals["not-due"] || 0)}</span>
              <span className="text-danger font-semibold">
                Overdue Total: {formatINR(summary.totalOverdue || 0)}
              </span>
            </div>
          </div>
        )}

        {/* Accessible Table View Toggle */}
        {showTableView && (
          <div className="overflow-x-auto rounded border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aging Bucket</TableHead>
                  <TableHead align="center">Bookings Count</TableHead>
                  <TableHead align="right">Amount (₹)</TableHead>
                  <TableHead align="right">% Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {AGING_BUCKETS.map((bKey) => {
                  const amount = bucketTotals[bKey] || 0
                  const count = bucketCounts[bKey] || 0
                  const percent = totalOutstanding > 0 ? ((amount / totalOutstanding) * 100).toFixed(1) : "0.0"
                  return (
                    <TableRow key={bKey}>
                      <TableCell className="font-semibold text-ink">
                        {AGING_BUCKET_LABELS[bKey]}
                      </TableCell>
                      <TableCell align="center" className="font-mono">
                        {count}
                      </TableCell>
                      <TableCell align="right" className="font-mono font-semibold">
                        {formatINR(amount)}
                      </TableCell>
                      <TableCell align="right" className="font-mono text-ink-muted">
                        {percent}%
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Controls Bar: As-of Date, Basis Toggle, Tour Select, Group By, Search, Export */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          {/* Basis Toggle with Explanatory Helper */}
          <div className="flex flex-col gap-1.5">
            <span id="aging-basis-label" className="text-xs font-semibold text-ink-secondary">
              Aging basis:
            </span>
            <div
              className="flex items-center rounded-[var(--yh-radius-md)] border border-border p-0.5 bg-surface-subtle h-8"
              role="radiogroup"
              aria-labelledby="aging-basis-label"
            >
              <button
                type="button"
                role="radio"
                aria-checked={basis === "journey"}
                onClick={() => setBasis("journey")}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer h-full ${
                  basis === "journey"
                    ? "bg-surface text-ink shadow-xs"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                By Journey Date
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={basis === "booking"}
                onClick={() => setBasis("booking")}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer h-full ${
                  basis === "booking"
                    ? "bg-surface text-ink shadow-xs"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                By Booking Date
              </button>
            </div>
          </div>

          {/* As-Of Date Picker */}
          <div className="flex items-end gap-2">
            <Field id="outstanding-as-of" label="As of date" className="w-auto">
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  type="date"
                  size="sm"
                  tabular
                  value={asOf}
                  onChange={(e) => setAsOf(e.target.value || todayStr)}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  className="h-8 text-xs font-tabular"
                />
              )}
            </Field>
          </div>

          {/* Tour Dropdown */}
          <div className="flex items-end gap-2">
            <Field id="outstanding-tour" label="Tour" className="w-auto">
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  size="sm"
                  value={tourFilter}
                  onChange={(e) => setTourFilter(e.target.value)}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  className="text-xs h-8 min-w-[140px]"
                >
                  <option value="all">All Tours</option>
                  {tourOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          {/* Group By Toggle */}
          <div className="flex flex-col gap-1.5">
            <span id="group-by-label" className="text-xs font-semibold text-ink-secondary">
              Group by:
            </span>
            <div
              className="flex items-center rounded-[var(--yh-radius-md)] border border-border p-0.5 bg-surface-subtle h-8"
              role="radiogroup"
              aria-labelledby="group-by-label"
            >
              <button
                type="button"
                role="radio"
                aria-checked={groupBy === "customer"}
                onClick={() => setGroupBy("customer")}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer h-full ${
                  groupBy === "customer"
                    ? "bg-surface text-ink shadow-xs"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                By Customer
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={groupBy === "booking"}
                onClick={() => setGroupBy("booking")}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer h-full ${
                  groupBy === "booking"
                    ? "bg-surface text-ink shadow-xs"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                By Booking
              </button>
            </div>
          </div>
        </div>

        {/* Explanatory subtitle for basis */}
        <div className="flex items-center gap-1.5 text-[11px] text-ink-muted pt-1 border-t border-border-subtle">
          <HelpCircle className="w-3.5 h-3.5 text-brand shrink-0" />
          <span>
            {basis === "journey"
              ? "Journey date basis calculates overdue days starting when the trip takes place (standard tour operator practice)."
              : "Booking date basis calculates overdue days starting from the initial reservation creation date."}
          </span>
        </div>

        {/* Search Bar & Export Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex-1 max-w-sm">
            <SearchInput
              id="outstanding-search"
              aria-label="Search receivables"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, phone, invoice..."
              className="w-full text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            {bucketFilter !== "all" && (
              <Badge variant="outline" size="sm" className="gap-1 bg-surface">
                Filter: {AGING_BUCKET_LABELS[bucketFilter]}
                <button
                  type="button"
                  onClick={() => setBucketFilter("all")}
                  className="ml-1 text-ink-muted hover:text-ink font-bold cursor-pointer"
                  aria-label="Clear bucket filter"
                >
                  &times;
                </button>
              </Badge>
            )}

            <Button
              type="button"
              variant={filterNotReminded7d ? "primary" : "outline"}
              size="sm"
              onClick={() => setFilterNotReminded7d((prev) => !prev)}
              className="gap-1.5 text-xs"
            >
              <Clock className="w-3.5 h-3.5" />
              Not reminded in 7 days
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setReminderQueue(queueCandidates)
                setActiveReminderCustomer(queueCandidates[0] || null)
              }}
              disabled={queueCandidates.length === 0}
              className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Reminder queue ({queueCandidates.length})
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="gap-1.5 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Data Table */}
      <Card className="overflow-hidden">
        {loading && (
          <div className="p-8 flex flex-col items-center justify-center gap-2 text-ink-muted">
            <Spinner size="md" />
            <p className="text-xs">Loading receivables report...</p>
          </div>
        )}

        {!loading && groupBy === "customer" && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: "36px" }}></TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead align="right">Total Outstanding</TableHead>
                  <TableHead align="right">Overdue Amount</TableHead>
                  <TableHead align="center">Oldest Dues</TableHead>
                  <TableHead align="center">Bookings</TableHead>
                  <TableHead align="center">Last Reminded</TableHead>
                  <TableHead align="right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-ink-muted">
                      No customer records match your filter criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedCustomers.map((c, idx) => {
                    const rowKey =
                      c.customerId && c.customerId !== "unlinked"
                        ? c.customerId
                        : `unlinked_${idx}`
                    const isExpanded = expandedCustomerKeys.has(rowKey)

                    return (
                      <Fragment key={rowKey}>
                        <TableRow className="hover:bg-surface-subtle transition-colors">
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => toggleCustomerExpand(rowKey)}
                              aria-label={isExpanded ? "Collapse bookings" : "Expand bookings"}
                              className="p-1 rounded text-ink-muted hover:text-ink cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="font-bold text-ink text-sm">
                                  {c.customerName}
                                  {c.isUnlinked && (
                                    <Badge variant="neutral" size="sm" className="ml-2">
                                      Unlinked
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5">
                                  {c.customerPhone && <span>{c.customerPhone}</span>}
                                  {c.customerCity && <span>&bull; {c.customerCity}</span>}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell align="right" className="font-mono font-bold text-sm text-ink">
                            {formatINR(c.totalOutstanding)}
                          </TableCell>

                          <TableCell
                            align="right"
                            className={`font-mono font-semibold text-sm ${
                              c.overdueAmount > 0 ? "text-danger" : "text-ink-muted"
                            }`}
                          >
                            {formatINR(c.overdueAmount)}
                          </TableCell>

                          <TableCell align="center">
                            {c.oldestOverdueDays > 0 ? (
                              <Badge variant="danger" size="sm">
                                {c.oldestOverdueDays} days
                              </Badge>
                            ) : (
                              <Badge variant="success" size="sm">
                                Current
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell align="center" className="font-mono text-xs">
                            {c.bookingsCount}
                          </TableCell>

                          <TableCell align="center">
                            {c.lastReminderAt ? (
                              <div
                                className="text-xs font-medium text-ink"
                                title={new Date(c.lastReminderAt).toLocaleString("en-IN")}
                              >
                                {formatTimeAgo(c.lastReminderAt)}
                                {c.reminderCount30d > 0 && (
                                  <span className="block text-[10px] text-ink-muted">
                                    ({c.reminderCount30d} in 30d)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-ink-muted text-xs">Never</span>
                            )}
                          </TableCell>

                          <TableCell align="right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Remind Action Button */}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setReminderQueue(null)
                                  setActiveReminderCustomer(c)
                                  setActiveReminderBookings(c.bookings || [])
                                }}
                                disabled={c.isUnlinked || c.totalOutstanding <= 0}
                                className="gap-1 text-xs px-2.5 py-1 h-7 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                Remind
                              </Button>

                              {/* Statement Action Button */}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveStatementCustomer(c)}
                                className="gap-1 text-xs px-2.5 py-1 h-7"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Statement
                              </Button>

                              {/* Customer Drawer Profile Action */}
                              {!c.isUnlinked && c.customerId && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setActiveDrawerCustomerId(c.customerId)}
                                  className="gap-1 text-xs px-2 py-1 h-7"
                                  title="View Customer Profile"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  Profile
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Bookings Nested Table */}
                        {isExpanded && (
                          <TableRow className="bg-surface-subtle/50">
                            <TableCell colSpan={8} className="p-3 pl-10">
                              <div className="rounded border border-border bg-surface overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-surface-subtle">
                                      <TableHead>Invoice #</TableHead>
                                      <TableHead>Tour</TableHead>
                                      <TableHead>Journey Date</TableHead>
                                      <TableHead align="right">Total</TableHead>
                                      <TableHead align="right">Collected</TableHead>
                                      <TableHead align="right">Balance Due</TableHead>
                                      <TableHead align="center">Aging Bucket</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(c.bookings || []).map((b) => {
                                      const style = BUCKET_COLORS[b.bucket] || BUCKET_COLORS["not-due"]
                                      return (
                                        <TableRow key={b.bookingId || b.invoiceNo}>
                                          <TableCell className="font-mono font-semibold text-ink text-xs">
                                            #{b.invoiceNo}
                                          </TableCell>
                                          <TableCell className="text-xs text-ink font-medium">
                                            {b.tourName}
                                          </TableCell>
                                          <TableCell className="text-xs text-ink-muted font-tabular">
                                            {b.journeyDate || "—"}
                                          </TableCell>
                                          <TableCell align="right" className="font-mono text-xs">
                                            {formatINR(b.totalAmount)}
                                          </TableCell>
                                          <TableCell align="right" className="font-mono text-xs text-success">
                                            {formatINR(b.collected)}
                                          </TableCell>
                                          <TableCell align="right" className="font-mono text-xs font-bold text-danger">
                                            {formatINR(b.outstanding)}
                                          </TableCell>
                                          <TableCell align="center">
                                            <Badge variant={style.badge} size="sm">
                                              {AGING_BUCKET_LABELS[b.bucket]} ({b.daysOverdue}d)
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      )
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Booking Flat Table View */}
        {!loading && groupBy === "booking" && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Tour</TableHead>
                  <TableHead>Journey Date</TableHead>
                  <TableHead align="right">Total</TableHead>
                  <TableHead align="right">Collected</TableHead>
                  <TableHead align="right">Outstanding</TableHead>
                  <TableHead align="center">Bucket</TableHead>
                  <TableHead align="right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-ink-muted">
                      No booking records match your filter criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedRows.map((r) => {
                    const style = BUCKET_COLORS[r.bucket] || BUCKET_COLORS["not-due"]
                    return (
                      <TableRow key={r.bookingId || r.invoiceNo}>
                        <TableCell className="font-mono font-semibold text-ink text-xs">
                          #{r.invoiceNo}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium text-ink">{r.customerName}</div>
                          {r.customerPhone && (
                            <div className="text-[11px] text-ink-muted">{r.customerPhone}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-ink font-medium">{r.tourName}</TableCell>
                        <TableCell className="text-xs text-ink-muted font-tabular">
                          {r.journeyDate || "—"}
                        </TableCell>
                        <TableCell align="right" className="font-mono text-xs">
                          {formatINR(r.totalAmount)}
                        </TableCell>
                        <TableCell align="right" className="font-mono text-xs text-success">
                          {formatINR(r.collected)}
                        </TableCell>
                        <TableCell align="right" className="font-mono text-xs font-bold text-danger">
                          {formatINR(r.outstanding)}
                        </TableCell>
                        <TableCell align="center">
                          <Badge variant={style.badge} size="sm">
                            {AGING_BUCKET_LABELS[r.bucket]} ({r.daysOverdue}d)
                          </Badge>
                        </TableCell>
                        <TableCell align="right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setReminderQueue(null)
                                setActiveReminderCustomer({
                                  _id: r.customerId,
                                  id: r.customerId,
                                  name: r.customerName,
                                  phone: r.customerPhone,
                                  customerName: r.customerName,
                                  customerPhone: r.customerPhone,
                                  customerCity: r.customerCity,
                                  language: r.language,
                                  whatsappOptOut: r.whatsappOptOut,
                                  lastReminderAt: r.lastReminderAt,
                                  reminderCount30d: r.reminderCount30d,
                                  totalOutstanding: r.outstanding,
                                  bookings: [r],
                                })
                                setActiveReminderBookings([r])
                              }}
                              disabled={!r.customerId || r.outstanding <= 0}
                              className="text-xs px-2 py-1 h-7 text-emerald-700 dark:text-emerald-400"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              Remind
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setActiveStatementCustomer({
                                  _id: r.customerId,
                                  id: r.customerId,
                                  name: r.customerName,
                                  phone: r.customerPhone,
                                })
                              }
                              className="text-xs px-2 py-1 h-7"
                            >
                              Statement
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Statement Modal */}
      {activeStatementCustomer && (
        <StatementModal
          isOpen={!!activeStatementCustomer}
          onClose={() => setActiveStatementCustomer(null)}
          customer={activeStatementCustomer}
        />
      )}

      {/* Customer Drawer */}
      {activeDrawerCustomerId && (
        <CustomerDrawer
          isOpen={!!activeDrawerCustomerId}
          onClose={() => setActiveDrawerCustomerId(null)}
          customerId={activeDrawerCustomerId}
        />
      )}

      {/* Payment Reminder Modal */}
      {activeReminderCustomer && (
        <ReminderModal
          isOpen={!!activeReminderCustomer}
          onClose={() => {
            setActiveReminderCustomer(null)
            setReminderQueue(null)
          }}
          customer={activeReminderCustomer}
          bookings={activeReminderBookings}
          company={user}
          user={user}
          queue={reminderQueue}
          onReminderLogged={() => {
            fetchReport()
          }}
        />
      )}
    </div>
  )
}

export default function OutstandingManager(props) {
  return (
    <PanelErrorBoundary name="OutstandingManager">
      <OutstandingManagerContent {...props} />
    </PanelErrorBoundary>
  )
}
