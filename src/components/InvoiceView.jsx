"use client"

import {
  Printer,
  Share2,
  ArrowLeft,
  Bus,
  MapPin,
  Phone,
  IndianRupee,
  ShieldCheck,
  CheckCircle2,
  Download,
} from "lucide-react"

export default function InvoiceView({ booking, onBack, user }) {
  const handlePrint = () => {
    window.print()
  }

  const handleShare = () => {
    const companyName = user?.companyName || "Xyz Tourism"
    const text = `*${companyName.toUpperCase()}*\n*Tour Confirmation: #${booking.invoiceNo}*\n\n*Destination:* ${booking.tourName}\n*Traveler:* ${booking.contactName}\n*Departure:* ${new Date(booking.journeyDate).toLocaleDateString()}\n*Travelers:* ${booking.passengers.length} PAX\n\n*Payment Summary*\nTotal Package: ₹${booking.totalAmount.toLocaleString()}\nAdvance Paid: ₹${booking.advanceReceived.toLocaleString()}\n*BALANCE PAYABLE: ₹${(booking.totalAmount - booking.advanceReceived).toLocaleString()}*\n\n_Thank you for choosing us for your journey!_`
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, "_blank")
  }

  const handleDownload = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 print:bg-white print:pb-0">
      {/* Control Bar */}
      <div className="h-auto py-4 lg:h-20 bg-white border-b border-slate-200 sticky top-0 z-40 flex flex-col md:flex-row items-center justify-between px-6 lg:px-10 gap-4 no-print shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold text-sm transition-colors w-full md:w-auto"
        >
          <ArrowLeft size={18} /> Exit Invoice Preview
        </button>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleShare}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl font-black text-sm hover:bg-emerald-100 transition-all"
          >
            <Share2 size={18} /> <span className="hidden sm:inline">Share via WhatsApp</span>{" "}
            <span className="sm:hidden">Share</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-black text-sm hover:bg-blue-100 transition-all"
          >
            <Download size={18} /> <span className="hidden sm:inline">Download PDF</span>{" "}
            <span className="sm:hidden">PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
          >
            <Printer size={18} /> <span className="hidden sm:inline">Print</span>{" "}
            <span className="sm:hidden">Print</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto mt-6 lg:mt-12 mb-12 px-4 lg:px-0 print:mt-0 print:mb-0 print:px-0">
        <div
          id="invoice-content"
          className="bg-white shadow-2xl shadow-slate-200/50 rounded-3xl lg:rounded-[3rem] overflow-hidden border border-slate-100 print:shadow-none print:border-none print:rounded-none"
        >
          {/* Header Branding */}
          <div className="bg-indigo-600 p-8 lg:p-12 text-white relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 lg:gap-8">
              <div className="flex items-center gap-4 lg:gap-6">
                {user?.companyLogo ? (
                  <div className="bg-white p-2 lg:p-3 rounded-2xl lg:rounded-3xl shadow-xl">
                    <img
                      src={user.companyLogo || "/placeholder.svg"}
                      alt="Company Logo"
                      className="w-12 h-12 lg:w-16 lg:h-16 object-contain"
                    />
                  </div>
                ) : (
                  <div className="bg-white p-3 lg:p-4 rounded-2xl lg:rounded-3xl text-indigo-600 shadow-xl">
                    <Bus size={32} className="lg:w-12 lg:h-12" strokeWidth={2.5} />
                  </div>
                )}
                <div>
                  <h1 className="text-4xl font-black tracking-tighter leading-none mb-1">
                    {user?.companyName?.toUpperCase() || "XYZ TOURISM"}
                  </h1>
                  <p className="text-indigo-100 text-lg font-bold tracking-[0.3em] uppercase opacity-90">
                    {user?.companyTagline || "Tourism & Travels"}
                  </p>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="bg-indigo-500/30 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-400/30 mb-4">
                  Official Booking Invoice
                </span>
                <h2 className="text-5xl font-black tracking-tighter opacity-20 mt-1">INVOICE</h2>
              </div>
            </div>
            {/* Background bus pattern */}
            <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4 rotate-[-15deg]">
              <Bus size={400} />
            </div>
          </div>

          <div className="p-8 lg:p-12 space-y-8 lg:space-y-12">
            {/* Meta Info */}
            <div className="flex flex-col md:flex-row justify-between gap-8 border-b border-slate-100 pb-8 lg:pb-12">
              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Headquarters</p>
                  <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <MapPin size={14} className="text-indigo-600" />{" "}
                    {user?.companyHeadquarters || "Junagadh, Gujarat, 362001"}
                  </p>
                  <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Phone size={14} className="text-indigo-600" /> {user?.companyPhone || "+91 88662 29022"}
                  </p>
                </div>
                {user?.organizers && user.organizers.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tour Organizers</p>
                    {user.organizers.map((organizer, index) => (
                      <p key={index} className="text-sm font-bold text-indigo-600 flex items-center gap-2">
                        <Phone size={14} className="text-indigo-400" /> {organizer.name} - {organizer.phone}
                      </p>
                    ))}
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Details</p>
                  <p className="text-2xl font-black text-indigo-600">{booking.contactName}</p>
                  <p className="text-sm font-bold text-slate-500">{booking.contactPhone}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-6 lg:p-8 rounded-2xl lg:rounded-[2rem] border border-slate-100 min-w-full md:min-w-[320px]">
                <div className="grid grid-cols-2 gap-y-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      Invoice Number
                    </p>
                    <p className="font-black text-slate-900">#{booking.invoiceNo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Booking Date</p>
                    <p className="font-black text-slate-900">{new Date(booking.date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Payment Mode</p>
                    <p className="font-black text-emerald-600 uppercase text-sm">{booking.paymentMode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tour Status</p>
                    <div className="flex justify-end">
                      <span className="flex items-center gap-1.5 text-xs font-black text-indigo-600 uppercase">
                        <CheckCircle2 size={14} /> Confirmed
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tour Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              <div className="bg-indigo-50/50 p-6 lg:p-8 rounded-[2rem] border border-indigo-100/50 flex items-center gap-4">
                <div className="bg-white p-3 rounded-2xl text-indigo-600 shadow-sm">
                  <Bus size={24} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Tour Name</p>
                  <p className="font-black text-indigo-900 leading-tight">{booking.tourName}</p>
                </div>
              </div>
              <div className="bg-indigo-50/50 p-6 lg:p-8 rounded-[2rem] border border-indigo-100/50 flex items-center gap-4">
                <div className="bg-white p-3 rounded-2xl text-indigo-600 shadow-sm">
                  <MapPin size={24} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Journey Date</p>
                  <p className="font-black text-indigo-900">{new Date(booking.journeyDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="bg-indigo-50/50 p-6 lg:p-8 rounded-[2rem] border border-indigo-100/50 flex items-center gap-4">
                <div className="bg-white p-3 rounded-2xl text-indigo-600 shadow-sm">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Travel Config</p>
                  <p className="font-black text-indigo-900 text-xs">{booking.busType}</p>
                </div>
              </div>
            </div>

            {/* Passenger Manifest */}
            <div className="overflow-hidden rounded-2xl lg:rounded-[2rem] border border-slate-100">
              <div className="bg-slate-50 px-8 py-4 border-b border-slate-100">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Passenger Manifest ({booking.passengers.length} Total)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-125 lg:min-w-0">
                  <thead>
                    <tr className="bg-white text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-8 py-4">#</th>
                      <th className="px-8 py-4">Traveler Name</th>
                      <th className="px-8 py-4">Seat #</th>
                      <th className="px-8 py-4">From City</th>
                      <th className="px-8 py-4 text-center">Age</th>
                      <th className="px-8 py-4 text-right">Gender</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {booking.passengers.map((p, i) => (
                      <tr key={i} className="text-sm">
                        <td className="px-8 py-4 text-slate-400 font-bold">{i + 1}</td>
                        <td className="px-8 py-4 font-black text-slate-900">{p.name}</td>
                        <td className="px-8 py-4 font-bold text-indigo-600 uppercase text-[10px] tracking-widest">
                          {p.seatId || "N/A"}
                        </td>
                        <td className="px-8 py-4 font-bold text-slate-600">{p.city}</td>
                        <td className="px-8 py-4 text-center font-black text-slate-900">{p.age}</td>
                        <td className="px-8 py-4 text-right font-bold text-slate-600 uppercase text-[10px] tracking-widest">
                          {p.gender}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financials & T&C */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 pt-8 border-t border-slate-100">
              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-4 flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-indigo-600" /> Booking Policy & T&C
                  </h4>
                  <ul className="text-[10px] font-bold text-slate-500 space-y-2 leading-relaxed uppercase tracking-tight">
                    <li>• Valid Aadhar card is strictly required for all travelers.</li>
                    <li>• Advance payment is non-refundable upon confirmation.</li>
                    <li>• Final balance must be settled 24 hours prior to departure.</li>
                    <li>• Company is not liable for itinerary changes due to weather.</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">
                    Total Tour Package
                  </span>
                  <span className="font-black text-slate-900">₹{booking.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">
                    Security Advance Paid
                  </span>
                  <span className="font-black text-emerald-600">(-) ₹{booking.advanceReceived.toLocaleString()}</span>
                </div>
                <div className="bg-indigo-600 p-6 lg:p-8 rounded-2xl lg:rounded-[2rem] text-white flex justify-between items-center shadow-2xl shadow-indigo-100 relative overflow-hidden group">
                  <div className="relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 block mb-1">
                      Balance Payable
                    </span>
                    <div className="text-4xl font-black flex items-center tracking-tighter">
                      <IndianRupee size={28} strokeWidth={3} className="mr-1" />
                      {(booking.totalAmount - booking.advanceReceived).toLocaleString()}
                    </div>
                  </div>
                  <CheckCircle2 size={60} className="absolute -right-4 -bottom-4 opacity-10" />
                </div>
              </div>
            </div>
          </div>

          {/* Final Footer */}
          <div className="p-8 lg:p-12 bg-slate-50 text-center border-t border-slate-100">
            <p className="text-slate-900 font-black text-xl mb-1 tracking-tight">We wish you a magnificent journey!</p>
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em] opacity-80">
              {user?.companyName?.toLowerCase().replace(/\s+/g, "") || "yatrahub"}.com
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
          #invoice-content { border: none !important; margin: 0 !important; width: 100% !important; max-width: none !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
    </div>
  )
}
