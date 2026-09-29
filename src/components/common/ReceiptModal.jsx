import { useState } from "react"
import {
  X,
  Printer,
  Share2,
  Receipt,
  Languages,
  CheckCircle2,
  AlertCircle,
  Phone,
  Calendar,
  IndianRupee,
} from "lucide-react"
import { DOCUMENT_LANGUAGES, getDocumentTranslation } from "../../i18n/documents"
import { formatDisplayDate } from "../../utils/date"

export default function ReceiptModal({
  booking,
  payment,
  user,
  onClose,
}) {
  const [selectedLang, setSelectedLang] = useState(user?.documentLanguage || "en")

  const t = getDocumentTranslation(selectedLang)
  const theme = user?.invoiceTheme || "classic"
  const accentColor = user?.invoiceColor || "#4f46e5"
  const companyName = user?.companyName || "YATRA TOURS"
  const companyPhone = user?.companyPhone || ""
  const companyHQ = user?.companyHeadquarters || ""
  const gstNumber = user?.gstNumber || ""

  const suffix = (payment?._id || booking?._id || "0001").toString().slice(-4)
  const receiptNo = payment?.receiptNo || `#${user?.receiptPrefix || "REC"}-${suffix}`
  const paymentDate = formatDisplayDate(payment?.paymentDate || payment?.date || booking?.date)
  const amount = Math.abs(Number(payment?.amount || payment?.paymentAmount || 0))
  const isRefund = payment?.type === "refund" || Number(payment?.amount) < 0
  const isVoid = Boolean(payment?.isVoid)
  const balance = Math.max(0, (booking.totalAmount || 0) - (booking.advanceReceived || 0))

  const buildPrintableHTML = () => {
    return `<!DOCTYPE html>
<html lang="${selectedLang}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Receipt ${receiptNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#f8fafc; color:#0f172a; padding:30px; }
  
  .receipt-box {
    max-width: 680px;
    margin: 0 auto;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: ${theme === "modern" ? "16px" : theme === "minimal" ? "4px" : "8px"};
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    overflow: hidden;
  }
  
  .header {
    background: ${theme === "minimal" ? "#ffffff" : accentColor};
    color: ${theme === "minimal" ? "#0f172a" : "#ffffff"};
    border-bottom: 2px solid ${accentColor};
    padding: 24px 30px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .brand-title { font-size: 22px; font-weight: 900; letter-spacing: -0.02em; }
  .brand-sub { font-size: 10px; font-weight: 700; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.1em; }
  
  .receipt-tag {
    text-align: right;
  }
  .receipt-badge {
    background: ${theme === "minimal" ? "#f1f5f9" : "rgba(255,255,255,0.2)"};
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }
  .receipt-num { font-size: 15px; font-weight: 900; margin-top: 4px; font-family: monospace; }

  .content { padding: 24px 30px; }

  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding-bottom: 20px;
    border-bottom: 1px solid #e2e8f0;
    margin-bottom: 20px;
  }
  .label { font-size: 9px; font-weight: 900; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em; }
  .val { font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 2px; }

  .amount-card {
    background: #f8fafc;
    border: 2px dashed ${accentColor};
    border-radius: 12px;
    padding: 18px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
  .amount-big { font-size: 32px; font-weight: 900; color: ${accentColor}; }

  .table-rows { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
  .table-rows tr { border-bottom: 1px solid #f1f5f9; }
  .table-rows td { padding: 10px 0; }
  .table-rows td:last-child { text-align: right; font-weight: 900; }

  .footer-sign {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 36px;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
  }
  .sign-line { width: 180px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px; }

  @media print {
    body { background: #fff; padding: 0; }
    .receipt-box { box-shadow: none; border-color: #cbd5e1; }
  }
</style>
</head>
<body>
  <div class="receipt-box">
    <div class="header">
      <div>
        <div class="brand-title">${companyName.toUpperCase()}</div>
        <div class="brand-sub">${user?.companyTagline || "Tourism & Travels"}</div>
        <div style="font-size:10px;margin-top:2px;">📍 ${companyHQ} | 📞 ${companyPhone} ${gstNumber ? " | GSTIN: " + gstNumber : ""}</div>
      </div>
      <div class="receipt-tag">
        <div class="receipt-badge">${isRefund ? t.refundIssued : t.paymentReceipt}</div>
        <div class="receipt-num">${receiptNo}</div>
      </div>
    </div>

    <div class="content">
      ${isVoid ? `<div style="background:#fee2e2;color:#b91c1c;padding:10px;text-align:center;font-weight:900;border-radius:8px;margin-bottom:16px;">${t.voidedReceipt}</div>` : ""}

      <div class="meta-grid">
        <div>
          <div class="label">${t.receivedFrom}</div>
          <div class="val">${booking.contactName}</div>
          <div style="font-size:11px;color:#64748b;font-weight:700;">📞 ${booking.contactPhone}</div>
        </div>
        <div style="text-align:right;">
          <div class="label">${t.paymentDate}</div>
          <div class="val">${paymentDate}</div>
          <div style="font-size:11px;color:#64748b;font-weight:700;">Invoice: #${booking.invoiceNo}</div>
        </div>
      </div>

      <div class="amount-card">
        <div>
          <div class="label">${t.amountReceived}</div>
          <div style="font-size:11px;font-weight:700;color:#64748b;margin-top:2px;">
            ${t.paymentMode}: <strong style="color:#0f172a;">${(payment?.paymentMode || payment?.mode || "Cash").toUpperCase()}</strong>
          </div>
        </div>
        <div class="amount-big">
          ₹${amount.toLocaleString()}
        </div>
      </div>

      <table class="table-rows">
        <tr>
          <td><span class="label">${t.paymentFor}</span></td>
          <td>${booking.tourName} (${formatDisplayDate(booking.journeyDate)})</td>
        </tr>
        <tr>
          <td><span class="label">${t.totalBill}</span></td>
          <td>₹${(booking.totalAmount || 0).toLocaleString()}</td>
        </tr>
        <tr>
          <td><span class="label">${t.advancePaid} / ${t.totalPaidSoFar}</span></td>
          <td style="color:#059669;">₹${(booking.advanceReceived || 0).toLocaleString()}</td>
        </tr>
        <tr>
          <td><span class="label">${t.balancePayable}</span></td>
          <td style="color:${balance > 0 ? '#b45309' : '#059669'};">
            ${balance > 0 ? `₹${balance.toLocaleString()}` : t.confirmed}
          </td>
        </tr>
        ${payment?.notes ? `<tr><td><span class="label">${t.notes}</span></td><td>${payment.notes}</td></tr>` : ""}
      </table>

      <div class="footer-sign">
        <div style="font-size:10px;color:#94a3b8;font-weight:700;">
          ${t.paymentSuccessNotice}
        </div>
        <div style="text-align:center;">
          <div class="sign-line"></div>
          <div class="label">${t.authorizedSignatory}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`
  }

  const handlePrint = () => {
    const html = buildPrintableHTML()
    const win = window.open("", "_blank", "width=800,height=700")
    if (!win) {
      alert("Please allow popups to print receipts.")
      return
    }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => {
      win.print()
    }, 500)
  }

  const handleShareWhatsApp = () => {
    const text = `*${companyName.toUpperCase()} — ${t.paymentReceipt.toUpperCase()}*\n\n*${t.receiptNo}:* ${receiptNo}\n*${t.paymentDate}:* ${paymentDate}\n*${t.receivedFrom}:* ${booking.contactName}\n*${t.amountReceived}:* ₹${amount.toLocaleString()} (${(payment?.paymentMode || payment?.mode || "Cash").toUpperCase()})\n*${t.tourName}:* ${booking.tourName} (Inv #${booking.invoiceNo})\n*${t.balancePayable}:* ₹${balance.toLocaleString()}\n\n_${t.paymentSuccessNotice}_\n*${t.wishJourney}*`
    const phone = booking.contactPhone?.replace(/\D/g, "")
    const url = `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`
    window.open(url, "_blank")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-2xl text-white shadow-md shadow-indigo-100"
              style={{ backgroundColor: accentColor }}
            >
              <Receipt size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                {t.paymentReceipt}
              </h3>
              <p className="text-xs font-bold text-slate-400 font-mono">
                {receiptNo}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-xs">
              <Languages size={13} className="text-slate-400 ml-2 mr-1" />
              {DOCUMENT_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setSelectedLang(lang.code)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-black transition-all ${
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
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body Preview */}
        <div className="p-6 bg-slate-50/50 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            {isVoid && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center text-xs font-black text-red-700">
                {t.voidedReceipt}
              </div>
            )}

            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-base font-black text-slate-900">
                  {companyName.toUpperCase()}
                </h4>
                <p className="text-xs font-bold text-slate-400">
                  {companyHQ} • {companyPhone}
                </p>
              </div>
              <div className="text-right">
                <span
                  className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  {t.paymentReceipt}
                </span>
                <p className="text-xs font-bold text-slate-500 font-mono mt-1">
                  {paymentDate}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  {t.amountReceived}
                </span>
                <p className="text-xs font-bold text-slate-600">
                  {t.paymentMode}: <strong className="text-slate-900 uppercase">{(payment?.paymentMode || payment?.mode || "Cash")}</strong>
                </p>
              </div>
              <div
                className="text-2xl font-black"
                style={{ color: accentColor }}
              >
                ₹{amount.toLocaleString()}
              </div>
            </div>

            <div className="space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex justify-between pt-1">
                <span className="text-slate-400 font-bold">{t.receivedFrom}</span>
                <span className="text-slate-900 font-black">{booking.contactName} ({booking.contactPhone})</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-400 font-bold">{t.paymentFor}</span>
                <span className="text-slate-900 font-black">{booking.tourName}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-400 font-bold">{t.totalBill}</span>
                <span className="text-slate-900 font-black">₹{(booking.totalAmount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-400 font-bold">{t.balancePayable}</span>
                <span className={`font-black ${balance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {balance > 0 ? `₹${balance.toLocaleString()}` : t.confirmed}
                </span>
              </div>
              {payment?.notes && (
                <div className="flex justify-between pt-2">
                  <span className="text-slate-400 font-bold">{t.notes}</span>
                  <span className="text-slate-600 font-medium">{payment.notes}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs transition-colors"
          >
            <Share2 size={15} />
            <span>Share</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-black text-xs shadow-md transition-all"
            style={{ backgroundColor: accentColor }}
          >
            <Printer size={15} />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  )
}
