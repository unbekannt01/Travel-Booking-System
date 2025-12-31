"use client"

import { useState } from "react"
import { ShieldCheck, MapPin, Phone, User, Fingerprint, FileDown, Eye, Filter, X, Printer } from "lucide-react"

export default function PassengerManagement({ bookings }) {
  const [selectedTour, setSelectedTour] = useState("all")
  const [showPreview, setShowPreview] = useState(false)
  const [includeAadhar, setIncludeAadhar] = useState(true)

  const uniqueTours = [...new Set(bookings.map((b) => b.tourName))].filter(Boolean)

  const filteredBookings = selectedTour === "all" ? bookings : bookings.filter((b) => b.tourName === selectedTour)

  const getJourneyDate = () => {
    const booking = filteredBookings[0]
    return booking?.journeyDate ? new Date(booking.journeyDate).toLocaleDateString() : "N/A"
  }

  const handleExport = (withAadhar) => {
    setIncludeAadhar(withAadhar)
    setShowPreview(true)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-100">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Admin: Internal Manifest</h2>
            <p className="text-sm font-medium text-slate-500">Confidential traveler documents and contact database</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="relative min-w-50">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={selectedTour}
              onChange={(e) => setSelectedTour(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none appearance-none cursor-pointer"
            >
              <option value="all">All Tours</option>
              {uniqueTours.map((tour) => (
                <option key={tour} value={tour}>
                  {tour}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleExport(false)}
              disabled={filteredBookings.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown size={16} /> Without Aadhar
            </button>
            <button
              onClick={() => handleExport(true)}
              disabled={filteredBookings.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown size={16} /> With Aadhar
            </button>
          </div>
        </div>
      </div>

      {selectedTour !== "all" && (
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Filter size={18} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-indigo-600">Filtered by Tour</p>
              <p className="text-sm font-black text-indigo-900">{selectedTour}</p>
            </div>
          </div>
          <button
            onClick={() => setSelectedTour("all")}
            className="text-indigo-600 hover:text-indigo-800 font-bold text-sm flex items-center gap-1"
          >
            <X size={16} /> Clear Filter
          </button>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                <th className="px-8 py-5">Tour Assignment</th>
                <th className="px-8 py-5">Full Name</th>
                <th className="px-8 py-5">Contact Details</th>
                <th className="px-8 py-5">Aadhar Card</th>
                <th className="px-8 py-5">Location</th>
                <th className="px-8 py-5 text-center">Age/Sex</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredBookings.flatMap((booking) =>
                booking.passengers.map((p, idx) => (
                  <tr key={`${booking.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider block w-fit">
                        {booking.tourName}
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold mt-1 block">
                        {new Date(booking.journeyDate).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-8 py-5 font-black text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                          <User size={14} />
                        </div>
                        {p.name}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <Phone size={14} className="text-indigo-400" /> {p.contact || "NOT PROVIDED"}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <Fingerprint size={14} className="text-indigo-400" /> {p.aadhar || "MISSING"}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                        <MapPin size={14} className="text-indigo-400" /> {p.city}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center font-black text-slate-900 text-xs">
                      {p.age}Y / {p.gender.toUpperCase()}
                    </td>
                  </tr>
                )),
              )}
              {filteredBookings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-bold">
                    No passenger records available in system.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-xl text-white">
                  <Eye size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Passenger Manifest Preview</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {includeAadhar ? "With Aadhar Numbers" : "Without Aadhar Numbers"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm shadow-lg shadow-indigo-100 transition-all"
                >
                  <Printer size={16} /> Export PDF
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-50" id="pdf-content">
              <div className="bg-white p-10 rounded-2xl shadow-sm mx-auto max-w-3xl print-content">
                {/* PDF Header */}
                <div className="text-center mb-8 border-b-2 border-indigo-600 pb-6">
                  <h1 className="text-3xl font-black text-indigo-600 mb-2">SHREE BHAGAVAT TOURISM</h1>
                  <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">
                    Internal Passenger Manifest
                  </p>
                </div>

                {/* Tour Information */}
                <div className="mb-8 bg-indigo-50 p-6 rounded-xl border-2 border-indigo-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400 mb-1">Tour Name</p>
                      <p className="font-black text-indigo-900">
                        {selectedTour === "all" ? "All Tours" : selectedTour}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400 mb-1">
                        Journey Date
                      </p>
                      <p className="font-black text-indigo-900">{getJourneyDate()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400 mb-1">
                        Total Passengers
                      </p>
                      <p className="font-black text-indigo-900">
                        {filteredBookings.reduce((acc, b) => acc + b.passengers.length, 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400 mb-1">
                        Generated On
                      </p>
                      <p className="font-black text-indigo-900">{new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Passenger Table */}
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-slate-200">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-600">#</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-600">
                        Passenger Name
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-600">City</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-600">
                        Contact
                      </th>
                      {includeAadhar && (
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-600">
                          Aadhar
                        </th>
                      )}
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-600 text-center">
                        Age/Gender
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBookings.flatMap((booking, bookingIdx) =>
                      booking.passengers.map((p, idx) => {
                        const globalIndex =
                          filteredBookings.slice(0, bookingIdx).reduce((acc, b) => acc + b.passengers.length, 0) +
                          idx +
                          1
                        return (
                          <tr key={`${booking.id}-${idx}`} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm font-bold text-slate-400">{globalIndex}</td>
                            <td className="px-4 py-3 text-sm font-black text-slate-900">{p.name}</td>
                            <td className="px-4 py-3 text-sm font-bold text-slate-600">{p.city}</td>
                            <td className="px-4 py-3 text-sm font-bold text-slate-600">{p.contact || "N/A"}</td>
                            {includeAadhar && (
                              <td className="px-4 py-3 text-sm font-bold text-slate-600">{p.aadhar || "MISSING"}</td>
                            )}
                            <td className="px-4 py-3 text-sm font-bold text-slate-700 text-center">
                              {p.age}Y / {p.gender[0]}
                            </td>
                          </tr>
                        )
                      }),
                    )}
                  </tbody>
                </table>

                {/* Footer */}
                <div className="mt-10 pt-6 border-t border-slate-200 text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    This is a confidential document for internal use only
                  </p>
                  <p className="text-xs font-bold text-indigo-600 mt-2">www.shreebhagavattourism.com</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content,
          .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: A4;
            margin: 15mm;
          }
        }
      `}</style>
    </div>
  )
}
