import { useState } from "react"
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
  Languages,
  Ticket,
} from "lucide-react"
import { DOCUMENT_LANGUAGES, getDocumentTranslation } from "../i18n/documents"
import BoardingPassModal from "./common/BoardingPassModal"

export default function InvoiceView({ booking, onBack, user }) {
  const [selectedLang, setSelectedLang] = useState(user?.documentLanguage || "en")
  const [showBoardingPassModal, setShowBoardingPassModal] = useState(false)

  const t = getDocumentTranslation(selectedLang)
  const theme = user?.invoiceTheme || "classic"
  const accentColor = user?.invoiceColor || "#4f46e5"

  // ── Build the full HTML for the invoice (used in print window) ──
  const buildInvoiceHTML = () => {
    const companyName = user?.companyName?.toUpperCase() || "YATRA TOURS"
    const companyTagline = user?.companyTagline || "Tourism & Travels"
    const companyHQ = user?.companyHeadquarters || ""
    const companyPhone = user?.companyPhone || ""
    const gstHTML = user?.gstNumber
      ? `<div style="font-size:11px;font-weight:900;color:${accentColor};margin:2px 0;">GSTIN: ${user.gstNumber}</div>`
      : ""
    const defaultTC = [
      "Valid Aadhar card is strictly required for all travelers.",
      "Advance payment is non-refundable upon confirmation.",
      "Final balance must be settled 24 hours prior to departure.",
      "Company is not liable for itinerary changes due to weather.",
    ]
    const tcList = user?.termsAndConditions?.length ? user.termsAndConditions : defaultTC
    const tcHTML = tcList.map((item) => `<li>• ${item}</li>`).join("")
    const logoHTML = user?.companyLogo
      ? `<img src="${user.companyLogo}" alt="logo" style="width:56px;height:56px;object-fit:contain;" />`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none"
           stroke="${accentColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
           <rect x="1" y="6" width="22" height="14" rx="2"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
           <line x1="1" y1="10" x2="23" y2="10"/>
         </svg>`

    const organizersHTML = user?.organizers?.length
      ? user.organizers
          .map(
            (o) =>
              `<p style="font-size:12px;font-weight:700;color:${accentColor};margin:2px 0;">
             📞 ${o.name}${o.phone ? " — " + o.phone : ""}
           </p>`
          )
          .join("")
      : ""

    const passengersHTML = booking.passengers
      .map(
        (p, i) =>
          `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"};">
        <td style="padding:10px 14px;font-weight:700;color:#94a3b8;">${i + 1}</td>
        <td style="padding:10px 14px;font-weight:900;color:#0f172a;">${p.name}</td>
        <td style="padding:10px 14px;font-weight:700;color:${accentColor};font-size:11px;text-transform:uppercase;">${p.seatId || "—"}</td>
        <td style="padding:10px 14px;font-weight:700;color:#475569;">${p.city}</td>
        <td style="padding:10px 14px;font-weight:900;color:#0f172a;text-align:center;">${p.age}</td>
        <td style="padding:10px 14px;font-weight:700;color:#475569;font-size:11px;text-transform:uppercase;">${p.gender}</td>
      </tr>`
      )
      .join("")

    const balance = booking.totalAmount - booking.advanceReceived
    const isCancelled = booking.status === "Cancelled" || booking.status === "cancelled"
    const journeyDate = new Date(booking.journeyDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    const bookingDate = new Date(booking.date).toLocaleDateString()

    return `<!DOCTYPE html>
<html lang="${selectedLang}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Invoice #${booking.invoiceNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#f1f5f9; color:#0f172a; }

  /* Base layout */
  .page {
    max-width: 800px;
    margin: 20px auto;
    background: #fff;
    ${theme === "modern" ? "border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.08);" : ""}
    ${theme === "classic" ? "border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 4px 16px rgba(0,0,0,0.06);" : ""}
    ${theme === "minimal" ? "border-radius: 4px; border: 1px solid #e2e8f0; box-shadow: none;" : ""}
    overflow: hidden;
  }

  /* Header */
  .header {
    ${theme === "modern" ? `background: linear-gradient(135deg, ${accentColor}, #0f172a); padding: 38px 40px;` : ""}
    ${theme === "classic" ? `background: ${accentColor}; padding: 34px 40px; border-bottom: 3px solid rgba(0,0,0,0.1);` : ""}
    ${theme === "minimal" ? `background: #ffffff; padding: 30px 40px; border-top: 6px solid ${accentColor}; border-bottom: 1px solid #e2e8f0;` : ""}
    position: relative;
    overflow: hidden;
  }
  .header-inner { display:flex; justify-content:space-between; align-items:center; position:relative; z-index:1; }
  .logo-wrap { background:#fff; border-radius:${theme === "minimal" ? "6px" : "14px"}; padding:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .brand { margin-left:16px; }
  .brand h1 { font-size:28px; font-weight:900; color:${theme === "minimal" ? "#0f172a" : "#ffffff"}; letter-spacing:-0.03em; line-height:1; }
  .brand p  { font-size:11px; font-weight:700; color:${theme === "minimal" ? accentColor : "#c7d2fe"}; letter-spacing:0.25em; text-transform:uppercase; margin-top:4px; }
  .invoice-badge {
    background:${theme === "minimal" ? "#f1f5f9" : "rgba(255,255,255,0.2)"};
    border:1px solid ${theme === "minimal" ? "#cbd5e1" : "rgba(255,255,255,0.3)"};
    padding:5px 14px;
    border-radius:999px;
    font-size:9px;
    font-weight:900;
    color:${theme === "minimal" ? "#334155" : "#ffffff"};
    letter-spacing:0.15em;
    text-transform:uppercase;
  }
  .invoice-word { font-size:48px; font-weight:900; color:${theme === "minimal" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.12)"}; letter-spacing:-0.04em; margin-top:4px; }

  /* Meta row */
  .meta { display:flex; gap:32px; padding:32px 40px 24px; border-bottom:1px solid #f1f5f9; flex-wrap:wrap; }
  .meta-left { flex:1; min-width:200px; display:flex; flex-direction:column; gap:18px; }
  .meta-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:20px 24px; min-width:260px; }
  .meta-box-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .label { font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.15em; color:#94a3b8; margin-bottom:3px; }
  .value { font-size:13px; font-weight:900; color:#0f172a; }
  .value-green { color:#059669; }
  .value-indigo { color:${accentColor}; font-size:20px; }
  .value-right { text-align:right; }

  /* Tour cards */
  .cards { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; padding:0 40px; margin-bottom:24px; }
  .card {
    background:${theme === "minimal" ? "#ffffff" : "#f8fafc"};
    border:1px solid ${theme === "minimal" ? "#e2e8f0" : "#e0e7ff"};
    border-radius:${theme === "minimal" ? "6px" : "14px"};
    padding:16px;
    display:flex;
    align-items:center;
    gap:12px;
  }
  .card-icon { background:#fff; border-radius:10px; padding:10px; color:${accentColor}; flex-shrink:0; }
  .card-label { font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.15em; color:${accentColor}; margin-bottom:2px; }
  .card-value { font-size:13px; font-weight:900; color:#1e1b4b; }

  /* Table */
  .table-wrap { margin:0 40px 24px; border:1px solid #e2e8f0; border-radius:${theme === "minimal" ? "6px" : "14px"}; overflow:hidden; }
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
  .balance-card {
    background:${theme === "minimal" ? "#f8fafc" : accentColor};
    border:${theme === "minimal" ? `2px solid ${accentColor}` : "none"};
    border-radius:${theme === "minimal" ? "8px" : "14px"};
    padding:16px 20px;
    display:flex;
    justify-content:space-between;
    align-items:center;
    color:${theme === "minimal" ? "#0f172a" : "#ffffff"};
    margin-top:4px;
    ${theme === "modern" ? "box-shadow: 0 8px 24px rgba(0,0,0,0.12);" : ""}
  }
  .balance-label { font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.25em; opacity:0.8; margin-bottom:4px; }
  .balance-amount { font-size:28px; font-weight:900; letter-spacing:-0.03em; color:${theme === "minimal" ? accentColor : "#ffffff"}; }

  /* Footer */
  .footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:20px; text-align:center; }
  .footer h3 { font-size:16px; font-weight:900; color:#0f172a; }
  .footer p  { font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.3em; color:${accentColor}; opacity:0.85; margin-top:4px; }

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
        <div class="invoice-badge">${t.officialBookingInvoice}</div>
        <div class="invoice-word">${t.invoiceWord}</div>
      </div>
    </div>
  </div>

  <!-- META ROW -->
  <div class="meta">
    <div class="meta-left">
      <div>
        <div class="label">${t.headquarters}</div>
        <div style="font-size:12px;font-weight:700;color:#334155;margin-top:2px;">📍 ${companyHQ}</div>
        <div style="font-size:12px;font-weight:700;color:#334155;margin-top:2px;">📞 ${companyPhone}</div>
        ${gstHTML}
      </div>
      ${organizersHTML ? `<div><div class="label">${t.tourOrganizers}</div>${organizersHTML}</div>` : ""}
      <div>
        <div class="label">${t.customerDetails}</div>
        <div class="value-indigo" style="margin-top:3px;">${booking.contactName}</div>
        <div style="font-size:12px;font-weight:700;color:#64748b;margin-top:2px;">${booking.contactPhone}</div>
        ${booking.contactEmail ? `<div style="font-size:12px;font-weight:700;color:#94a3b8;">${booking.contactEmail}</div>` : ""}
      </div>
    </div>

    <div class="meta-box">
      <div class="meta-box-grid">
        <div>
          <div class="label">${t.invoiceNo}</div>
          <div class="value">#${booking.invoiceNo}</div>
        </div>
        <div class="value-right">
          <div class="label">${t.bookingDate}</div>
          <div class="value">${bookingDate}</div>
        </div>
        <div>
          <div class="label">${t.paymentMode}</div>
          <div class="value value-green">${booking.paymentMode?.toUpperCase()}</div>
        </div>
        <div class="value-right">
          <div class="label">${t.status}</div>
          <div class="value" style="color:${isCancelled ? '#ef4444' : '#4f46e5'};">${isCancelled ? t.cancelled : t.confirmed}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- TOUR CARDS -->
  <div class="cards">
    <div class="card">
      <div class="card-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="${accentColor}" stroke-width="2.5"><rect x="1" y="6" width="22" height="14" rx="2"/>
             <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
      </div>
      <div>
        <div class="card-label">${t.tourName}</div>
        <div class="card-value">${booking.tourName}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="${accentColor}" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
             <circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div>
        <div class="card-label">${t.journeyDate}</div>
        <div class="card-value">${journeyDate}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="${accentColor}" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
      <div>
        <div class="card-label">${t.travelConfig}</div>
        <div class="card-value">${booking.busType || "—"}</div>
      </div>
    </div>
  </div>

  <!-- PASSENGER TABLE -->
  <div class="table-wrap">
    <div class="table-head-row">
      <p>${t.passengerManifest} — ${booking.passengers.length} ${t.totalPax}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>#</th><th>${t.travelerName}</th><th>${t.seat}</th>
          <th>${t.city}</th><th style="text-align:center;">${t.age}</th><th>${t.gender}</th>
        </tr>
      </thead>
      <tbody>${passengersHTML}</tbody>
    </table>
  </div>

  <!-- BOTTOM: T&C + FINANCE -->
  <div class="bottom">
    <div class="tc">
      <h4>⚑ ${t.bookingPolicyTC}</h4>
      <ul style="list-style:none;">
        ${tcHTML}
      </ul>
      ${
        user?.bankDetails?.upiId || user?.bankDetails?.accountNumber
          ? `
      <div style="margin-top:14px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:12px; padding:12px 14px;">
        <h4 style="font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.15em; color:${accentColor}; margin-bottom:4px;">💳 ${t.bankPaymentDetails}</h4>
        ${user.bankDetails.upiId ? `<p style="font-size:11px; font-weight:900; color:${accentColor}; margin:2px 0;">${t.upiId}: ${user.bankDetails.upiId}</p>` : ""}
        ${user.bankDetails.accountName ? `<p style="font-size:10px; font-weight:700; color:#0f172a; margin:2px 0;">${t.accountName}: ${user.bankDetails.accountName}</p>` : ""}
        ${user.bankDetails.accountNumber ? `<p style="font-size:10px; font-weight:700; color:#475569; margin:2px 0;">${t.accountNumber}: ${user.bankDetails.accountNumber} | ${t.ifscCode}: ${user.bankDetails.ifscCode || ""} | ${t.bankName}: ${user.bankDetails.bankName || ""}</p>` : ""}
      </div>`
          : ""
      }
    </div>
    <div class="finance">
      <div class="fin-row">
        <span class="fin-label">${t.grossPackage}</span>
        <span class="fin-val">₹${(booking.baseAmount || booking.totalAmount).toLocaleString()}</span>
      </div>
      ${
        booking.discount > 0
          ? `
      <div class="fin-row">
        <span class="fin-label">${t.discount}</span>
        <span class="fin-val" style="color:#059669;">(–) ₹${booking.discount.toLocaleString()}</span>
      </div>`
          : ""
      }
      ${
        booking.gstRate > 0
          ? `
      <div class="fin-row">
        <span class="fin-label">${t.gst} (${booking.gstRate}%)</span>
        <span class="fin-val" style="color:${accentColor};">${booking.isTaxInclusive ? "(Incl.)" : "(+)"} ₹${(booking.taxAmount || 0).toLocaleString()}</span>
      </div>`
          : ""
      }
      <div class="fin-row" style="border-top:1px dashed #cbd5e1; padding-top:4px;">
        <span class="fin-label" style="font-weight:900;">${t.finalAmount}</span>
        <span class="fin-val" style="font-weight:900;">₹${booking.totalAmount.toLocaleString()}</span>
      </div>
      <div class="fin-row">
        <span class="fin-label">${t.advancePaid}</span>
        <span class="fin-val" style="color:#059669;">(–) ₹${(booking.advanceReceived || 0).toLocaleString()}</span>
      </div>
      ${
        booking.status === "Cancelled" && (booking.cancellationCharge > 0 || booking.refundAmount > 0)
          ? `
      <div class="fin-row" style="color:#dc2626;">
        <span class="fin-label" style="color:#dc2626;">${t.cancellationFee}</span>
        <span class="fin-val" style="color:#dc2626;">₹${(booking.cancellationCharge || 0).toLocaleString()}</span>
      </div>
      <div class="fin-row" style="color:#d97706;">
        <span class="fin-label" style="color:#d97706;">${t.refundIssued}</span>
        <span class="fin-val" style="color:#d97706;">₹${(booking.refundAmount || 0).toLocaleString()}</span>
      </div>`
          : ""
      }
      <div class="balance-card">
        <div>
          <div class="balance-label">${t.balancePayable}</div>
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
    <h3>${t.wishJourney}</h3>
    <p>${(user?.companyName || "yatrahub").toLowerCase().replace(/\s+/g, "")}.com</p>
  </div>

</div>
</body>
</html>`
  }

  const handlePrint = () => {
    const html = buildInvoiceHTML()
    const win = window.open("", "_blank", "width=900,height=700")
    if (!win) {
      alert("Please allow popups to print invoices.")
      return
    }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => {
      win.print()
    }, 600)
  }

  const handleShare = () => {
    const companyName = user?.companyName || "Xyz Tourism"
    const text = `*${companyName.toUpperCase()}*\n*${t.officialBookingInvoice}: #${booking.invoiceNo}*\n\n*${t.tourName}:* ${booking.tourName}\n*${t.travelerName}:* ${booking.contactName}\n*${t.journeyDate}:* ${new Date(booking.journeyDate).toLocaleDateString()}\n*${t.passengerManifest}:* ${booking.passengers.length} ${t.totalPax}\n\n*${t.finalAmount}:* ₹${booking.totalAmount.toLocaleString()}\n*${t.advancePaid}:* ₹${(booking.advanceReceived || 0).toLocaleString()}\n*${t.balancePayable.toUpperCase()}: ₹${(booking.totalAmount - (booking.advanceReceived || 0)).toLocaleString()}*\n\n_${t.wishJourney}_`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")
  }

  const balance = booking.totalAmount - (booking.advanceReceived || 0)

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

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          {/* Document Language Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-xs">
            <Languages size={14} className="text-slate-400 ml-2 mr-1" />
            {DOCUMENT_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setSelectedLang(lang.code)}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                  selectedLang === lang.code
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {lang.native}
              </button>
            ))}
          </div>

          {/* Boarding Passes Trigger */}
          <button
            type="button"
            onClick={() => setShowBoardingPassModal(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-black text-xs transition-all border border-indigo-100"
          >
            <Ticket size={16} />
            <span>Boarding Passes ({booking.passengers.length})</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-black text-xs hover:bg-emerald-100 transition-all"
          >
            <Share2 size={16} />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl font-black text-xs hover:bg-blue-100 transition-all"
          >
            <Download size={16} />
            <span>PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-5 py-2 text-white rounded-xl font-black text-xs shadow-md transition-all"
            style={{ backgroundColor: accentColor }}
          >
            <Printer size={16} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Screen Preview */}
      <div className="max-w-4xl mx-auto mt-6 lg:mt-10 mb-12 px-4 lg:px-0">
        <div
          className={`bg-white overflow-hidden border ${
            theme === "modern"
              ? "rounded-3xl border-slate-100 shadow-2xl"
              : theme === "classic"
                ? "rounded-xl border-slate-300 shadow-lg"
                : "rounded-lg border-slate-200 shadow-sm"
          }`}
        >
          {/* Header */}
          <div
            className={`p-8 lg:p-10 relative overflow-hidden ${
              theme === "minimal"
                ? "bg-white text-slate-900 border-b border-slate-200"
                : "text-white"
            }`}
            style={{
              backgroundColor: theme === "minimal" ? "#ffffff" : accentColor,
              borderTop: theme === "minimal" ? `6px solid ${accentColor}` : undefined,
              backgroundImage:
                theme === "modern"
                  ? `linear-gradient(135deg, ${accentColor}, #0f172a)`
                  : undefined,
            }}
          >
            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div className="flex items-center gap-4">
                {user?.companyLogo ? (
                  <div className="bg-white p-2 rounded-2xl shadow-xl shrink-0">
                    <img src={user.companyLogo} alt="Logo" className="w-14 h-14 object-contain" />
                  </div>
                ) : (
                  <div
                    className="bg-white p-3 rounded-2xl shadow-xl shrink-0"
                    style={{ color: accentColor }}
                  >
                    <Bus size={32} />
                  </div>
                )}
                <div>
                  <h1
                    className={`text-3xl font-black tracking-tight ${
                      theme === "minimal" ? "text-slate-900" : "text-white"
                    }`}
                  >
                    {user?.companyName?.toUpperCase() || "XYZ TOURISM"}
                  </h1>
                  <p
                    className="text-sm font-bold tracking-[0.25em] uppercase"
                    style={{ color: theme === "minimal" ? accentColor : "#c7d2fe" }}
                  >
                    {user?.companyTagline || "Tourism & Travels"}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span
                  className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border"
                  style={{
                    backgroundColor: theme === "minimal" ? "#f1f5f9" : "rgba(255,255,255,0.2)",
                    borderColor: theme === "minimal" ? "#cbd5e1" : "rgba(255,255,255,0.3)",
                    color: theme === "minimal" ? "#334155" : "#ffffff",
                  }}
                >
                  {t.officialBookingInvoice}
                </span>
                <span
                  className="text-4xl font-black tracking-tighter"
                  style={{ opacity: theme === "minimal" ? 0.08 : 0.15 }}
                >
                  {t.invoiceWord}
                </span>
              </div>
            </div>
            {theme !== "minimal" && (
              <div
                className="absolute right-0 bottom-0 pointer-events-none"
                style={{ opacity: 0.08, transform: "translate(25%, 25%) rotate(-15deg)" }}
              >
                <Bus size={320} />
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-8 lg:p-10 space-y-8">
            {/* Meta */}
            <div className="flex flex-col md:flex-row justify-between gap-8 pb-8 border-b border-slate-100">
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                    {t.headquarters}
                  </p>
                  <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <MapPin size={13} style={{ color: accentColor }} />
                    {user?.companyHeadquarters || "Junagadh, Gujarat, 362001"}
                  </p>
                  <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mt-0.5">
                    <Phone size={13} style={{ color: accentColor }} />
                    {user?.companyPhone || "+91 98765 43210"}
                  </p>
                  {user?.gstNumber && (
                    <p className="text-xs font-bold text-slate-600 mt-1">
                      GSTIN: <span className="font-mono text-slate-800 font-black">{user.gstNumber}</span>
                    </p>
                  )}
                </div>
                {user?.organizers?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      {t.tourOrganizers}
                    </p>
                    {user.organizers.map((o, i) => (
                      <p key={i} className="text-sm font-bold flex items-center gap-1.5" style={{ color: accentColor }}>
                        <Phone size={13} style={{ color: "#a5b4fc" }} />
                        {o.name}{o.phone ? ` — ${o.phone}` : ""}
                      </p>
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                    {t.customerDetails}
                  </p>
                  <p className="text-2xl font-black" style={{ color: accentColor }}>
                    {booking.contactName}
                  </p>
                  <p className="text-sm font-bold text-slate-500 mt-0.5">{booking.contactPhone}</p>
                  {booking.contactEmail && <p className="text-sm text-slate-400">{booking.contactEmail}</p>}
                </div>
              </div>
              <div
                className="rounded-2xl border border-slate-100 p-6 self-start min-w-full md:min-w-70"
                style={{ backgroundColor: "#f8fafc" }}
              >
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                      {t.invoiceNo}
                    </p>
                    <p className="font-black text-slate-900">#{booking.invoiceNo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                      {t.bookingDate}
                    </p>
                    <p className="font-black text-slate-900">{new Date(booking.date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                      {t.paymentMode}
                    </p>
                    <p className="font-black text-sm uppercase" style={{ color: "#059669" }}>
                      {booking.paymentMode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                      {t.status}
                    </p>
                    {booking.status === "Cancelled" || booking.status === "cancelled" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-black uppercase text-rose-600">
                        ✕ {t.cancelled}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-black uppercase" style={{ color: accentColor }}>
                        <CheckCircle2 size={12} /> {t.confirmed}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: <Bus size={20} />, label: t.tourName, value: booking.tourName },
                {
                  icon: <MapPin size={20} />,
                  label: t.journeyDate,
                  value: new Date(booking.journeyDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  }),
                },
                { icon: <ShieldCheck size={20} />, label: t.travelConfig, value: booking.busType || "—" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-5 rounded-2xl border"
                  style={{
                    backgroundColor: theme === "minimal" ? "#ffffff" : "#f8fafc",
                    borderColor: theme === "minimal" ? "#e2e8f0" : "#e0e7ff",
                  }}
                >
                  <div className="p-3 bg-white rounded-xl shadow-xs shrink-0" style={{ color: accentColor }}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: accentColor }}>
                      {item.label}
                    </p>
                    <p className="font-black text-slate-900">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <div className="px-6 py-3 border-b border-slate-100" style={{ backgroundColor: "#f8fafc" }}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {t.passengerManifest} — {booking.passengers.length} {t.totalPax}
                </p>
              </div>
              <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#fff" }}>
                    {["#", t.travelerName, t.seat, t.city, t.age, t.gender].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {booking.passengers.map((p, i) => (
                    <tr
                      key={i}
                      style={{
                        borderTop: "1px solid #f1f5f9",
                        backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa",
                      }}
                    >
                      <td className="px-5 py-3 text-sm font-bold text-slate-400">{i + 1}</td>
                      <td className="px-5 py-3 text-sm font-black text-slate-900">{p.name}</td>
                      <td
                        className="px-5 py-3 text-[10px] font-black uppercase tracking-wider"
                        style={{ color: accentColor }}
                      >
                        {p.seatId || "—"}
                      </td>
                      <td className="px-5 py-3 text-sm font-bold text-slate-600">{p.city}</td>
                      <td className="px-5 py-3 text-sm font-black text-slate-900 text-center">{p.age}</td>
                      <td className="px-5 py-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                        {p.gender}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financials + T&C */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
              <div>
                <h4
                  className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5"
                  style={{ color: "#1e293b" }}
                >
                  <CheckCircle2 size={13} style={{ color: accentColor }} /> {t.bookingPolicyTC}
                </h4>
                <ul className="text-[10px] font-bold text-slate-400 space-y-1.5 uppercase tracking-tight leading-relaxed list-none">
                  {(user?.termsAndConditions?.length
                    ? user.termsAndConditions
                    : [
                        "Valid Aadhar card is strictly required for all travelers.",
                        "Advance payment is non-refundable upon confirmation.",
                        "Final balance must be settled 24 hours prior to departure.",
                        "Company is not liable for itinerary changes due to weather.",
                      ]
                  ).map((term, i) => (
                    <li key={i}>• {term}</li>
                  ))}
                </ul>

                {(user?.bankDetails?.upiId || user?.bankDetails?.accountNumber) && (
                  <div className="mt-4 p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-1 text-xs">
                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 mb-1">
                      {t.bankPaymentDetails}
                    </p>
                    {user.bankDetails.upiId && (
                      <p className="font-black text-indigo-950">
                        {t.upiId}: <span className="text-indigo-600">{user.bankDetails.upiId}</span>
                      </p>
                    )}
                    {user.bankDetails.accountName && (
                      <p className="font-bold text-slate-600">
                        {t.accountName}: {user.bankDetails.accountName}
                      </p>
                    )}
                    {user.bankDetails.accountNumber && (
                      <p className="font-bold text-slate-600">
                        {t.accountNumber}: {user.bankDetails.accountNumber}{" "}
                        {user.bankDetails.ifscCode && `| ${t.ifscCode}: ${user.bankDetails.ifscCode}`}
                      </p>
                    )}
                    {user.bankDetails.bankName && (
                      <p className="font-bold text-slate-500">
                        {t.bankName}: {user.bankDetails.bankName}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">
                    {t.grossPackage}
                  </span>
                  <span className="font-black text-slate-900">
                    ₹{(booking.baseAmount || booking.totalAmount).toLocaleString()}
                  </span>
                </div>
                {booking.discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span className="font-bold uppercase tracking-widest text-[10px]">{t.discount}</span>
                    <span className="font-black">(–) ₹{booking.discount.toLocaleString()}</span>
                  </div>
                )}
                {booking.gstRate > 0 && (
                  <div className="flex justify-between text-sm text-indigo-600">
                    <span className="font-bold uppercase tracking-widest text-[10px]">
                      {t.gst} ({booking.gstRate}%)
                    </span>
                    <span className="font-black">
                      {booking.isTaxInclusive ? "(Incl.)" : "(+)"} ₹{(booking.taxAmount || 0).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-700 uppercase tracking-widest text-[10px]">
                    {t.finalAmount}
                  </span>
                  <span className="font-black text-slate-900">₹{booking.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">
                    {t.advancePaid}
                  </span>
                  <span className="font-black" style={{ color: "#059669" }}>
                    (–) ₹{(booking.advanceReceived || 0).toLocaleString()}
                  </span>
                </div>
                {booking.status === "Cancelled" && (booking.cancellationCharge > 0 || booking.refundAmount > 0) && (
                  <>
                    <div className="flex justify-between text-sm text-red-600">
                      <span className="font-bold uppercase tracking-widest text-[10px]">
                        {t.cancellationFee}
                      </span>
                      <span className="font-black">₹{(booking.cancellationCharge || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm text-amber-600">
                      <span className="font-bold uppercase tracking-widest text-[10px]">
                        {t.refundIssued}
                      </span>
                      <span className="font-black">₹{(booking.refundAmount || 0).toLocaleString()}</span>
                    </div>
                  </>
                )}
                <div
                  className="flex justify-between items-center p-5 rounded-2xl text-white shadow-sm"
                  style={{ backgroundColor: accentColor }}
                >
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-0.5" style={{ opacity: 0.75 }}>
                      {t.balancePayable}
                    </p>
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
            <p className="font-black text-slate-900 text-lg mb-0.5">{t.wishJourney}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: accentColor, opacity: 0.7 }}>
              {user?.companyName?.toLowerCase().replace(/\s+/g, "") || "yatrahub"}.com
            </p>
          </div>
        </div>
      </div>

      {/* Boarding Passes Modal */}
      {showBoardingPassModal && (
        <BoardingPassModal
          booking={booking}
          user={user}
          onClose={() => setShowBoardingPassModal(false)}
        />
      )}
    </div>
  )
}