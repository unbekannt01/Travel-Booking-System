import { useState, useEffect, useCallback } from "react"
import {
  Card,
  StatCard,
  Button,
  SearchInput,
  Select,
  Switch,
  Badge,
  Spinner,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  EmptyState,
} from "../ui"
import { RateLimitNotice } from "../common/RateLimitNotice"
import { PanelErrorBoundary } from "../common/PanelErrorBoundary"
import { listCustomers, linkCustomerBookings, CUSTOMER_TAGS } from "../../data/customers"
import { formatINR } from "../../utils/formatters"
import { downloadCsv } from "../../utils/csv"
import { useToast } from "../common/ToastContext"
import CustomerModal from "./CustomerModal"
import CustomerDrawer from "./CustomerDrawer"
import {
  Users,
  UserCheck,
  AlertCircle,
  Download,
  Upload,
  Plus,
  Info,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
} from "lucide-react"

const TAG_VARIANTS = {
  vip: "primary",
  "group-leader": "success",
  agent: "info",
  frequent: "primary",
  corporate: "accent",
  "pilgrim-group": "neutral",
  regular: "neutral",
}

const TAG_LABELS = {
  vip: "VIP",
  "group-leader": "Group Leader",
  agent: "Agent",
  frequent: "Frequent",
  corporate: "Corporate",
  "pilgrim-group": "Pilgrim Group",
  regular: "Regular",
}

