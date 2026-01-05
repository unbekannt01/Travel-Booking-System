"use client"

import { useState, useMemo } from "react"
import { MapPin, Check, Download, MessageCircle, Mail } from "lucide-react"

export default function JourneyManager({ bookings }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [selectedTour, setSelectedTour] = useState("all")
  const [checkedInPassengers, setCheckedInPassengers] = useState({})
  const [showExportOptions, setShowExportOptions] = useState(false)

  const uniqueTours = [...new Set(bookings.map((b) => b.tourName))].filter(Boolean)

  const journeyBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        const bookingDate = new Date(b.journeyDate).toISOString().split("T")[0]
        const dateMatch = bookingDate === selectedDate
        const tourMatch = selectedTour === "all" || b.tourName === selectedTour
        return dateMatch && tourMatch
      })
      .sort((a, b) => new Date(a.journeyDate) - new Date(b.journeyDate))
  }, [bookings, selectedDate, selectedTour])

  const totalPassengers = journeyBookings.reduce((sum, b) => sum + b.passengers.length, 0)
  const totalCheckedIn = journeyBookings.reduce((sum, b) => {
    return sum + b.passengers.filter((p) => checkedInPassengers[`${b.id || b._id}-${p.name}`]).length
  }, 0)

  const toggleCheckIn = (bookingId, passengerName) => {
    const key = `${bookingId}-${passengerName}`
    setCheckedInPassengers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleSendWhatsApp = (booking) => {
    const passengers = booking.passengers.map((p) => `${p.name} (${p.city})`).join(", ")
    const message = `Hi ${booking.contactName},\n\nYour journey details:\nInvoice: ${booking.invoiceNo}\nTour: ${booking.tourName}\nDate: ${new Date(booking.journeyDate).toLocaleDateString()}\nPassengers: ${passengers}\nTotal: ${booking.passengers.length}\n\nPlease confirm receipt. Thank you!`
    const phoneNumber = booking.contactPhone.replace(/\D/g, "")
    const whatsappUrl = `https://wa.me/91${phoneNumber}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }

  const handleSendEmail = (booking) => {
    const passengers = booking.passengers.map((p) => `${p.name} (${p.city})`).join(", ")
    const subject = `Journey Details - ${booking.invoiceNo}`
    const body = `Hi ${booking.contactName},\n\nYour journey details:\n\nInvoice: ${booking.invoiceNo}\nTour: ${booking.tourName}\nDate: ${new Date(booking.journeyDate).toLocaleDateString()}\nPassengers: ${passengers}\nTotal: ${booking.passengers.length}\n\nPlease confirm receipt.\n\nThank you!`
    const mailUrl = `mailto:${booking.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailUrl
  }

  const handlePrintSeatLayout = () => {
    window.print()
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Journey Coordination Manager</h2>
        <p className="text-slate-500 font-bold text-sm">Manage departures and coordinate tour groups</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-slate-400">Select Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-slate-400">Filter Tour</label>
          <select
            value={selectedTour}
            onChange={(e) => setSelectedTour(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none appearance-none cursor-pointer"
          >
            <option value="all">All Tours</option>
            {uniqueTours.map((tour) => (
              <option key={tour} value={tour}>
                {tour}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-slate-400">Export</label>
          <div className="relative">
            <button
              onClick={() => setShowExportOptions(!showExportOptions)}
              className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 no-print"
            >
              <Download size={16} /> Export
            </button>
            {showExportOptions && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-10 no-print">
                <button
                  onClick={() => {
                    handlePrintSeatLayout()
                    setShowExportOptions(false)
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-slate-50 font-bold text-sm"
                >
                  Print Seat Map PDF
                </button>
                <button
                  onClick={() => setShowExportOptions(false)}
                  className="w-full px-4 py-2.5 text-left hover:bg-slate-50 font-bold text-sm"
                >
                  Excel (Coming)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {journeyBookings.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-12 text-center">
          <MapPin size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-black text-slate-900 mb-2">No Journeys Scheduled</h3>
          <p className="text-slate-500 font-bold">
            No tours departing on {new Date(selectedDate).toLocaleDateString()}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Total Journeys</p>
              <h3 className="text-3xl font-black text-slate-900">{journeyBookings.length}</h3>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Total Passengers</p>
              <h3 className="text-3xl font-black text-slate-900">{totalPassengers}</h3>
            </div>
            <div className="bg-green-50 rounded-2xl shadow-sm border border-green-200 p-6">
              <p className="text-green-600 font-bold text-xs uppercase tracking-widest mb-2">Checked In</p>
              <h3 className="text-3xl font-black text-green-600">
                {totalCheckedIn}/{totalPassengers}
              </h3>
              <p className="text-xs text-green-500 font-bold mt-2">
                {totalPassengers > 0 ? Math.round((totalCheckedIn / totalPassengers) * 100) : 0}% Complete
              </p>
            </div>
          </div>

          {journeyBookings.map((booking) => {
            const bookedInPassengers = booking.passengers.filter(
              (p) => checkedInPassengers[`${booking.id || booking._id}-${p.name}`],
            )

            return (
              <div
                key={booking.id || booking._id}
                className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden"
              >
                <div className="bg-linear-to-r from-indigo-50 to-blue-50 p-6 border-b border-slate-100">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 mb-1">{booking.tourName}</h3>
                      <p className="text-sm text-slate-500 font-bold">Invoice: {booking.invoiceNo}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                        Check-in Progress
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-600 transition-all"
                            style={{
                              width: `${booking.passengers.length > 0 ? (bookedInPassengers.length / booking.passengers.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-black text-slate-900">
                          {bookedInPassengers.length}/{booking.passengers.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Date</p>
                      <p className="font-black text-slate-900">{new Date(booking.journeyDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Customer</p>
                      <p className="font-black text-slate-900">{booking.contactName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Passengers</p>
                      <p className="font-black text-slate-900">{booking.passengers.length} PAX</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Payment</p>
                      <p
                        className={`font-black ${booking.totalAmount === booking.advanceReceived ? "text-green-600" : "text-red-600"}`}
                      >
                        {booking.totalAmount === booking.advanceReceived ? "Paid" : "Pending"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-full">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-200">
                        <th className="px-6 py-4">No.</th>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Age / Gender</th>
                        <th className="px-6 py-4">City</th>
                        <th className="px-6 py-4">Seat</th>
                        <th className="px-6 py-4">Payment</th>
                        <th className="px-6 py-4">Check-in</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {booking.passengers.map((passenger, idx) => {
                        const isCheckedIn = checkedInPassengers[`${booking.id || booking._id}-${passenger.name}`]
                        return (
                          <tr
                            key={idx}
                            className={`transition-colors ${isCheckedIn ? "bg-green-50" : "hover:bg-slate-50"}`}
                          >
                            <td className="px-6 py-4">
                              <span className="font-black text-slate-900">{idx + 1}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-bold text-slate-900">{passenger.name}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-slate-600">
                                {passenger.age} / {passenger.gender}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-bold text-slate-700">{passenger.city}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black">
                                {passenger.seatId || "—"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-bold text-green-600">Paid</span>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => toggleCheckIn(booking.id || booking._id, passenger.name)}
                                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                                  isCheckedIn
                                    ? "bg-green-600 text-white shadow-lg shadow-green-200"
                                    : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                                }`}
                              >
                                <Check size={16} strokeWidth={3} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleSendWhatsApp(booking)}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-green-200"
                  >
                    <MessageCircle size={16} />
                    Send WhatsApp
                  </button>
                  {booking.contactEmail && (
                    <button
                      onClick={() => handleSendEmail(booking)}
                      className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-200"
                    >
                      <Mail size={16} />
                      Send Email
                    </button>
                  )}
                </div>

                <div className="print-only hidden p-8 bg-white">
                  <div className="border-4 border-slate-900 p-6 rounded-3xl">
                    <h2 className="text-3xl font-black mb-4">SEAT LAYOUT: {booking.tourName}</h2>
                    <p className="text-xl font-bold mb-8">
                      Date: {new Date(booking.journeyDate).toLocaleDateString()} | Invoice: {booking.invoiceNo}
                    </p>

                    <div className="grid grid-cols-4 gap-4">
                      {booking.passengers.map((p, idx) => (
                        <div key={idx} className="border-2 border-slate-200 p-4 rounded-xl text-center">
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                            SEAT {p.seatId || "—"}
                          </p>
                          <p className="font-black text-slate-900">{p.name}</p>
                          <p className="text-xs font-bold text-slate-500">{booking.contactPhone}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
