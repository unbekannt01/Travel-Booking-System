import { useState, useMemo, lazy, Suspense } from "react"
import {
  IndianRupee,
  Ticket,
  Users,
  Clock,
  FileText,
  Eye,
  Edit3,
  Trash2,
  Calendar,
  Bus,
  CheckCircle2,
  Ban,
  ArrowRight,
  AlertTriangle,
  Plus,
  History,
} from "lucide-react"
import PaymentTracker from "../PaymentTracker"
import { formatDisplayDate } from "../../utils/date"
import { formatINR, formatSeatLabel } from "../../utils/formatters"
import { cn } from "../../utils/cn"
import {
  computeOverviewMetrics,
  groupUpcomingDepartures,
  filterRecentBookings,
  getBookingBalance,
  getBookingPaymentStatus,
  isBookingCancelled,
} from "../../utils/dashboardOverview"
import {
  Card,
  CardContent,
  Button,
  IconButton,
  Badge,
  StatusPill,
  StatCard,
  SearchInput,
  EmptyState,
  Skeleton,
  Tooltip,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  FOCUS_RING_CLASS,
} from "../ui"

const STATUS_FILTER_CHIPS = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "pending", label: "Pending" },
  { id: "cancelled", label: "Cancelled" },
]

const HistoryDrawer = lazy(() => import("../history/HistoryDrawer"))

