import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import {
  Plus,
  Trash2,
  Edit2,
  Copy,
  Download,
  Filter,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  DollarSign,
  AlertCircle,
  ReceiptText,
  Fuel,
  CreditCard,
  UserCheck,
  Bus,
  Utensils,
  Hotel,
  FileText,
  Wrench,
  Percent,
  Megaphone,
  Building2,
  Users,
  HelpCircle,
  Clock,
  CheckCircle2,
} from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts"
import { useToast } from "./common/useToast"
import { PanelErrorBoundary } from "./common/PanelErrorBoundary"
import { RateLimitNotice } from "./common/RateLimitNotice"
import {
  Button,
  IconButton,
  Input,
  Select,
  Textarea,
  Field,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  StatusPill,
  Modal,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  StatCard,
  PageHeader,
  SearchInput,
  ConfirmDialog,
  EmptyState,
  Skeleton,
  Spinner,
} from "./ui"
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_MAP,
  EXPENSE_CATEGORY_IDS,
  EXPENSE_PAYMENT_MODES,
  EXPENSE_PAYMENT_MODE_MAP,
  EXPENSE_STATUSES,
  EXPENSE_STATUS_MAP,
  sumAmounts,
  groupByCategory,
  round2,
} from "../../shared/expenses"
import { calculateProfitLoss, parseTourRef, toDateKey } from "../../shared/profitLoss"
import {
  listExpenses,
  getExpenseSummary,
  createExpense,
  updateExpense,
  deleteExpense,
} from "../data/expenses"
import { formatINR } from "../utils/formatters"
import { downloadCsv } from "../utils/csv"
import { cn } from "../utils/cn"

const CATEGORY_ICON_MAP = {
  Fuel,
  CreditCard,
  UserCheck,
  Bus,
  Utensils,
  Hotel,
  FileText,
  Wrench,
  Percent,
  Megaphone,
  Building2,
  Users,
  HelpCircle,
}

const CHART_COLORS = [
  "#0284c7",
  "#f97316",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#06b6d4",
  "#6366f1",
  "#14b8a6",
  "#84cc16",
  "#e11d48",
  "#64748b",
  "#a855f7",
]

function CategoryIcon({ iconName, className = "h-4 w-4" }) {
  const IconComponent = CATEGORY_ICON_MAP[iconName] || HelpCircle
  return <IconComponent className={className} aria-hidden="true" />
}

function getQuickRangeDates(rangeKey) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  if (rangeKey === "this_month") {
    const from = new Date(year, month, 1).toISOString().split("T")[0]
    const to = new Date(year, month + 1, 0).toISOString().split("T")[0]
    return { from, to }
  }
  if (rangeKey === "last_month") {
    const from = new Date(year, month - 1, 1).toISOString().split("T")[0]
    const to = new Date(year, month, 0).toISOString().split("T")[0]
    return { from, to }
  }
  if (rangeKey === "this_fy") {
    const fyStartYear = month >= 3 ? year : year - 1
    const from = `${fyStartYear}-04-01`
    const to = `${fyStartYear + 1}-03-31`
    return { from, to }
  }
  return { from: "", to: "" }
}

