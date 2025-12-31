"use client"

import { useState, useEffect } from "react"
import {
  Bus,
  Plus,
  Users,
  LayoutDashboard,
  Search,
  Eye,
  Edit3,
  Trash2,
  TrendingUp,
  MapPin,
  Menu,
  X,
  Compass,
  Filter,
  FileText,
  LogOut,
  Edit2,
  Check,
} from "lucide-react"
import BookingForm from "./BookingForm"
import InvoiceView from "./InvoiceView"
import TourInventory from "./TourInventory"
import PassengerManagement from "./PassengerManagement"

export default function Dashboard({ user, onLogout, onUserUpdate }) {
  const [bookings, setBookings] = useState([])
  const [activeTab, setActiveTab] = useState("dashboard")
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [editingBooking, setEditingBooking] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [tours, setTours] = useState([])
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showAllInvoices, setShowAllInvoices] = useState(false)
  const [invoiceTourFilter, setInvoiceTourFilter] = useState("all")
  const [isEditingName, setIsEditingName] = useState(false)
  const [newName, setNewName] = useState(user?.name || "SB TOURISM")
  const [_loading, setLoading] = useState(false)

  const getAuthHeaders = () => {
    const token = localStorage.getItem("auth-token")
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem("auth-token")

        if (!token) {
          console.log("[v0] No token found, user not authenticated")
          return
        }

        const bookingsRes = await fetch("http://localhost:5000/api/bookings", {
          headers: getAuthHeaders(),
        })

        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json()
          console.log("[v0] Fetched user bookings:", bookingsData.length)
          const formattedBookings = bookingsData.map((b) => ({
            ...b,
            id: b._id || b.id,
          }))
          setBookings(formattedBookings)
        } else if (bookingsRes.status === 401) {
          console.log("[v0] Token expired")
          onLogout()
        }

        const toursRes = await fetch("http://localhost:5000/api/tours", {
          headers: getAuthHeaders(),
        })

        if (toursRes.ok) {
          const toursData = await toursRes.json()
          console.log("[v0] Fetched user tours:", toursData.length)
          const formattedTours = toursData.map((t) => ({
            ...t,
            id: t._id || t.id,
          }))
          setTours(formattedTours)
        }
      } catch (error) {
        console.error("[v0] Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchData()
    }
  }, [user, onLogout])

  useEffect(() => {
    const mainContent = document.getElementById("main-content")
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [activeTab])

  const handleUpdateName = async () => {
    if (!newName.trim()) return

    try {
      const res = await fetch("http://localhost:5000/api/auth/update-name", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ newName }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message)

      const updatedUser = { ...user, name: data.user.name }
      localStorage.setItem("user", JSON.stringify(updatedUser))
      onUserUpdate(updatedUser)
      setIsEditingName(false)
      console.log("[v0] Name updated")
    } catch (err) {
      console.error("[v0] Error updating name:", err.message)
      alert("Failed to update name: " + err.message)
    }
  }

  const handleSaveBooking = async (bookingData) => {
    try {
      const url = editingBooking
        ? `http://localhost:5000/api/bookings/${bookingData._id || bookingData.id}`
        : "http://localhost:5000/api/bookings"

      const method = editingBooking ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(bookingData),
      })

      if (response.ok) {
        const savedBooking = await response.json()

        setBookings((prev) => {
          if (editingBooking) {
            return prev.map((b) =>
              (b._id || b.id) === (savedBooking._id || savedBooking.id)
                ? { ...savedBooking, id: savedBooking._id || savedBooking.id }
                : b,
            )
          } else {
            return [{ ...savedBooking, id: savedBooking._id || savedBooking.id }, ...prev]
          }
        })

        setActiveTab("dashboard")
        setEditingBooking(null)
      } else {
        const error = await response.json()
        alert("Failed to save booking: " + error.message)
      }
    } catch (error) {
      console.error("[v0] Error saving booking:", error)
      alert("Failed to connect to server")
    }
  }

  const handleDeleteBooking = async (id) => {
    if (confirm("Are you sure you want to delete this booking?")) {
      try {
        const response = await fetch(`http://localhost:5000/api/bookings/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        })

        if (response.ok) {
          setBookings((prev) => prev.filter((b) => (b._id || b.id) !== id))
        } else {
          const error = await response.json()
          alert("Failed to delete booking: " + error.message)
        }
      } catch (error) {
        console.error("[v0] Error deleting booking:", error)
        alert("Failed to connect to server")
      }
    }
  }

  const handleSaveTour = async (tourData) => {
    try {
      const url =
        tourData._id || tourData.id
          ? `http://localhost:5000/api/tours/${tourData._id || tourData.id}`
          : "http://localhost:5000/api/tours"

      const method = tourData._id || tourData.id ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(tourData),
      })

      if (response.ok) {
        const savedTour = await response.json()

        setTours((prev) => {
          const existingIndex = prev.findIndex((t) => (t._id || t.id) === (savedTour._id || savedTour.id))
          if (existingIndex !== -1) {
            const updated = [...prev]
            updated[existingIndex] = { ...savedTour, id: savedTour._id || savedTour.id }
            return updated
          } else {
            return [...prev, { ...savedTour, id: savedTour._id || savedTour.id }]
          }
        })
      } else {
        const error = await response.json()
        alert("Failed to save tour: " + error.message)
      }
    } catch (error) {
      console.error("[v0] Error saving tour:", error)
      alert("Failed to connect to server")
    }
  }

  const handleDeleteTour = async (id) => {
    if (confirm("Delete this tour template?")) {
      try {
        const response = await fetch(`http://localhost:5000/api/tours/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        })

        if (response.ok) {
          setTours((prev) => prev.filter((t) => (t._id || t.id) !== id))
        } else {
          const error = await response.json()
          alert("Failed to delete tour: " + error.message)
        }
      } catch (error) {
        console.error("[v0] Error deleting tour:", error)
        alert("Failed to connect to server")
      }
    }
  }

  const filteredBookings = bookings.filter(
    (b) =>
      b.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.tourName.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const uniqueTours = [...new Set(bookings.map((b) => b.tourName))].filter(Boolean)
  const filteredInvoices =
    invoiceTourFilter === "all" ? bookings : bookings.filter((b) => b.tourName === invoiceTourFilter)

  if (selectedBooking) {
    return <InvoiceView booking={selectedBooking} onBack={() => setSelectedBooking(null)} />
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Mobile Header */}
      <header className="lg:hidden h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-1.5 rounded-lg text-white shadow-lg shadow-primary/20">
            <Compass size={18} strokeWidth={2.5} />
          </div>
          <h1 className="font-black text-sm tracking-tight text-slate-900">{user?.name || "SB TOURISM"}</h1>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-white transform transition-all duration-300 lg:relative lg:translate-x-0 flex flex-col border-r border-slate-200/60
        ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"}
      `}
      >
        <div className="p-8 hidden lg:block">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2.5 rounded-2xl text-white shadow-xl shadow-primary/20 rotate-3 group-hover:rotate-0 transition-transform">
              <Bus size={24} strokeWidth={2.5} />
            </div>
            <div className="group/name relative">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="font-black text-xl tracking-tight leading-none text-slate-900 bg-slate-50 border-none rounded p-1 outline-none w-40 focus:ring-2 focus:ring-primary/20"
                    autoFocus
                    onBlur={() => !newName.trim() && setIsEditingName(false)}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdateName()}
                  />
                  <button onClick={handleUpdateName} className="text-green-500 hover:text-green-600 transition-colors">
                    <Check size={18} strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div>
                    <h1 className="font-black text-xl tracking-tight leading-none text-slate-900">
                      {user?.name || "SB TOURISM"}
                    </h1>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary/60 block mt-1">
                      Luxury Travels
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setNewName(user?.name || "SB TOURISM")
                      setIsEditingName(true)
                    }}
                    className="opacity-0 group-hover/name:opacity-100 p-1 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-primary"
                  >
                    <Edit2 size={12} strokeWidth={3} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:hidden p-6 border-b border-slate-100 flex items-center justify-between">
          <span className="font-black text-primary/60 uppercase tracking-widest text-xs">Navigation Menu</span>
          <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-6 space-y-1.5">
          {[
            { id: "dashboard", icon: <LayoutDashboard size={18} />, label: "Overview" },
            { id: "passengers", icon: <Users size={18} />, label: "Travelers" },
            { id: "tours", icon: <MapPin size={18} />, label: "Destinations" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setIsMobileMenuOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm ${
                activeTab === tab.id
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm text-red-400 hover:bg-red-50"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </nav>

        <div className="p-6">
          <div className="bg-primary rounded-2xl p-5 text-white relative overflow-hidden group shadow-xl shadow-primary/20">
            <div className="relative z-10">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Total Revenue</p>
              <h3 className="text-2xl font-black">
                ₹{bookings.reduce((acc, b) => acc + b.totalAmount, 0).toLocaleString()}
              </h3>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-primary/10">
                <TrendingUp size={14} /> +12% from last month
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 transform group-hover:scale-110 transition-transform duration-500">
              <Bus size={120} />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 flex flex-col min-w-0 overflow-y-auto scroll-smooth">
        <header className="h-20 bg-white border-b border-slate-200 hidden lg:flex items-center justify-between px-10 sticky top-0 z-30 shrink-0">
          <div className="flex-1 max-w-xl relative group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary/60 transition-colors"
              size={18}
            />
            <input
              type="text"
              placeholder="Search invoices, tours, or traveler names..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border-transparent rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4 ml-8">
            <button
              onClick={() => {
                setEditingBooking(null)
                setActiveTab("form")
              }}
              className="bg-primary hover:bg-primary/80 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
            >
              <Plus size={18} strokeWidth={3} /> New Reservation
            </button>
          </div>
        </header>

        <div className="lg:hidden px-6 pt-6 pb-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search bookings..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto w-full">
          {activeTab === "dashboard" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-7 rounded-3xl shadow-sm border border-slate-100 relative group overflow-hidden">
                  <div className="relative z-10">
                    <div className="bg-blue-50 text-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                      <LayoutDashboard size={22} />
                    </div>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">Active Bookings</p>
                    <h3 className="text-3xl font-black text-slate-900">{bookings.length}</h3>
                  </div>
                </div>
                <div className="bg-white p-7 rounded-3xl shadow-sm border border-slate-100 relative group overflow-hidden">
                  <div className="relative z-10">
                    <div className="bg-emerald-50 text-emerald-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                      <Users size={22} />
                    </div>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">Total Travelers</p>
                    <h3 className="text-3xl font-black text-slate-900">
                      {bookings.reduce((acc, b) => acc + b.passengers.length, 0)}
                    </h3>
                  </div>
                </div>
                <div className="bg-white p-7 rounded-3xl shadow-sm border border-slate-100 relative group overflow-hidden">
                  <div className="relative z-10">
                    <div className="bg-indigo-50 text-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                      <MapPin size={22} />
                    </div>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">
                      Destinations Cover
                    </p>
                    <h3 className="text-3xl font-black text-slate-900">{tours.length}</h3>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-7 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h2 className="text-lg font-black text-slate-900">Recent Booking Invoices</h2>
                  <button
                    onClick={() => setShowAllInvoices(true)}
                    className="text-primary/60 text-sm font-bold hover:underline flex items-center gap-2"
                  >
                    <FileText size={16} /> View All Invoices
                  </button>
                </div>
                <div className="overflow-x-auto mx-0">
                  <table className="w-full text-left min-w-175 lg:min-w-0">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        <th className="px-8 py-4">Invoice #</th>
                        <th className="px-8 py-4">Main Traveler</th>
                        <th className="px-8 py-4">Tour Selection</th>
                        <th className="px-8 py-4">Amount</th>
                        <th className="px-8 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredBookings.slice(0, 5).map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-5">
                            <span className="font-black text-slate-900 group-hover:text-primary/60 transition-colors">
                              #{b.invoiceNo}
                            </span>
                            <span className="block text-[10px] text-slate-400 font-medium mt-0.5">
                              {new Date(b.date).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <span className="font-bold text-slate-700">{b.contactName}</span>
                            <span className="block text-xs text-slate-400 mt-0.5">{b.contactPhone}</span>
                          </td>
                          <td className="px-8 py-5">
                            <span className="bg-primary text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                              {b.tourName}
                            </span>
                          </td>
                          <td className="px-8 py-5 font-black text-slate-900">₹{b.totalAmount.toLocaleString()}</td>
                          <td className="px-8 py-5">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedBooking(b)}
                                className="p-2 text-slate-400 hover:text-primary/60 hover:bg-primary/10 rounded-lg transition-all"
                              >
                                <Eye size={18} />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingBooking(b)
                                  setActiveTab("form")
                                }}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              >
                                <Edit3 size={18} />
                              </button>
                              <button
                                onClick={() => handleDeleteBooking(b.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredBookings.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-medium">
                            No bookings found. Create your first booking to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "form" && (
            <BookingForm
              onSave={handleSaveBooking}
              tours={tours}
              editData={editingBooking}
              bookings={bookings}
              onCancel={() => {
                setActiveTab("dashboard")
                setEditingBooking(null)
              }}
            />
          )}

          {activeTab === "passengers" && (
            <PassengerManagement
              bookings={bookings}
              onUpdateBooking={handleSaveBooking}
              onDeleteBooking={handleDeleteBooking}
              onEditBooking={(booking) => {
                setEditingBooking(booking)
                setActiveTab("form")
              }}
            />
          )}

          {activeTab === "tours" && <TourInventory tours={tours} onAdd={handleSaveTour} onDelete={handleDeleteTour} />}
        </div>
      </main>

      {showAllInvoices && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-xl text-white">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">All Booking Invoices</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {filteredInvoices.length} Total Invoices
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-1 lg:flex-none lg:min-w-60">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <select
                    value={invoiceTourFilter}
                    onChange={(e) => setInvoiceTourFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none appearance-none cursor-pointer"
                  >
                    <option value="all">All Tours</option>
                    {uniqueTours.map((tour) => (
                      <option key={tour} value={tour}>
                        {tour}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    setShowAllInvoices(false)
                    setInvoiceTourFilter("all")
                  }}
                  className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-200">
                      <th className="px-6 py-4">Invoice #</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Traveler</th>
                      <th className="px-6 py-4">Tour</th>
                      <th className="px-6 py-4">Journey Date</th>
                      <th className="px-6 py-4">Passengers</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInvoices.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <span className="font-black text-slate-900">#{b.invoiceNo}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-slate-600">
                            {new Date(b.date).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <span className="font-bold text-slate-700 block">{b.contactName}</span>
                            <span className="text-xs text-slate-400">{b.contactPhone}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                            {b.tourName}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-slate-600">
                            {new Date(b.journeyDate).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-black text-indigo-600">{b.passengers.length} PAX</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-black text-slate-900">₹{b.totalAmount.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedBooking(b)
                                setShowAllInvoices(false)
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingBooking(b)
                                setActiveTab("form")
                                setShowAllInvoices(false)
                              }}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => {
                                handleDeleteBooking(b.id)
                                if (filteredInvoices.length === 1) {
                                  setShowAllInvoices(false)
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredInvoices.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="bg-slate-100 p-4 rounded-2xl">
                              <FileText size={32} className="text-slate-300" />
                            </div>
                            <p className="text-slate-400 font-bold">No invoices found for this tour</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
