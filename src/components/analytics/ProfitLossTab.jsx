import { useState, useMemo, useEffect, useCallback } from "react"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Filter,
  BarChart2,
  Table as TableIcon,
  HelpCircle,
  Eye,
  Calendar,
  Bus,
  RefreshCw,
  Users,
  CheckCircle,
  Clock,
  Layers,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import {
  StatCard,
  Select,
  Input,
  Field,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  StatusPill,
  Button,
  IconButton,
  Drawer,
  EmptyState,
  Spinner,
} from "../ui/index"
import { PanelErrorBoundary } from "../common/PanelErrorBoundary"
import { formatINR } from "../../utils/formatters"
import { downloadCsv } from "../../utils/csv"
import { calculateProfitLoss, toDateKey } from "../../../shared/profitLoss"
import { EXPENSE_CATEGORY_MAP } from "../../../shared/expenses"
import { getTourPnl } from "../../data/reports"
import { listExpenses } from "../../data/expenses"

export default function ProfitLossTab({ bookings = [], tours = [] }) {
  // Filters state
  const [dateRangeKey, setDateRangeKey] = useState("this_fy")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [selectedTour, setSelectedTour] = useState("all")
  const [groupBy, setGroupBy] = useState("tour") // "tour" | "departure"
  const [chartViewMode, setChartViewMode] = useState("chart") // "chart" | "table"

  // Sorting
  const [sortField, setSortField] = useState("bookedRevenue")
  const [sortOrder, setSortOrder] = useState("desc")

  // Drawer detail state
  const [selectedItem, setSelectedItem] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Data fetching state
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(false)
  const [apiReport, setApiReport] = useState(null)

  // Compute active date boundaries
  const activeDates = useMemo(() => {
    const today = new Date()
    const y = today.getFullYear()
    const m = today.getMonth()

    if (dateRangeKey === "custom") {
      return { from: customFrom || undefined, to: customTo || undefined }
    }
    if (dateRangeKey === "this_month") {
      const start = new Date(y, m, 1)
      const end = new Date(y, m + 1, 0)
      return { from: toDateKey(start), to: toDateKey(end) }
    }
    if (dateRangeKey === "last_month") {
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 0)
      return { from: toDateKey(start), to: toDateKey(end) }
    }
    if (dateRangeKey === "this_fy") {
      const fyStartYear = m >= 3 ? y : y - 1
      return {
        from: `${fyStartYear}-04-01`,
        to: `${fyStartYear + 1}-03-31`,
      }
    }
    return { from: undefined, to: undefined }
  }, [dateRangeKey, customFrom, customTo])

  // Fetch server P&L or expenses
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Attempt server authoritative report first
      const pnlData = await getTourPnl({
        from: activeDates.from,
        to: activeDates.to,
        tourName: selectedTour !== "all" ? selectedTour : undefined,
        groupBy,
      })

      if (pnlData && pnlData.success && pnlData.summary) {
        setApiReport(pnlData)
      } else {
        // Fallback to local expenses
        const expData = await listExpenses({ limit: 100 })
        setExpenses(expData.expenses || [])
        setApiReport(null)
      }
    } catch {
      // Graceful fallback to client-side calculation
      try {
        const expData = await listExpenses({ limit: 100 })
        setExpenses(expData.expenses || [])
      } catch {
        // Client without network will calculate with empty or provided expenses
      }
      setApiReport(null)
    } finally {
      setLoading(false)
    }
  }, [activeDates, selectedTour, groupBy])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Pure P&L report generation (uses API report if available, else shared client engine)
  const report = useMemo(() => {
    if (apiReport && apiReport.summary) {
      return apiReport
    }
    return calculateProfitLoss({
      bookings,
      expenses,
      filters: {
        from: activeDates.from,
        to: activeDates.to,
        tourName: selectedTour !== "all" ? selectedTour : undefined,
        groupBy,
      },
    })
  }, [apiReport, bookings, expenses, activeDates, selectedTour, groupBy])

  // Unique tours for filter dropdown
  const uniqueTours = useMemo(() => {
    const set = new Set()
    for (const b of bookings || []) {
      if (b.tourName) set.add(b.tourName)
    }
    for (const t of tours || []) {
      if (t.name) set.add(t.name)
    }
    return Array.from(set).sort()
  }, [bookings, tours])

  // Active items according to groupBy
  const rawItems = groupBy === "tour" ? report.tours : report.departures

  // Sorted items
  const sortedItems = useMemo(() => {
    const list = [...rawItems]
    list.sort((a, b) => {
      let valA = a[sortField]
      let valB = b[sortField]

      if (valA === null || valA === undefined) valA = -Infinity
      if (valB === null || valB === undefined) valB = -Infinity

      if (typeof valA === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA)
      }

      return sortOrder === "asc" ? valA - valB : valB - valA
    })
    return list
  }, [rawItems, sortField, sortOrder])

  // Handle column sort toggle
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortOrder("desc")
    }
  }

  // Open drawer for item details
  const handleOpenDrawer = (item) => {
    setSelectedItem(item)
    setIsDrawerOpen(true)
  }

  // CSV Export of current visible table
  const handleExportCsv = () => {
    const headers = [
      groupBy === "tour" ? "Tour Name" : "Departure Key",
      "Date",
      "Passengers",
      "Capacity",
      "Occupancy %",
      "Booked Revenue (INR)",
      "Collected (INR)",
      "Outstanding (INR)",
      "Expenses Total (INR)",
      "Expenses Paid (INR)",
      "Expenses Pending (INR)",
      "Profit Booked (INR)",
      "Operating Margin %",
      "Avg Ticket Price (INR)",
      "Cost Per Pax (INR)",
      "Break-Even Seats",
    ]

    const rows = sortedItems.map((item) => [
      groupBy === "tour" ? item.tourName : item.departureKey,
      item.dateStr || "N/A",
      item.passengers,
      item.capacity || "N/A",
      item.occupancyPercent !== null ? `${item.occupancyPercent}%` : "N/A",
      item.bookedRevenue,
      item.collected,
      item.outstanding,
      item.expensesTotal,
      item.expensesPaid,
      item.expensesPending,
      item.profitBooked,
      item.marginPercent !== null ? `${item.marginPercent}%` : "N/A",
      item.avgTicketPrice,
      item.costPerPassenger !== null ? item.costPerPassenger : "N/A",
      item.breakEvenSeats !== null ? item.breakEvenSeats : "N/A",
    ])

    const filename = `yatrahub-profit-loss-${groupBy}-${new Date().toISOString().slice(0, 10)}.csv`
    downloadCsv(filename, [headers, ...rows])
  }

  // Bar chart dataset
  const chartData = useMemo(() => {
    return sortedItems.slice(0, 12).map((item) => ({
      name:
        groupBy === "tour"
          ? item.tourName
          : `${item.tourName} (${item.dateStr || ""})`,
      revenue: item.bookedRevenue,
      expenses: item.expensesTotal,
      profit: item.profitBooked,
    }))
  }, [sortedItems, groupBy])

  const summary = report.summary || {}
  const isOverallNetLoss = (summary.overallBusinessProfitBooked || 0) < 0

  return (
    <PanelErrorBoundary resetKey={`${groupBy}-${dateRangeKey}`} title="Profit & Loss Panel Error">
      <div className="space-y-6">
        {/* Header Toolbar & Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-(--yh-text-primary) flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-(--yh-brand)" />
              Tour & Departure Profit / Loss
            </h2>
            <p className="text-xs text-(--yh-text-muted)">
              Accrual (Booked) and Cash-basis operating margins with break-even analysis
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              disabled={sortedItems.length === 0}
              icon={<Download className="w-4 h-4" />}
            >
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadData}
              disabled={loading}
              icon={<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <Card elevation="sm" padding="md" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Date Range" htmlFor="pnl-date-range">
              <Select
                id="pnl-date-range"
                size="sm"
                value={dateRangeKey}
                onChange={(e) => setDateRangeKey(e.target.value)}
              >
                <option value="this_fy">This Financial Year (FY {new Date().getFullYear()})</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="all">All Time</option>
                <option value="custom">Custom Date Range</option>
              </Select>
            </Field>

            <Field label="Filter Tour" htmlFor="pnl-tour-filter">
              <Select
                id="pnl-tour-filter"
                size="sm"
                value={selectedTour}
                onChange={(e) => setSelectedTour(e.target.value)}
              >
                <option value="all">All Tours & Departures</option>
                {uniqueTours.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="general">General (Unlinked Expenses)</option>
              </Select>
            </Field>

            <Field label="Group Analysis By" htmlFor="pnl-group-by">
              <Select
                id="pnl-group-by"
                size="sm"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
              >
                <option value="tour">By Tour (Aggregated)</option>
                <option value="departure">By Coach Departure (Trip-wise)</option>
              </Select>
            </Field>

            {dateRangeKey === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="From Date" htmlFor="pnl-custom-from">
                  <Input
                    id="pnl-custom-from"
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </Field>
                <Field label="To Date" htmlFor="pnl-custom-to">
                  <Input
                    id="pnl-custom-to"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>
        </Card>

        {/* 4 Primary Financial KPI StatCards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Booked Revenue"
            value={formatINR(summary.bookedRevenue || 0, 2)}
            hint="Gross ticket sales (Accrual)"
            tone="accent"
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard
            label="Cash Collected"
            value={formatINR(summary.collected || 0, 2)}
            hint={`Outstanding: ${formatINR(summary.outstanding || 0, 2)}`}
            tone="success"
            icon={<DollarSign className="w-5 h-5" />}
          />
          <StatCard
            label="Total Expenses"
            value={formatINR(summary.allExpensesTotal || 0, 2)}
            hint={`Paid: ${formatINR(summary.allExpensesPaid || 0, 2)} • Pending: ${formatINR(summary.allExpensesPending || 0, 2)}`}
            tone="warning"
            icon={<Calendar className="w-5 h-5" />}
          />
          <StatCard
            label={isOverallNetLoss ? "Overall Net Loss" : "Overall Net Profit"}
            value={formatINR(summary.overallBusinessProfitBooked || 0, 2)}
            hint={
              isOverallNetLoss
                ? `Net Loss (${summary.overallBusinessMarginPercent ?? 0}% margin)`
                : `Margin: ${summary.overallBusinessMarginPercent ?? 0}% • Cash: ${formatINR(summary.overallBusinessProfitCash || 0, 2)}`
            }
            tone={isOverallNetLoss ? "danger" : "accent"}
            icon={isOverallNetLoss ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
          />
        </div>

        {/* Recharts Bar Chart: Revenue vs Expenses with Table Alternative */}
        <Card elevation="sm" padding="md" className="space-y-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-bold text-(--yh-text-primary) flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-(--yh-brand)" />
                {groupBy === "tour" ? "Tour Revenue vs Expenses" : "Departure Revenue vs Expenses"}
              </CardTitle>
              <CardDescription className="text-xs text-(--yh-text-muted)">
                Comparative financial breakdown per {groupBy}
              </CardDescription>
            </div>

            <div className="flex items-center gap-1 bg-(--yh-surface-muted) p-1 rounded-lg border border-(--yh-border-subtle)">
              <button
                type="button"
                onClick={() => setChartViewMode("chart")}
                className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                  chartViewMode === "chart"
                    ? "bg-(--yh-surface) text-(--yh-text-primary) shadow-sm"
                    : "text-(--yh-text-muted) hover:text-(--yh-text-primary)"
                }`}
                aria-pressed={chartViewMode === "chart"}
                aria-label="View as chart"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chart</span>
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode("table")}
                className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                  chartViewMode === "table"
                    ? "bg-(--yh-surface) text-(--yh-text-primary) shadow-sm"
                    : "text-(--yh-text-muted) hover:text-(--yh-text-primary)"
                }`}
                aria-pressed={chartViewMode === "table"}
                aria-label="View as table"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </CardHeader>

          <CardContent>
            {chartViewMode === "chart" ? (
              <div
                className="w-full h-72"
                role="region"
                aria-label="Revenue and expenses comparison chart"
              >
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `₹${Number(v) / 1000}k`}
                      />
                      <RechartsTooltip
                        formatter={(val) => formatINR(val, 2)}
                        contentStyle={{
                          backgroundColor: "var(--yh-surface)",
                          borderColor: "var(--yh-border-subtle)",
                          borderRadius: "var(--yh-radius-md)",
                          fontSize: "12px",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="revenue" fill="var(--yh-brand, #4f46e5)" name="Revenue" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" fill="var(--yh-color-danger, #ef4444)" name="Expenses" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" fill="var(--yh-color-success, #10b981)" name="Profit" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    title="No data to plot"
                    description="Record bookings and expenses to view comparative financial charts."
                  />
                )}
              </div>
            ) : (
              /* Accessible Data-Table Alternative */
              <div className="overflow-x-auto">
                <Table>
                  <caption className="sr-only">Revenue, Expenses and Net Profit per {groupBy}</caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{groupBy === "tour" ? "Tour" : "Departure"}</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Expenses</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chartData.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-ink">{row.name}</TableCell>
                        <TableCell className="text-right">{formatINR(row.revenue, 2)}</TableCell>
                        <TableCell className="text-right text-(--yh-color-danger)">
                          {formatINR(row.expenses, 2)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-bold ${
                            row.profit >= 0 ? "text-(--yh-color-success)" : "text-(--yh-color-danger)"
                          }`}
                        >
                          {formatINR(row.profit, 2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Profit/Loss Table */}
        <Card elevation="sm" padding="none" className="overflow-hidden">
          <div className="p-4 border-b border-(--yh-border-subtle) flex items-center justify-between">
            <h3 className="text-sm font-bold text-(--yh-text-primary)">
              {groupBy === "tour" ? "Tour Performance Breakdown" : "Departure Performance Breakdown"} ({sortedItems.length})
            </h3>
            <span className="text-xs text-(--yh-text-muted)">
              Click any row or &apos;Details&apos; to view ledger
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => handleSort(groupBy === "tour" ? "tourName" : "departureKey")}
                      className="font-bold text-left hover:text-(--yh-brand) transition-colors"
                    >
                      {groupBy === "tour" ? "Tour" : "Departure / Bus"}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">PAX / Cap</TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("bookedRevenue")}
                      className="font-bold hover:text-(--yh-brand) transition-colors"
                    >
                      Booked Revenue
                    </button>
                  </TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("expensesTotal")}
                      className="font-bold hover:text-(--yh-brand) transition-colors"
                    >
                      Expenses
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("profitBooked")}
                      className="font-bold hover:text-(--yh-brand) transition-colors"
                    >
                      Net Profit (Margin)
                    </button>
                  </TableHead>
                  <TableHead className="text-right">Break-Even</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {sortedItems.map((item, idx) => {
                  const isLoss = (item.profitBooked || 0) < 0
                  return (
                    <TableRow
                      key={idx}
                      className="cursor-pointer hover:bg-(--yh-surface-hover) transition-colors"
                      onClick={() => handleOpenDrawer(item)}
                    >
                      <TableCell>
                        <div className="font-bold text-sm text-(--yh-text-primary)">
                          {item.tourName}
                        </div>
                        {item.dateStr && (
                          <div className="text-xs text-(--yh-text-muted) flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {item.dateStr} • {item.busType || "2x1 Luxury"}
                          </div>
                        )}
                        {item.departuresCount !== undefined && (
                          <div className="text-xs text-(--yh-text-muted) mt-0.5">
                            {item.departuresCount} coach departure(s)
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-right tabular-nums text-xs">
                        <span className="font-semibold text-ink">{item.passengers}</span>
                        {item.capacity ? (
                          <span className="text-(--yh-text-muted)"> / {item.capacity}</span>
                        ) : null}
                        {item.occupancyPercent !== null && (
                          <div className="text-[11px] text-(--yh-text-muted)">
                            {item.occupancyPercent}% occ
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-right tabular-nums font-semibold text-ink">
                        {formatINR(item.bookedRevenue, 2)}
                      </TableCell>

                      <TableCell className="text-right tabular-nums text-xs">
                        <div className="font-medium text-success-text">
                          {formatINR(item.collected, 2)}
                        </div>
                        {item.outstanding > 0 && (
                          <div className="text-[10px] text-warning-text">
                            Due: {formatINR(item.outstanding, 2)}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-right tabular-nums text-xs">
                        <div className="font-semibold text-(--yh-color-danger)">
                          {formatINR(item.expensesTotal, 2)}
                        </div>
                        <div className="text-[10px] text-(--yh-text-muted)">
                          Paid: {formatINR(item.expensesPaid, 2)}
                        </div>
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        <div
                          className={`font-bold text-sm ${
                            isLoss ? "text-danger-text" : "text-success-text"
                          }`}
                        >
                          {formatINR(item.profitBooked, 2)}
                        </div>
                        {item.marginPercent !== null && (
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isLoss
                                ? "bg-danger-soft text-danger-text"
                                : "bg-success-soft text-success-text"
                            }`}
                          >
                            {isLoss ? `Loss ${item.marginPercent}%` : `${item.marginPercent}% margin`}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right tabular-nums text-xs">
                        {item.breakEvenSeats !== null ? (
                          <>
                            <div className="font-medium text-ink">
                              {item.breakEvenSeats} seats
                            </div>
                            {item.seatsToBreakEvenRemaining !== null && (
                              <div className="text-[10px] text-(--yh-text-muted)">
                                {item.seatsToBreakEvenRemaining > 0
                                  ? `${item.seatsToBreakEvenRemaining} needed`
                                  : "Achieved"}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-(--yh-text-muted)">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => handleOpenDrawer(item)}
                          icon={<Eye className="w-3.5 h-3.5" />}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}

                {sortedItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-(--yh-text-muted)">
                      No financial data matching the current filter range.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Stacked Cards View (<md) */}
          <div className="block md:hidden divide-y divide-(--yh-border-subtle)">
            {sortedItems.map((item, idx) => {
              const isLoss = (item.profitBooked || 0) < 0
              return (
                <div
                  key={idx}
                  role="button"
                  tabIndex={0}
                  className="p-4 space-y-3 cursor-pointer hover:bg-(--yh-surface-hover) focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring transition-colors"
                  onClick={() => handleOpenDrawer(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      handleOpenDrawer(item)
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-(--yh-text-primary)">
                        {item.tourName}
                      </h4>
                      {item.dateStr && (
                        <p className="text-xs text-(--yh-text-muted)">
                          {item.dateStr} • {item.busType}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        isLoss ? "text-danger-text" : "text-success-text"
                      }`}
                    >
                      {formatINR(item.profitBooked, 2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-(--yh-surface-muted)">
                      <span className="text-[10px] uppercase font-bold text-(--yh-text-muted) block">
                        Revenue
                      </span>
                      <span className="font-semibold text-ink">
                        {formatINR(item.bookedRevenue, 0)}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-(--yh-surface-muted)">
                      <span className="text-[10px] uppercase font-bold text-(--yh-text-muted) block">
                        Expenses
                      </span>
                      <span className="font-semibold text-(--yh-color-danger)">
                        {formatINR(item.expensesTotal, 0)}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-(--yh-surface-muted)">
                      <span className="text-[10px] uppercase font-bold text-(--yh-text-muted) block">
                        Margin
                      </span>
                      <span className={`font-semibold ${isLoss ? "text-danger-text" : "text-success-text"}`}>
                        {item.marginPercent !== null ? `${item.marginPercent}%` : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-(--yh-text-muted) pt-1">
                    <span>
                      Seats: <strong className="text-ink">{item.passengers}</strong>
                      {item.capacity ? ` / ${item.capacity}` : ""}
                    </span>
                    <Button size="xs" variant="outline" onClick={() => handleOpenDrawer(item)}>
                      View Ledger
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* General Expenses Bucket (Unallocated Overhead) */}
        {report.generalExpenses && report.generalExpenses.length > 0 && (
          <Card elevation="sm" padding="md" className="border-l-4 border-l-(--yh-brand)">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-(--yh-text-primary) flex items-center gap-2">
                  <Layers className="w-4 h-4 text-(--yh-brand)" />
                  General & Administrative Overhead
                </h3>
                <p className="text-xs text-(--yh-text-muted)">
                  Expenses not assigned to a specific tour or departure (deducted in overall business profit)
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span>
                  Total General Expenses:{" "}
                  <strong className="text-(--yh-color-danger) tabular-nums">
                    {formatINR(summary.generalExpensesTotal || 0, 2)}
                  </strong>
                </span>
                <Badge variant="outline" size="sm">
                  {report.generalExpenses.length} Records
                </Badge>
              </div>
            </div>
          </Card>
        )}

        {/* Accrual vs Cash Help Text Card */}
        <Card elevation="none" padding="sm" className="bg-(--yh-surface-muted) text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-(--yh-text-primary)">
            <HelpCircle className="w-3.5 h-3.5 text-(--yh-brand)" />
            Understanding Booked (Accrual) vs Cash Accounting
          </div>
          <p className="text-(--yh-text-muted) leading-relaxed">
            <strong>Booked Profit:</strong> Revenue from all confirmed bookings plus retained cancellation charges minus total expenses incurred (both paid and pending). This reflects true operational profitability.
            <br />
            <strong>Cash Profit:</strong> Actual payments collected into your bank/cash register minus payments already disbursed for expenses.
          </p>
        </Card>

        {/* Slide-over Ledger Drawer */}
        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          title={
            <div className="space-y-1">
              <div className="font-bold text-base text-ink">
                {selectedItem?.tourName || "Departure"} Financial Ledger
              </div>
              <div className="text-xs text-ink-muted">
                {selectedItem?.dateStr
                  ? `Departure Date: ${selectedItem.dateStr} • ${selectedItem.busType}`
                  : "Consolidated Tour Financials"}
              </div>
            </div>
          }
        >
          {selectedItem && (
            <div className="space-y-6 p-4">
              {/* Drawer Top Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-lg bg-(--yh-surface-muted)">
                  <span className="text-[10px] uppercase font-bold text-(--yh-text-muted) block">
                    Booked Revenue
                  </span>
                  <span className="text-base font-bold text-ink">
                    {formatINR(selectedItem.bookedRevenue, 2)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-(--yh-surface-muted)">
                  <span className="text-[10px] uppercase font-bold text-(--yh-text-muted) block">
                    Expenses Incurred
                  </span>
                  <span className="text-base font-bold text-(--yh-color-danger)">
                    {formatINR(selectedItem.expensesTotal, 2)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-(--yh-surface-muted)">
                  <span className="text-[10px] uppercase font-bold text-(--yh-text-muted) block">
                    Cash Collected
                  </span>
                  <span className="text-base font-bold text-success-text">
                    {formatINR(selectedItem.collected, 2)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-(--yh-surface-muted)">
                  <span className="text-[10px] uppercase font-bold text-(--yh-text-muted) block">
                    Net Profit (Margin)
                  </span>
                  <span
                    className={`text-base font-bold ${
                      (selectedItem.profitBooked || 0) >= 0 ? "text-success-text" : "text-danger-text"
                    }`}
                  >
                    {formatINR(selectedItem.profitBooked, 2)} (
                    {selectedItem.marginPercent !== null ? `${selectedItem.marginPercent}%` : "—"})
                  </span>
                </div>
              </div>

              {/* Unit Economics Card */}
              <Card elevation="sm" padding="sm" className="space-y-2 text-xs">
                <h4 className="font-bold text-ink">Unit Economics</h4>
                <div className="grid grid-cols-2 gap-2 text-ink-muted">
                  <div>Avg Ticket: <strong className="text-ink">{formatINR(selectedItem.avgTicketPrice, 2)}</strong></div>
                  <div>Cost / Pax: <strong className="text-ink">{selectedItem.costPerPassenger !== null ? formatINR(selectedItem.costPerPassenger, 2) : "—"}</strong></div>
                  <div>Break-Even: <strong className="text-ink">{selectedItem.breakEvenSeats !== null ? `${selectedItem.breakEvenSeats} seats` : "—"}</strong></div>
                  <div>Seats to Break-Even: <strong className="text-ink">{selectedItem.seatsToBreakEvenRemaining !== null ? selectedItem.seatsToBreakEvenRemaining : "—"}</strong></div>
                </div>
              </Card>

              {/* Income Ledger (Bookings) - STRICT NO PII */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-ink flex items-center justify-between">
                  <span>Income Lines ({selectedItem.bookings?.length || 0})</span>
                  <span className="text-xs text-ink-muted font-normal">No PII exposed</span>
                </h4>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-(--yh-border-subtle)">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead className="text-right">PAX</TableHead>
                        <TableHead className="text-right">Booked</TableHead>
                        <TableHead className="text-right">Advance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedItem.bookings || []).map((b, bIdx) => (
                        <TableRow key={bIdx}>
                          <TableCell className="font-medium text-ink">{b.invoiceNo}</TableCell>
                          <TableCell className="text-right">{b.paxCount || (b.passengers || []).length || 1}</TableCell>
                          <TableCell className="text-right">{formatINR(b.totalAmount, 0)}</TableCell>
                          <TableCell className="text-right text-success-text">{formatINR(b.advanceReceived, 0)}</TableCell>
                        </TableRow>
                      ))}
                      {(selectedItem.bookings || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-4 text-ink-muted">
                            No booking income recorded for this selection.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Expense Ledger */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-ink flex items-center justify-between">
                  <span>Expense Lines ({selectedItem.expenses?.length || 0})</span>
                  <span className="text-xs text-(--yh-color-danger) font-semibold">
                    {formatINR(selectedItem.expensesTotal, 2)}
                  </span>
                </h4>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-(--yh-border-subtle)">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category / Payee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedItem.expenses || []).map((e, eIdx) => {
                        const cat = EXPENSE_CATEGORY_MAP[e.category]
                        return (
                          <TableRow key={eIdx}>
                            <TableCell>
                              <div className="font-semibold text-xs text-ink">{cat?.label || e.category}</div>
                              {e.vendor && <div className="text-[10px] text-ink-muted">{e.vendor}</div>}
                            </TableCell>
                            <TableCell>
                              <StatusPill status={e.status === "paid" ? "Paid" : "Pending"} />
                            </TableCell>
                            <TableCell className="text-right font-bold text-xs text-(--yh-color-danger)">
                              {formatINR(e.amount, 2)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {(selectedItem.expenses || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-4 text-ink-muted">
                            No trip expenses recorded for this departure.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </Drawer>
      </div>
    </PanelErrorBoundary>
  )
}