export default function CustomerManager({
  onNewBooking = null,
  onNavigate = null,
  onEditBooking = null,
}) {
  const toastCtx = useToast()
  const toast = toastCtx.toast || toastCtx

  // State
  const [customers, setCustomers] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 })
  const [counts, setCounts] = useState({ total: 0, repeat: 0, withOutstanding: 0, unlinkedBookingsCount: 0, unresolvedBookings: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  const [showUnresolvedList, setShowUnresolvedList] = useState(false)

  // Filters
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedTag, setSelectedTag] = useState("all")
  const [hasOutstandingOnly, setHasOutstandingOnly] = useState(false)
  const [sortBy, setSortBy] = useState("recent_booking")
  const [page, setPage] = useState(1)

  // Modals & Drawers
  const [drawerCustomerId, setDrawerCustomerId] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [dismissUnlinkedAlert, setDismissUnlinkedAlert] = useState(false)

  // 400ms debounce on search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    setIsRateLimited(false)
    try {
      const res = await listCustomers({
        q: debouncedSearch,
        tag: selectedTag === "all" ? "" : selectedTag,
        hasOutstanding: hasOutstandingOnly ? "true" : undefined,
        sort: sortBy,
        page,
        limit: 25,
      })
      setCustomers(res.customers || [])
      setPagination(res.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 })
      setCounts(res.counts || { total: 0, repeat: 0, withOutstanding: 0, unlinkedBookingsCount: 0 })
    } catch (err) {
      console.error("Failed to load customers:", err)
      if (err.status === 429) {
        setIsRateLimited(true)
      } else {
        setError(err.message || "Failed to load customers")
      }
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, selectedTag, hasOutstandingOnly, sortBy, page])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const handleLinkBookings = async () => {
    try {
      setIsLinking(true)
      const res = await linkCustomerBookings()
      toast.success(res.message || "Bookings linked successfully!")
      await fetchCustomers()
    } catch (err) {
      toast.error(err.message || "Failed to link bookings")
    } finally {
      setIsLinking(false)
    }
  }

  // Open drawer for a customer
  const handleOpenCustomer = (customer) => {
    setDrawerCustomerId(customer.id || customer._id)
    setIsDrawerOpen(true)
  }

  // Add / Edit Modal handlers
  const handleOpenAddModal = () => {
    setEditingCustomer(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (customer) => {
    setEditingCustomer(customer)
    setIsModalOpen(true)
  }

  const handleCustomerSaved = () => {
    fetchCustomers()
    if (drawerCustomerId) {
      // Re-trigger drawer refresh
      setDrawerCustomerId((prev) => prev)
    }
  }

  const handleCustomerDeleted = () => {
    setIsDrawerOpen(false)
    setDrawerCustomerId(null)
    fetchCustomers()
  }

  // CSV Export with formula injection sanitization and UTF-8 BOM
  const handleExportCSV = () => {
    if (customers.length === 0) {
      toast.warning("No customers to export.")
      return
    }

    const headers = [
      "Customer Name",
      "Mobile Phone",
      "Email",
      "City",
      "Language",
      "Tags",
      "Total Bookings",
      "Total Passengers",
      "Booked Revenue",
      "Outstanding Balance",
      "Repeat Customer",
      "WhatsApp Opt-Out",
    ]

    const rows = customers.map((c) => [
      c.name,
      c.phone,
      c.email || "",
      c.city || "",
      c.language || "en",
      (c.tags || []).join("; "),
      c.summary?.totalBookings ?? 0,
      c.summary?.totalPassengers ?? 0,
      c.summary?.totalBookedRevenue ?? 0,
      c.summary?.totalOutstanding ?? 0,
      c.summary?.isRepeat ? "Yes" : "No",
      c.whatsappOptOut ? "Yes" : "No",
    ])

    const filename = `yatrahub-customers-${new Date().toISOString().slice(0, 10)}.csv`
    downloadCsv(filename, [headers, ...rows])
    toast.success(`Exported ${customers.length} customer records to CSV`)
  }

  const hasActiveFilters = search || selectedTag !== "all" || hasOutstandingOnly

  const clearFilters = () => {
    setSearch("")
    setDebouncedSearch("")
    setSelectedTag("all")
    setHasOutstandingOnly(false)
    setSortBy("recent_booking")
    setPage(1)
  }

  return (
    <PanelErrorBoundary title="Customer Directory Error">
      <div className="space-y-6">
        {/* Top Header & Global Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
              Customer Directory
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-0.5">
              Manage traveler contact details, repeat pilgrims, booking history, and balance tracking.
            </p>
          </div>
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <Button
              variant="outline"
              size="md"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleExportCSV}
              disabled={loading || customers.length === 0}
              className="flex-1 sm:flex-initial"
            >
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="md"
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={() => {
                if (onNavigate) {
                  onNavigate("data", "import")
                } else {
                  window.location.hash = "#data?tab=import"
                }
              }}
              className="flex-1 sm:flex-initial"
            >
              Import CSV
            </Button>
            <Button
              variant="accent"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleOpenAddModal}
              className="flex-1 sm:flex-initial"
            >
              Add Customer
            </Button>
          </div>
        </div>

        {/* Unlinked Bookings Alert Banner ("Needs Attention") */}
        {!dismissUnlinkedAlert && (counts.unlinkedBookingsCount || 0) > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="p-4 rounded-[var(--yh-radius-lg)] bg-warning-soft text-warning border border-warning/30 text-xs sm:text-sm space-y-3"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block text-ink">
                    {counts.unlinkedBookingsCount}{" "}
                    {counts.unlinkedBookingsCount === 1 ? "booking needs" : "bookings need"} attention
                  </strong>
                  <p className="text-ink-muted text-xs mt-0.5">
                    Some older bookings are not linked to customer profiles.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLinking}
                  onClick={handleLinkBookings}
                  leftIcon={isLinking ? <Spinner size="sm" /> : null}
                >
                  {isLinking ? "Linking..." : "Link now"}
                </Button>
                <button
                  type="button"
                  onClick={() => setDismissUnlinkedAlert(true)}
                  className="text-xs font-semibold text-ink-muted hover:text-ink cursor-pointer px-2 py-1 rounded"
                >
                  Dismiss
                </button>
              </div>
            </div>

            {counts.unresolvedBookings && counts.unresolvedBookings.length > 0 && (
              <div className="pt-2 border-t border-warning/20">
                <button
                  type="button"
                  onClick={() => setShowUnresolvedList(!showUnresolvedList)}
                  className="text-xs font-medium text-ink underline hover:no-underline cursor-pointer"
                >
                  {showUnresolvedList
                    ? "Hide unlinked bookings"
                    : `View ${counts.unresolvedBookings.length} unlinked booking${counts.unresolvedBookings.length === 1 ? "" : "s"}`}
                </button>
                {showUnresolvedList && (
                  <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                    {counts.unresolvedBookings.map((ub) => (
                      <div
                        key={ub.bookingId}
                        className="flex items-center justify-between gap-2 p-2 rounded bg-surface/80 border border-border-subtle text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink font-mono">{ub.invoiceNo || "No Invoice"}</span>
                          <span className="text-ink-muted">·</span>
                          <span className="text-ink-muted">{ub.reasonDescription || ub.reasonCode}</span>
                        </div>
                        {onEditBooking && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => onEditBooking(ub.bookingId)}
                          >
                            Open booking
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Rate Limit Alert */}
        {isRateLimited && (
          <RateLimitNotice
            onRetry={fetchCustomers}
            title="Customer Directory Rate Limited"
            description="Too many requests. Please wait before refreshing customer list."
          />
        )}

        {/* Error Notice */}
        {error && !isRateLimited && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 p-4 rounded-[var(--yh-radius-lg)] bg-danger-soft text-danger border border-danger/30 text-xs sm:text-sm"
          >
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchCustomers}>
              Retry
            </Button>
          </div>
        )}

        {/* KPI StatCards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="w-5 h-5" />}
            label="Total Customers"
            value={counts.total}
            description="Active customer records"
            variant="neutral"
          />
          <StatCard
            icon={<UserCheck className="w-5 h-5" />}
            label="Repeat Travelers"
            value={counts.repeat}
            description="Booked 2 or more trips"
            variant="success"
          />
          <StatCard
            icon={<AlertCircle className="w-5 h-5" />}
            label="With Outstanding"
            value={counts.withOutstanding}
            description="Uncollected balances due"
            variant={counts.withOutstanding > 0 ? "warning" : "success"}
          />
          <StatCard
            icon={<Info className="w-5 h-5" />}
            label="Unlinked Bookings"
            value={counts.unlinkedBookingsCount}
            description="Bookings pending link"
            variant={counts.unlinkedBookingsCount > 0 ? "warning" : "neutral"}
          />
        </div>

        {/* Filters and Controls */}
        <Card elevation="sm" padding="md" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
            {/* Search Input */}
            <div className="lg:col-span-2">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
                placeholder="Search customers by name or 10-digit mobile..."
                aria-label="Search customers by name or phone"
              />
            </div>

            {/* Sort Selector */}
            <div>
              <Select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value)
                  setPage(1)
                }}
                aria-label="Sort customers"
              >
                <option value="recent_booking">Sort: Recent Booking</option>
                <option value="name_asc">Sort: Name (A to Z)</option>
                <option value="name_desc">Sort: Name (Z to A)</option>
                <option value="outstanding_desc">Sort: Outstanding (High to Low)</option>
                <option value="revenue_desc">Sort: Revenue (High to Low)</option>
              </Select>
            </div>

            {/* Outstanding Toggle */}
            <div className="flex items-center sm:justify-end">
              <Switch
                label="Outstanding only"
                checked={hasOutstandingOnly}
                onChange={(checked) => {
                  setHasOutstandingOnly(checked)
                  setPage(1)
                }}
              />
            </div>
          </div>

          {/* Tag Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border-subtle">
            <span className="text-xs font-semibold text-ink-muted mr-1">Filter Tag:</span>
            <button
              type="button"
              onClick={() => {
                setSelectedTag("all")
                setPage(1)
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                selectedTag === "all"
                  ? "bg-brand text-brand-fg border-brand"
                  : "bg-surface text-ink-secondary border-border-subtle hover:bg-surface-hover hover:text-ink"
              }`}
            >
              All
            </button>
            {CUSTOMER_TAGS.map((tag) => {
              const active = selectedTag === tag
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setSelectedTag(active ? "all" : tag)
                    setPage(1)
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                    active
                      ? "bg-brand text-brand-fg border-brand"
                      : "bg-surface text-ink-secondary border-border-subtle hover:bg-surface-hover hover:text-ink"
                  }`}
                >
                  {TAG_LABELS[tag] || tag}
                </button>
              )
            })}
          </div>
        </Card>

        {/* Customer Data Table / List */}
        <Card elevation="sm" padding="none" className="overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-ink-muted space-y-2">
              <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Loading customers...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Users className="w-10 h-10 text-ink-muted" />}
                title={hasActiveFilters ? "No matching customers found" : "No customers recorded yet"}
                description={
                  hasActiveFilters
                    ? "Try adjusting your search query, tag chips, or outstanding balance toggle."
                    : "Add your first customer profile manually or link them automatically from bookings."
                }
                action={
                  hasActiveFilters ? (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  ) : (
                    <Button variant="accent" size="sm" onClick={handleOpenAddModal}>
                      Add Customer
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <>
              {/* Desktop Table (>=md) */}
              <div className="hidden md:block overflow-x-auto">
                <Table ariaLabel="Customer Master Directory">
                  <TableCaption>
                    Showing {customers.length} of {pagination.total} customer profiles.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead align="right">Bookings</TableHead>
                      <TableHead align="right">Booked Revenue</TableHead>
                      <TableHead align="right">Outstanding</TableHead>
                      <TableHead align="right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((c) => {
                      const summary = c.summary || {}
                      const hasOutstanding = (summary.totalOutstanding || 0) > 0
                      return (
                        <TableRow
                          key={c.id || c._id}
                          className="hover:bg-surface-muted/60 transition-colors cursor-pointer"
                          onClick={() => handleOpenCustomer(c)}
                        >
                          <TableCell>
                            <div className="space-y-0.5">
                              <span className="font-bold text-sm text-ink block">
                                {c.name}
                              </span>
                              {c.aliases && c.aliases.length > 0 && (
                                <span className="text-[11px] text-ink-muted block truncate max-w-xs">
                                  aka: {c.aliases.join(", ")}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center gap-1.5 text-ink font-semibold">
                                <Phone className="w-3.5 h-3.5 text-brand" />
                                <span>{c.phone}</span>
                              </div>
                              {c.city && (
                                <div className="flex items-center gap-1 text-ink-muted">
                                  <MapPin className="w-3 h-3" />
                                  <span>{c.city}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1">
                              {c.tags && c.tags.length > 0 ? (
                                c.tags.map((t) => (
                                  <Badge key={t} variant={TAG_VARIANTS[t] || "neutral"} size="sm">
                                    {t}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-ink-muted">-</span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell align="right" className="font-tabular">
                            <div className="space-y-0.5">
                              <span className="font-bold text-ink text-sm">
                                {summary.totalBookings || 0}
                              </span>
                              {summary.isRepeat && (
                                <Badge variant="success" size="sm" className="block w-fit ml-auto">
                                  Repeat
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          <TableCell align="right" className="font-tabular font-bold text-ink">
                            {formatINR(summary.totalBookedRevenue || 0)}
                          </TableCell>

                          <TableCell
                            align="right"
                            className={`font-tabular font-bold ${
                              hasOutstanding ? "text-warning" : "text-ink-muted"
                            }`}
                          >
                            {formatINR(summary.totalOutstanding || 0)}
                          </TableCell>

                          <TableCell align="right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenCustomer(c)
                              }}
                              aria-label={`View details for ${c.name}`}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Stacked View (<md) */}
              <div className="block md:hidden divide-y divide-border-subtle">
                {customers.map((c) => {
                  const summary = c.summary || {}
                  const hasOutstanding = (summary.totalOutstanding || 0) > 0
                  return (
                    <button
                      type="button"
                      key={c.id || c._id}
                      onClick={() => handleOpenCustomer(c)}
                      className="w-full text-left p-4 space-y-3 active:bg-surface-muted transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-sm text-ink block">
                            {c.name}
                          </span>
                          <span className="text-xs text-ink-muted flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-brand" />
                            {c.phone} {c.city ? `• ${c.city}` : ""}
                          </span>
                        </div>
                        {summary.isRepeat && (
                          <Badge variant="success" size="sm">
                            Repeat
                          </Badge>
                        )}
                      </div>

                      {c.tags && c.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {c.tags.map((t) => (
                            <Badge key={t} variant={TAG_VARIANTS[t] || "neutral"} size="sm">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-border-subtle">
                        <div className="p-2 rounded bg-surface-muted">
                          <span className="text-ink-muted text-[10px] uppercase font-bold block">Trips</span>
                          <span className="font-bold text-ink">{summary.totalBookings || 0}</span>
                        </div>
                        <div className="p-2 rounded bg-surface-muted">
                          <span className="text-ink-muted text-[10px] uppercase font-bold block">Revenue</span>
                          <span className="font-bold text-ink truncate block">{formatINR(summary.totalBookedRevenue || 0)}</span>
                        </div>
                        <div className="p-2 rounded bg-surface-muted">
                          <span className="text-ink-muted text-[10px] uppercase font-bold block">Due</span>
                          <span className={`font-bold block truncate ${hasOutstanding ? "text-warning" : "text-ink-muted"}`}>
                            {formatINR(summary.totalOutstanding || 0)}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Pagination Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border-subtle text-xs text-ink-muted">
                <span>
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total customers)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    leftIcon={<ChevronLeft className="w-4 h-4" />}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    rightIcon={<ChevronRight className="w-4 h-4" />}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Customer Detail Drawer */}
        <CustomerDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          customerId={drawerCustomerId}
          onEdit={(cust) => {
            setIsDrawerOpen(false)
            handleOpenEditModal(cust)
          }}
          onNewBooking={(cust) => {
            if (onNewBooking) onNewBooking(cust)
          }}
          onDeleted={handleCustomerDeleted}
        />

        {/* Add / Edit Customer Modal */}
        <CustomerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSaved={handleCustomerSaved}
          customer={editingCustomer}
        />
      </div>
    </PanelErrorBoundary>
  )
}
