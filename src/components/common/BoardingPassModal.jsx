import { useState, useEffect, useMemo } from "react"
import QRCode from "qrcode"
import {
  X,
  Printer,
  Share2,
  Bus,
  MapPin,
  Clock,
  Phone,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Languages,
  User,
} from "lucide-react"
import { DOCUMENT_LANGUAGES, getDocumentTranslation } from "../../i18n/documents"
import { formatDisplayDate } from "../../utils/date"
import { maskAadhaar } from "../../utils/formatters"

export default function BoardingPassModal({
  booking,
  departure,
  user,
  onClose,
  initialPassengerIndex = 0,
}) {
  const [selectedLang, setSelectedLang] = useState(user?.documentLanguage || "en")
  const [selectedPaxIndex, setSelectedPaxIndex] = useState(
    initialPassengerIndex === "all" ? "all" : Number(initialPassengerIndex) || 0
  )
  const [qrCodes, setQrCodes] = useState({})

  const t = getDocumentTranslation(selectedLang)
  const accentColor = user?.invoiceColor || "#4f46e5"
  const companyName = user?.companyName || "YATRA TOURS"
  const companyPhone = user?.companyPhone || ""
  const companyHQ = user?.companyHeadquarters || ""
  const busNumber =
    departure?.busNumber ||
    booking?.busNumber ||
    booking?.busType ||
    "AC Sleeper Coach"

  const primaryOrganizer = user?.organizers?.[0]
  const organizerContact = primaryOrganizer
    ? `${primaryOrganizer.name} (${primaryOrganizer.phone})`
    : companyPhone || "Operator Office"

  const passengers = useMemo(() => booking?.passengers || [], [booking?.passengers])

  // Generate QR codes for all passengers
  useEffect(() => {
    let isMounted = true
    const generateQRs = async () => {
      const generated = {}
      for (let i = 0; i < passengers.length; i++) {
        const pax = passengers[i]
        const seat = pax.seatId || `P${i + 1}`
        // QR format: invoiceNo + seatId as requested in spec
        const qrPayload = `${booking.invoiceNo}-${seat}`
        try {
          const url = await QRCode.toDataURL(qrPayload, {
            width: 160,
            margin: 1,
            color: {
              dark: "#0f172a",
              light: "#ffffff",
            },
          })
          generated[i] = url
        } catch (err) {
          console.error("QR Generation failed for pax:", i, err)
        }
      }
      if (isMounted) setQrCodes(generated)
    }
    generateQRs()
    return () => {
      isMounted = false
    }
  }, [booking, passengers])

  const getDeckLabel = (seatId) => {
    if (!seatId) return "Seat"
    if (seatId.toLowerCase().startsWith("lower")) return "Lower Deck"
    if (seatId.toLowerCase().startsWith("upper")) return "Upper Deck"
    return "Reserved"
  }

  // Build printable HTML document for window.print()
  const buildPrintableHTML = (paxIndex) => {
    const listToPrint =
      paxIndex === "all"
        ? passengers.map((p, idx) => ({ pax: p, idx }))
        : [{ pax: passengers[paxIndex], idx: paxIndex }]

    const ticketsHTML = listToPrint
      .map(({ pax, idx }) => {
        const seat = pax.seatId || "—"
        const qrUrl = qrCodes[idx] || ""
        const deckLabel = getDeckLabel(seat)
        const isPaid = (booking.advanceReceived || 0) >= (booking.totalAmount || 0)
        const dueAmount = Math.max(0, (booking.totalAmount || 0) - (booking.advanceReceived || 0))

        return `
        <div class="ticket-card">
          <!-- Main Left Section -->
          <div class="ticket-main">
            <!-- Header -->
            <div class="ticket-header">
              <div class="company-brand">
                <h2>${companyName.toUpperCase()}</h2>
                <p class="tagline">${user?.companyTagline || "Tourism & Travels"}</p>
                <p class="hq">${companyHQ ? "📍 " + companyHQ : ""} ${companyPhone ? " | 📞 " + companyPhone : ""}</p>
              </div>
              <div class="ticket-badge">
                <span class="badge-title">${t.boardingPass.toUpperCase()}</span>
                <span class="badge-sub">${t.ticketVerifiedNotice}</span>
              </div>
            </div>

            <!-- Tour & Journey Banner -->
            <div class="tour-banner">
              <div>
                <span class="meta-label">${t.tourName.toUpperCase()}</span>
                <div class="tour-title">${booking.tourName}</div>
              </div>
              <div style="text-align: right;">
                <span class="meta-label">${t.journeyDate.toUpperCase()}</span>
                <div class="journey-date">${formatDisplayDate(booking.journeyDate)}</div>
              </div>
            </div>

            <!-- Passenger Details Grid -->
            <div class="passenger-grid">
              <div>
                <span class="meta-label">${t.travelerName.toUpperCase()}</span>
                <div class="meta-value-bold">${pax.name || "Passenger " + (idx + 1)}</div>
                <div class="meta-sub">${pax.age ? pax.age + " Yrs" : ""} • ${pax.gender || ""} • ${pax.city || ""}${pax.aadhar ? " • " + maskAadhaar(pax.aadhar) : ""}</div>
              </div>
              <div>
                <span class="meta-label">${t.busNumber.toUpperCase()}</span>
                <div class="meta-value-bold">${busNumber}</div>
                <div class="meta-sub">Invoice: #${booking.invoiceNo}</div>
              </div>
              <div>
                <span class="meta-label">${t.emergencyContact.toUpperCase()}</span>
                <div class="meta-value-bold">${organizerContact}</div>
                <div class="meta-sub">Customer: ${booking.contactName} (${booking.contactPhone})</div>
              </div>
            </div>

            <!-- Important Instructions -->
            <div class="instructions-box">
              <div class="inst-header">⚑ ${t.importantInstructions}</div>
              <ul class="inst-list">
                <li>• ${t.inst1}</li>
                <li>• ${t.inst2}</li>
                <li>• ${t.inst3}</li>
                <li>• ${t.inst4}</li>
              </ul>
            </div>
          </div>

          <!-- Stub Right Section -->
          <div class="ticket-stub">
            <div class="stub-header">
              <span class="stub-tag">${deckLabel.toUpperCase()}</span>
              <div class="seat-badge">${seat}</div>
              <span class="seat-title">${t.seatNumber}</span>
            </div>

            <div class="qr-container">
              ${qrUrl ? `<img src="${qrUrl}" alt="QR" class="qr-img"/>` : `<div class="qr-placeholder">QR CODE</div>`}
              <span class="qr-label">${booking.invoiceNo}-${seat}</span>
            </div>

            <div class="stub-footer">
              <div class="payment-status ${isPaid ? "paid" : "due"}">
                ${isPaid ? t.confirmed : `Due: ₹${dueAmount.toLocaleString()}`}
              </div>
              <div class="stub-verify">${t.scanVerification}</div>
            </div>
          </div>
        </div>
        `
      })
      .join("")

    return `<!DOCTYPE html>
<html lang="${selectedLang}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Boarding Passes - #${booking.invoiceNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#f8fafc; color:#0f172a; padding:20px; }
  
  .ticket-card {
    max-width: 820px;
    margin: 0 auto 28px;
    background: #ffffff;
    border: 2px solid #e2e8f0;
    border-radius: 16px;
    display: flex;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    page-break-after: always;
  }
  .ticket-card:last-child {
    page-break-after: avoid;
  }

  /* Left Main */
  .ticket-main {
    flex: 1;
    padding: 24px 28px;
    border-right: 2px dashed #cbd5e1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .ticket-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 12px;
  }
  .company-brand h2 {
    font-size: 20px;
    font-weight: 900;
    color: ${accentColor};
    letter-spacing: -0.02em;
  }
  .company-brand .tagline {
    font-size: 10px;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .company-brand .hq {
    font-size: 10px;
    font-weight: 600;
    color: #94a3b8;
    margin-top: 2px;
  }
  .ticket-badge {
    text-align: right;
  }
  .badge-title {
    display: inline-block;
    background: ${accentColor};
    color: #fff;
    font-size: 10px;
    font-weight: 900;
    padding: 3px 10px;
    border-radius: 999px;
    letter-spacing: 0.15em;
  }
  .badge-sub {
    display: block;
    font-size: 9px;
    font-weight: 700;
    color: #94a3b8;
    margin-top: 4px;
  }

  .tour-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 12px 18px;
    margin: 14px 0;
  }
  .tour-title {
    font-size: 16px;
    font-weight: 900;
    color: #0f172a;
  }
  .journey-date {
    font-size: 15px;
    font-weight: 900;
    color: ${accentColor};
  }

  .passenger-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 14px;
  }
  .meta-label {
    display: block;
    font-size: 8px;
    font-weight: 900;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-bottom: 2px;
  }
  .meta-value-bold {
    font-size: 13px;
    font-weight: 900;
    color: #0f172a;
  }
  .meta-sub {
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
    margin-top: 1px;
  }

  .instructions-box {
    background: #f8fafc;
    border-radius: 10px;
    padding: 10px 14px;
    border: 1px solid #f1f5f9;
  }
  .inst-header {
    font-size: 9px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #334155;
    margin-bottom: 4px;
  }
  .inst-list {
    list-style: none;
    font-size: 8.5px;
    font-weight: 600;
    color: #64748b;
    line-height: 1.5;
  }

  /* Right Stub */
  .ticket-stub {
    width: 210px;
    background: #fafafa;
    padding: 24px 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    text-align: center;
  }
  .stub-tag {
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.15em;
    color: #64748b;
    text-transform: uppercase;
  }
  .seat-badge {
    font-size: 32px;
    font-weight: 900;
    color: ${accentColor};
    letter-spacing: -0.04em;
    line-height: 1.1;
  }
  .seat-title {
    font-size: 9px;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .qr-container {
    margin: 12px 0;
  }
  .qr-img {
    width: 110px;
    height: 110px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 3px;
    background: #fff;
  }
  .qr-placeholder {
    width: 110px;
    height: 110px;
    background: #e2e8f0;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 900;
    color: #64748b;
  }
  .qr-label {
    display: block;
    font-size: 9px;
    font-family: monospace;
    font-weight: 800;
    color: #475569;
    margin-top: 4px;
  }

  .payment-status {
    display: inline-block;
    font-size: 10px;
    font-weight: 900;
    padding: 3px 8px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .payment-status.paid {
    background: #ecfdf5;
    color: #059669;
  }
  .payment-status.due {
    background: #fffbeb;
    color: #b45309;
  }
  .stub-verify {
    font-size: 8px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    margin-top: 4px;
  }

  @page { size: A4 portrait; margin: 10mm; }
  @media print {
    body { background: #ffffff; padding: 0; }
    .ticket-card { box-shadow: none; border-color: #cbd5e1; margin-bottom: 20px; }
  }
</style>
</head>
<body>
  ${ticketsHTML}
</body>
</html>`
  }

  const handlePrint = (paxIndex) => {
    const html = buildPrintableHTML(paxIndex)
    const win = window.open("", "_blank", "width=900,height=750")
    if (!win) {
      alert("Please allow popups to print boarding passes.")
      return
    }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => {
      win.print()
    }, 500)
  }

  const handleShareWhatsApp = (pax) => {
    const seat = pax.seatId || "—"
    const text = `*${companyName.toUpperCase()} — ${t.boardingPass.toUpperCase()}*\n\n*${t.tourName}:* ${booking.tourName}\n*${t.journeyDate}:* ${formatDisplayDate(booking.journeyDate)}\n*${t.travelerName}:* ${pax.name}\n*${t.seatNumber}:* ${seat} (${getDeckLabel(seat)})\n*${t.busNumber}:* ${busNumber}\n*Invoice #:* ${booking.invoiceNo}\n\n*${t.emergencyContact}:* ${organizerContact}\n\n_${t.inst1}_\n_${t.inst2}_\n\n*${t.wishJourney}*`
    const phone = booking.contactPhone?.replace(/\D/g, "")
    const url = `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`
    window.open(url, "_blank")
  }

  const activePax =
    selectedPaxIndex === "all"
      ? passengers[0] || {}
      : passengers[selectedPaxIndex] || {}

  const activePaxIdx = selectedPaxIndex === "all" ? 0 : selectedPaxIndex
  const activeQrUrl = qrCodes[activePaxIdx] || ""

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden my-auto">
        {/* Top Header & Language Picker */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-2xl text-white shadow-md shadow-indigo-100"
              style={{ backgroundColor: accentColor }}
            >
              <Bus size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">
                {t.boardingPass} & QR Pass
              </h3>
              <p className="text-xs font-bold text-slate-400">
                Invoice #{booking.invoiceNo} • {passengers.length} {t.totalPax}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Language Selector */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-xs">
              <Languages size={14} className="text-slate-400 ml-2 mr-1" />
              {DOCUMENT_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setSelectedLang(lang.code)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                    selectedLang === lang.code
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {lang.native}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors ml-2"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Passenger Tabs */}
        <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedPaxIndex("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all ${
              selectedPaxIndex === "all"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.allPassengers} ({passengers.length})
          </button>
          {passengers.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedPaxIndex(idx)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 flex items-center gap-1.5 transition-all ${
                selectedPaxIndex === idx
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-200"
              }`}
            >
              <User size={12} />
              <span>{p.name || `Pax ${idx + 1}`}</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                  selectedPaxIndex === idx ? "bg-white/20 text-white" : "bg-slate-100 text-indigo-600"
                }`}
              >
                {p.seatId || "—"}
              </span>
            </button>
          ))}
        </div>

        {/* Modal Body / Ticket Card Preview */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xl flex flex-col md:flex-row">
            {/* Left Main */}
            <div className="flex-1 p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-dashed border-slate-200">
              <div>
                {/* Header */}
                <div className="flex justify-between items-start gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h2
                      className="text-xl font-black tracking-tight"
                      style={{ color: accentColor }}
                    >
                      {companyName.toUpperCase()}
                    </h2>
                    <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mt-0.5">
                      {user?.companyTagline || "Tourism & Travels"}
                    </p>
                    {companyPhone && (
                      <p className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-1">
                        <Phone size={12} /> {companyPhone}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className="inline-block px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white rounded-full shadow-xs"
                      style={{ backgroundColor: accentColor }}
                    >
                      {t.boardingPass}
                    </span>
                    <span className="block text-[9px] font-bold text-slate-400 mt-1">
                      {t.ticketVerifiedNotice}
                    </span>
                  </div>
                </div>

                {/* Tour Banner */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 my-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {t.tourName}
                    </span>
                    <h4 className="text-base font-black text-slate-900 mt-0.5">
                      {booking.tourName}
                    </h4>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {t.journeyDate}
                    </span>
                    <p
                      className="text-sm font-black mt-0.5"
                      style={{ color: accentColor }}
                    >
                      {formatDisplayDate(booking.journeyDate)}
                    </p>
                  </div>
                </div>

                {/* Passenger Info Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {t.travelerName}
                    </span>
                    <p className="text-sm font-black text-slate-900 mt-0.5">
                      {activePax.name || `Passenger ${activePaxIdx + 1}`}
                    </p>
                    <p className="text-xs font-bold text-slate-500">
                      {activePax.age ? `${activePax.age}Y` : ""} • {activePax.gender || ""} • {activePax.city || ""}{activePax.aadhar ? ` • ${maskAadhaar(activePax.aadhar)}` : ""}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {t.busNumber}
                    </span>
                    <p className="text-sm font-black text-slate-900 mt-0.5">
                      {busNumber}
                    </p>
                    <p className="text-xs font-bold text-slate-500 font-mono">
                      Inv #{booking.invoiceNo}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {t.emergencyContact}
                    </span>
                    <p className="text-xs font-black text-slate-900 mt-0.5">
                      {organizerContact}
                    </p>
                    <p className="text-[11px] font-bold text-slate-500">
                      {booking.contactName} ({booking.contactPhone})
                    </p>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 text-[11px] text-slate-600">
                <p className="font-black text-slate-800 text-[10px] uppercase tracking-wider mb-1">
                  ⚑ {t.importantInstructions}
                </p>
                <p className="font-semibold text-slate-500 leading-snug">
                  • {t.inst1} <br />
                  • {t.inst2}
                </p>
              </div>
            </div>

            {/* Right Stub */}
            <div className="w-full md:w-56 bg-slate-50/80 p-6 flex flex-col items-center justify-between text-center gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {getDeckLabel(activePax.seatId)}
                </span>
                <div
                  className="text-4xl font-black my-1"
                  style={{ color: accentColor }}
                >
                  {activePax.seatId || "—"}
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {t.seatNumber}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
                {activeQrUrl ? (
                  <img
                    src={activeQrUrl}
                    alt="QR"
                    className="w-28 h-28 object-contain"
                  />
                ) : (
                  <div className="w-28 h-28 bg-slate-100 rounded-xl flex items-center justify-center text-xs font-bold text-slate-400">
                    Loading QR...
                  </div>
                )}
                <span className="text-[9px] font-mono font-bold text-slate-400 mt-1">
                  {booking.invoiceNo}-{activePax.seatId || "PAX"}
                </span>
              </div>

              <div>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    (booking.advanceReceived || 0) >= (booking.totalAmount || 0)
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {(booking.advanceReceived || 0) >= (booking.totalAmount || 0)
                    ? t.confirmed
                    : `Due ₹${Math.max(0, (booking.totalAmount || 0) - (booking.advanceReceived || 0)).toLocaleString()}`}
                </span>
                <p className="text-[9px] font-bold text-slate-400 mt-1">
                  {t.scanVerification}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-400">
            {selectedPaxIndex === "all" ? (
              <span>
                Printing will generate <strong>{passengers.length}</strong> separate boarding passes
              </span>
            ) : (
              <span>
                Showing pass for <strong>{activePax.name || `Pax ${activePaxIdx + 1}`}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleShareWhatsApp(activePax)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs transition-colors"
            >
              <Share2 size={15} />
              <span>{t.shareTicket}</span>
            </button>

            <button
              type="button"
              onClick={() => handlePrint(selectedPaxIndex)}
              className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-black text-xs shadow-md transition-all"
              style={{ backgroundColor: accentColor }}
            >
              <Printer size={15} />
              <span>
                {selectedPaxIndex === "all"
                  ? `${t.printAllTickets} (${passengers.length})`
                  : t.printTicket}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
