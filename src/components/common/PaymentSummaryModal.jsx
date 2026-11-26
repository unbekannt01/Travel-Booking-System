import { useState, useMemo, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import {
  X,
  Printer,
  FileDown,
  Languages,
  DollarSign,
  Receipt,
  Users,
  Check,
  Tag,
  Layers,
} from "lucide-react"
import { renderPaymentSummaryHtml, PAYMENT_SUMMARY_I18N } from "../../../shared/paymentSummary.js"
import { useToast } from "./ToastContext"
import { Button } from "../ui"
import { request } from "../../data/client"

/**
 * PaymentSummaryModal (Output 1)
 *
 * Displays a passenger-wise fare and payment breakdown for a booking or a group.
 * Sandboxed iframe live preview, direct browser print, and PDF export.
 */
export default function PaymentSummaryModal({
  isOpen,
  onClose,
  booking = null,
  group = null,
  memberBookings = [],
  payments = [],
  groupPayments = [],
  user = null,
  onGroupUpdated = null,
}) {
  const iframeRef = useRef(null)
  const modalRef = useRef(null)
  const { toast } = useToast()

  const [language, setLanguage] = useState(() => user?.documentLanguage || "en")
  const [nameScript, setNameScript] = useState("en") // 'en' | 'gu' | 'both'
  const [showDeckBreakdown, setShowDeckBreakdown] = useState(true)
  const [showTotalsSummary, setShowTotalsSummary] = useState(true)

  const initialDiscount = Number(group?.discount || booking?.discount || 0)
  const [discount, setDiscount] = useState(initialDiscount)
  const [savingDiscount, setSavingDiscount] = useState(false)

  useEffect(() => {
    setDiscount(Number(group?.discount || booking?.discount || 0))
  }, [group?.discount, booking?.discount])

  // Company metadata
  const companyInfo = useMemo(() => {
    return {
      companyName: user?.companyName || "YATRA HUB",
      companyPhone: user?.companyPhone || user?.phone || "",
      companyAddress: user?.address || user?.companyHeadquarters || "",
      gstNumber: user?.gstNumber || "",
      busNumber: booking?.busNumber || group?.busNumber || "",
    }
  }, [user, booking?.busNumber, group?.busNumber])

  // Generate sandboxed HTML with dynamic controls
  const htmlContent = useMemo(() => {
    if (!isOpen) return ""
    return renderPaymentSummaryHtml({
      booking,
      group,
      memberBookings,
      payments,
      groupPayments,
      companyInfo,
      language,
      nameScript,
      showDeckBreakdown,
      showTotalsSummary,
      discount: Number(discount) || 0,
    })
  }, [
    isOpen,
    booking,
    group,
    memberBookings,
    payments,
    groupPayments,
    companyInfo,
    language,
    nameScript,
    showDeckBreakdown,
    showTotalsSummary,
    discount,
  ])

  // Update preview iframe
  useEffect(() => {
    if (!isOpen || !iframeRef.current) return
    const iframe = iframeRef.current
    iframe.srcdoc = htmlContent
  }, [isOpen, htmlContent])

  // Save discount to group backend
  const handleSaveDiscount = async () => {
    if (!group?._id && !group?.id) return
    setSavingDiscount(true)
    try {
      const gId = group._id || group.id
      await request(`/api/groups/${gId}`, {
        method: "PATCH",
        body: JSON.stringify({ discount: Number(discount) || 0 }),
      })
      toast.success("Group discount saved!")
      if (onGroupUpdated) onGroupUpdated()
    } catch (err) {
      console.error("Save discount error:", err)
      toast.error(err.message || "Failed to save discount")
    } finally {
      setSavingDiscount(false)
    }
  }

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || typeof document === "undefined") return null

  const isGroup = Boolean(group || memberBookings.length > 0)
  const titleRef = isGroup
    ? group?.groupCode || group?.name || "Group Booking"
    : booking?.invoiceNo || "Booking"

  const handlePrint = () => {
    try {
      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        toast.error("Pop-up blocked. Please allow pop-ups to print payment summary.")
        return
      }

      printWindow.document.open()
      printWindow.document.write(htmlContent)
      printWindow.document.close()

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.focus()
          printWindow.print()
        }, 250)
      }
    } catch (err) {
      console.error("Print summary error:", err)
      toast.error("Failed to open print preview")
    }
  }

  const handleDownloadPdf = () => {
    toast.info("In the print dialog, select 'Save as PDF' as destination.")
    handlePrint()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-summary-title"
      ref={modalRef}
    >
      <div className="relative w-full max-w-4xl bg-surface border border-border-subtle rounded-[var(--yh-radius-2xl)] shadow-2xl flex flex-col h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle bg-surface-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              {isGroup ? <Users size={18} /> : <Receipt size={18} />}
            </div>
            <div>
              <h2 id="payment-summary-title" className="text-base sm:text-lg font-bold text-ink">
                Payment Summary {isGroup ? "(Group)" : ""}
              </h2>
              <p className="text-xs text-ink-muted">
                {titleRef} • {booking?.tourName || group?.tourName || "Tour Journey"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <div className="flex items-center gap-1 bg-surface-muted p-1 rounded-lg border border-border-subtle text-xs">
              <Languages size={14} className="text-ink-muted ml-1 mr-0.5" />
              {[
                { id: "en", label: "EN" },
                { id: "hi", label: "हिन्दी" },
                { id: "gu", label: "ગુજરાતી" },
              ].map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLanguage(l.id)}
                  className={`px-2 py-1 rounded font-bold cursor-pointer transition-colors ${
                    language === l.id
                      ? "bg-brand text-brand-fg shadow-xs"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Options & PDF Layout Customization Strip */}
        <div className="px-5 py-2.5 bg-surface-muted/60 border-b border-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Passenger Name Script */}
            <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border-subtle">
              <span className="text-[11px] font-semibold text-ink-muted px-1">Names:</span>
              <button
                type="button"
                onClick={() => setNameScript("en")}
                className={`px-2 py-0.5 rounded font-semibold text-xs cursor-pointer ${
                  nameScript === "en" ? "bg-brand text-brand-fg" : "text-ink-muted hover:text-ink"
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setNameScript("gu")}
                className={`px-2 py-0.5 rounded font-semibold text-xs cursor-pointer ${
                  nameScript === "gu" ? "bg-brand text-brand-fg" : "text-ink-muted hover:text-ink"
                }`}
              >
                ગુજરાતી
              </button>
              <button
                type="button"
                onClick={() => setNameScript("both")}
                className={`px-2 py-0.5 rounded font-semibold text-xs cursor-pointer ${
                  nameScript === "both" ? "bg-brand text-brand-fg" : "text-ink-muted hover:text-ink"
                }`}
              >
                Both
              </button>
            </div>

            {/* Optional PDF Sections Toggles */}
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-ink select-none">
              <input
                type="checkbox"
                checked={showDeckBreakdown}
                onChange={(e) => setShowDeckBreakdown(e.target.checked)}
                className="rounded text-brand focus:ring-brand"
              />
              <span>🛏️ Upper/Lower Dues</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-ink select-none">
              <input
                type="checkbox"
                checked={showTotalsSummary}
                onChange={(e) => setShowTotalsSummary(e.target.checked)}
                className="rounded text-brand focus:ring-brand"
              />
              <span>👥 Totals Summary</span>
            </label>
          </div>

          {/* Group Discount Field */}
          {isGroup && (
            <div className="flex items-center gap-1.5">
              <Tag size={13} className="text-emerald-600" />
              <span className="font-semibold text-ink">Discount:</span>
              <div className="flex items-center">
                <span className="px-1.5 py-1 text-xs bg-surface-muted border border-r-0 border-border-subtle rounded-l text-ink-muted font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0"
                  className="w-20 text-xs px-2 py-1 border border-border-subtle bg-surface text-ink font-bold tabular-nums outline-none focus:border-brand"
                />
                {group?._id && (
                  <button
                    type="button"
                    onClick={handleSaveDiscount}
                    disabled={savingDiscount || Number(discount) === initialDiscount}
                    className="px-2 py-1 text-xs bg-brand text-brand-fg rounded-r font-semibold hover:bg-brand-hover disabled:opacity-40 transition-colors cursor-pointer"
                    title="Save discount to group booking in database"
                  >
                    Save
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Body: Sandboxed Live Preview */}
        <div className="flex-1 p-3 sm:p-4 bg-surface-muted/20 overflow-hidden flex flex-col">
          <div className="flex-1 w-full bg-white rounded-xl shadow-inner border border-border-subtle overflow-hidden">
            <iframe
              ref={iframeRef}
              title="Payment Summary Preview"
              className="w-full h-full border-0"
              sandbox="allow-same-origin allow-modals"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-border-subtle bg-surface-muted/40">
          <div className="text-xs text-ink-muted flex items-center gap-1.5">
            <DollarSign size={14} className="text-emerald-600" />
            <span>Clean passenger list with overall group settlement and deck dues.</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadPdf}
              icon={<FileDown size={14} />}
            >
              Download PDF
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              icon={<Printer size={14} />}
            >
              Print Summary
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
