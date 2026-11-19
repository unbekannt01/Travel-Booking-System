import { useState, useMemo } from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import {
  TrendingUp,
  Users,
  Calendar,
  IndianRupee,
  PieChart as PieIcon,
  BarChart2,
} from "lucide-react"
import {
  StatCard,
  Select,
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
  EmptyState,
  Badge,
} from "./ui/index"
import { formatINR } from "../utils/formatters"

export default function TourAnalytics({ bookings = [] }) {
  const [timeRange, setTimeRange] = useState("all")
  const [selectedTour, setSelectedTour] = useState("all")

  const analytics = useMemo(() => {
    let filteredBookings = bookings

    if (selectedTour !== "all") {
      filteredBookings = filteredBookings.filter((b) => b.tourName === selectedTour)
    }

    if (timeRange !== "all") {
      const days = timeRange === "30days" ? 30 : 90
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)

      filteredBookings = filteredBookings.filter((b) => new Date(b.date || b.createdAt || b.journeyDate) >= cutoffDate)
    }

    const tourStats = {}

    filteredBookings.forEach((booking) => {
      const tName = booking.tourName || "Unassigned Tour"
      if (!tourStats[tName]) {
        tourStats[tName] = { bookings: 0, passengers: 0, revenue: 0 }
      }
      tourStats[tName].bookings += 1
      tourStats[tName].passengers += (booking.passengers || []).length
      tourStats[tName].revenue += Number(booking.totalAmount) || 0
    })

    const dateGroups = {}
    filteredBookings.forEach((booking) => {
      const rawDate = booking.journeyDate || booking.date
      const date = rawDate
        ? new Date(rawDate).toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
          })
        : "Unknown"

      if (!dateGroups[date]) {
        dateGroups[date] = { date, bookings: 0, revenue: 0, passengers: 0 }
      }
      dateGroups[date].bookings += 1
      dateGroups[date].revenue += Number(booking.totalAmount) || 0
      dateGroups[date].passengers += (booking.passengers || []).length
    })

    const timelineData = Object.values(dateGroups).sort((a, b) => new Date(a.date) - new Date(b.date))

    const paidCount = filteredBookings.filter((b) => (Number(b.totalAmount) || 0) <= (Number(b.advanceReceived) || 0)).length
    const pendingCount = filteredBookings.filter((b) => (Number(b.totalAmount) || 0) > (Number(b.advanceReceived) || 0)).length

    const totalRevenue = filteredBookings.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0)
    const totalPassengers = filteredBookings.reduce((sum, b) => sum + (b.passengers || []).length, 0)
    const totalBookings = filteredBookings.length
    const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0
    const pendingPayments = filteredBookings.reduce(
      (sum, b) => sum + Math.max(0, (Number(b.totalAmount) || 0) - (Number(b.advanceReceived) || 0)),
      0,
    )

    return {
      tourStats: Object.entries(tourStats)
        .map(([name, data]) => ({
          name,
          ...data,
          avgPassengers: data.bookings > 0 ? Math.round(data.passengers / data.bookings) : 0,
          avgRevenue: data.bookings > 0 ? Math.round(data.revenue / data.bookings) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue),
      timelineData,
      paymentStatus: { paid: paidCount, pending: pendingCount },
      totalRevenue,
      totalPassengers,
      totalBookings,
      averageBookingValue,
      pendingPayments,
    }
  }, [bookings, timeRange, selectedTour])

  const paymentChartData = useMemo(() => [
    { name: "Paid in Full", value: analytics.paymentStatus.paid },
    { name: "Pending Balance", value: analytics.paymentStatus.pending },
  ], [analytics.paymentStatus])

  const uniqueTourNames = useMemo(() => {
    return ["all", ...new Set(bookings.map((b) => b.tourName))].filter(Boolean)
  }, [bookings])

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp className="w-8 h-8 text-(--yh-text-muted)" />}
        title="No analytics data available"
        description="Booking records, passenger trends, and revenue metrics will automatically appear here once bookings are recorded."
      />
    )
  }

  // Custom tooltip styling using CSS custom properties for dark/light theme compatibility
  const tooltipContentStyle = {
    backgroundColor: "var(--yh-surface)",
    borderColor: "var(--yh-border-subtle)",
    borderRadius: "var(--yh-radius-lg)",
    color: "var(--yh-text-primary)",
    boxShadow: "var(--yh-shadow-md)",
    padding: "8px 12px",
    fontSize: "12px",
  }

  return (
    <div className="space-y-6">
      {/* Top Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <p className="text-xs text-(--yh-text-muted) font-medium">
          Showing analytics for <strong className="text-(--yh-text-primary)">{analytics.totalBookings}</strong> bookings
        </p>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
          <div className="w-full sm:w-48">
            <Select
              size="sm"
              value={selectedTour}
              onChange={(e) => setSelectedTour(e.target.value)}
              aria-label="Filter by Tour"
            >
              <option value="all">All Destinations</option>
              {uniqueTourNames
                .filter((name) => name !== "all")
                .map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
            </Select>
          </div>
          <div className="w-full sm:w-40">
            <Select
              size="sm"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              aria-label="Filter by Time Range"
            >
              <option value="all">All Time</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={formatINR(analytics.totalRevenue)}
          hint={`${analytics.totalBookings} total bookings`}
          icon={<TrendingUp size={20} />}
          tone="brand"
        />
        <StatCard
          label="Total Bookings"
          value={String(analytics.totalBookings)}
          hint={`${formatINR(analytics.averageBookingValue, 0)} avg value`}
          icon={<Calendar size={20} />}
          tone="accent"
        />
        <StatCard
          label="Total Passengers"
          value={String(analytics.totalPassengers)}
          hint={`${analytics.totalBookings > 0 ? Math.round(analytics.totalPassengers / analytics.totalBookings) : 0} avg per booking`}
          icon={<Users size={20} />}
          tone="success"
        />
        <StatCard
          label="Pending Payments"
          value={formatINR(analytics.pendingPayments)}
          hint={`${analytics.paymentStatus.pending} unpaid bookings`}
          icon={<IndianRupee size={20} />}
          tone={analytics.pendingPayments > 0 ? "warning" : "brand"}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        {/* Revenue Timeline */}
        <Card elevation="sm" className="p-5 flex flex-col justify-between min-w-0" role="region" aria-label="Revenue Timeline Chart">
          <CardHeader className="pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={18} className="text-(--yh-brand)" />
                Revenue Timeline
              </CardTitle>
              <CardDescription>Daily revenue progression over journey dates</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4 min-w-0">
            {analytics.timelineData.length > 0 ? (
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--yh-border-subtle)" opacity={0.7} />
                    <XAxis
                      dataKey="date"
                      stroke="var(--yh-text-muted)"
                      tick={{ fill: "var(--yh-text-muted)", fontSize: 11 }}
                    />
                    <YAxis
                      stroke="var(--yh-text-muted)"
                      tick={{ fill: "var(--yh-text-muted)", fontSize: 11 }}
                      tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    />
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      formatter={(val) => [formatINR(val), "Revenue"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--yh-brand)"
                      strokeWidth={2.5}
                      dot={{ fill: "var(--yh-brand)", r: 4 }}
                      activeDot={{ r: 6, fill: "var(--yh-brand)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-sm text-(--yh-text-muted)">
                No timeline data for the selected period
              </div>
            )}
            {/* Screen Reader Summary */}
            <div className="sr-only">
              <table>
                <caption>Revenue Timeline Table</caption>
                <thead>
                  <tr><th>Date</th><th>Revenue</th><th>Bookings</th></tr>
                </thead>
                <tbody>
                  {analytics.timelineData.map((d, idx) => (
                    <tr key={idx}><td>{d.date}</td><td>{formatINR(d.revenue)}</td><td>{d.bookings}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Payment Status Breakdown */}
        <Card elevation="sm" className="p-5 flex flex-col justify-between min-w-0" role="region" aria-label="Payment Status Chart">
          <CardHeader className="pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PieIcon size={18} className="text-(--yh-brand)" />
                Payment Collection Status
              </CardTitle>
              <CardDescription>Paid in full vs outstanding balance</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4 min-w-0">
            {analytics.totalBookings > 0 ? (
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      <Cell fill="var(--yh-success)" />
                      <Cell fill="var(--yh-warning)" />
                    </Pie>
                    <Tooltip contentStyle={tooltipContentStyle} />
                    <Legend
                      formatter={(val) => <span className="text-xs text-(--yh-text-primary) font-medium">{val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-sm text-(--yh-text-muted)">
                No payment data available
              </div>
            )}
            <div className="sr-only">
              <table>
                <caption>Payment Status Summary</caption>
                <thead><tr><th>Status</th><th>Count</th></tr></thead>
                <tbody>
                  <tr><td>Paid</td><td>{analytics.paymentStatus.paid}</td></tr>
                  <tr><td>Pending</td><td>{analytics.paymentStatus.pending}</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Top Performing Destinations Bar Chart */}
        <Card elevation="sm" className="p-5 lg:col-span-2 min-w-0" role="region" aria-label="Destination Performance Chart">
          <CardHeader className="pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 size={18} className="text-(--yh-brand)" />
                Destination Performance Comparison
              </CardTitle>
              <CardDescription>Volume, passenger load, and revenue generated per tour</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4 min-w-0">
            {analytics.tourStats.length > 0 ? (
              <div className="w-full h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.tourStats} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--yh-border-subtle)" opacity={0.7} />
                    <XAxis
                      dataKey="name"
                      stroke="var(--yh-text-muted)"
                      tick={{ fill: "var(--yh-text-muted)", fontSize: 11 }}
                      interval={0}
                    />
                    <YAxis
                      stroke="var(--yh-text-muted)"
                      tick={{ fill: "var(--yh-text-muted)", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      formatter={(val, name) => [
                        name === "Revenue" ? formatINR(val) : val,
                        name,
                      ]}
                    />
                    <Legend
                      formatter={(val) => <span className="text-xs text-(--yh-text-primary) font-medium">{val}</span>}
                    />
                    <Bar dataKey="bookings" fill="var(--yh-brand)" name="Bookings" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="passengers" fill="var(--yh-success)" name="Passengers" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="revenue" fill="var(--yh-accent-warm)" name="Revenue" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-sm text-(--yh-text-muted)">
                No destination metrics available
              </div>
            )}
            <div className="sr-only">
              <table>
                <caption>Destination Metrics</caption>
                <thead>
                  <tr><th>Tour</th><th>Bookings</th><th>Passengers</th><th>Revenue</th></tr>
                </thead>
                <tbody>
                  {analytics.tourStats.map((t, idx) => (
                    <tr key={idx}><td>{t.name}</td><td>{t.bookings}</td><td>{t.passengers}</td><td>{formatINR(t.revenue)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Destination Performance Table */}
      <Card elevation="sm" className="rounded-2xl border-(--yh-border-subtle) overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-(--yh-border-subtle) flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-(--yh-text-primary)">
              Detailed Destination Breakdown
            </h3>
            <p className="text-xs text-(--yh-text-muted) mt-0.5">
              Aggregated tour performance and passenger statistics
            </p>
          </div>
          <Badge variant="neutral" size="sm">
            {analytics.tourStats.length} Destinations
          </Badge>
        </div>

        {/* Desktop Table View (md+) */}
        <div className="hidden md:block">
          <Table ariaLabel="Detailed Destination Performance Table">
            <TableHeader>
              <TableRow>
                <TableHead>Tour Name</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Passengers</TableHead>
                <TableHead className="text-right">Avg PAX / Trip</TableHead>
                <TableHead className="text-right">Total Revenue</TableHead>
                <TableHead className="text-right">Avg Booking Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.tourStats.map((tour, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-semibold text-(--yh-text-primary)">
                    {tour.name}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {tour.bookings}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {tour.passengers}
                  </TableCell>
                  <TableCell className="text-right text-(--yh-text-muted)">
                    {tour.avgPassengers} PAX
                  </TableCell>
                  <TableCell className="text-right font-bold text-(--yh-text-primary)">
                    {formatINR(tour.revenue)}
                  </TableCell>
                  <TableCell className="text-right text-(--yh-text-muted)">
                    {formatINR(tour.avgRevenue)}
                  </TableCell>
                </TableRow>
              ))}
              {analytics.tourStats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-(--yh-text-muted)">
                    No destination data available for the selected filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Stacked View (<md) */}
        <div className="block md:hidden divide-y divide-(--yh-border-subtle)">
          {analytics.tourStats.map((tour, idx) => (
            <div key={idx} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-sm text-(--yh-text-primary)">
                  {tour.name}
                </span>
                <span className="font-bold text-sm text-(--yh-brand)">
                  {formatINR(tour.revenue)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-(--yh-surface-muted)">
                  <span className="text-(--yh-text-muted) text-[10px] uppercase font-bold block">Bookings</span>
                  <span className="font-bold text-(--yh-text-primary)">{tour.bookings}</span>
                </div>
                <div className="p-2 rounded-lg bg-(--yh-surface-muted)">
                  <span className="text-(--yh-text-muted) text-[10px] uppercase font-bold block">PAX</span>
                  <span className="font-bold text-(--yh-text-primary)">{tour.passengers}</span>
                </div>
                <div className="p-2 rounded-lg bg-(--yh-surface-muted)">
                  <span className="text-(--yh-text-muted) text-[10px] uppercase font-bold block">Avg / Trip</span>
                  <span className="font-bold text-(--yh-text-primary)">{tour.avgPassengers}</span>
                </div>
              </div>
              <div className="text-xs text-(--yh-text-muted) flex items-center justify-between pt-1">
                <span>Avg Booking Value</span>
                <span className="font-medium text-(--yh-text-primary)">{formatINR(tour.avgRevenue)}</span>
              </div>
            </div>
          ))}
          {analytics.tourStats.length === 0 && (
            <div className="p-8 text-center text-sm text-(--yh-text-muted)">
              No destination data available for the selected filters
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
