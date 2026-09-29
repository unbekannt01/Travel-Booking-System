import { useState, useEffect, useMemo } from "react"
import QRCode from "qrcode"
import {
  X,
  Printer,
  Share2,
  Bus,
  Languages,
  User,
  LayoutTemplate,
} from "lucide-react"
import { DOCUMENT_LANGUAGES, getDocumentTranslation } from "../../i18n/documents"
import { formatDisplayDate } from "../../utils/date"
import {
  TICKET_TEMPLATES,
  getTicketTemplate,
  buildBatchPrintableTicketsHTML,
  buildSingleTicketCardHTML,
} from "../tickets/ticketRegistry"

export default function BoardingPassModal({
  booking,
  departure,
  user,
  onClose,
  initialPassengerIndex = 0,
}) {
  const [selectedLang, setSelectedLang] = useState(user?.documentLanguage || "en")
  const [selectedTemplate, setSelectedTemplate] = useState(
    user?.ticketTemplate || "classic"
  )
  const [selectedPaxIndex, setSelectedPaxIndex] = useState(
    initialPassengerIndex === "all" ? "all" : Number(initialPassengerIndex) || 0
  )
  const [qrCodes, setQrCodes] = useState({})

  const t = getDocumentTranslation(selectedLang)
  const accentColor = user?.invoiceColor || getTicketTemplate(selectedTemplate).accentDefault
  const companyName = user?.companyName || "YATRA TOURS"
  const companyPhone = user?.companyPhone || ""
  const busNumber =
    departure?.busNumber ||
    booking?.busNumber ||
    booking?.busType ||
    "AC Sleeper Coach"

  const primaryOrganizer = user?.organizers?.[0]
  const organizerContact = primaryOrganizer
    ? `${primaryOrganizer.name} (${primaryOrganizer.phone})`
    : companyPhone || "Operator Office"

  const rawPassengers = booking?.passengers
  const passengers = useMemo(() => rawPassengers || [], [rawPassengers])

  // Generate QR codes for all passengers
  useEffect(() => {
    let isMounted = true
    const generateQRs = async () => {
      const generated = {}
      for (let i = 0; i < passengers.length; i++) {
        const pax = passengers[i]
        const seat = pax.seatId || `P${i + 1}`
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

  const handlePrint = (paxIndex) => {
    const listToPrint =
      paxIndex === "all"
        ? passengers.map((p, idx) => ({ pax: p, idx, qrUrl: qrCodes[idx] || "" }))
        : [{ pax: passengers[paxIndex], idx: paxIndex, qrUrl: qrCodes[paxIndex] || "" }]

    const html = buildBatchPrintableTicketsHTML({
      templateId: selectedTemplate,
      booking,
      passengersWithQRs: listToPrint,
      user,
      departure,
      lang: selectedLang,
    })

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
    }, 450)
  }

  const handleShareWhatsApp = (pax) => {
    const seat = pax.seatId || "—"
    const text = `*${companyName.toUpperCase()} — ${t.boardingPass.toUpperCase()}*\n\n*${t.tourName}:* ${booking.tourName}\n*${t.journeyDate}:* ${formatDisplayDate(booking.journeyDate)}\n*${t.travelerName}:* ${pax.name}\n*${t.seatNumber}:* ${seat}\n*${t.busNumber}:* ${busNumber}\n*Invoice #:* ${booking.invoiceNo}\n\n*${t.emergencyContact}:* ${organizerContact}\n\n_${t.inst1}_\n_${t.inst2}_\n\n*${t.wishJourney}*`
    const phone = booking.contactPhone?.replace(/\D/g, "")
    const url = `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`
    window.open(url, "_blank")
  }

  const activePaxIdx = selectedPaxIndex === "all" ? 0 : selectedPaxIndex
  const activePax = useMemo(() => passengers[activePaxIdx] || {}, [passengers, activePaxIdx])
  const activeQrUrl = qrCodes[activePaxIdx] || ""

  // Generate preview HTML for current active pax
  const singleTicketHTML = useMemo(() => {
    if (!activePax.name && passengers.length === 0) return ""
    return buildSingleTicketCardHTML({
      templateId: selectedTemplate,
      booking,
      pax: activePax,
      idx: activePaxIdx,
      qrUrl: activeQrUrl,
      user,
      departure,
      lang: selectedLang,
    })
  }, [
    selectedTemplate,
    booking,
    activePax,
    activePaxIdx,
    activeQrUrl,
    user,
    departure,
    selectedLang,
    passengers.length,
  ])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden my-auto">
        {/* Top Header with Template & Language Pickers */}
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

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Ticket Template Selector */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2.5 py-1 shadow-xs gap-1.5">
              <LayoutTemplate size={14} className="text-indigo-600" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Design:
              </span>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-800 outline-none cursor-pointer pr-1"
              >
                {TICKET_TEMPLATES.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.name} ({tmpl.badge})
                  </option>
                ))}
              </select>
            </div>

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
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors ml-1"
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
                  selectedPaxIndex === idx
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-indigo-600"
                }`}
              >
                {p.seatId || "—"}
              </span>
            </button>
          ))}
        </div>

        {/* Modal Body: Ticket Preview Rendered with Ticket Styles */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100/60">
          <div className="max-w-3xl mx-auto">
            {/* Inline ticket stylesheet to render the HTML preview correctly */}
            <style>{`
              .ticket-classic { background: #ffffff; border: 2px solid #e2e8f0; border-radius: 16px; display: flex; overflow: hidden; box-shadow: 0 4px 18px rgba(0,0,0,0.06); }
              .classic-main { flex: 1; padding: 22px 26px; border-right: 2px dashed #cbd5e1; display: flex; flex-direction: column; justify-content: space-between; }
              .classic-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; }
              .brand-title { font-size: 19px; font-weight: 900; letter-spacing: -0.02em; }
              .brand-tagline { font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
              .brand-sub { font-size: 9.5px; font-weight: 600; color: #94a3b8; margin-top: 2px; }
              .ticket-badge { text-align: right; }
              .badge-pill { display: inline-block; color: #fff; font-size: 9.5px; font-weight: 900; padding: 3px 10px; border-radius: 999px; letter-spacing: 0.12em; }
              .badge-sub-text { display: block; font-size: 9px; font-weight: 700; color: #94a3b8; margin-top: 3px; }
              .classic-tour-strip { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; margin: 12px 0; }
              .label-tiny { display: block; font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; }
              .title-bold { font-size: 15px; font-weight: 900; color: #0f172a; }
              .date-bold { font-size: 14px; font-weight: 900; }
              .classic-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
              .val-bold { font-size: 12.5px; font-weight: 900; color: #0f172a; }
              .val-sub { font-size: 9.5px; font-weight: 600; color: #64748b; margin-top: 1px; }
              .classic-instructions { background: #f8fafc; border-radius: 8px; padding: 8px 12px; border: 1px solid #f1f5f9; font-size: 8.5px; color: #64748b; }
              .inst-head { display: block; font-weight: 900; text-transform: uppercase; color: #334155; margin-bottom: 2px; }
              .classic-stub { width: 210px; background: #fafafa; padding: 22px 16px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; }
              .deck-tag { font-size: 8.5px; font-weight: 900; letter-spacing: 0.12em; color: #64748b; text-transform: uppercase; }
              .seat-huge { font-size: 32px; font-weight: 900; letter-spacing: -0.04em; line-height: 1.1; }
              .seat-label { font-size: 8.5px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
              .qr-box { margin: 8px 0; }
              .qr-img { width: 100px; height: 100px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 3px; background: #fff; }
              .qr-ph { width: 100px; height: 100px; background: #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #64748b; }
              .qr-code-text { display: block; font-size: 8.5px; font-family: monospace; font-weight: 800; color: #475569; margin-top: 3px; }
              .pay-tag { display: inline-block; font-size: 9px; font-weight: 900; padding: 2px 8px; border-radius: 6px; text-transform: uppercase; }
              .pay-tag.paid { background: #ecfdf5; color: #059669; }
              .pay-tag.due { background: #fffbeb; color: #b45309; }
              .scan-verify { font-size: 7.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }

              .ticket-modern { background: #ffffff; border-radius: 20px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
              .modern-accent-bar { height: 6px; width: 100%; }
              .modern-body { padding: 22px 26px; }
              .modern-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 16px; }
              .modern-brand { display: flex; align-items: center; gap: 10px; }
              .modern-logo-dot { width: 12px; height: 12px; border-radius: 999px; }
              .modern-company { font-size: 17px; font-weight: 900; color: #0f172a; }
              .modern-route { font-size: 11px; font-weight: 700; color: #64748b; }
              .modern-date-badge { text-align: right; }
              .modern-date { display: block; font-size: 13px; font-weight: 800; color: #0f172a; }
              .modern-inv { font-size: 9.5px; font-weight: 700; color: #94a3b8; font-family: monospace; }
              .modern-content { display: flex; gap: 20px; align-items: center; }
              .modern-details { flex: 1; }
              .modern-data-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }
              .modern-cell { background: #f8fafc; border-radius: 12px; padding: 10px 12px; border: 1px solid #e2e8f0; }
              .m-lbl { display: block; font-size: 8px; font-weight: 900; color: #94a3b8; letter-spacing: 0.08em; margin-bottom: 2px; }
              .m-val { font-size: 12px; font-weight: 900; color: #0f172a; }
              .m-sub { font-size: 9px; font-weight: 600; color: #64748b; }
              .modern-notes { display: flex; gap: 6px; flex-wrap: wrap; }
              .m-note-pill { background: #f1f5f9; color: #475569; font-size: 8.5px; font-weight: 800; padding: 3px 8px; border-radius: 999px; }
              .pill-paid { background: #ecfdf5; color: #047857; }
              .pill-due { background: #fffbeb; color: #b45309; }
              .modern-qr-card { width: 140px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px; text-align: center; }
              .m-seat-circle { font-size: 22px; font-weight: 900; border: 2px solid; border-radius: 12px; padding: 2px 0; margin-bottom: 2px; }
              .m-seat-lbl { font-size: 7.5px; font-weight: 800; color: #94a3b8; letter-spacing: 0.1em; display: block; margin-bottom: 6px; }
              .modern-qr-img { width: 85px; height: 85px; margin: 0 auto; display: block; border-radius: 6px; }
              .m-code { display: block; font-size: 8px; font-family: monospace; color: #64748b; margin-top: 4px; }

              .ticket-heritage { background: #fffcf8; border: 3px double #d97706; border-radius: 14px; padding: 12px; }
              .heritage-border { border: 1px solid #fde68a; border-radius: 8px; padding: 14px 18px; }
              .heritage-top { text-align: center; margin-bottom: 12px; }
              .heritage-symbol { font-size: 12px; font-weight: 900; color: #b45309; letter-spacing: 0.2em; }
              .heritage-title { font-size: 20px; font-weight: 900; letter-spacing: 0.04em; }
              .heritage-tag { font-size: 9.5px; font-weight: 800; color: #92400e; text-transform: uppercase; }
              .heritage-hq { font-size: 9px; color: #78350f; margin-top: 2px; }
              .heritage-strip { display: flex; justify-content: space-between; border-top: 2px solid; border-bottom: 2px solid; padding: 8px 12px; margin-bottom: 12px; background: #fffbeb; }
              .h-lbl { display: block; font-size: 8px; font-weight: 900; color: #92400e; letter-spacing: 0.08em; }
              .h-val-lg { font-size: 14px; font-weight: 900; color: #451a03; }
              .heritage-main { display: flex; gap: 16px; }
              .heritage-pax-box { flex: 1; }
              .h-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px; }
              .h-pax-name { font-size: 13px; font-weight: 900; color: #451a03; }
              .h-pax-sub { font-size: 9px; color: #78350f; }
              .heritage-guidelines { background: #fef3c7; border-radius: 6px; padding: 6px 10px; font-size: 8.5px; color: #78350f; border-left: 3px solid #d97706; }
              .heritage-seat-stub { width: 150px; text-align: center; border-left: 2px dashed; padding-left: 14px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; }
              .h-deck { font-size: 8px; font-weight: 900; color: #92400e; }
              .h-seat { font-size: 28px; font-weight: 900; line-height: 1.1; }
              .h-seat-label { font-size: 8px; font-weight: 800; color: #b45309; }
              .h-qr { margin: 6px 0; }
              .h-status { font-size: 8.5px; font-weight: 900; padding: 2px 6px; border-radius: 4px; }
              .h-paid { background: #dcfce7; color: #166534; }
              .h-due { background: #fee2e2; color: #991b1b; }

              .ticket-corporate { background: #ffffff; border: 2px solid #0f172a; border-radius: 8px; padding: 16px 20px; }
              .corp-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
              .corp-company { font-size: 18px; font-weight: 900; color: #0f172a; letter-spacing: -0.01em; }
              .corp-meta { font-size: 9px; color: #475569; font-weight: 600; margin-top: 2px; }
              .corp-doc-type { text-align: right; }
              .corp-badge { display: inline-block; background: #0f172a; color: #fff; font-size: 8.5px; font-weight: 900; padding: 2px 8px; border-radius: 3px; letter-spacing: 0.1em; }
              .corp-ref { display: block; font-size: 9px; font-family: monospace; font-weight: 800; color: #64748b; margin-top: 2px; }
              .corp-banner { display: grid; grid-template-columns: repeat(4, 1fr); background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 12px; margin-bottom: 12px; gap: 8px; }
              .c-lbl { display: block; font-size: 7.5px; font-weight: 900; color: #64748b; letter-spacing: 0.08em; }
              .c-val-bold { font-size: 11.5px; font-weight: 900; color: #0f172a; margin-top: 2px; }
              .corp-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
              .corp-table th { background: #f1f5f9; padding: 5px 8px; font-size: 8px; font-weight: 800; text-align: left; border: 1px solid #cbd5e1; }
              .corp-table td { padding: 6px 8px; font-size: 9.5px; border: 1px solid #cbd5e1; }
              .corp-footer-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
              .corp-instructions p { font-size: 8.5px; color: #64748b; margin-top: 2px; line-height: 1.4; }
              .corp-qr-wrap { display: flex; align-items: center; gap: 10px; justify-content: flex-end; }
              .corp-qr { width: 75px; height: 75px; border: 1px solid #cbd5e1; padding: 2px; }
              .corp-sign-box { text-align: center; }
              .sign-space { width: 110px; height: 35px; border-bottom: 1px dashed #94a3b8; }
              .corp-sign-box span { font-size: 7.5px; font-weight: 800; color: #64748b; display: block; margin-top: 3px; }

              .ticket-thermal { max-width: 520px; margin: 0 auto; }
              .thermal-box { background: #ffffff; border: 2px dashed #0f172a; padding: 16px 20px; font-family: "Courier New", Courier, monospace; }
              .thermal-top { text-align: center; }
              .th-company { font-size: 16px; font-weight: 900; }
              .th-phone { font-size: 9.5px; color: #475569; }
              .th-dashed { border-top: 1px dashed #0f172a; margin: 8px 0; }
              .th-inv-row { display: flex; justify-content: space-between; font-size: 9.5px; font-weight: 700; }
              .th-tour { font-size: 13px; font-weight: 900; margin: 4px 0; }
              .thermal-body { display: flex; gap: 14px; align-items: center; margin: 8px 0; }
              .th-seat-banner { background: #0f172a; color: #fff; padding: 10px; border-radius: 6px; text-align: center; min-width: 90px; }
              .th-deck { font-size: 8px; letter-spacing: 0.1em; }
              .th-seat { font-size: 24px; font-weight: 900; margin: 2px 0; }
              .th-coach { font-size: 8px; }
              .th-pax { flex: 1; font-size: 9px; line-height: 1.5; }
              .th-row { display: flex; justify-content: space-between; }
              .th-fare { border-top: 1px solid #e2e8f0; margin-top: 4px; padding-top: 2px; }
              .thermal-qr-box { text-align: center; }
              .thermal-qr { width: 75px; height: 75px; }
              .th-code { font-size: 8px; font-weight: 700; }
              .th-rules { font-size: 7.5px; text-align: center; color: #64748b; letter-spacing: 0.05em; }

              .ticket-transit { background: #ffffff; border-radius: 16px; border: 2px solid #e2e8f0; display: flex; overflow: hidden; }
              .transit-main { flex: 1; padding: 20px 24px; }
              .transit-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 12px; }
              .transit-route-badge { display: inline-block; background: #059669; color: #fff; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.08em; margin-bottom: 4px; }
              .transit-company { font-size: 18px; font-weight: 900; }
              .transit-tour { font-size: 13px; font-weight: 800; color: #1e293b; }
              .transit-date-box { text-align: right; }
              .tr-lbl { display: block; font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 0.08em; }
              .tr-date { font-size: 13px; font-weight: 900; color: #0f172a; }
              .tr-inv { font-size: 9px; color: #64748b; font-family: monospace; }
              .transit-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
              .transit-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; }
              .tr-val { font-size: 12px; font-weight: 900; color: #0f172a; margin-top: 2px; }
              .tr-sub { font-size: 8.5px; color: #64748b; }
              .transit-notice { display: flex; justify-content: space-between; font-size: 8.5px; font-weight: 700; color: #059669; background: #ecfdf5; padding: 6px 12px; border-radius: 8px; }
              .transit-stub { width: 190px; background: #f8fafc; border-left: 2px dashed #cbd5e1; padding: 20px 14px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; }
              .transit-deck-pill { font-size: 8.5px; font-weight: 900; padding: 3px 10px; border-radius: 999px; letter-spacing: 0.1em; color: #fff; }
              .deck-lower { background: #059669; }
              .deck-upper { background: #4f46e5; }
              .transit-seat { font-size: 32px; font-weight: 900; line-height: 1.1; margin: 4px 0; }
              .transit-qr-wrap { margin: 8px 0; }
              .tr-qr-code { display: block; font-size: 8px; font-family: monospace; color: #475569; margin-top: 2px; }
              .transit-footer { font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 0.1em; }
              .text-green { color: #059669 !important; }
              .text-amber { color: #d97706 !important; }
            `}</style>

            <div dangerouslySetInnerHTML={{ __html: singleTicketHTML }} />
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-400">
            {selectedPaxIndex === "all" ? (
              <span>
                Printing will generate <strong>{passengers.length}</strong> separate boarding passes in <strong>{getTicketTemplate(selectedTemplate).name}</strong> style
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
