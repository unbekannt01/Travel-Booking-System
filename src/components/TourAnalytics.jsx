/* eslint-disable no-unused-vars */
"use client"

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
import { TrendingUp, DollarSign, Users, Calendar } from "lucide-react"

export default function TourAnalytics({ bookings }) {
  const [timeRange, setTimeRange] = useState("all")
  const [expandedTour, setExpandedTour] = useState(null)
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

      filteredBookings = filteredBookings.filter((b) => new Date(b.date) >= cutoffDate)
    }

    const tourStats = {}
    const tourRevenue = {}

    filteredBookings.forEach((booking) => {
      if (!tourStats[booking.tourName]) {
        tourStats[booking.tourName] = { bookings: 0, passengers: 0, revenue: 0 }
      }
      tourStats[booking.tourName].bookings += 1
      tourStats[booking.tourName].passengers += booking.passengers.length
      tourStats[booking.tourName].revenue += booking.totalAmount
    })

    const dateGroups = {}
    filteredBookings.forEach((booking) => {
      const date = new Date(booking.journeyDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })

      if (!dateGroups[date]) {
        dateGroups[date] = { date, bookings: 0, revenue: 0, passengers: 0 }
      }
      dateGroups[date].bookings += 1
      dateGroups[date].revenue += booking.totalAmount
      dateGroups[date].passengers += booking.passengers.length
    })

    const timelineData = Object.values(dateGroups).sort((a, b) => new Date(a.date) - new Date(b.date))

    const paymentStatus = {
      paid: filteredBookings.filter((b) => b.totalAmount === b.advanceReceived).length,
      pending: filteredBookings.filter((b) => b.totalAmount !== b.advanceReceived).length,
    }

    const totalRevenue = filteredBookings.reduce((sum, b) => sum + b.totalAmount, 0)
    const totalPassengers = filteredBookings.reduce((sum, b) => sum + b.passengers.length, 0)
    const totalBookings = filteredBookings.length
    const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0
    const pendingPayments = filteredBookings.reduce((sum, b) => sum + (b.totalAmount - b.advanceReceived), 0)

    return {
      tourStats: Object.entries(tourStats)
        .map(([name, data]) => ({
          name,
          ...data,
          avgPassengers: Math.round(data.passengers / data.bookings),
          avgRevenue: Math.round(data.revenue / data.bookings),
        }))
        .sort((a, b) => b.revenue - a.revenue),
      timelineData,
      paymentStatus,
      totalRevenue,
      totalPassengers,
      totalBookings,
      averageBookingValue,
      pendingPayments,
    }
  }, [bookings, timeRange, selectedTour])

  const chartColors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"]

  const paymentChartData = [
    { name: "Paid", value: analytics.paymentStatus.paid },
    { name: "Pending", value: analytics.paymentStatus.pending },
  ]

  const uniqueTourNames = useMemo(() => {
    return ["all", ...new Set(bookings.map((b) => b.tourName))].filter(Boolean)
  }, [bookings])

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Tour Performance Analytics</h2>
          <p className="text-slate-500 font-bold text-sm">Track tour metrics and revenue insights</p>
        </div>
        <div className="flex gap-4">
          <select
            value={selectedTour}
            onChange={(e) => setSelectedTour(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none appearance-none cursor-pointer"
          >
            <option value="all">All Tours</option>
            {uniqueTourNames
              .filter((name) => name !== "all")
              .map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
          </select>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none appearance-none cursor-pointer"
          >
            <option value="all">All Time</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Total Revenue</p>
              <h3 className="text-3xl font-black text-slate-900">₹{analytics.totalRevenue.toLocaleString()}</h3>
              <p className="text-xs text-slate-400 font-bold mt-2">{analytics.totalBookings} bookings</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
              <DollarSign size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Total Bookings</p>
              <h3 className="text-3xl font-black text-slate-900">{analytics.totalBookings}</h3>
              <p className="text-xs text-slate-400 font-bold mt-2">
                ₹{analytics.averageBookingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} avg
              </p>
            </div>
            <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
              <Calendar size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Total Passengers</p>
              <h3 className="text-3xl font-black text-slate-900">{analytics.totalPassengers}</h3>
              <p className="text-xs text-slate-400 font-bold mt-2">
                {analytics.totalBookings > 0 ? Math.round(analytics.totalPassengers / analytics.totalBookings) : 0} avg
                per tour
              </p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
              <Users size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Pending Payments</p>
              <h3 className="text-3xl font-black text-red-600">₹{analytics.pendingPayments.toLocaleString()}</h3>
              <p className="text-xs text-slate-400 font-bold mt-2">{analytics.paymentStatus.pending} unpaid bookings</p>
            </div>
            <div className="bg-red-50 p-3 rounded-xl text-red-600">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-black text-slate-900 mb-6">Revenue Timeline</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "12px",
                }}
                labelStyle={{ color: "#fff" }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: "#3b82f6", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-black text-slate-900 mb-6">Payment Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                <Cell fill="#10b981" />
                <Cell fill="#ef4444" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 lg:col-span-2">
          <h3 className="text-lg font-black text-slate-900 mb-6">Top Performing Tours</h3>
          {analytics.tourStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={analytics.tourStats} margin={{ top: 20, right: 30, left: 0, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  angle={0} // Changed from -25 to 0 for better readability
                  textAnchor="middle"
                  height={80}
                  interval={0}
                  tick={{ fontSize: 11, fontWeight: "bold", fill: "#64748b" }}
                />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "12px",
                  }}
                  labelStyle={{ color: "#fff" }}
                />
                <Legend />
                <Bar dataKey="bookings" fill="#3b82f6" name="Bookings" />
                <Bar dataKey="passengers" fill="#10b981" name="Passengers" />
                <Bar dataKey="revenue" fill="#f59e0b" name="Revenue (₹)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-96 flex items-center justify-center text-slate-400">
              <p className="font-bold">No booking data available</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-slate-900">Detailed Tour Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Tour Name</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Bookings</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Passengers</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Avg PAX</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Total Revenue</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Avg Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics.tourStats.map((tour, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">{tour.name}</td>
                  <td className="px-6 py-4 font-black text-primary">{tour.bookings}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">{tour.passengers}</td>
                  <td className="px-6 py-4 text-slate-700 font-bold">{tour.avgPassengers} PAX</td>
                  <td className="px-6 py-4 font-black text-slate-900">₹{tour.revenue.toLocaleString()}</td>
                  <td className="px-6 py-4 text-slate-700 font-bold">₹{tour.avgRevenue.toLocaleString()}</td>
                </tr>
              ))}
              {analytics.tourStats.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold">
                    No tour data available for the selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
