import { useState, useEffect, useCallback } from "react"
import {
  Card,
  Button,
  Badge,
  Input,
  Spinner,
  Tabs,
  FOCUS_RING_CLASS,
} from "../ui"
import { PanelErrorBoundary } from "../common/PanelErrorBoundary"
import { RateLimitNotice } from "../common/RateLimitNotice"
import { useToast } from "../common/ToastContext"
import { useConfirm } from "../common/useConfirm"
import { getTrash, restoreTrashItem } from "../../data/trash"
import { formatINR } from "../../utils/formatters"
import { HISTORY_LABELS } from "../../../shared/history.js"
import HistoryDrawer from "../history/HistoryDrawer"
import {
  Trash2,
  RotateCcw,
  History,
  Search,
  AlertTriangle,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Info,
} from "lucide-react"

const TABS = [
  { id: "all", label: "All Items" },
  { id: "booking", label: "Bookings" },
  { id: "expense", label: "Expenses" },
  { id: "customer", label: "Customers" },
  { id: "cashEntry", label: "Cash Entries" },
]

const TYPE_BADGE_VARIANTS = {
  booking: "primary",
  expense: "warning",
  customer: "info",
  cashEntry: "success",
}

const TYPE_LABELS = {
  booking: "Booking",
  expense: "Expense",
  customer: "Customer",
  cashEntry: "Cash Entry",
}

