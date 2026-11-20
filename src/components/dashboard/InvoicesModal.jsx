import { useState, useMemo, Fragment } from "react"
import { FileText, Eye, Edit3, Trash2, Ban, PlusCircle, AlertOctagon } from "lucide-react"
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
  Spinner,
  Textarea,
  Field,
} from "../ui"
import { useToast } from "../common/ToastContext"
import { formatINR } from "../../utils/formatters"
import { cn } from "../../utils/cn"
import {
  DOCUMENT_TYPES,
  getType,
  listDocuments,
  issueDocument,
  voidDocument,
} from "../../data/documents"

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
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all") // all | paid | pending | cancelled
  const [expandedBookingId, setExpandedBookingId] = useState(null)
  const [docsMap, setDocsMap] = useState({})
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [selectedDocTypes, setSelectedDocTypes] = useState({}) // { [bookingId]: docType }
  const [isIssuing, setIsIssuing] = useState(false)
  const [voidingDoc, setVoidingDoc] = useState(null)
  const [voidReason, setVoidReason] = useState("")
  const [isVoiding, setIsVoiding] = useState(false)

  const toggleExpandBooking = async (b) => {
    const bId = b.id || b._id
    if (expandedBookingId === bId) {
      setExpandedBookingId(null)
      return
    }
    setExpandedBookingId(bId)
    if (!docsMap[bId]) {
      try {
        setLoadingDocs(true)
        const docs = await listDocuments({ bookingId: bId })
        setDocsMap((prev) => ({ ...prev, [bId]: docs }))
      } catch (err) {
        console.error("Error loading documents:", err)
        toast.error("Failed to load documents: " + err.message)
      } finally {
        setLoadingDocs(false)
      }
    }
  }

  const handleIssueDoc = async (b, typeId) => {
    const bId = b.id || b._id
    const targetType = typeId || selectedDocTypes[bId] || "tax-invoice"
    try {
      setIsIssuing(true)
      const newDoc = await issueDocument({
        bookingId: bId,
        type: targetType,
      })
      toast.success(`${getType(targetType)?.label || "Document"} #${newDoc.number} issued successfully`)
      setDocsMap((prev) => ({
        ...prev,
        [bId]: [newDoc, ...(prev[bId] || [])],
      }))
    } catch (err) {
      toast.error(err.message || "Failed to issue document")
    } finally {
      setIsIssuing(false)
    }
  }

  const openVoidModal = (doc) => {
    setVoidingDoc(doc)
    setVoidReason("")
  }

  const handleConfirmVoid = async () => {
    if (!voidingDoc) return
    const trimmed = voidReason.trim()
    if (!trimmed || trimmed.length < 3) {
      toast.error("Please enter a valid void reason (at least 3 characters)")
      return
    }
    try {
      setIsVoiding(true)
      const updated = await voidDocument(voidingDoc.id || voidingDoc._id, trimmed)
      toast.success(`Document #${voidingDoc.number} voided successfully`)
      setDocsMap((prev) => ({
        ...prev,
        [voidingDoc.bookingId]: (prev[voidingDoc.bookingId] || []).map((d) =>
          (d.id || d._id) === (voidingDoc.id || voidingDoc._id) ? updated : d
        ),
      }))
      setVoidingDoc(null)
      setVoidReason("")
    } catch (err) {
      toast.error(err.message || "Failed to void document")
    } finally {
      setIsVoiding(false)
    }
  }

  const renderDocPanel = (b) => {
    const bId = b.id || b._id
    const isCancelled = b.status === "Cancelled" || b.status === "cancelled"
    const docs = docsMap[bId] || []
    const selectedType = selectedDocTypes[bId] || "tax-invoice"
    const hasCreditNote = docs.some((d) => d.type === "credit-note" && d.status === "issued")

    return (
      <div className="rounded-[var(--yh-radius-md)] border border-border-subtle bg-surface-subtle p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
          <div>
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-brand-primary" />
              <h4 className="text-sm font-bold text-ink">
                Documents for #{b.invoiceNo} — {b.contactName}
              </h4>
            </div>
            <p className="text-xs text-ink-muted">
              Issue separate document types (Quotation, Bill of Supply, Confirmation, etc.) or credit notes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-48">
              <Select
                size="sm"
                value={selectedType}
                onChange={(e) =>
                  setSelectedDocTypes((prev) => ({
                    ...prev,
                    [bId]: e.target.value,
                  }))
                }
                aria-label="Select document type"
              >
                {DOCUMENT_TYPES.filter((t) => t.id !== "credit-note").map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>

            <Button
              size="sm"
              variant="primary"
              disabled={isIssuing}
              onClick={() => handleIssueDoc(b)}
            >
              <PlusCircle size={14} className="mr-1.5" />
              Issue Document
            </Button>

            {isCancelled && !hasCreditNote && (
              <Button
                size="sm"
                variant="danger"
                disabled={isIssuing}
                onClick={() => handleIssueDoc(b, "credit-note")}
              >
                <AlertOctagon size={14} className="mr-1.5" />
                Issue Credit Note
              </Button>
            )}
            {hasCreditNote && (
              <Badge variant="warning" size="sm">
                Credit Note Issued
              </Badge>
            )}
          </div>
        </div>

        {loadingDocs && !docsMap[bId] ? (
          <div className="flex items-center justify-center py-4 text-xs text-ink-muted gap-2">
            <Spinner size="sm" />
            <span>Loading documents...</span>
          </div>
        ) : docs.length === 0 ? (
          <div className="py-3 text-center text-xs text-ink-muted">
            No documents issued yet. Click &quot;Issue Document&quot; above to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-subtle text-ink-muted font-semibold">
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Document #</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Issued At</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {docs.map((doc) => {
                  const isDocVoid = doc.status === "void"
                  const docDef = getType(doc.type)
                  return (
                    <tr key={doc.id || doc._id} className="hover:bg-surface-hover">
                      <td className="py-2 pr-4">
                        <Badge variant={doc.type === "credit-note" ? "danger" : "primary"} size="sm">
                          {docDef?.label || doc.type}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 font-bold text-ink">
                        #{doc.number}
                      </td>
                      <td className="py-2 pr-4">
                        <StatusPill
                          status={isDocVoid ? "Cancelled" : "Confirmed"}
                          label={isDocVoid ? "Void" : "Issued"}
                          size="sm"
                        />
                        {isDocVoid && doc.voidReason && (
                          <span className="block text-[10px] text-ink-muted truncate max-w-xs" title={doc.voidReason}>
                            Reason: {doc.voidReason}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-ink-muted">
                        {doc.issuedAt ? new Date(doc.issuedAt).toLocaleString() : "—"}
                      </td>
                      <td className="py-2 text-right space-x-1">
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => {
                            setSelectedBooking({ booking: b, document: doc })
                            onClose()
                          }}
                        >
                          <Eye size={12} className="mr-1" />
                          View
                        </Button>
                        {!isDocVoid && (
                          <Button
                            size="xs"
                            variant="ghost"
                            className="text-status-danger-text hover:bg-status-danger-bg"
                            onClick={() => openVoidModal(doc)}
                          >
                            Void
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

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
    <>
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
                    const isExpanded = expandedBookingId === (b.id || b._id)
                    return (
                      <Fragment key={b.id || b._id}>
                        <TableRow>
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
                                aria-label={`Manage documents for #${b.invoiceNo}`}
                                variant={isExpanded ? "primary" : "ghost"}
                                size="sm"
                                onClick={() => toggleExpandBooking(b)}
                                title="Manage documents & credit notes"
                              >
                                <FileText size={16} />
                              </IconButton>
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
                        {isExpanded && (
                          <TableRow className="bg-surface-subtle">
                            <TableCell colSpan={9} className="p-4">
                              {renderDocPanel(b)}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
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

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-subtle">
                      <Button
                        size="xs"
                        variant={expandedBookingId === (b.id || b._id) ? "primary" : "secondary"}
                        onClick={() => toggleExpandBooking(b)}
                      >
                        <FileText size={14} className="mr-1" />
                        Docs {docsMap[b.id || b._id]?.length ? `(${docsMap[b.id || b._id].length})` : ""}
                      </Button>
                      <div className="flex items-center gap-1">
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

                    {expandedBookingId === (b.id || b._id) && (
                      <div className="pt-2 border-t border-border-subtle">
                        {renderDocPanel(b)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </Modal>

    {/* Accessible Void Document Modal (replaces window.prompt) */}
    <Modal
      isOpen={Boolean(voidingDoc)}
      onClose={() => {
        if (!isVoiding) {
          setVoidingDoc(null)
          setVoidReason("")
        }
      }}
      title="Void Document"
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          Are you sure you want to void document{" "}
          <span className="font-bold text-ink">#{voidingDoc?.number}</span>? This action is permanent and cannot be undone.
        </p>

        <Field
          label="Reason for Voiding"
          required
          helperText="Minimum 3 characters. This will be permanently recorded in the audit trail."
        >
          <Textarea
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="e.g., Typographical error, booking cancelled, incorrect amount"
            rows={3}
            maxLength={250}
            disabled={isVoiding}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            onClick={() => {
              setVoidingDoc(null)
              setVoidReason("")
            }}
            disabled={isVoiding}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmVoid}
            isLoading={isVoiding}
            disabled={!voidReason.trim() || voidReason.trim().length < 3 || isVoiding}
          >
            Void Document
          </Button>
        </div>
      </div>
    </Modal>
    </>
  )
}
