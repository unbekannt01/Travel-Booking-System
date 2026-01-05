"use client"

import { useState, useMemo } from "react"
import { Trash2, Plus, TrendingDown, DollarSign, PieChartIcon } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

export default function ExpenseTracker({ bookings, onSave, expenses = [] }) {
  const [expenseList, setExpenseList] = useState(expenses || [])
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "Fuel",
    description: "",
    amount: "",
    tourId: "",
  })

  const categories = ["Fuel", "Accommodation", "Meals", "Permits", "Vehicle Maintenance", "Staff", "Other"]

  const handleAddExpense = () => {
    if (!formData.amount || !formData.description) {
      alert("Please fill in all required fields")
      return
    }

    const newExpense = {
      id: Date.now(),
      ...formData,
      amount: Number(formData.amount),
    }

    const updatedExpenses = [...expenseList, newExpense]
    setExpenseList(updatedExpenses)
    setFormData({
      date: new Date().toISOString().split("T")[0],
      category: "Fuel",
      description: "",
      amount: "",
      tourId: "",
    })
    setShowAddForm(false)

    // Optional: Save to backend
    if (onSave) {
      onSave(updatedExpenses)
    }
  }

  const handleDeleteExpense = (id) => {
    const updatedExpenses = expenseList.filter((e) => e.id !== id)
    setExpenseList(updatedExpenses)

    if (onSave) {
      onSave(updatedExpenses)
    }
  }

  const analysis = useMemo(() => {
    const categoryTotals = {}
    let totalExpenses = 0

    expenseList.forEach((expense) => {
      if (!categoryTotals[expense.category]) {
        categoryTotals[expense.category] = 0
      }
      categoryTotals[expense.category] += expense.amount
      totalExpenses += expense.amount
    })

    const chartData = Object.entries(categoryTotals).map(([name, value]) => ({
      name,
      value,
    }))

    // Calculate tour-wise expenses
    const tourExpenses = {}
    expenseList.forEach((expense) => {
      if (expense.tourId) {
        if (!tourExpenses[expense.tourId]) {
          tourExpenses[expense.tourId] = 0
        }
        tourExpenses[expense.tourId] += expense.amount
      }
    })

    // Calculate margin
    const totalRevenue = bookings.reduce((sum, b) => sum + b.totalAmount, 0)
    const netProfit = totalRevenue - totalExpenses
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    return {
      totalExpenses,
      categoryTotals,
      chartData,
      tourExpenses,
      netProfit,
      profitMargin,
      totalRevenue,
    }
  }, [expenseList, bookings])

  const chartColors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"]

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Expense Tracking</h2>
          <p className="text-slate-500 font-bold text-sm">Monitor tour expenses and calculate profitability</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 transition-all"
        >
          <Plus size={18} /> Add Expense
        </button>
      </div>

      {/* Add Expense Form */}
      {showAddForm && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <h3 className="text-lg font-black text-slate-900 mb-6">New Expense</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none appearance-none cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Fuel for Shimla tour"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Amount (₹)</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                Related Tour (Optional)
              </label>
              <select
                value={formData.tourId}
                onChange={(e) => setFormData({ ...formData, tourId: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none appearance-none cursor-pointer"
              >
                <option value="">General Expense</option>
                {bookings.map((booking) => (
                  <option key={booking.id || booking._id} value={booking.id || booking._id}>
                    {booking.tourName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-6 py-2.5 text-slate-500 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAddExpense}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 transition-all"
            >
              Add Expense
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Total Expenses</p>
              <h3 className="text-3xl font-black text-red-600">₹{analysis.totalExpenses.toLocaleString()}</h3>
              <p className="text-xs text-slate-400 font-bold mt-2">{expenseList.length} transactions</p>
            </div>
            <div className="bg-red-50 p-3 rounded-xl text-red-600">
              <TrendingDown size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Total Revenue</p>
              <h3 className="text-3xl font-black text-slate-900">₹{analysis.totalRevenue.toLocaleString()}</h3>
              <p className="text-xs text-slate-400 font-bold mt-2">From {bookings.length} bookings</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
              <DollarSign size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Net Profit</p>
              <h3 className={`text-3xl font-black ${analysis.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                ₹{analysis.netProfit.toLocaleString()}
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-2">{analysis.profitMargin.toFixed(1)}% margin</p>
            </div>
            <div
              className={`p-3 rounded-xl ${analysis.netProfit >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}
            >
              <DollarSign size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Expense Ratio</p>
              <h3 className="text-3xl font-black text-slate-900">
                {analysis.totalRevenue > 0 ? ((analysis.totalExpenses / analysis.totalRevenue) * 100).toFixed(1) : 0}%
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-2">Of total revenue</p>
            </div>
            <div className="bg-amber-50 p-3 rounded-xl text-amber-600">
              <PieChartIcon size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense by Category */}
        {analysis.chartData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-lg font-black text-slate-900 mb-6">Expenses by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analysis.chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name} ₹${value.toLocaleString()}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analysis.chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-black text-slate-900 mb-6">Category Breakdown</h3>
          <div className="space-y-4">
            {Object.entries(analysis.categoryTotals)
              .sort((a, b) => b[1] - a[1])
              .map(([category, amount], idx) => (
                <div
                  key={category}
                  className="flex items-center justify-between pb-4 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: chartColors[idx % chartColors.length] }}
                    />
                    <span className="font-bold text-slate-700">{category}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900">₹{amount.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">{((amount / analysis.totalExpenses) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Expense List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900">All Expenses</h3>
          <span className="text-xs font-bold text-slate-400 uppercase">{expenseList.length} Transactions</span>
        </div>
        {expenseList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Date</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Category</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Description</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Amount</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Tour</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-right text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenseList
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map((expense) => {
                    const tourName = expense.tourId
                      ? bookings.find((b) => (b.id || b._id) === expense.tourId)?.tourName
                      : "-"

                    return (
                      <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-slate-600">
                            {new Date(expense.date).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                            {expense.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-900">{expense.description}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-black text-red-600">₹{expense.amount.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-600">{tourName}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <TrendingDown size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-400 font-bold">No expenses recorded yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
