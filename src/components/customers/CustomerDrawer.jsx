import { useState, useEffect, useCallback } from "react"
import {
  Drawer,
  Button,
  Badge,
  Card,
  StatCard,
  Spinner,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../ui"
import { RateLimitNotice } from "../common/RateLimitNotice"
import { getCustomer, deleteCustomer, updateCustomer } from "../../data/customers"
import { formatINR } from "../../utils/formatters"
import { useToast } from "../common/ToastContext"
import { useConfirm } from "../common/useConfirm"
import StatementModal from "./StatementModal"
import ReminderModal from "../reminders/ReminderModal"
import HistoryDrawer from "../history/HistoryDrawer"
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  IndianRupee,
  Copy,
  Check,
  Edit2,
  Trash2,
  PlusCircle,
  FileText,
  AlertCircle,
  MessageSquare,
  History,
} from "lucide-react"

const LANGUAGE_LABELS = {
  en: "English",
  hi: "Hindi",
  gu: "Gujarati",
}

const TAG_VARIANTS = {
  vip: "primary",
  "group-leader": "success",
  agent: "info",
  frequent: "primary",
  corporate: "accent",
  "pilgrim-group": "neutral",
  regular: "neutral",
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

export default function CustomerDrawer({
  isOpen,
  onClose,
  customerId,
  onEdit,
  onNewBooking,
  onDeleted,
}) {
  const toast = useToast()
  const confirm = useConfirm()

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [copiedPhone, setCopiedPhone] = useState(false)
  const [showStatementModal, setShowStatementModal] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [updatingOptOut, setUpdatingOptOut] = useState(false)

  const fetchCustomerDetails = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    setError(null)
    setIsRateLimited(false)
    try {
      const res = await getCustomer(customerId)
      setData(res)
    } catch (err) {
      console.error("Failed to load customer details:", err)
      if (err.status === 429) {
        setIsRateLimited(true)
      } else {
        setError(err.message || "Failed to load customer details")
      }
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    if (isOpen && customerId) {
      fetchCustomerDetails()
    } else {
      setData(null)
      setError(null)
      setIsRateLimited(false)
    }
  }, [isOpen, customerId, fetchCustomerDetails])

  const handleCopyPhone = (phone) => {
    if (!phone) return
    navigator.clipboard?.writeText(phone)
    setCopiedPhone(true)
    toast.success(`Copied ${phone} to clipboard`)
    setTimeout(() => setCopiedPhone(false), 2000)
  }

  const handleDelete = async () => {
    if (!data?.customer) return
    const cust = data.customer
    const confirmed = await confirm({
      title: "Delete Customer",
      message: `Are you sure you want to delete ${cust.name}? Historical booking records will not be deleted, but this customer profile will be archived.`,
      confirmText: "Delete Customer",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (!confirmed) return

    try {
      await deleteCustomer(cust.id || cust._id)
      toast.success(`Customer "${cust.name}" archived successfully`)
      if (onDeleted) onDeleted(cust.id || cust._id)
      onClose()
    } catch (err) {
      toast.error(err.message || "Failed to delete customer")
    }
  }

  const customer = data?.customer
  const summary = data?.summary
  const bookings = data?.bookings || []

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={customer?.name || "Customer Details"}
      description={customer ? `Customer ID: ${customer.id || customer._id}` : "Loading traveler details..."}
      className="w-full max-w-[min(100vw,40rem)]"
    >
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Spinner size="lg" />
          <p className="text-xs text-ink-muted">Loading customer history and metrics...</p>
        </div>
      )}

      {isRateLimited && (
        <RateLimitNotice
          onRetry={fetchCustomerDetails}
          title="Rate Limit Notice"
          description="Too many requests. Please wait before refreshing customer details."
        />
      )}

      {error && !isRateLimited && (
        <div className="p-4 rounded-[var(--yh-radius-md)] bg-danger-soft text-danger border border-danger/30 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <h4 className="text-sm font-bold">Could not load customer</h4>
          </div>
          <p className="text-xs">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchCustomerDetails}>
            Retry
          </Button>
        </div>
      )}

      {!loading && customer && (
        <div className="space-y-6 min-w-0">
          {/* Header Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-[var(--yh-radius-lg)] bg-surface-muted border border-border-subtle min-w-0">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <Badge variant="outline" size="md">
                Language: {LANGUAGE_LABELS[customer.language] || customer.language}
              </Badge>
              {customer.tags?.map((t) => (
                <Badge key={t} variant={TAG_VARIANTS[t] || "neutral"} size="md">
                  {t}
                </Badge>
              ))}
              {summary?.isRepeat && (
                <Badge variant="success" size="md">
                  Repeat Customer
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <Button
                variant="accent"
                size="sm"
                className="min-h-11"
                leftIcon={<PlusCircle className="w-4 h-4" />}
                onClick={() => {
                  if (onNewBooking) onNewBooking(customer)
                  onClose()
                }}
              >
                New Booking
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                leftIcon={<FileText className="w-4 h-4" />}
                onClick={() => setShowStatementModal(true)}
              >
                Statement
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                leftIcon={<MessageSquare className="w-4 h-4" />}
                onClick={() => setShowReminderModal(true)}
                disabled={customer.whatsappOptOut || (summary && summary.totalOutstanding <= 0)}
              >
                Remind
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                leftIcon={<History className="w-4 h-4" />}
                onClick={() => setShowHistoryModal(true)}
              >
                History
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                leftIcon={<Edit2 className="w-4 h-4" />}
                onClick={() => {
                  if (onEdit) onEdit(customer)
                }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:bg-danger-soft min-h-11"
                leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={handleDelete}
                aria-label={`Delete customer ${customer.name}`}
              >
                Delete
              </Button>
            </div>
          </div>

          {/* Contact Details Card */}
          <Card elevation="sm" padding="md" className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Contact & Profile Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between p-2.5 rounded-[var(--yh-radius-md)] bg-surface-subtle">
                <div className="flex items-center gap-2 text-ink">
                  <Phone className="w-4 h-4 text-brand" />
                  <span className="font-semibold">{customer.phone}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyPhone(customer.phone)}
                  aria-label="Copy mobile number"
                  className="p-1 rounded text-ink-muted hover:text-ink hover:bg-surface-hover cursor-pointer transition-colors"
                >
                  {copiedPhone ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {customer.email ? (
                <div className="flex items-center gap-2 p-2.5 rounded-[var(--yh-radius-md)] bg-surface-subtle text-ink">
                  <Mail className="w-4 h-4 text-brand" />
                  <span className="truncate">{customer.email}</span>
                </div>
              ) : (
                <div className="p-2.5 rounded-[var(--yh-radius-md)] bg-surface-subtle text-xs text-ink-muted">
                  No email provided
                </div>
              )}

              {customer.city && (
                <div className="flex items-center gap-2 p-2.5 rounded-[var(--yh-radius-md)] bg-surface-subtle text-ink">
                  <MapPin className="w-4 h-4 text-brand" />
                  <span>{customer.city}</span>
                </div>
              )}

              {customer.gstin && (
                <div className="flex items-center gap-2 p-2.5 rounded-[var(--yh-radius-md)] bg-surface-subtle text-ink font-tabular">
                  <FileText className="w-4 h-4 text-brand" />
                  <span>GSTIN: {customer.gstin}</span>
                </div>
              )}
            </div>

            {customer.address && (
              <p className="text-xs text-ink-secondary pt-1">
                <strong className="text-ink">Address:</strong> {customer.address}
              </p>
            )}

            {customer.aliases && customer.aliases.length > 0 && (
              <div className="pt-2 border-t border-border-subtle flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-ink-muted mr-1">Known Aliases:</span>
                {customer.aliases.map((alias, idx) => (
                  <Badge key={idx} variant="outline" size="sm">
                    {alias}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-xs">
              <span className="text-ink-muted flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp Reminders:
              </span>
              <div className="flex items-center gap-2">
                <span className={customer.whatsappOptOut ? "text-danger font-semibold" : "text-success font-semibold"}>
                  {customer.whatsappOptOut ? "Opted Out" : "Enabled"}
                </span>
                <button
                  type="button"
                  disabled={updatingOptOut}
                  onClick={async () => {
                    setUpdatingOptOut(true)
                    try {
                      const updated = await updateCustomer(customer.id, {
                        whatsappOptOut: !customer.whatsappOptOut,
                      })
                      setData((prev) => ({
                        ...prev,
                        customer: {
                          ...prev.customer,
                          whatsappOptOut: updated.whatsappOptOut,
                        },
                      }))
                      toast.show(
                        updated.whatsappOptOut
                          ? "Customer opted out of WhatsApp reminders"
                          : "WhatsApp reminders enabled for customer",
                        "info"
                      )
                    } catch (err) {
                      toast.show(err.message || "Failed to update opt-out status", "error")
                    } finally {
                      setUpdatingOptOut(false)
                    }
                  }}
                  className="text-[11px] text-brand hover:underline cursor-pointer disabled:opacity-50"
                >
                  {customer.whatsappOptOut ? "Enable" : "Opt Out"}
                </button>
              </div>
            </div>

            {customer.notes && (
              <div className="p-3 rounded-[var(--yh-radius-md)] bg-surface-muted text-xs text-ink space-y-1">
                <span className="font-bold text-ink-muted block uppercase tracking-wider text-[10px]">Operator Notes:</span>
                <p className="whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
          </Card>

          {/* Authoritative Financial & Booking Metrics */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-0">
              <StatCard
                className="min-w-0"
                icon={<IndianRupee className="w-4 h-4" />}
                label="Booked Revenue"
                value={formatINR(summary.totalBookedRevenue)}
                hint={`${summary.totalBookings} active trips`}
                tone="brand"
              />
              <StatCard
                className="min-w-0"
                icon={<Calendar className="w-4 h-4" />}
                label="Outstanding"
                value={formatINR(summary.totalOutstanding)}
                hint={summary.totalOutstanding > 0 ? "Payment due" : "Paid in full"}
                tone={summary.totalOutstanding > 0 ? "warning" : "success"}
              />
              <StatCard
                className="min-w-0"
                icon={<IndianRupee className="w-4 h-4" />}
                label="Collected"
                value={formatINR(summary.totalCollected)}
                hint="Cash / UPI received"
                tone="info"
              />
              <StatCard
                className="min-w-0"
                icon={<Calendar className="w-4 h-4" />}
                label="Passengers"
                value={summary.totalPassengers}
                hint="Berths booked"
                tone="neutral"
              />
            </div>
          )}

          {/* Booking History Table */}
          <Card elevation="sm" padding="md" className="space-y-3 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Booking History ({bookings.length})
              </h3>
              {summary?.destinations?.length > 0 && (
                <span className="text-xs text-ink-muted">
                  Routes: {summary.destinations.join(", ")}
                </span>
              )}
            </div>

            {bookings.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-muted">
                No bookings recorded for this customer yet.
              </div>
            ) : (
              <Table ariaLabel="Customer booking history">
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Tour Name</TableHead>
                    <TableHead>Journey Date</TableHead>
                    <TableHead align="right">Amount</TableHead>
                    <TableHead align="right">Paid</TableHead>
                    <TableHead align="right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((b) => {
                    const balance = Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0))
                    const isCancelled = b.status === "Cancelled" || b.status === "cancelled"
                    return (
                      <TableRow key={b.id || b._id}>
                        <TableCell className="font-semibold text-ink font-tabular whitespace-nowrap">
                          #{b.invoiceNo}
                        </TableCell>
                        <TableCell className="text-ink font-medium">
                          {b.tourName}
                        </TableCell>
                        <TableCell className="text-xs text-ink-muted font-tabular whitespace-nowrap">
                          {b.journeyDate ? new Date(b.journeyDate).toLocaleDateString("en-IN") : "-"}
                        </TableCell>
                        <TableCell align="right" className="font-tabular">
                          {formatINR(b.totalAmount)}
                        </TableCell>
                        <TableCell align="right" className="font-tabular text-success">
                          {formatINR(b.advanceReceived)}
                        </TableCell>
                        <TableCell
                          align="right"
                          className={`font-tabular font-bold ${
                            !isCancelled && balance > 0 ? "text-warning" : "text-ink-muted"
                          }`}
                        >
                          {isCancelled ? "₹0.00" : formatINR(balance)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isCancelled ? "danger" : b.isPaid ? "success" : "warning"} size="sm">
                            {b.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </Card>

          {/* Payment Reminders Section */}
          <Card elevation="sm" padding="md" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Payment Reminders ({data.reminders?.length || 0})
              </h3>
              {!customer.whatsappOptOut && summary && summary.totalOutstanding > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReminderModal(true)}
                  className="gap-1 text-xs px-2 py-0.5 h-6 text-emerald-700 dark:text-emerald-400"
                >
                  <MessageSquare className="w-3 h-3" />
                  Send Reminder
                </Button>
              )}
            </div>

            {!data.reminders || data.reminders.length === 0 ? (
              <div className="py-4 text-center text-xs text-ink-muted">
                No reminders recorded for this customer yet.
              </div>
            ) : (
              <div className="space-y-2">
                {data.reminders.map((r) => (
                  <div
                    key={r.id}
                    className="p-2.5 rounded-lg border border-border-subtle bg-surface-subtle flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          r.tone === "overdue"
                            ? "danger"
                            : r.tone === "due-soon"
                            ? "warning"
                            : "neutral"
                        }
                        size="sm"
                      >
                        {r.tone}
                      </Badge>
                      <span className="font-mono font-semibold text-ink">
                        {formatINR(r.amount)}
                      </span>
                      <span className="text-ink-muted">
                        ({r.language?.toUpperCase()})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-ink-muted">
                      <span title={new Date(r.openedAt).toLocaleString("en-IN")}>
                        {formatTimeAgo(r.openedAt)}
                      </span>
                      <Badge variant={r.status === "sent" ? "success" : "neutral"} size="sm">
                        {r.status === "sent" ? "Sent" : "Opened"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {showStatementModal && customer && (
        <StatementModal
          isOpen={showStatementModal}
          onClose={() => setShowStatementModal(false)}
          customer={customer}
        />
      )}

      {showReminderModal && customer && (
        <ReminderModal
          isOpen={showReminderModal}
          onClose={() => setShowReminderModal(false)}
          customer={customer}
          bookings={bookings}
          onReminderLogged={() => {
            fetchCustomerDetails()
          }}
        />
      )}

      {showHistoryModal && customer && (
        <HistoryDrawer
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          entityType="customer"
          entityId={customer._id || customer.id}
          title={`${customer.name || "Customer"} History`}
        />
      )}
    </Drawer>
  )
}
