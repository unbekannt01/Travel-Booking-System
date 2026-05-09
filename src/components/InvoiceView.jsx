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

  // ── Build the full HTML for the invoice (used in print window) ──
  const buildInvoiceHTML = () => {
    const companyName = user?.companyName?.toUpperCase() || "XYZ TOURISM"
    const companyTagline = user?.companyTagline || "Tourism & Travels"
    const companyHQ = user?.companyHeadquarters || "Junagadh, Gujarat, 362001"
    const companyPhone = user?.companyPhone || "+91 98765 43210"
    const logoHTML = user?.companyLogo
      ? `<img src="${user.companyLogo}" alt="logo" style="width:56px;height:56px;object-fit:contain;" />`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none"
           stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
           <rect x="1" y="6" width="22" height="14" rx="2"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
           <line x1="1" y1="10" x2="23" y2="10"/>
         </svg>`

    const organizersHTML = user?.organizers?.length
      ? user.organizers.map(o =>
          `<p style="font-size:12px;font-weight:700;color:#4f46e5;margin:2px 0;">
             📞 ${o.name}${o.phone ? " — " + o.phone : ""}
           </p>`).join("")
      : ""

    const passengersHTML = booking.passengers.map((p, i) =>
      `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"};">
        <td style="padding:10px 14px;font-weight:700;color:#94a3b8;">${i + 1}</td>
        <td style="padding:10px 14px;font-weight:900;color:#0f172a;">${p.name}</td>
        <td style="padding:10px 14px;font-weight:700;color:#4f46e5;font-size:11px;text-transform:uppercase;">${p.seatId || "—"}</td>
        <td style="padding:10px 14px;font-weight:700;color:#475569;">${p.city}</td>
        <td style="padding:10px 14px;font-weight:900;color:#0f172a;text-align:center;">${p.age}</td>
        <td style="padding:10px 14px;font-weight:700;color:#475569;font-size:11px;text-transform:uppercase;">${p.gender}</td>
      </tr>`
    ).join("")

    const balance = booking.totalAmount - booking.advanceReceived
    const journeyDate = new Date(booking.journeyDate).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric"
    })
    const bookingDate = new Date(booking.date).toLocaleDateString()

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Invoice #${booking.invoiceNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#f1f5f9; color:#0f172a; }
  .page { max-width:800px; margin:20px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.10); }

  /* Header */
  .header { background:#4f46e5; padding:36px 40px; position:relative; overflow:hidden; }
  .header-inner { display:flex; justify-content:space-between; align-items:center; position:relative; z-index:1; }
  .logo-wrap { background:#fff; border-radius:14px; padding:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .brand { margin-left:16px; }
  .brand h1 { font-size:28px; font-weight:900; color:#fff; letter-spacing:-0.03em; line-height:1; }
  .brand p  { font-size:11px; font-weight:700; color:#c7d2fe; letter-spacing:0.25em; text-transform:uppercase; margin-top:4px; }
  .invoice-badge { background:rgba(99,102,241,0.35); border:1px solid rgba(165,180,252,0.4);
                   padding:5px 14px; border-radius:999px; font-size:9px; font-weight:900;
                   color:#fff; letter-spacing:0.15em; text-transform:uppercase; }
  .invoice-word { font-size:48px; font-weight:900; color:rgba(255,255,255,0.12); letter-spacing:-0.04em; margin-top:4px; }

  /* Meta row */
  .meta { display:flex; gap:32px; padding:32px 40px 24px; border-bottom:1px solid #f1f5f9; flex-wrap:wrap; }
  .meta-left { flex:1; min-width:200px; display:flex; flex-direction:column; gap:18px; }
  .meta-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:20px 24px; min-width:260px; }
  .meta-box-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .label { font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.15em; color:#94a3b8; margin-bottom:3px; }
  .value { font-size:13px; font-weight:900; color:#0f172a; }
  .value-green { color:#059669; }
  .value-indigo { color:#4f46e5; font-size:20px; }
  .value-right { text-align:right; }

  /* Tour cards */
  .cards { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; padding:0 40px; margin-bottom:24px; }
  .card { background:#eef2ff; border:1px solid #e0e7ff; border-radius:14px; padding:16px; display:flex; align-items:center; gap:12px; }
  .card-icon { background:#fff; border-radius:10px; padding:10px; color:#4f46e5; flex-shrink:0; }
  .card-label { font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.15em; color:#818cf8; margin-bottom:2px; }
  .card-value { font-size:13px; font-weight:900; color:#1e1b4b; }

  /* Table */
  .table-wrap { margin:0 40px 24px; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; }
  .table-head-row { background:#f8fafc; padding:10px 14px; }
  .table-head-row p { font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.2em; color:#94a3b8; }
  table { width:100%; border-collapse:collapse; }
  thead tr { background:#fff; }
  thead th { padding:10px 14px; font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.15em; color:#94a3b8; text-align:left; }

  /* Bottom: TC + Financials */
  .bottom { display:flex; gap:32px; padding:0 40px 32px; flex-wrap:wrap; }
  .tc { flex:1; min-width:200px; }
  .tc h4 { font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.15em; color:#0f172a; margin-bottom:10px; }
  .tc li { font-size:9px; font-weight:700; color:#94a3b8; text-transform:uppercase; line-height:1.8; }
  .finance { min-width:240px; display:flex; flex-direction:column; gap:10px; }
  .fin-row { display:flex; justify-content:space-between; font-size:11px; }
  .fin-label { font-weight:700; color:#94a3b8; text-transform:uppercase; font-size:9px; letter-spacing:0.1em; }
  .fin-val { font-weight:900; color:#0f172a; }
  .balance-card { background:#4f46e5; border-radius:14px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; color:#fff; margin-top:4px; }
  .balance-label { font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.25em; opacity:0.75; margin-bottom:4px; }
  .balance-amount { font-size:28px; font-weight:900; letter-spacing:-0.03em; }

  /* Footer */
  .footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:20px; text-align:center; }
  .footer h3 { font-size:16px; font-weight:900; color:#0f172a; }
  .footer p  { font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.3em; color:#4f46e5; opacity:0.7; margin-top:4px; }

  @page { size:A4 portrait; margin:8mm; }
  @media print {
    body { background:#fff; }
    .page { box-shadow:none; border-radius:0; margin:0; max-width:100%; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="header-inner">
      <div style="display:flex;align-items:center;">
        <div class="logo-wrap">${logoHTML}</div>
        <div class="brand">
          <h1>${companyName}</h1>
          <p>${companyTagline}</p>
        </div>
      </div>
      <div style="text-align:right;">
        <div class="invoice-badge">Official Booking Invoice</div>
        <div class="invoice-word">INVOICE</div>
      </div>
    </div>
  </div>

  <!-- META ROW -->
  <div class="meta">
    <div class="meta-left">
      <div>
        <div class="label">Headquarters</div>
        <div style="font-size:12px;font-weight:700;color:#334155;margin-top:2px;">📍 ${companyHQ}</div>
        <div style="font-size:12px;font-weight:700;color:#334155;margin-top:2px;">📞 ${companyPhone}</div>
      </div>
      ${organizersHTML ? `<div><div class="label">Tour Organizers</div>${organizersHTML}</div>` : ""}
      <div>
        <div class="label">Customer Details</div>
        <div class="value-indigo" style="margin-top:3px;">${booking.contactName}</div>
        <div style="font-size:12px;font-weight:700;color:#64748b;margin-top:2px;">${booking.contactPhone}</div>
        ${booking.contactEmail ? `<div style="font-size:12px;font-weight:700;color:#94a3b8;">${booking.contactEmail}</div>` : ""}
      </div>
    </div>

    <div class="meta-box">
      <div class="meta-box-grid">
        <div>
          <div class="label">Invoice No.</div>
          <div class="value">#${booking.invoiceNo}</div>
        </div>
        <div class="value-right">
          <div class="label">Booking Date</div>
          <div class="value">${bookingDate}</div>
        </div>
        <div>
          <div class="label">Payment</div>
          <div class="value value-green">${booking.paymentMode?.toUpperCase()}</div>
        </div>
        <div class="value-right">
          <div class="label">Status</div>
          <div class="value" style="color:#4f46e5;">✓ Confirmed</div>
        </div>
      </div>
    </div>
  </div>

  <!-- TOUR CARDS -->
  <div class="cards">
    <div class="card">
      <div class="card-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="#4f46e5" stroke-width="2.5"><rect x="1" y="6" width="22" height="14" rx="2"/>
             <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
      </div>
      <div>
        <div class="card-label">Tour Name</div>
        <div class="card-value">${booking.tourName}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="#4f46e5" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
             <circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div>
        <div class="card-label">Journey Date</div>
        <div class="card-value">${journeyDate}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="#4f46e5" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
      <div>
        <div class="card-label">Travel Config</div>
        <div class="card-value">${booking.busType || "—"}</div>
      </div>
    </div>
  </div>

  <!-- PASSENGER TABLE -->
  <div class="table-wrap">
    <div class="table-head-row">
      <p>Passenger Manifest — ${booking.passengers.length} Total</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Traveler Name</th><th>Seat</th>
          <th>City</th><th style="text-align:center;">Age</th><th>Gender</th>
        </tr>
      </thead>
      <tbody>${passengersHTML}</tbody>
    </table>
  </div>

  <!-- BOTTOM: T&C + FINANCE -->
  <div class="bottom">
    <div class="tc">
      <h4>⚑ Booking Policy & T&C</h4>
      <ul style="list-style:none;">
        <li>• Valid Aadhar card is strictly required for all travelers.</li>
        <li>• Advance payment is non-refundable upon confirmation.</li>
        <li>• Final balance must be settled 24 hours prior to departure.</li>
        <li>• Company is not liable for itinerary changes due to weather.</li>
      </ul>
    </div>
    <div class="finance">
      <div class="fin-row">
        <span class="fin-label">Total Package</span>
        <span class="fin-val">₹${booking.totalAmount.toLocaleString()}</span>
      </div>
      <div class="fin-row">
        <span class="fin-label">Advance Paid</span>
        <span class="fin-val" style="color:#059669;">(–) ₹${booking.advanceReceived.toLocaleString()}</span>
      </div>
      <div class="balance-card">
        <div>
          <div class="balance-label">Balance Payable</div>
          <div class="balance-amount">₹${balance.toLocaleString()}</div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none"
             stroke="rgba(255,255,255,0.2)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
             <polyline points="22 4 12 14.01 9 11.01"/></svg>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <h3>We wish you a magnificent journey!</h3>
    <p>${(user?.companyName || "yatrahub").toLowerCase().replace(/\s+/g, "")}.com</p>
  </div>

</div>
</body>
</html>`
  }

  const handlePrint = () => {
    const html = buildInvoiceHTML()
    const win = window.open("", "_blank", "width=900,height=700")
    win.document.write(html)
    win.document.close()
    win.focus()
    // Small delay so images/fonts load before print dialog
    setTimeout(() => {
      win.print()
    }, 600)
  }

  const handleShare = () => {
    const companyName = user?.companyName || "Xyz Tourism"
    const text = `*${companyName.toUpperCase()}*\n*Tour Confirmation: #${booking.invoiceNo}*\n\n*Destination:* ${booking.tourName}\n*Traveler:* ${booking.contactName}\n*Departure:* ${new Date(booking.journeyDate).toLocaleDateString()}\n*Travelers:* ${booking.passengers.length} PAX\n\n*Payment Summary*\nTotal Package: ₹${booking.totalAmount.toLocaleString()}\nAdvance Paid: ₹${booking.advanceReceived.toLocaleString()}\n*BALANCE PAYABLE: ₹${(booking.totalAmount - booking.advanceReceived).toLocaleString()}*\n\n_Thank you for choosing us for your journey!_`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")
  }

  const balance = booking.totalAmount - booking.advanceReceived

  return (
    <div className="min-h-screen bg-slate-50 pb-20">

      {/* Control Bar */}
      <div className="h-auto py-4 lg:h-20 bg-white border-b border-slate-200 sticky top-0 z-40 flex flex-col md:flex-row items-center justify-between px-6 lg:px-10 gap-4 shadow-sm">
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
            <Share2 size={18} />
            <span className="hidden sm:inline">Share via WhatsApp</span>
            <span className="sm:hidden">Share</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-black text-sm hover:bg-blue-100 transition-all"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
          >
            <Printer size={18} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Screen Preview */}
      <div className="max-w-4xl mx-auto mt-6 lg:mt-10 mb-12 px-4 lg:px-0">
        <div className="bg-white rounded-3xl overflow-hidden border border-slate-100"
             style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}>

          {/* Header */}
          <div className="p-8 lg:p-10 text-white relative overflow-hidden"
               style={{ backgroundColor: "#4f46e5" }}>
            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div className="flex items-center gap-4">
                {user?.companyLogo ? (
                  <div className="bg-white p-2 rounded-2xl shadow-xl shrink-0">
                    <img src={user.companyLogo} alt="Logo" className="w-14 h-14 object-contain" />
                  </div>
                ) : (
                  <div className="bg-white p-3 rounded-2xl shadow-xl shrink-0" style={{ color: "#4f46e5" }}>
                    <Bus size={28} strokeWidth={2.5} />
                  </div>
                )}
                <div>
                  <h1 className="text-3xl lg:text-4xl font-black tracking-tighter leading-none mb-1">
                    {user?.companyName?.toUpperCase() || "XYZ TOURISM"}
                  </h1>
                  <p className="text-sm font-bold tracking-[0.25em] uppercase" style={{ color: "#c7d2fe" }}>
                    {user?.companyTagline || "Tourism & Travels"}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border"
                      style={{ backgroundColor: "rgba(99,102,241,0.35)", borderColor: "rgba(165,180,252,0.4)" }}>
                  Official Booking Invoice
                </span>
                <span className="text-4xl font-black tracking-tighter" style={{ opacity: 0.15 }}>INVOICE</span>
              </div>
            </div>
            <div className="absolute right-0 bottom-0 pointer-events-none"
                 style={{ opacity: 0.08, transform: "translate(25%, 25%) rotate(-15deg)" }}>
              <Bus size={320} />
            </div>
          </div>

          {/* Body */}
          <div className="p-8 lg:p-10 space-y-8">

            {/* Meta */}
            <div className="flex flex-col md:flex-row justify-between gap-8 pb-8 border-b border-slate-100">
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Headquarters</p>
                  <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <MapPin size={13} style={{ color: "#4f46e5" }} />
                    {user?.companyHeadquarters || "Junagadh, Gujarat, 362001"}
                  </p>
                  <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mt-0.5">
                    <Phone size={13} style={{ color: "#4f46e5" }} />
                    {user?.companyPhone || "+91 98765 43210"}
                  </p>
                </div>
                {user?.organizers?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tour Organizers</p>
                    {user.organizers.map((o, i) => (
                      <p key={i} className="text-sm font-bold flex items-center gap-1.5" style={{ color: "#4f46e5" }}>
                        <Phone size={13} style={{ color: "#a5b4fc" }} />
                        {o.name}{o.phone ? ` — ${o.phone}` : ""}
                      </p>
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Customer Details</p>
                  <p className="text-2xl font-black" style={{ color: "#4f46e5" }}>{booking.contactName}</p>
                  <p className="text-sm font-bold text-slate-500 mt-0.5">{booking.contactPhone}</p>
                  {booking.contactEmail && <p className="text-sm text-slate-400">{booking.contactEmail}</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 p-6 self-start min-w-full md:min-w-70"
                   style={{ backgroundColor: "#f8fafc" }}>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Invoice No.</p>
                    <p className="font-black text-slate-900">#{booking.invoiceNo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Booking Date</p>
                    <p className="font-black text-slate-900">{new Date(booking.date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Payment</p>
                    <p className="font-black text-sm uppercase" style={{ color: "#059669" }}>{booking.paymentMode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Status</p>
                    <span className="inline-flex items-center gap-1 text-xs font-black uppercase" style={{ color: "#4f46e5" }}>
                      <CheckCircle2 size={12} /> Confirmed
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: <Bus size={20} />, label: "Tour Name", value: booking.tourName },
                { icon: <MapPin size={20} />, label: "Journey Date",
                  value: new Date(booking.journeyDate).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) },
                { icon: <ShieldCheck size={20} />, label: "Travel Config", value: booking.busType },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-5 rounded-2xl border"
                     style={{ backgroundColor: "#eef2ff", borderColor: "#e0e7ff" }}>
                  <div className="p-2.5 rounded-xl bg-white shadow-sm shrink-0" style={{ color: "#4f46e5" }}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: "#818cf8" }}>
                      {item.label}
                    </p>
                    <p className="font-black text-sm leading-tight" style={{ color: "#1e1b4b" }}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <div className="px-6 py-3 border-b border-slate-100" style={{ backgroundColor: "#f8fafc" }}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Passenger Manifest — {booking.passengers.length} Total
                </p>
              </div>
              <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#fff" }}>
                    {["#", "Traveler Name", "Seat", "City", "Age", "Gender"].map(h => (
                      <th key={h} className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {booking.passengers.map((p, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f1f5f9", backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td className="px-5 py-3 text-sm font-bold text-slate-400">{i + 1}</td>
                      <td className="px-5 py-3 text-sm font-black text-slate-900">{p.name}</td>
                      <td className="px-5 py-3 text-[10px] font-black uppercase tracking-wider" style={{ color: "#4f46e5" }}>{p.seatId || "—"}</td>
                      <td className="px-5 py-3 text-sm font-bold text-slate-600">{p.city}</td>
                      <td className="px-5 py-3 text-sm font-black text-slate-900 text-center">{p.age}</td>
                      <td className="px-5 py-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider">{p.gender}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financials + T&C */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: "#1e293b" }}>
                  <CheckCircle2 size={13} style={{ color: "#4f46e5" }} /> Booking Policy & T&C
                </h4>
                <ul className="text-[10px] font-bold text-slate-400 space-y-1.5 uppercase tracking-tight leading-relaxed list-none">
                  <li>• Valid Aadhar card is strictly required for all travelers.</li>
                  <li>• Advance payment is non-refundable upon confirmation.</li>
                  <li>• Final balance must be settled 24 hours prior to departure.</li>
                  <li>• Company is not liable for itinerary changes due to weather.</li>
                </ul>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Total Package</span>
                  <span className="font-black text-slate-900">₹{booking.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Advance Paid</span>
                  <span className="font-black" style={{ color: "#059669" }}>(–) ₹{booking.advanceReceived.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-5 rounded-2xl text-white"
                     style={{ backgroundColor: "#4f46e5" }}>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-0.5" style={{ opacity: 0.75 }}>Balance Payable</p>
                    <div className="flex items-center text-3xl font-black tracking-tighter">
                      <IndianRupee size={22} strokeWidth={3} className="mr-0.5" />
                      {balance.toLocaleString()}
                    </div>
                  </div>
                  <CheckCircle2 size={48} style={{ opacity: 0.15 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 text-center border-t border-slate-100" style={{ backgroundColor: "#f8fafc" }}>
            <p className="font-black text-slate-900 text-lg mb-0.5">We wish you a magnificent journey!</p>
            <p className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: "#4f46e5", opacity: 0.7 }}>
              {user?.companyName?.toLowerCase().replace(/\s+/g, "") || "yatrahub"}.com
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}