function normalizeIncomingExpense(exp) {
  if (!exp) return null
  const id = exp._id || exp.id || String(Date.now())
  let category = exp.category || "other"
  if (!EXPENSE_CATEGORY_IDS.includes(category)) {
    const normalized = String(category).toLowerCase().replace(/\s+/g, "-")
    category = EXPENSE_CATEGORY_IDS.includes(normalized) ? normalized : "other"
  }
  const parsed = parseTourRef(exp.tourRef || exp.departureKey || exp.tourName)
  const tourName = exp.tourName || parsed.tourName || ""
  const departureKey = exp.departureKey || (parsed.isDeparture ? parsed.departureKey : "") || ""

  return {
    _id: id,
    id,
    date: exp.date ? new Date(exp.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    category,
    amount: round2(Number(exp.amount) || 0),
    tourRef: exp.tourRef || exp.tourId || departureKey || tourName || "",
    tourName,
    departureKey,
    tourLabel: exp.tourLabel || (parsed.isDeparture ? `${tourName} (${parsed.dateKey})` : tourName) || "",
    vendor: exp.vendor || "",
    paymentMode: exp.paymentMode || "cash",
    status: exp.status || "paid",
    note: exp.note || exp.description || "",
    description: exp.description || exp.note || "",
    paidOn: exp.paidOn || "",
  }
}

export default function ExpenseTracker({
  bookings = [],
  tours = [],
  user = null,
  onSave = null,
  expenses = [],
}) {
  const toastContext = useToast()
  const toast = toastContext.toast || toastContext

  const lang = user?.documentLanguage || "en"

  // Date filters
  const [dateRangeKey, setDateRangeKey] = useState("this_month")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")

  // Filter criteria
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [tourFilter, setTourFilter] = useState("all")
  const [paymentModeFilter, setPaymentModeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  // UI state
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [rateLimitState, setRateLimitState] = useState(null) // { retryAfter: number } | null

  // Expenses data
  const [expenseList, setExpenseList] = useState(() => (Array.isArray(expenses) ? expenses.map(normalizeIncomingExpense).filter(Boolean) : []))
  const [_summaryData, setSummaryData] = useState(null)

  // Modal & Form state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState(null)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "fuel",
    amount: "",
    tourRef: "",
    tourName: "",
    departureKey: "",
    tourLabel: "",
    vendor: "",
    paymentMode: "cash",
    status: "paid",
    note: "",
  })
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete Confirm state
  const [deletingExpense, setDeletingExpense] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Track initial mount
  const hasLoadedRef = useRef(false)

  // Resolve active dates for API and filtering
  const activeDates = useMemo(() => {
    if (dateRangeKey === "custom") {
      return { from: customFrom, to: customTo }
    }
    return getQuickRangeDates(dateRangeKey)
  }, [dateRangeKey, customFrom, customTo])

  // Localized helper
  const getCategoryLabel = useCallback(
    (catId) => {
      const cat = EXPENSE_CATEGORY_MAP[catId]
      if (!cat) return catId || "Other"
      if (lang === "hi" && cat.labelHi) return cat.labelHi
      if (lang === "gu" && cat.labelGu) return cat.labelGu
      return cat.label
    },
    [lang],
  )

  const getPaymentModeLabel = useCallback(
    (modeId) => {
      const m = EXPENSE_PAYMENT_MODE_MAP[modeId]
      if (!m) return modeId || "Cash"
      if (lang === "hi" && m.labelHi) return m.labelHi
      if (lang === "gu" && m.labelGu) return m.labelGu
      return m.label
    },
    [lang],
  )

  // Available tour options
  const availableTours = useMemo(() => {
    const set = new Set()
    for (const t of tours || []) {
      const name = t.tourName || t.name || t.destination
      if (name) set.add(name.trim())
    }
    for (const b of bookings || []) {
      if (b.tourName) set.add(b.tourName.trim())
    }
    return Array.from(set).sort()
  }, [tours, bookings])

  // Fetch expenses from API
  const fetchExpenses = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setApiError(null)

    try {
      const queryParams = {
        limit: 100,
      }
      if (activeDates.from) queryParams.from = activeDates.from
      if (activeDates.to) queryParams.to = activeDates.to
      if (categoryFilter !== "all") queryParams.category = categoryFilter
      if (tourFilter !== "all") queryParams.tourRef = tourFilter
      if (paymentModeFilter !== "all") queryParams.paymentMode = paymentModeFilter
      if (statusFilter !== "all") queryParams.status = statusFilter
      if (searchQuery.trim()) queryParams.q = searchQuery.trim()

      const [listResult, summaryResult] = await Promise.all([
        listExpenses(queryParams).catch((err) => {
          // If 401 or offline, allow fallback if expenses prop exists
          throw err
        }),
        getExpenseSummary(queryParams).catch(() => null),
      ])

      const normalizedList = (listResult?.expenses || []).map(normalizeIncomingExpense).filter(Boolean)
      setExpenseList(normalizedList)
      setSummaryData(summaryResult)
      setRateLimitState(null)
    } catch (err) {
      console.error("Error loading expenses:", err)
      setApiError(err.message || "Failed to load expenses")
      if (
        err.status === 429 ||
        err.message?.includes("429") ||
        err.message?.toLowerCase().includes("too many requests") ||
        err.message?.toLowerCase().includes("rate limit")
      ) {
        setRateLimitState({
          retryAfter: err.retryAfter || 60,
        })
      }
      // If expenses prop was passed, use it as fallback
      if (Array.isArray(expenses) && expenses.length > 0) {
        setExpenseList(expenses.map(normalizeIncomingExpense).filter(Boolean))
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [
    activeDates.from,
    activeDates.to,
    categoryFilter,
    tourFilter,
    paymentModeFilter,
    statusFilter,
    searchQuery,
    expenses,
  ])

  useEffect(() => {
    fetchExpenses(hasLoadedRef.current)
    hasLoadedRef.current = true
  }, [fetchExpenses])

  // Filtered in-memory list (safety pass)
  const filteredList = useMemo(() => {
    return expenseList.filter((exp) => {
      if (categoryFilter !== "all" && exp.category !== categoryFilter) return false
      if (tourFilter !== "all") {
        if (tourFilter === "general" && exp.tourRef) return false
        if (tourFilter !== "general" && exp.tourRef !== tourFilter) return false
      }
      if (paymentModeFilter !== "all" && exp.paymentMode !== paymentModeFilter) return false
      if (statusFilter !== "all" && exp.status !== statusFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const vendor = (exp.vendor || "").toLowerCase()
        const note = (exp.note || exp.description || "").toLowerCase()
        const tour = (exp.tourLabel || exp.tourRef || "").toLowerCase()
        const cat = (EXPENSE_CATEGORY_MAP[exp.category]?.label || "").toLowerCase()
        if (!vendor.includes(q) && !note.includes(q) && !tour.includes(q) && !cat.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [expenseList, categoryFilter, tourFilter, paymentModeFilter, statusFilter, searchQuery])

  // Analysis & KPI calculations
  const analysis = useMemo(() => {
    const totalExpenses = sumAmounts(filteredList)
    let totalPaid = 0
    let totalPending = 0
    let pendingCount = 0

    const catTotals = {}
    for (const exp of filteredList) {
      const amt = Number(exp.amount) || 0
      if (exp.status === "pending") {
        totalPending += amt
        pendingCount += 1
      } else {
        totalPaid += amt
      }
      const c = exp.category || "other"
      catTotals[c] = (catTotals[c] || 0) + amt
    }

    const categoryGroups = groupByCategory(filteredList).filter((c) => c.total > 0)
    const topCategory = categoryGroups.length > 0 ? categoryGroups[0] : null

    // Net profit vs revenue analysis computed with shared P&L engine
    const pnl = calculateProfitLoss({
      bookings,
      expenses: filteredList,
      filters: {
        from: activeDates.from,
        to: activeDates.to,
        tourName: tourFilter !== "all" ? tourFilter : undefined,
      },
    })
    const totalRevenue = pnl.summary.bookedRevenue
    const netProfit = pnl.summary.tourProfitBooked
    const profitMargin = pnl.summary.tourMarginPercent ?? 0
    const expenseRatio = totalRevenue > 0 ? round2((totalExpenses / totalRevenue) * 100) : 0

    // Chart data for PieChart
    const chartData = categoryGroups.map((c) => ({
      name: getCategoryLabel(c.id),
      value: c.total,
      id: c.id,
      count: c.count,
    }))

    return {
      totalExpenses,
      totalPaid: round2(totalPaid),
      totalPending: round2(totalPending),
      pendingCount,
      topCategory,
      categoryGroups,
      chartData,
      totalRevenue,
      netProfit,
      profitMargin,
      expenseRatio,
    }
  }, [filteredList, bookings, getCategoryLabel, activeDates.from, activeDates.to, tourFilter])

  // Open modal for new expense
  const handleOpenAddModal = () => {
    setEditingExpenseId(null)
    setFormData({
      date: new Date().toISOString().split("T")[0],
      category: "fuel",
      amount: "",
      tourRef: "",
      tourLabel: "",
      vendor: "",
      paymentMode: "cash",
      status: "paid",
      note: "",
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  // Open modal for duplicate ("Add similar")
  const handleAddSimilar = (exp) => {
    setEditingExpenseId(null)
    const parsed = parseTourRef(exp.tourRef || exp.departureKey || exp.tourName)
    const tourName = exp.tourName || parsed.tourName || ""
    const departureKey = exp.departureKey || (parsed.isDeparture ? parsed.departureKey : "") || ""
    setFormData({
      date: new Date().toISOString().split("T")[0],
      category: exp.category || "fuel",
      amount: String(exp.amount || ""),
      tourRef: exp.tourRef || "",
      tourName,
      departureKey,
      tourLabel: exp.tourLabel || "",
      vendor: exp.vendor || "",
      paymentMode: exp.paymentMode || "cash",
      status: "paid",
      note: exp.note || exp.description || "",
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  // Open modal for editing
  const handleEditExpense = (exp) => {
    setEditingExpenseId(exp._id || exp.id)
    const parsed = parseTourRef(exp.tourRef || exp.departureKey || exp.tourName)
    const tourName = exp.tourName || parsed.tourName || ""
    const departureKey = exp.departureKey || (parsed.isDeparture ? parsed.departureKey : "") || ""
    setFormData({
      date: exp.date ? exp.date.slice(0, 10) : new Date().toISOString().split("T")[0],
      category: exp.category || "fuel",
      amount: String(exp.amount || ""),
      tourRef: exp.tourRef || "",
      tourName,
      departureKey,
      tourLabel: exp.tourLabel || "",
      vendor: exp.vendor || "",
      paymentMode: exp.paymentMode || "cash",
      status: exp.status || "paid",
      note: exp.note || exp.description || "",
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  // Available departures for currently selected tour in the modal
  const availableDepartures = useMemo(() => {
    if (!formData.tourName) return []
    const depMap = new Map()
    for (const b of bookings || []) {
      if (b.tourName === formData.tourName && b.status !== "Cancelled" && b.status !== "cancelled") {
        const dKey = toDateKey(b.journeyDate || b.date)
        const bus = b.busType || "2x1 Sleeper Luxury"
        const depKey = `${b.tourName}___${dKey}___${bus}`
        if (!depMap.has(depKey)) {
          depMap.set(depKey, {
            key: depKey,
            dateStr: dKey,
            busType: bus,
            label: `${dKey} — ${bus}`,
          })
        }
      }
    }
    return Array.from(depMap.values()).sort((a, b) => (b.dateStr || "").localeCompare(a.dateStr || ""))
  }, [formData.tourName, bookings])

  // Validate form before save
  const validateForm = () => {
    const errors = {}
    const amt = Number(formData.amount)
    if (!formData.amount || isNaN(amt) || amt <= 0) {
      errors.amount = "Enter a valid amount greater than ₹0"
    } else if (amt > 10000000) {
      errors.amount = "Amount exceeds ₹1,00,00,000 maximum limit"
    }

    if (!formData.date) {
      errors.date = "Date is required"
    }

    if (!formData.category || !EXPENSE_CATEGORY_IDS.includes(formData.category)) {
      errors.category = "Select a valid category"
    }

    if (formData.vendor && formData.vendor.length > 80) {
      errors.vendor = "Vendor name must be 80 characters or less"
    }

    if (formData.note && formData.note.length > 300) {
      errors.note = "Note must be 300 characters or less"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Save (Create or Update)
  const handleSaveExpense = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      const payload = {
        date: formData.date,
        category: formData.category,
        amount: round2(Number(formData.amount)),
        tourRef: formData.departureKey || formData.tourName || formData.tourRef || null,
        tourName: formData.tourName || null,
        departureKey: formData.departureKey || null,
        tourLabel: formData.tourLabel || (formData.tourName ? formData.tourName : null),
        vendor: formData.vendor.trim() || undefined,
        paymentMode: formData.paymentMode,
        status: formData.status,
        note: formData.note.trim() || undefined,
      }

      let saved
      if (editingExpenseId) {
        saved = await updateExpense(editingExpenseId, payload)
        toast.success("Expense updated successfully")
      } else {
        saved = await createExpense(payload)
        toast.success("Expense added successfully")
      }

      const normalized = normalizeIncomingExpense(saved)
      setExpenseList((prev) => {
        let updated
        if (editingExpenseId) {
          updated = prev.map((item) => ((item._id || item.id) === editingExpenseId ? normalized : item))
        } else {
          updated = [normalized, ...prev]
        }
        if (onSave) onSave(updated)
        return updated
      })

      setIsModalOpen(false)
      // Refresh summary from backend
      getExpenseSummary().then((s) => s && setSummaryData(s)).catch(() => {})
    } catch (err) {
      console.error("Error saving expense:", err)
      toast.error(err.message || "Failed to save expense")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Soft delete confirm
  const handleConfirmDelete = async () => {
    if (!deletingExpense) return
    setIsDeleting(true)
    try {
      const id = deletingExpense._id || deletingExpense.id
      await deleteExpense(id)
      setExpenseList((prev) => {
        const updated = prev.filter((item) => (item._id || item.id) !== id)
        if (onSave) onSave(updated)
        return updated
      })
      toast.success("Expense removed")
      setDeletingExpense(null)
      getExpenseSummary().then((s) => s && setSummaryData(s)).catch(() => {})
    } catch (err) {
      console.error("Error deleting expense:", err)
      toast.error(err.message || "Failed to delete expense")
    } finally {
      setIsDeleting(false)
    }
  }

  // Export filtered expenses to CSV
  const handleExportCSV = () => {
    if (filteredList.length === 0) {
      toast.info("No expenses to export")
      return
    }

    const header = [
      "Date",
      "Category",
      "Vendor",
      "Related Tour",
      "Payment Mode",
      "Status",
      "Amount (INR)",
      "Note / Details",
    ]

    const rows = filteredList.map((exp) => [
      exp.date,
      getCategoryLabel(exp.category),
      exp.vendor || "—",
      exp.tourLabel || exp.tourRef || "General Expense",
      getPaymentModeLabel(exp.paymentMode),
      exp.status === "paid" ? "Paid" : "Pending",
      exp.amount.toFixed(2),
      exp.note || exp.description || "",
    ])

    const dateStr = new Date().toISOString().split("T")[0]
    downloadCsv(`yatrahub-expenses-${dateStr}`, [header, ...rows])
    toast.success("Expenses exported to CSV")
  }

  // Clear all filters
  const handleClearFilters = () => {
    setDateRangeKey("this_month")
    setCustomFrom("")
    setCustomTo("")
    setCategoryFilter("all")
    setTourFilter("all")
    setPaymentModeFilter("all")
    setStatusFilter("all")
    setSearchQuery("")
  }

  const activeFilterCount =
    (dateRangeKey !== "all" ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0) +
    (tourFilter !== "all" ? 1 : 0) +
    (paymentModeFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0)

  return (
    <PanelErrorBoundary resetKey="expenses-screen" title="Expense Management Error">
      <div className="space-y-6 pb-12 animate-in fade-in duration-300">
        {/* Calm Inline 429 Rate Limit Alert */}
        {rateLimitState && (
          <RateLimitNotice
            retryAfterSeconds={rateLimitState.retryAfter}
            onRetry={() => {
              setRateLimitState(null)
              fetchExpenses(true)
            }}
            title="Expenses Rate Limit Active"
            message="Too many expense requests. Please wait for the cooldown before retrying."
          />
        )}

        {/* Top Header */}
        <PageHeader
          title="Expense Management"
          description="Track coach operations, fuel, toll, driver bhatta, meals, and maintenance costs."
          actions={
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="md"
                onClick={handleExportCSV}
                disabled={loading || filteredList.length === 0}
                className="gap-2"
                aria-label="Export filtered expenses to CSV"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Export CSV</span>
              </Button>
              <Button
                variant="accent"
                size="md"
                onClick={handleOpenAddModal}
                className="gap-2"
                aria-label="Add new expense"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Expense</span>
              </Button>
            </div>
          }
        />

        {/* API Error Alert Banner with Retry */}
        {apiError && (
          <div
            role="alert"
            className="flex items-center justify-between p-4 rounded-[var(--yh-radius-lg)] bg-status-danger/10 border border-status-danger/30 text-status-danger"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold">Failed to load live expenses</p>
                <p className="text-xs text-ink-muted">{apiError}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchExpenses(false)}
              className="gap-1.5 shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Retry</span>
            </Button>
          </div>
        )}

        {/* 4 Primary StatCards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Expenses"
            value={formatINR(analysis.totalExpenses, 2)}
            hint={`${filteredList.length} transaction${filteredList.length === 1 ? "" : "s"}`}
            icon={TrendingDown}
            tone="danger"
          />

          <StatCard
            label="Paid Expenses"
            value={formatINR(analysis.totalPaid, 2)}
            hint="Settled payments"
            icon={CheckCircle2}
            tone="success"
          />

          <StatCard
            label="Pending Payments"
            value={formatINR(analysis.totalPending, 2)}
            hint={
              analysis.pendingCount > 0
                ? `${analysis.pendingCount} unpaid bill${analysis.pendingCount === 1 ? "" : "s"}`
                : "All payments settled"
            }
            icon={Clock}
            tone={analysis.pendingCount > 0 ? "warning" : "brand"}
          />

          <StatCard
            label="Top Category"
            value={analysis.topCategory ? formatINR(analysis.topCategory.total, 2) : "₹0.00"}
            hint={analysis.topCategory ? getCategoryLabel(analysis.topCategory.id) : "No expenses"}
            icon={ReceiptText}
            tone="accent"
          />
        </div>

        {/* Profitability Summary (When Bookings Revenue is Available) */}
        {bookings && bookings.length > 0 && (
          <Card className="p-4 sm:p-5 border-border-subtle bg-surface">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
              <div>
                <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-brand" aria-hidden="true" />
                  Tour Operating Margin
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Real-time profit calculated against total booking revenue ({bookings.length} reservations)
                </p>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-xs font-bold text-ink-muted uppercase tracking-wider">Total Revenue</p>
                  <p className="text-base font-black text-ink">{formatINR(analysis.totalRevenue, 2)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-ink-muted uppercase tracking-wider">Net Margin</p>
                  <p
                    className={cn(
                      "text-base font-black",
                      analysis.netProfit >= 0 ? "text-status-success" : "text-status-danger",
                    )}
                  >
                    {analysis.profitMargin.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4">
              <div>
                <p className="text-xs font-bold text-ink-muted">Net Operating Profit</p>
                <p
                  className={cn(
                    "text-lg font-black mt-1",
                    analysis.netProfit >= 0 ? "text-status-success" : "text-status-danger",
                  )}
                >
                  {formatINR(analysis.netProfit, 2)}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-ink-muted">Expense Ratio</p>
                <p className="text-lg font-black text-ink mt-1">
                  {analysis.expenseRatio.toFixed(1)}%
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs font-bold text-ink-muted">Operating Balance</p>
                <p className="text-sm font-bold text-ink-muted mt-1">
                  {analysis.netProfit >= 0 ? "Profitable tour operation" : "Expenses exceed collections"}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Filter Bar (Collapsible on Mobile) */}
        <Card className="border-border-subtle bg-surface">
          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Quick search input */}
            <div className="flex-1 max-w-md">
              <SearchInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery("")}
                placeholder="Search vendor, note, tour, category..."
                aria-label="Search expenses"
              />
            </div>

            {/* Date range toggle chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "this_month", label: "This Month" },
                { id: "last_month", label: "Last Month" },
                { id: "this_fy", label: "This FY" },
                { id: "all", label: "All Time" },
                { id: "custom", label: "Custom" },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setDateRangeKey(r.id)}
                  aria-pressed={dateRangeKey === r.id}
                  className={cn(
                    "px-3 py-1.5 rounded-[var(--yh-radius-md)] text-xs font-bold transition-colors cursor-pointer min-h-[36px]",
                    dateRangeKey === r.id
                      ? "bg-brand text-brand-fg shadow-sm"
                      : "bg-surface-muted text-ink-muted hover:text-ink hover:bg-surface-raised",
                  )}
                >
                  {r.label}
                </button>
              ))}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltersOpen((prev) => !prev)}
                className="gap-1.5 text-xs font-bold ml-1"
                aria-expanded={filtersOpen}
                aria-controls="expense-advanced-filters"
              >
                <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Filters {activeFilterCount > 1 ? `(${activeFilterCount})` : ""}</span>
              </Button>
            </div>
          </div>

          {/* Collapsible Advanced Filters */}
          {(filtersOpen || dateRangeKey === "custom") && (
            <div
              id="expense-advanced-filters"
              className="p-4 pt-0 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2"
            >
              {dateRangeKey === "custom" && (
                <>
                  <Field label="From Date">
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      aria-label="Filter from date"
                    />
                  </Field>
                  <Field label="To Date">
                    <Input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      aria-label="Filter to date"
                    />
                  </Field>
                </>
              )}

              <Field label="Category">
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter by category"
                >
                  <option value="all">All Categories</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {getCategoryLabel(cat.id)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Related Tour">
                <Select
                  value={tourFilter}
                  onChange={(e) => setTourFilter(e.target.value)}
                  aria-label="Filter by tour"
                >
                  <option value="all">All Tours</option>
                  <option value="general">General (Unlinked)</option>
                  {availableTours.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Payment Mode">
                <Select
                  value={paymentModeFilter}
                  onChange={(e) => setPaymentModeFilter(e.target.value)}
                  aria-label="Filter by payment mode"
                >
                  <option value="all">All Modes</option>
                  {EXPENSE_PAYMENT_MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {getPaymentModeLabel(m.id)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Status">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                </Select>
              </Field>

              <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  Reset Filters
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Charts & Breakdown (When Data Exists) */}
        {analysis.chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recharts Pie Chart */}
            <Card className="p-5 border-border-subtle bg-surface flex flex-col">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-base font-bold text-ink">Expenses by Category</CardTitle>
                <CardDescription className="text-xs text-ink-muted">
                  Visual distribution across {analysis.chartData.length} active spending areas
                </CardDescription>
              </CardHeader>
              <div className="w-full h-64 min-h-[256px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analysis.chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {analysis.chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.id}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                          stroke="var(--yh-surface)"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val) => [formatINR(val, 2), "Amount"]}
                      contentStyle={{
                        backgroundColor: "var(--yh-surface-raised)",
                        borderColor: "var(--yh-border-subtle)",
                        borderRadius: "var(--yh-radius-md)",
                        color: "var(--yh-ink)",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Category Breakdown Ranked List */}
            <Card className="p-5 border-border-subtle bg-surface flex flex-col">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-base font-bold text-ink">Category Breakdown</CardTitle>
                <CardDescription className="text-xs text-ink-muted">
                  Ranked by total expense volume
                </CardDescription>
              </CardHeader>
              <div className="space-y-3 overflow-y-auto max-h-64 pr-1">
                {analysis.categoryGroups.map((cat, idx) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-2 rounded-[var(--yh-radius-md)] bg-surface-muted/50 border border-border-subtle"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        aria-hidden="true"
                      />
                      <CategoryIcon
                        iconName={cat.icon}
                        className="h-4 w-4 text-ink-muted shrink-0"
                      />
                      <span className="text-xs font-bold text-ink truncate">
                        {getCategoryLabel(cat.id)}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-ink">{formatINR(cat.total, 2)}</p>
                      <p className="text-[10px] text-ink-muted">
                        {cat.percentage}% ({cat.count} tx)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Expenses List / Table Section */}
        <Card className="border-border-subtle bg-surface overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-ink">Expense Transactions</h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Showing {filteredList.length} recorded item{filteredList.length === 1 ? "" : "s"}
              </p>
            </div>
            {refreshing && (
              <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                <Spinner size="sm" />
                <span>Updating...</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : filteredList.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Vendor & Notes</TableHead>
                      <TableHead>Tour</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredList.map((exp) => (
                      <TableRow key={exp._id || exp.id}>
                        <TableCell className="font-semibold text-xs whitespace-nowrap text-ink-muted">
                          {exp.date}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <CategoryIcon
                              iconName={EXPENSE_CATEGORY_MAP[exp.category]?.icon}
                              className="h-3.5 w-3.5 text-ink-muted"
                            />
                            <span className="text-xs font-bold text-ink">
                              {getCategoryLabel(exp.category)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="text-xs font-bold text-ink truncate">{exp.vendor || "—"}</p>
                          {(exp.note || exp.description) && (
                            <p className="text-[11px] text-ink-muted truncate">
                              {exp.note || exp.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-ink truncate max-w-[140px] block">
                            {exp.tourLabel || exp.tourRef || "General"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-ink-muted uppercase">
                          {exp.paymentMode}
                        </TableCell>
                        <TableCell>
                          <StatusPill
                            status={exp.status === "paid" ? "confirmed" : "pending"}
                            label={exp.status === "paid" ? "Paid" : "Pending"}
                          />
                        </TableCell>
                        <TableCell className="text-right font-black text-sm text-status-danger whitespace-nowrap">
                          {formatINR(exp.amount, 2)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton
                              variant="ghost"
                              size="sm"
                              aria-label={`Add similar expense to ${getCategoryLabel(exp.category)}`}
                              onClick={() => handleAddSimilar(exp)}
                            >
                              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                            </IconButton>
                            <IconButton
                              variant="ghost"
                              size="sm"
                              aria-label={`Edit expense ${getCategoryLabel(exp.category)}`}
                              onClick={() => handleEditExpense(exp)}
                            >
                              <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </IconButton>
                            <IconButton
                              variant="ghost"
                              size="sm"
                              aria-label={`Delete expense ${getCategoryLabel(exp.category)}`}
                              onClick={() => setDeletingExpense(exp)}
                              className="text-status-danger hover:bg-status-danger/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </IconButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Stacked Card View */}
              <div className="md:hidden divide-y divide-border-subtle">
                {filteredList.map((exp) => (
                  <div key={exp._id || exp.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CategoryIcon
                          iconName={EXPENSE_CATEGORY_MAP[exp.category]?.icon}
                          className="h-4 w-4 text-brand"
                        />
                        <span className="text-sm font-bold text-ink">
                          {getCategoryLabel(exp.category)}
                        </span>
                      </div>
                      <p className="text-base font-black text-status-danger">
                        {formatINR(exp.amount, 2)}
                      </p>
                    </div>

                    <div className="text-xs space-y-1">
                      {exp.vendor && (
                        <p className="text-ink font-semibold">Vendor: {exp.vendor}</p>
                      )}
                      {(exp.note || exp.description) && (
                        <p className="text-ink-muted">{exp.note || exp.description}</p>
                      )}
                      <p className="text-ink-muted">
                        Tour: <span className="font-medium text-ink">{exp.tourLabel || exp.tourRef || "General"}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50 text-xs">
                      <div className="flex items-center gap-2">
                        <StatusPill
                          status={exp.status === "paid" ? "confirmed" : "pending"}
                          label={exp.status === "paid" ? "Paid" : "Pending"}
                        />
                        <span className="text-ink-muted uppercase font-bold text-[10px]">
                          {exp.paymentMode}
                        </span>
                        <span className="text-ink-muted text-[11px]">{exp.date}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <IconButton
                          variant="ghost"
                          size="sm"
                          aria-label="Add similar"
                          onClick={() => handleAddSimilar(exp)}
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          aria-label="Edit"
                          onClick={() => handleEditExpense(exp)}
                        >
                          <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          aria-label="Delete"
                          onClick={() => setDeletingExpense(exp)}
                          className="text-status-danger hover:bg-status-danger/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-10">
              <EmptyState
                icon={<ReceiptText className="h-6 w-6" aria-hidden="true" />}
                title="No expenses recorded"
                description={
                  expenseList.length > 0 && activeFilterCount > 0
                    ? "No expenses matched the active filters. Try resetting the filters or modifying your search."
                    : "Track coach operations, fuel, toll, driver allowance, and vendor costs with ease."
                }
                action={
                  expenseList.length > 0 && activeFilterCount > 0 ? (
                    <Button variant="outline" size="sm" onClick={handleClearFilters}>
                      Clear Filters
                    </Button>
                  ) : (
                    <Button variant="accent" size="sm" onClick={handleOpenAddModal} className="gap-2">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      <span>Add First Expense</span>
                    </Button>
                  )
                }
              />
            </div>
          )}
        </Card>

        {/* Add / Edit Expense Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingExpenseId ? "Edit Expense" : "Add Expense"}
          description="Record a coach operation cost, fuel refill, bhatta, or supplier payment."
        >
          <form onSubmit={handleSaveExpense} noValidate aria-label="Expense form" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Date"
                required
                error={formErrors.date}
                htmlFor="expense-input-date"
              >
                <Input
                  id="expense-input-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  hasError={Boolean(formErrors.date)}
                  required
                />
              </Field>

              <Field
                label="Amount (₹)"
                required
                error={formErrors.amount}
                htmlFor="expense-input-amount"
              >
                <Input
                  id="expense-input-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="10000000"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  hasError={Boolean(formErrors.amount)}
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Category"
                required
                error={formErrors.category}
                htmlFor="expense-input-category"
              >
                <Select
                  id="expense-input-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  hasError={Boolean(formErrors.category)}
                  required
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {getCategoryLabel(cat.id)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Related Tour (Optional)"
                htmlFor="expense-input-tour"
              >
                <Select
                  id="expense-input-tour"
                  value={formData.tourName || formData.tourRef}
                  onChange={(e) => {
                    const val = e.target.value
                    setFormData({
                      ...formData,
                      tourName: val,
                      departureKey: "",
                      tourRef: val || "",
                      tourLabel: val || "General",
                    })
                  }}
                >
                  <option value="">General Expense (Unlinked)</option>
                  {availableTours.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {formData.tourName && availableDepartures.length > 0 && (
              <Field
                label="Specific Departure (Optional)"
                htmlFor="expense-input-departure"
              >
                <Select
                  id="expense-input-departure"
                  value={formData.departureKey}
                  onChange={(e) => {
                    const val = e.target.value
                    const dep = availableDepartures.find((d) => d.key === val)
                    setFormData({
                      ...formData,
                      departureKey: val,
                      tourRef: val || formData.tourName,
                      tourLabel: dep ? `${formData.tourName} (${dep.dateStr})` : formData.tourName,
                    })
                  }}
                >
                  <option value="">Entire Tour (All Departures)</option>
                  {availableDepartures.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Vendor / Payee (Optional)"
                error={formErrors.vendor}
                htmlFor="expense-input-vendor"
              >
                <Input
                  id="expense-input-vendor"
                  type="text"
                  maxLength={80}
                  placeholder="e.g. Bharat Petroleum, Royal Hotel"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  hasError={Boolean(formErrors.vendor)}
                />
              </Field>

              <Field
                label="Payment Mode"
                htmlFor="expense-input-mode"
              >
                <Select
                  id="expense-input-mode"
                  value={formData.paymentMode}
                  onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                >
                  {EXPENSE_PAYMENT_MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {getPaymentModeLabel(m.id)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Payment Status"
                htmlFor="expense-input-status"
              >
                <Select
                  id="expense-input-status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                </Select>
              </Field>
            </div>

            <Field
              label="Note / Details (Optional)"
              error={formErrors.note}
              htmlFor="expense-input-note"
            >
              <Textarea
                id="expense-input-note"
                rows={3}
                maxLength={300}
                placeholder="Voucher or invoice number, receipt notes, bus plate number..."
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                hasError={Boolean(formErrors.note)}
              />
            </Field>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="accent"
                disabled={isSubmitting}
                className="gap-2"
              >
                {isSubmitting && <Spinner size="sm" />}
                <span>{editingExpenseId ? "Update Expense" : "Save Expense"}</span>
              </Button>
            </div>
          </form>
        </Modal>

        {/* Delete ConfirmDialog */}
        <ConfirmDialog
          isOpen={Boolean(deletingExpense)}
          onClose={() => setDeletingExpense(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Expense?"
          message={`Are you sure you want to remove this ${
            EXPENSE_CATEGORY_MAP[deletingExpense?.category]?.label || "expense"
          } of ${formatINR(deletingExpense?.amount || 0, 2)}? It can be recovered from audit logs if needed.`}
          confirmText={isDeleting ? "Deleting..." : "Delete Expense"}
          cancelText="Cancel"
          isDestructive={true}
        />
      </div>
    </PanelErrorBoundary>
  )
}
