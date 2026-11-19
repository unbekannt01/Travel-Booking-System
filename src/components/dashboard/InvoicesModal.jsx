import { useState, useMemo } from "react"
import { FileText, Eye, Edit3, Trash2, Ban } from "lucide-react"
import {
  Modal,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Select,
  SearchInput,
  Badge,
  StatusPill,
  IconButton,
  Button,
  EmptyState,
} from "../ui"
import { formatINR } from "../../utils/formatters"
import { cn } from "../../utils/cn"

const STATUS_CHIPS = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "pending", label: "Pending" },
  { id: "cancelled", label: "Cancelled" },
]

export default function InvoicesModal({
  isOpen,
  onClose,
  filteredInvoices = [],
  invoiceTourFilter,
  setInvoiceTourFilter,
  uniqueTours = [],
  setSelectedBooking,
  setEditingBooking,
  setActiveTab,
  handleDeleteBooking,
  handleCancelBooking,
}) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all") // all | paid | pending | cancelled

  const displayedInvoices = useMemo(() => {
    return filteredInvoices.filter((b) => {
      const isCancelled = b.status === "Cancelled" || b.status === "cancelled"
      const balance = Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0))
      const isPaid = !isCancelled && (b.isPaid || balance === 0)
      const isPending = !isCancelled && !isPaid

      if (statusFilter === "paid" && !isPaid) return false
      if (statusFilter === "pending" && !isPending) return false
      if (statusFilter === "cancelled" && !isCancelled) return false

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const matchesInvoice = b.invoiceNo?.toLowerCase().includes(q)
        const matchesName = b.contactName?.toLowerCase().includes(q)
        const matchesPhone = b.contactPhone?.toLowerCase().includes(q)
        const matchesTour = b.tourName?.toLowerCase().includes(q)
        const matchesPassenger = b.passengers?.some((p) => p.name?.toLowerCase().includes(q))
        if (!matchesInvoice && !matchesName && !matchesPhone && !matchesTour && !matchesPassenger) {
          return false
        }
      }
      return true
    })
  }, [filteredInvoices, statusFilter, searchTerm])

  const handleClose = () => {
    onClose?.()
    setInvoiceTourFilter?.("all")
    setSearchTerm("")
    setStatusFilter("all")
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="xl"
      className="max-w-6xl max-h-[92vh]"
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--yh-radius-md)] bg-brand-primary text-white shadow-xs">
            <FileText size={20} aria-hidden="true" />
          </div>
          <div>
            <span className="block text-lg font-bold text-ink">All Booking Invoices</span>
            <span className="block text-xs font-semibold text-ink-muted">
              Showing {displayedInvoices.length} of {filteredInvoices.length} invoices
            </span>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Sticky Toolbar: Search, Tour Filter, and Status Chips */}
        <div className="sticky -top-5 z-10 -mx-6 -mt-5 bg-surface-elevated px-6 pt-4 pb-4 border-b border-border-subtle space-y-3 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 max-w-md">
              <SearchInput
                size="sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClear={() => setSearchTerm("")}
                placeholder="Search invoice #, traveler name, phone, tour..."
                aria-label="Search invoices"
              />
            </div>
            <div className="w-full sm:w-56 shrink-0">
              <Select
                size="sm"
                value={invoiceTourFilter}
                onChange={(e) => setInvoiceTourFilter(e.target.value)}
                aria-label="Filter by tour"
              >
                <option value="all">All Tours</option>
                {uniqueTours.map((tour) => (
                  <option key={tour} value={tour}>
                    {tour}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-1"
            role="group"
            aria-label="Filter invoices by status"
          >
            {STATUS_CHIPS.map((chip) => {
              const isActive = statusFilter === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setStatusFilter(chip.id)}
                  className={cn(
                    "rounded-[var(--yh-radius-full)] px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors shrink-0",
                    isActive
                      ? "bg-brand-primary text-white shadow-xs"
                      : "bg-surface-muted text-ink-muted hover:bg-surface-hover hover:text-ink",
                  )}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Invoices List / Table */}
        {displayedInvoices.length === 0 ? (
          <EmptyState
            icon={<FileText size={24} />}
            title="No invoices found"
            description={
              searchTerm || statusFilter !== "all" || invoiceTourFilter !== "all"
                ? "Try adjusting your search terms or filters to find what you are looking for."
                : "No invoices have been recorded yet."
            }
            action={
              searchTerm || statusFilter !== "all" || invoiceTourFilter !== "all" ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("")
                    setStatusFilter("all")
                    setInvoiceTourFilter("all")
                  }}
                >
                  Reset filters
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            {/* Desktop Table View (md+) */}
            <div className="hidden md:block">
              <Table ariaLabel="Invoices table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Traveler</TableHead>
                    <TableHead>Tour</TableHead>
                    <TableHead>Journey Date</TableHead>
                    <TableHead>Passengers</TableHead>
                    <TableHead align="right">Amount</TableHead>
                    <TableHead align="right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedInvoices.map((b) => {
                    const isCancelled = b.status === "Cancelled" || b.status === "cancelled"
                    return (
                      <TableRow key={b.id || b._id}>
                        <TableCell>
                          <span className="font-bold text-ink">#{b.invoiceNo}</span>
                        </TableCell>
                        <TableCell>
                          <StatusPill
                            status={isCancelled ? "Cancelled" : "Confirmed"}
                            size="sm"
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-ink-muted">
                            {b.date ? new Date(b.date).toLocaleDateString() : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-semibold text-ink block">{b.contactName}</span>
                            <span className="text-xs text-ink-muted">{b.contactPhone}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="primary" size="sm">
                            {b.tourName}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-ink-muted">
                            {b.journeyDate ? new Date(b.journeyDate).toLocaleDateString() : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-brand-primary tabular-nums">
                            {b.passengers?.length || 0} PAX
                          </span>
                        </TableCell>
                        <TableCell align="right" tabular>
                          <span className="font-bold text-ink">
                            {formatINR(b.totalAmount || 0)}
                          </span>
                        </TableCell>
                        <TableCell align="right">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton
                              aria-label={`View invoice #${b.invoiceNo}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedBooking(b)
                                onClose()
                              }}
                              title="View invoice"
                            >
                              <Eye size={16} />
                            </IconButton>
                            <IconButton
                              aria-label={`Edit booking #${b.invoiceNo}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingBooking(b)
                                setActiveTab("form")
                                onClose()
                              }}
                              title="Edit booking"
                            >
                              <Edit3 size={16} />
                            </IconButton>
                            {!isCancelled && (
                              <IconButton
                                aria-label={`Cancel booking #${b.invoiceNo}`}
                                variant="ghost"
                                size="sm"
                                className="text-status-warning-text hover:bg-status-warning-bg"
                                onClick={() => handleCancelBooking && handleCancelBooking(b.id)}
                                title="Cancel booking"
                              >
                                <Ban size={16} />
                              </IconButton>
                            )}
                            <IconButton
                              aria-label={`Delete booking #${b.invoiceNo}`}
                              variant="ghost"
                              size="sm"
                              className="text-status-danger-text hover:bg-status-danger-bg"
                              onClick={() => {
                                handleDeleteBooking(b.id)
                                if (filteredInvoices.length === 1) {
                                  onClose()
                                }
                              }}
                              title="Delete booking"
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Stacked Card View (<md) */}
            <div className="space-y-3 md:hidden">
              {displayedInvoices.map((b) => {
                const isCancelled = b.status === "Cancelled" || b.status === "cancelled"
                return (
                  <div
                    key={b.id || b._id}
                    className="rounded-[var(--yh-radius-lg)] border border-border-subtle bg-surface p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">#{b.invoiceNo}</span>
                        <StatusPill
                          status={isCancelled ? "Cancelled" : "Confirmed"}
                          size="sm"
                        />
                      </div>
                      <span className="font-bold text-ink tabular-nums text-base">
                        {formatINR(b.totalAmount || 0)}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="font-semibold text-ink">{b.contactName}</div>
                      <div className="text-xs text-ink-muted">{b.contactPhone}</div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Badge variant="primary" size="sm">
                          {b.tourName}
                        </Badge>
                        <span className="text-xs text-ink-muted">
                          Journey: {b.journeyDate ? new Date(b.journeyDate).toLocaleDateString() : "—"}
                        </span>
                        <span className="text-xs font-bold text-brand-primary tabular-nums">
                          {b.passengers?.length || 0} PAX
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                      <IconButton
                        aria-label={`View invoice #${b.invoiceNo}`}
                        variant="secondary"
                        size="md"
                        className="min-h-11 min-w-11"
                        onClick={() => {
                          setSelectedBooking(b)
                          onClose()
                        }}
                      >
                        <Eye size={18} />
                      </IconButton>
                      <IconButton
                        aria-label={`Edit booking #${b.invoiceNo}`}
                        variant="secondary"
                        size="md"
                        className="min-h-11 min-w-11"
                        onClick={() => {
                          setEditingBooking(b)
                          setActiveTab("form")
                          onClose()
                        }}
                      >
                        <Edit3 size={18} />
                      </IconButton>
                      {!isCancelled && (
                        <IconButton
                          aria-label={`Cancel booking #${b.invoiceNo}`}
                          variant="secondary"
                          size="md"
                          className="min-h-11 min-w-11 text-status-warning-text hover:bg-status-warning-bg"
                          onClick={() => handleCancelBooking && handleCancelBooking(b.id)}
                        >
                          <Ban size={18} />
                        </IconButton>
                      )}
                      <IconButton
                        aria-label={`Delete booking #${b.invoiceNo}`}
                        variant="secondary"
                        size="md"
                        className="min-h-11 min-w-11 text-status-danger-text hover:bg-status-danger-bg"
                        onClick={() => {
                          handleDeleteBooking(b.id)
                          if (filteredInvoices.length === 1) {
                            onClose()
                          }
                        }}
                      >
                        <Trash2 size={18} />
                      </IconButton>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