export default function DashboardHome({
  bookings = [],
  tours = [],
  filteredBookings = [],
  loading = false,
  setShowAllInvoices,
  setSelectedBooking,
  setEditingBooking,
  setActiveTab,
  handleDeleteBooking,
  handleCancelBooking,
  handleMarkPaymentPaid,
  handleVoidPayment,
  user,
}) {
  const [recentSearch, setRecentSearch] = useState("")
  const [recentStatus, setRecentStatus] = useState("all") // all | paid | pending | cancelled
  const [historyBooking, setHistoryBooking] = useState(null)

  const now = useMemo(() => new Date(), [])

  const metrics = useMemo(
    () => computeOverviewMetrics(bookings, tours, now),
    [bookings, tours, now],
  )

  const upcomingDepartures = useMemo(
    () => groupUpcomingDepartures(bookings, tours, now, 7),
    [bookings, tours, now],
  )

  // Compose shell top-bar search (filteredBookings) with local status chip and invoice search
  const sourceBookings = filteredBookings || bookings
  const displayedRecentBookings = useMemo(
    () =>
      filterRecentBookings(sourceBookings, {
        statusFilter: recentStatus,
        localSearch: recentSearch,
      }),
    [sourceBookings, recentStatus, recentSearch],
  )

  const visibleRecentBookings = displayedRecentBookings.slice(0, 10)
  const hasActiveLocalFilter = recentStatus !== "all" || recentSearch.trim().length > 0
  const isGlobalSearchFiltered = sourceBookings.length !== bookings.length

  const handleCreateFirstBooking = () => {
    setEditingBooking(null)
    setActiveTab("form")
  }

  const handleFilterPendingDues = () => {
    setRecentStatus("pending")
    const el = document.getElementById("recent-bookings-section")
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Today's Operations Hero Card ── */}
      <Card
        elevation="sm"
        padding="none"
        className="overflow-hidden border-brand/20 bg-surface"
      >
        <div className="bg-brand-soft/60 border-b border-border-subtle px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-secondary">
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-block h-2 w-2 rounded-full",
                    metrics.todayDeparturesCount > 0 ? "bg-success" : "bg-brand",
                  )}
                />
                <span className="text-brand font-semibold">Today&apos;s Operations</span>
                <span aria-hidden="true" className="text-ink-muted">•</span>
                <span className="text-ink-muted">{formatDisplayDate(now)}</span>
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-ink tracking-tight">
                {metrics.todayDeparturesCount > 0
                  ? `${metrics.todayDeparturesCount} Bus Group${metrics.todayDeparturesCount > 1 ? "s" : ""} Departing Today`
                  : "No Bus Departures Today"}
              </h2>

              <p className="text-sm text-ink-secondary max-w-2xl">
                {metrics.todayDeparturesCount > 0
                  ? `Tours: ${metrics.todayTours.join(", ")}`
                  : "Plan new bookings or review upcoming scheduled tours in Journey Manager."}
              </p>
            </div>

            <div className="flex flex-wrap items-stretch sm:items-center gap-3">
              <div className="rounded-[var(--yh-radius-md)] bg-surface border border-border-subtle px-4 py-2.5 min-w-[128px]">
                <p className="text-xs font-medium text-ink-muted">Check-in status</p>
                <p className="text-base font-bold text-ink tabular-nums mt-0.5">
                  {metrics.todayPax > 0
                    ? `${metrics.todayCheckedIn} / ${metrics.todayPax} PAX`
                    : "0 PAX"}
                </p>
              </div>

              <div className="rounded-[var(--yh-radius-md)] bg-surface border border-border-subtle px-4 py-2.5 min-w-[128px]">
                <p className="text-xs font-medium text-ink-muted">Today&apos;s due</p>
                <p className="text-base font-bold text-warning-text tabular-nums mt-0.5">
                  {formatINR(metrics.todayDue, 0)}
                </p>
              </div>

              <Button
                variant="primary"
                size="md"
                leftIcon={<Bus size={16} />}
                rightIcon={<ArrowRight size={15} />}
                onClick={() => setActiveTab("journey")}
                className="w-full sm:w-auto"
              >
                Open Manifests
              </Button>
            </div>
          </div>
        </div>

        {/* Secondary Operations Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border-subtle bg-surface">
          {/* Next 7 Days Departures */}
          <div className="p-4 sm:px-6 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-muted flex items-center gap-1.5">
                <Calendar size={14} className="text-brand shrink-0" aria-hidden="true" />
                <span>Next 7 days departures</span>
              </p>
              <p className="text-base font-bold text-ink tabular-nums mt-1">
                {upcomingDepartures.length}{" "}
                <span className="text-xs font-normal text-ink-muted">
                  {upcomingDepartures.length === 1 ? "trip scheduled" : "trips scheduled"}
                </span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab("journey")}
            >
              View
            </Button>
          </div>

          {/* Pending Balance Dues */}
          <div className="p-4 sm:px-6 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-muted flex items-center gap-1.5">
                <Clock size={14} className="text-warning-text shrink-0" aria-hidden="true" />
                <span>Pending balance dues</span>
              </p>
              <p className="text-base font-bold text-warning-text tabular-nums mt-1">
                {formatINR(metrics.pendingDuesAmount, 0)}{" "}
                <span className="text-xs font-normal text-ink-muted">
                  ({metrics.pendingDuesCount}{" "}
                  {metrics.pendingDuesCount === 1 ? "booking" : "bookings"})
                </span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFilterPendingDues}
            >
              Filter
            </Button>
          </div>

          {/* Unassigned Seats Status */}
          <div
            className={cn(
              "p-4 sm:px-6 flex items-center justify-between gap-3",
              metrics.unassignedSeatBookings.length > 0 && "bg-warning-soft/50",
            )}
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-muted flex items-center gap-1.5">
                {metrics.unassignedSeatBookings.length > 0 ? (
                  <AlertTriangle size={14} className="text-warning-text shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={14} className="text-success-text shrink-0" aria-hidden="true" />
                )}
                <span>Unassigned seats</span>
              </p>
              {metrics.unassignedSeatBookings.length > 0 ? (
                <p className="text-base font-bold text-ink tabular-nums mt-1">
                  {metrics.unassignedSeatBookings.length}{" "}
                  <span className="text-xs font-normal text-warning-text">
                    ({metrics.unassignedPaxTotal} unseated)
                  </span>
                </p>
              ) : (
                <p className="text-sm font-semibold text-success-text mt-1">
                  All travelers have seats
                </p>
              )}
            </div>
            {metrics.unassignedSeatBookings.length > 0 ? (
              <Button
                variant="accent"
                size="sm"
                onClick={() => {
                  setEditingBooking(metrics.unassignedSeatBookings[0])
                  setActiveTab("form")
                }}
              >
                Assign Seats
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* ── KPI Metric Row ── */}
      {loading ? (
        <div role="status" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-busy="true" aria-label="Loading overview metrics">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx} elevation="sm" padding="md" className="space-y-3">
              <Skeleton shape="text" className="w-24 h-3.5" />
              <Skeleton shape="text" className="w-32 h-7" />
              <Skeleton shape="text" className="w-28 h-3" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Total Revenue"
            value={formatINR(metrics.activeRevenue, 0)}
            hint={`Across ${metrics.activeBookingsCount} active ${metrics.activeBookingsCount === 1 ? "booking" : "bookings"}`}
            icon={<IndianRupee size={20} />}
            tone="brand"
          />
          <StatCard
            label="Active Bookings"
            value={metrics.activeBookingsCount}
            hint={`${metrics.destinationsCount} ${metrics.destinationsCount === 1 ? "destination" : "destinations"} configured`}
            icon={<Ticket size={20} />}
            tone="info"
          />
          <StatCard
            label="Total Travelers"
            value={metrics.totalTravelers}
            hint={
              metrics.todayPax > 0
                ? `${metrics.todayPax} departing today`
                : "No departures scheduled today"
            }
            icon={<Users size={20} />}
            tone="success"
          />
          <StatCard
            label="Pending Dues"
            value={formatINR(metrics.pendingDuesAmount, 0)}
            hint={`${metrics.pendingDuesCount} unpaid ${metrics.pendingDuesCount === 1 ? "booking" : "bookings"}`}
            icon={<Clock size={20} />}
            tone={metrics.pendingDuesAmount > 0 ? "warning" : "success"}
          />
        </div>
      )}

      {/* ── Upcoming Departures (Next 7 Days) ── */}
      <section aria-labelledby="upcoming-departures-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 id="upcoming-departures-heading" className="text-base sm:text-lg font-semibold text-ink">
              Upcoming Departures
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted">
              Scheduled coaches departing over the next 7 days
            </p>
          </div>
          {upcomingDepartures.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              rightIcon={<ArrowRight size={14} />}
              onClick={() => setActiveTab("journey")}
            >
              Manage Journeys
            </Button>
          ) : null}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Card key={idx} elevation="sm" padding="md" className="space-y-3">
                <Skeleton shape="text" className="w-40 h-4" />
                <Skeleton shape="text" className="w-28 h-3" />
                <Skeleton shape="rect" className="w-full h-2.5" />
                <Skeleton shape="text" className="w-48 h-3" />
              </Card>
            ))}
          </div>
        ) : upcomingDepartures.length === 0 ? (
          <EmptyState
            icon={<Bus size={24} />}
            title="No departures in the next 7 days"
            description="Scheduled coaches for the coming week will appear here with berth occupancy and boarding progress."
            action={
              <Button
                variant="accent"
                size="md"
                leftIcon={<Plus size={16} />}
                onClick={handleCreateFirstBooking}
              >
                New Booking
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {upcomingDepartures.map((dep) => {
              const capacityText = `${dep.pax} of ${dep.capacity} berths booked, ${dep.occupancyPct}%`
              return (
                <Card key={dep.key} elevation="sm" padding="md" className="flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-semibold text-ink truncate">
                          {dep.tourName}
                        </h3>
                        <p className="text-xs text-ink-muted flex items-center gap-1.5 mt-0.5">
                          <Calendar size={13} aria-hidden="true" />
                          <span>{formatDisplayDate(dep.journeyDate)}</span>
                        </p>
                      </div>
                      <Badge variant="primary" size="sm" className="shrink-0">
                        {dep.busType}
                      </Badge>
                    </div>

                    {/* Accessible Occupancy Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink-secondary">{capacityText}</span>
                        <span className="font-semibold text-ink tabular-nums">{dep.occupancyPct}%</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={`${dep.tourName} berth occupancy`}
                        aria-valuenow={dep.occupancyPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuetext={capacityText}
                        className="h-2 w-full rounded-full bg-surface-muted overflow-hidden"
                      >
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            dep.occupancyPct >= 90
                              ? "bg-success"
                              : dep.occupancyPct >= 50
                                ? "bg-brand"
                                : "bg-accent-warm",
                          )}
                          style={{ width: `${dep.occupancyPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Strip */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="rounded-[var(--yh-radius-sm)] bg-surface-muted px-3 py-2">
                        <p className="text-xs text-ink-muted">Boarded</p>
                        <p className="text-sm font-semibold text-ink tabular-nums mt-0.5">
                          {dep.boardedCount} / {dep.pax} PAX
                        </p>
                      </div>
                      <div className="rounded-[var(--yh-radius-sm)] bg-surface-muted px-3 py-2">
                        <p className="text-xs text-ink-muted">Pending dues</p>
                        <p
                          className={cn(
                            "text-sm font-semibold tabular-nums mt-0.5",
                            dep.pendingDue > 0 ? "text-warning-text" : "text-success-text",
                          )}
                        >
                          {formatINR(dep.pendingDue, 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-2">
                    <span className="text-xs text-ink-muted tabular-nums">
                      {dep.bookingsCount} {dep.bookingsCount === 1 ? "booking" : "bookings"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      rightIcon={<ArrowRight size={14} />}
                      onClick={() => setActiveTab("journey")}
                    >
                      Boarding &amp; Manifest
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Recent Bookings Section ── */}
      <section id="recent-bookings-section" aria-labelledby="recent-bookings-heading" className="space-y-4">
        <Card elevation="sm" padding="none" className="overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-border-subtle space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 id="recent-bookings-heading" className="text-base sm:text-lg font-semibold text-ink">
                  Recent Bookings
                </h2>
                <p className="text-xs sm:text-sm text-ink-muted tabular-nums">
                  Showing {visibleRecentBookings.length} of {displayedRecentBookings.length}{" "}
                  {isGlobalSearchFiltered || hasActiveLocalFilter ? "matching " : ""}
                  reservations
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileText size={15} />}
                onClick={() => setShowAllInvoices(true)}
                className="self-start sm:self-auto"
              >
                View All Invoices
              </Button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="w-full md:max-w-xs">
                <SearchInput
                  value={recentSearch}
                  onChange={(e) => setRecentSearch(e.target.value)}
                  onClear={() => setRecentSearch("")}
                  placeholder="Filter by invoice, customer, tour..."
                  aria-label="Filter recent bookings"
                />
              </div>

              {/* Filter Chips — wrap cleanly on 360px mobile without text clipping */}
              <div
                role="group"
                aria-label="Filter bookings by status"
                className="flex flex-wrap items-center gap-2"
              >
                {STATUS_FILTER_CHIPS.map((chip) => {
                  const isActive = recentStatus === chip.id
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setRecentStatus(chip.id)}
                      className={cn(
                        "inline-flex items-center justify-center px-3.5 min-h-11 sm:min-h-9 rounded-[var(--yh-radius-md)] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap",
                        isActive
                          ? "bg-brand text-brand-fg shadow-[var(--yh-shadow-xs)]"
                          : "bg-surface-muted text-ink-secondary hover:bg-surface-hover hover:text-ink border border-border-subtle",
                        FOCUS_RING_CLASS,
                      )}
                    >
                      {chip.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {loading ? (
            <CardContent className="p-5 space-y-3" aria-busy="true">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} shape="rect" className="w-full h-12" />
              ))}
            </CardContent>
          ) : visibleRecentBookings.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<FileText size={24} />}
                title={
                  bookings.length === 0
                    ? "No bookings yet"
                    : "No matching bookings found"
                }
                description={
                  bookings.length === 0
                    ? "Create your first reservation to generate invoices, allocate sleeper berths, and track collections."
                    : "Try adjusting your search query or switching the status filter."
                }
                action={
                  bookings.length === 0 ? (
                    <Button
                      variant="accent"
                      size="md"
                      leftIcon={<Plus size={16} />}
                      onClick={handleCreateFirstBooking}
                    >
                      Create your first booking
                    </Button>
                  ) : hasActiveLocalFilter ? (
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => {
                        setRecentStatus("all")
                        setRecentSearch("")
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : null
                }
              />
            </div>
          ) : (
            <>
              {/* Desktop & Tablet Table (md and up) */}
              <div className="hidden md:block">
                <Table
                  ariaLabel="Recent bookings table"
                  stickyHeader={false}
                  containerClassName="border-0 rounded-none"
                >
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Tour &amp; Date</TableHead>
                      <TableHead>Seats / Pax</TableHead>
                      <TableHead align="right">Total</TableHead>
                      <TableHead align="right">Paid</TableHead>
                      <TableHead align="right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead align="right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRecentBookings.map((b) => {
                      const bookingId = b._id || b.id
                      const isCancelled = isBookingCancelled(b)
                      const balance = getBookingBalance(b)
                      const paidAmount = Number(b.advanceReceived) || 0
                      const paymentStatus = getBookingPaymentStatus(b)
                      const paxCount = b.passengers?.length || 0
                      const assignedSeats = (b.passengers || []).map((p) => p.seatId).filter(Boolean)

                      return (
                        <TableRow
                          key={bookingId}
                          className={cn(isCancelled && "opacity-70 bg-surface-muted/40")}
                        >
                          <TableCell tabular>
                            <span
                              className={cn(
                                "font-semibold",
                                isCancelled ? "line-through text-ink-muted" : "text-ink",
                              )}
                            >
                              #{b.invoiceNo}
                            </span>
                            <span className="block text-xs text-ink-muted mt-0.5">
                              {formatDisplayDate(b.date)}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span className="font-semibold text-ink block truncate max-w-[180px]">
                              {b.contactName}
                            </span>
                            <span className="text-xs text-ink-muted tabular-nums">
                              +91 {b.contactPhone}
                            </span>
                          </TableCell>

                          <TableCell>
                            <Badge variant="primary" size="sm" className="max-w-[180px] truncate">
                              {b.tourName}
                            </Badge>
                            <span className="block text-xs text-ink-muted mt-1">
                              {formatDisplayDate(b.journeyDate)}
                            </span>
                          </TableCell>

                          <TableCell tabular>
                            <span className="font-medium text-ink block">
                              {paxCount} {paxCount === 1 ? "traveler" : "travelers"}
                            </span>
                            <span className="text-xs text-ink-muted block truncate max-w-[130px]">
                              {assignedSeats.length > 0
                                ? assignedSeats.map((s) => formatSeatLabel(s)).slice(0, 3).join(", ") +
                                  (assignedSeats.length > 3 ? ` +${assignedSeats.length - 3}` : "")
                                : "Unassigned"}
                            </span>
                          </TableCell>

                          <TableCell align="right" tabular className="font-semibold text-ink">
                            {formatINR(b.totalAmount, 0)}
                          </TableCell>

                          <TableCell align="right" tabular className="text-success-text font-medium">
                            {formatINR(paidAmount, 0)}
                          </TableCell>

                          <TableCell
                            align="right"
                            tabular
                            className={cn(
                              "font-semibold",
                              !isCancelled && balance > 0 ? "text-warning-text" : "text-ink-muted",
                            )}
                          >
                            {isCancelled ? "—" : formatINR(balance, 0)}
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col items-start gap-1">
                              <StatusPill status={paymentStatus} size="sm" />
                              {!isCancelled ? (
                                <span className="text-[11px] text-ink-muted">Confirmed</span>
                              ) : null}
                            </div>
                          </TableCell>

                          <TableCell align="right">
                            <div className="inline-flex items-center justify-end gap-1">
                              <Tooltip content="View Invoice">
                                <IconButton
                                  aria-label={`View invoice ${b.invoiceNo}`}
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedBooking(b)}
                                >
                                  <Eye size={16} />
                                </IconButton>
                              </Tooltip>

                              <Tooltip content="Change History">
                                <IconButton
                                  aria-label={`View history for booking ${b.invoiceNo}`}
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setHistoryBooking(b)}
                                  className="min-h-11 sm:min-h-9"
                                >
                                  <History size={16} />
                                </IconButton>
                              </Tooltip>

                              {!isCancelled ? (
                                <Tooltip content="Edit Booking">
                                  <IconButton
                                    aria-label={`Edit booking ${b.invoiceNo}`}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingBooking(b)
                                      setActiveTab("form")
                                    }}
                                  >
                                    <Edit3 size={16} />
                                  </IconButton>
                                </Tooltip>
                              ) : null}

                              {!isCancelled && handleCancelBooking ? (
                                <Tooltip content="Cancel Booking">
                                  <IconButton
                                    aria-label={`Cancel booking ${b.invoiceNo}`}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCancelBooking(bookingId)}
                                  >
                                    <Ban size={16} />
                                  </IconButton>
                                </Tooltip>
                              ) : null}

                              <Tooltip content="Delete Booking">
                                <IconButton
                                  aria-label={`Delete booking ${b.invoiceNo}`}
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteBooking(bookingId)}
                                  className="hover:text-danger-text hover:bg-danger-soft"
                                >
                                  <Trash2 size={16} />
                                </IconButton>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Stacked Card List (<md, zero horizontal page scroll at 360px) */}
              <div className="md:hidden divide-y divide-border-subtle">
                {visibleRecentBookings.map((b) => {
                  const bookingId = b._id || b.id
                  const isCancelled = isBookingCancelled(b)
                  const balance = getBookingBalance(b)
                  const paidAmount = Number(b.advanceReceived) || 0
                  const paymentStatus = getBookingPaymentStatus(b)
                  const paxCount = b.passengers?.length || 0
                  const assignedSeats = (b.passengers || []).map((p) => p.seatId).filter(Boolean)

                  return (
                    <article
                      key={bookingId}
                      className={cn(
                        "p-4 space-y-3",
                        isCancelled && "opacity-75 bg-surface-muted/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              isCancelled ? "line-through text-ink-muted" : "text-ink",
                            )}
                          >
                            #{b.invoiceNo}
                          </p>
                          <p className="text-sm font-semibold text-ink truncate mt-0.5">
                            {b.contactName}
                          </p>
                          <p className="text-xs text-ink-muted tabular-nums">
                            +91 {b.contactPhone}
                          </p>
                        </div>
                        <StatusPill status={paymentStatus} size="sm" className="shrink-0" />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
                        <Badge variant="primary" size="sm">
                          {b.tourName}
                        </Badge>
                        <span>• {formatDisplayDate(b.journeyDate)}</span>
                        <span className="tabular-nums">
                          • {paxCount} {paxCount === 1 ? "PAX" : "PAX"}
                          {assignedSeats.length > 0 ? ` (${assignedSeats.map((s) => formatSeatLabel(s)).slice(0, 2).join(", ")}${assignedSeats.length > 2 ? ` +${assignedSeats.length - 2}` : ""})` : ""}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 rounded-[var(--yh-radius-md)] bg-surface-muted p-2.5 text-xs">
                        <div>
                          <span className="text-ink-muted block">Total</span>
                          <span className="font-semibold text-ink tabular-nums">
                            {formatINR(b.totalAmount, 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-ink-muted block">Paid</span>
                          <span className="font-semibold text-success-text tabular-nums">
                            {formatINR(paidAmount, 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-ink-muted block">Balance</span>
                          <span
                            className={cn(
                              "font-semibold tabular-nums",
                              !isCancelled && balance > 0 ? "text-warning-text" : "text-ink-muted",
                            )}
                          >
                            {isCancelled ? "—" : formatINR(balance, 0)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Eye size={15} />}
                          onClick={() => setSelectedBooking(b)}
                          className="flex-1"
                        >
                          Invoice
                        </Button>
                        {!isCancelled ? (
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Edit3 size={15} />}
                            onClick={() => {
                              setEditingBooking(b)
                              setActiveTab("form")
                            }}
                            className="flex-1"
                          >
                            Edit
                          </Button>
                        ) : null}
                        {!isCancelled && handleCancelBooking ? (
                          <IconButton
                            aria-label={`Cancel booking ${b.invoiceNo}`}
                            variant="outline"
                            size="md"
                            onClick={() => handleCancelBooking(bookingId)}
                          >
                            <Ban size={16} />
                          </IconButton>
                        ) : null}
                        <IconButton
                          aria-label={`View history for booking ${b.invoiceNo}`}
                          variant="outline"
                          size="md"
                          onClick={() => setHistoryBooking(b)}
                          className="min-h-11 sm:min-h-9"
                        >
                          <History size={16} />
                        </IconButton>
                        <IconButton
                          aria-label={`Delete booking ${b.invoiceNo}`}
                          variant="outline"
                          size="md"
                          onClick={() => handleDeleteBooking(bookingId)}
                          className="text-danger-text hover:bg-danger-soft min-h-11 sm:min-h-9"
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )}
        </Card>
      </section>

      {/* ── Payment Tracking & Ledger Overview ── */}
      <PaymentTracker
        bookings={bookings}
        onMarkPaid={handleMarkPaymentPaid}
        onVoidPayment={handleVoidPayment}
        user={user}
      />

      {historyBooking && (
        <Suspense fallback={null}>
          <HistoryDrawer
            isOpen={!!historyBooking}
            onClose={() => setHistoryBooking(null)}
            entityType="booking"
            entityId={historyBooking._id || historyBooking.id}
            title={`Booking #${historyBooking.invoiceNo || ""} History`}
          />
        </Suspense>
      )}
    </div>
  )
}