export default function Trash() {
  const { toast } = useToast()
  const confirm = useConfirm()

  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    totalPages: 1,
    counts: { all: 0, booking: 0, expense: 0, customer: 0, cashEntry: 0 },
    lockDate: null,
  })
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState(null)
  const [rateLimitRetry, setRateLimitRetry] = useState(null)

  // History Drawer state
  const [historyTarget, setHistoryTarget] = useState(null)

  // Debounce search input (~400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch trash items
  const fetchItems = useCallback(async () => {
    setLoading(true)
    setRateLimitRetry(null)
    try {
      const res = await getTrash({
        type: activeTab,
        q: debouncedQuery,
        page,
        limit: 25,
      })
      setData({
        items: Array.isArray(res?.items) ? res.items : [],
        total: res?.total || 0,
        page: res?.page || 1,
        totalPages: res?.totalPages || 1,
        counts: res?.counts || { all: 0, booking: 0, expense: 0, customer: 0, cashEntry: 0 },
        lockDate: res?.lockDate || null,
      })
    } catch (err) {
      if (err.status === 429) {
        setRateLimitRetry(60)
      } else {
        console.error("Trash fetch error:", err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [activeTab, debouncedQuery, page])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Handle restore action
  const handleRestore = async (item) => {
    const isConfirmed = await confirm({
      title: "Restore from Trash?",
      message: `Are you sure you want to restore "${item.title}"? This item will return to active records immediately.`,
      confirmText: "Restore Item",
      cancelText: "Cancel",
      variant: "primary",
    })

    if (!isConfirmed) return

    setRestoringId(item._id)
    try {
      const res = await restoreTrashItem(item.type, item._id)
      if (res?.success) {
        toast({
          title: "Item Restored",
          description: `"${item.title}" has been restored to active records.`,
          variant: "success",
        })
        await fetchItems()
      } else {
        throw new Error(res?.message || "Failed to restore item.")
      }
    } catch (err) {
      if (err.status === 423) {
        toast({
          title: "Books Closed",
          description: err.message || "Cannot restore this record because books are closed for its date.",
          variant: "danger",
        })
      } else if (err.status === 409) {
        toast({
          title: "Conflict Detected",
          description: err.message || "An active record with the same number or phone already exists.",
          variant: "danger",
        })
      } else {
        toast({
          title: "Restore Failed",
          description: err.message || "An unexpected error occurred while restoring the item.",
          variant: "danger",
        })
      }
    } finally {
      setRestoringId(null)
    }
  }

  // Format reason text for disabled restore
  const getDisabledReasonText = (restore) => {
    if (!restore || restore.allowed || !restore.reasons?.length) return ""
    const code = restore.reasons[0]
    return HISTORY_LABELS.en.restoreReasons[code] || "Cannot restore at this time."
  }

  return (
    <PanelErrorBoundary panelName="Trash">
      <div className="space-y-6">
        {/* Header with Title & Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--yh-text-primary)] flex items-center gap-2">
              <Trash2 className="h-6 w-6 text-danger" aria-hidden="true" />
              <span>Trash & Recycle Bin</span>
            </h1>
            <p className="text-sm text-[var(--yh-text-secondary)] mt-1">
              Safely view and restore deleted records. Items remain available for 2 years before purging.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchItems}
            disabled={loading}
            className="self-start sm:self-auto"
            aria-label="Refresh trash items"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </Button>
        </div>

        {/* Rate limit banner */}
        {rateLimitRetry && (
          <RateLimitNotice retryAfterSeconds={rateLimitRetry} onRetry={fetchItems} />
        )}

        {/* Tabs & Search Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs using shared accessible primitive */}
          <div className="flex-1 min-w-0">
            <Tabs
              ariaLabel="Trash entity tabs"
              value={activeTab}
              onChange={(nextTab) => {
                setActiveTab(nextTab)
                setPage(1)
              }}
              items={TABS.map((tab) => ({
                id: tab.id,
                label: tab.label,
                badge: data.counts[tab.id] || 0,
              }))}
            />
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--yh-text-muted)]" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search in trash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-1.5 text-sm rounded-[var(--yh-radius-md)] border border-[var(--yh-border-default)] bg-[var(--yh-bg-surface)] text-[var(--yh-text-primary)] ${FOCUS_RING_CLASS}`}
              aria-label="Search soft-deleted records"
            />
          </div>
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-[var(--yh-text-secondary)]">Loading trash items...</p>
          </div>
        ) : data.items.length === 0 ? (
          <div className="text-center py-16 bg-[var(--yh-bg-surface)] border border-[var(--yh-border-default)] rounded-[var(--yh-radius-lg)] p-8">
            <Trash2 className="h-12 w-12 mx-auto text-[var(--yh-text-muted)] opacity-40 mb-3" aria-hidden="true" />
            <h3 className="text-base font-semibold text-[var(--yh-text-primary)]">Trash is Empty</h3>
            <p className="text-sm text-[var(--yh-text-secondary)] mt-1 max-w-md mx-auto">
              {debouncedQuery
                ? `No soft-deleted records match "${debouncedQuery}".`
                : "No deleted items in this category. Deleted bookings, expenses, customers, and cash transactions will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View with Keyboard Focusable Region */}
            <div className="hidden md:block">
              <div
                role="region"
                aria-label="Trash table, scrollable"
                /* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WCAG 2.1 SC 2.1.1: scrollable data region must be keyboard focusable */
                tabIndex={0}
                className={`overflow-x-auto border border-[var(--yh-border-default)] rounded-[var(--yh-radius-lg)] bg-[var(--yh-bg-surface)] ${FOCUS_RING_CLASS}`}
              >
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--yh-border-default)] bg-surface-muted text-[var(--yh-text-secondary)] text-xs uppercase font-semibold">
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Record Details</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Deleted On</th>
                      <th className="py-3 px-4">Restore Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--yh-border-subtle)]">
                    {data.items.map((item) => {
                      const isRestoreAllowed = item.restore?.allowed
                      const disabledReason = getDisabledReasonText(item.restore)
                      const deletedDate = new Date(item.deletedAt)

                      return (
                        <tr key={item._id} className="hover:bg-[var(--yh-bg-subtle)] transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge variant={TYPE_BADGE_VARIANTS[item.type] || "default"} size="sm">
                              {TYPE_LABELS[item.type] || item.type}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-[var(--yh-text-primary)]">{item.title}</div>
                            {item.subtitle && (
                              <div className="text-xs text-[var(--yh-text-secondary)] mt-0.5">{item.subtitle}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-medium">
                            {item.amount !== null && item.amount !== undefined ? (
                              <span className="text-[var(--yh-text-primary)]">{formatINR(item.amount)}</span>
                            ) : (
                              <span className="text-[var(--yh-text-muted)]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-xs text-[var(--yh-text-secondary)]">
                            {deletedDate.toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3 px-4">
                            {isRestoreAllowed ? (
                              <span className="inline-flex items-center text-xs text-success font-medium">
                                Ready to restore
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-xs text-danger font-medium"
                                title={disabledReason}
                              >
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="truncate max-w-[200px]">{disabledReason}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* History Drawer Trigger */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setHistoryTarget({
                                    entityType: item.type,
                                    entityId: item._id,
                                    title: `${TYPE_LABELS[item.type] || item.type} Change History`,
                                  })
                                }
                                title="View change history"
                                aria-label={`View history for ${item.title}`}
                              >
                                <History className="h-4 w-4" aria-hidden="true" />
                              </Button>

                              {/* Restore Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!isRestoreAllowed || restoringId === item._id}
                                onClick={() => handleRestore(item)}
                                title={!isRestoreAllowed ? disabledReason : "Restore record to active database"}
                                aria-label={`Restore ${item.title}`}
                                className={isRestoreAllowed ? "text-brand border-brand hover:bg-brand hover:text-brand-fg" : ""}
                              >
                                <RotateCcw className={`h-3.5 w-3.5 mr-1.5 ${restoringId === item._id ? "animate-spin" : ""}`} aria-hidden="true" />
                                Restore
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Stacked Card View */}
            <div className="md:hidden space-y-3">
              {data.items.map((item) => {
                const isRestoreAllowed = item.restore?.allowed
                const disabledReason = getDisabledReasonText(item.restore)
                const deletedDate = new Date(item.deletedAt)

                return (
                  <Card key={item._id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge variant={TYPE_BADGE_VARIANTS[item.type] || "default"} size="sm">
                          {TYPE_LABELS[item.type] || item.type}
                        </Badge>
                        <h4 className="font-semibold text-sm text-[var(--yh-text-primary)] mt-1.5">{item.title}</h4>
                        {item.subtitle && (
                          <p className="text-xs text-[var(--yh-text-secondary)] mt-0.5">{item.subtitle}</p>
                        )}
                      </div>
                      {item.amount !== null && item.amount !== undefined && (
                        <div className="text-sm font-bold text-[var(--yh-text-primary)]">
                          {formatINR(item.amount)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-[var(--yh-text-muted)] border-t border-[var(--yh-border-subtle)] pt-2.5">
                      <span>
                        Deleted:{" "}
                        {deletedDate.toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {!isRestoreAllowed && (
                        <span className="text-danger font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          Locked
                        </span>
                      )}
                    </div>

                    {!isRestoreAllowed && disabledReason && (
                      <p className="text-xs text-danger bg-surface-muted p-2 rounded">
                        {disabledReason}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1 border-t border-[var(--yh-border-subtle)]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setHistoryTarget({
                            entityType: item.type,
                            entityId: item._id,
                            title: `${TYPE_LABELS[item.type] || item.type} Change History`,
                          })
                        }
                        className="flex-1 text-xs"
                      >
                        <History className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                        History
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!isRestoreAllowed || restoringId === item._id}
                        onClick={() => handleRestore(item)}
                        className={`flex-1 text-xs ${
                          isRestoreAllowed ? "text-brand border-brand" : ""
                        }`}
                      >
                        <RotateCcw className={`h-3.5 w-3.5 mr-1 ${restoringId === item._id ? "animate-spin" : ""}`} aria-hidden="true" />
                        Restore
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>

            {/* Pagination Controls */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[var(--yh-border-default)] pt-4">
                <span className="text-xs text-[var(--yh-text-secondary)]">
                  Showing page {data.page} of {data.totalPages} ({data.total} items)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page >= data.totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reusable History Drawer */}
        {historyTarget && (
          <HistoryDrawer
            isOpen={Boolean(historyTarget)}
            onClose={() => setHistoryTarget(null)}
            entityType={historyTarget.entityType}
            entityId={historyTarget.entityId}
            title={historyTarget.title}
          />
        )}
      </div>
    </PanelErrorBoundary>
  )
}
