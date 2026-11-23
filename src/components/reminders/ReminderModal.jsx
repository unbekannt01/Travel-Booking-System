import { useState, useEffect, useMemo } from "react"
import {
  Modal,
  Button,
  Badge,
} from "../ui"
import {
  REMINDER_TONES,
  REMINDER_LANGUAGES,
  DEFAULT_REMINDER_TEMPLATES,
  renderReminder,
  buildWhatsAppUrl,
  suggestTone,
  formatRupees,
} from "../../../shared/reminders"
import { normalizeIndianMobile } from "../../../shared/customers"
import { listReminderTemplates, createReminderLog, markReminderSent } from "../../data/reminders"
import {
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  RotateCcw,
} from "lucide-react"

const TONE_LABELS = {
  friendly: "Friendly",
  "due-soon": "Due Soon",
  overdue: "Overdue",
}

const LANGUAGE_LABELS = {
  en: "English",
  hi: "हिन्दी",
  gu: "ગુજરાતી",
}

function formatTimeAgo(date) {
  if (!date) return ""
  const diffMs = Date.now() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / (60 * 1000))
  if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export default function ReminderModal({
  isOpen,
  onClose,
  customer,
  bookings = [],
  company = null,
  user = null,
  queue = null,
  queueIndex = 0,
  onQueueNext = null,
  onReminderLogged = null,
}) {
  const [currentIdx, setCurrentIdx] = useState(queueIndex || 0)
  const [now] = useState(() => Date.now())

  // Sync internal index if queueIndex prop changes
  useEffect(() => {
    if (typeof queueIndex === "number") {
      setCurrentIdx(queueIndex)
    }
  }, [queueIndex])

  // Resolve target customer
  const isQueueMode = Array.isArray(queue) && queue.length > 0
  const activeCustomer = useMemo(() => {
    if (isQueueMode) {
      return queue[currentIdx] || null
    }
    return customer || null
  }, [isQueueMode, queue, currentIdx, customer])

  // Resolve bookings for active customer
  const activeBookings = useMemo(() => {
    if (activeCustomer?.bookings && Array.isArray(activeCustomer.bookings) && activeCustomer.bookings.length > 0) {
      return activeCustomer.bookings
    }
    if (Array.isArray(bookings) && bookings.length > 0) {
      return bookings
    }
    return []
  }, [activeCustomer, bookings])

  // Selected booking IDs state (for multi-booking customers)
  const [selectedBookingIds, setSelectedBookingIds] = useState(new Set())

  // Initialize selected bookings when active customer/bookings change
  useEffect(() => {
    if (activeBookings.length > 0) {
      const owing = activeBookings
        .filter((b) => (b.outstanding || b.totalOutstanding || 0) > 0)
        .map((b) => b.bookingId || b.id || b._id)
        .filter(Boolean)
      setSelectedBookingIds(new Set(owing.length > 0 ? owing : [activeBookings[0].bookingId || activeBookings[0].id || activeBookings[0]._id]))
    } else {
      setSelectedBookingIds(new Set())
    }
  }, [activeBookings])

  // Company info
  const companyProfile = useMemo(() => {
    return {
      companyName: company?.companyName || user?.companyName || "YatraHub",
      companyPhone: company?.companyPhone || user?.companyPhone || "",
      upiId: company?.bankDetails?.upiId || user?.bankDetails?.upiId || "",
    }
  }, [company, user])

  // Templates map cache
  const [templates, setTemplates] = useState(null)

  useEffect(() => {
    let isMounted = true
    const loadTemplates = async () => {
      try {
        const res = await listReminderTemplates()
        if (isMounted) setTemplates(res)
      } catch (e) {
        console.warn("Failed to load custom reminder templates; using defaults", e)
        if (isMounted) setTemplates(DEFAULT_REMINDER_TEMPLATES)
      }
    }
    if (isOpen) {
      loadTemplates()
    }
    return () => {
      isMounted = false
    }
  }, [isOpen])

  // Compute tone suggestion based on oldest dues or journey dates
  const suggestedTone = useMemo(() => {
    if (!activeCustomer) return "friendly"
    const daysOverdue = Number(activeCustomer.oldestOverdueDays || 0)
    let daysToJourney = 999
    for (const b of activeBookings) {
      if (b.journeyDate) {
        const jTime = new Date(b.journeyDate).getTime()
        const diffDays = Math.ceil((jTime - now) / (1000 * 60 * 60 * 24))
        if (diffDays < daysToJourney) daysToJourney = diffDays
      }
    }
    const remindersSent = Number(activeCustomer.reminderCount30d || 0)
    return suggestTone({ daysOverdue, daysToJourney, remindersSent })
  }, [activeCustomer, activeBookings, now])

  // Tone and Language selection
  const [tone, setTone] = useState("friendly")
  const [language, setLanguage] = useState("en")
  const [userEditedText, setUserEditedText] = useState(null)
  const [copied, setCopied] = useState(false)
  const [loggedReminderId, setLoggedReminderId] = useState(null)
  const [isSent, setIsSent] = useState(false)
  const [actionError, setActionError] = useState(null)

  // Reset tone & language when active customer changes
  useEffect(() => {
    if (activeCustomer) {
      setTone(suggestedTone)
      setLanguage(activeCustomer.language || activeCustomer.customerLanguage || "en")
      setUserEditedText(null)
      setCopied(false)
      setLoggedReminderId(null)
      setIsSent(false)
      setActionError(null)
    }
  }, [activeCustomer, suggestedTone])

  // Calculate financial values for current selection
  const selectedValues = useMemo(() => {
    if (!activeCustomer) {
      return {
        customerName: "",
        companyName: companyProfile.companyName,
        companyPhone: companyProfile.companyPhone,
        tourName: "",
        journeyDate: "",
        invoiceNo: "",
        balance: "₹0",
        totalAmount: "₹0",
        paidAmount: "₹0",
        daysOverdue: 0,
        upiId: companyProfile.upiId,
      }
    }

    const selectedList = activeBookings.filter((b) =>
      selectedBookingIds.has(b.bookingId || b.id || b._id)
    )

    const listToSum = selectedList.length > 0 ? selectedList : activeBookings

    let totalBal = 0
    let totalAmt = 0
    let totalPaid = 0
    let maxOverdue = Number(activeCustomer.oldestOverdueDays || 0)

    const tourNames = []
    const journeyDates = []
    const invoiceNos = []

    for (const b of listToSum) {
      const out = Number(b.outstanding || (b.totalAmount - (b.advanceReceived || 0)) || 0)
      totalBal += out
      totalAmt += Number(b.totalAmount || 0)
      totalPaid += Number(b.advanceReceived || b.collected || 0)
      if (b.daysOverdue > maxOverdue) maxOverdue = b.daysOverdue
      if (b.tourName && !tourNames.includes(b.tourName)) tourNames.push(b.tourName)
      if (b.journeyDate && !journeyDates.includes(b.journeyDate)) journeyDates.push(b.journeyDate)
      if (b.invoiceNo && !invoiceNos.includes(b.invoiceNo)) invoiceNos.push(b.invoiceNo)
    }

    if (totalBal === 0 && activeCustomer.totalOutstanding) {
      totalBal = activeCustomer.totalOutstanding
    }

    return {
      customerName: activeCustomer.customerName || activeCustomer.name || "Customer",
      companyName: companyProfile.companyName,
      companyPhone: companyProfile.companyPhone,
      tourName: tourNames.join(", ") || "Yatra Tour",
      journeyDate: journeyDates[0] || "",
      invoiceNo: invoiceNos.join(", ") || "",
      balance: formatRupees(totalBal),
      totalAmount: formatRupees(totalAmt),
      paidAmount: formatRupees(totalPaid),
      daysOverdue: maxOverdue,
      upiId: companyProfile.upiId,
    }
  }, [activeCustomer, activeBookings, selectedBookingIds, companyProfile])

  // Template body resolution
  const activeTemplateBody = useMemo(() => {
    if (!templates) {
      return DEFAULT_REMINDER_TEMPLATES[language]?.[tone] || ""
    }
    const t = templates[language]?.[tone]
    if (typeof t === "string") return t
    if (t?.body) return t.body
    return DEFAULT_REMINDER_TEMPLATES[language]?.[tone] || ""
  }, [templates, language, tone])

  // Live rendered text (from template or user edit)
  const renderedMessage = useMemo(() => {
    if (userEditedText !== null) {
      return userEditedText
    }
    return renderReminder({
      template: activeTemplateBody,
      values: selectedValues,
    })
  }, [userEditedText, activeTemplateBody, selectedValues])

  // Customer phone validation & opt-out checks
  const phone = activeCustomer?.customerPhone || activeCustomer?.phone || ""
  const phoneCheck = useMemo(() => normalizeIndianMobile(phone), [phone])
  const isOptedOut = Boolean(activeCustomer?.whatsappOptOut)

  // 24-hour reminder check
  const isWithin24Hours = useMemo(() => {
    if (!activeCustomer?.lastReminderAt) return false
    const diffHours = (now - new Date(activeCustomer.lastReminderAt).getTime()) / (1000 * 60 * 60)
    return diffHours < 24
  }, [activeCustomer, now])

  // Build WhatsApp link
  const waUrl = useMemo(() => {
    if (isOptedOut || !phoneCheck.valid || !renderedMessage) return null
    return buildWhatsAppUrl(phoneCheck.normalized, renderedMessage)
  }, [isOptedOut, phoneCheck, renderedMessage])

  // Toggle booking checkbox
  const toggleBooking = (id) => {
    setSelectedBookingIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size > 1) next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    setUserEditedText(null) // recompute template with new values
  }

  // Handle Copy
  const handleCopy = async () => {
    if (isOptedOut || !renderedMessage) return
    try {
      await navigator.clipboard.writeText(renderedMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Clipboard copy error:", err)
    }
  }

  // Handle WhatsApp Click (Trigger non-blocking log creation)
  const handleOpenWhatsApp = async () => {
    if (isOptedOut || !phoneCheck.valid) return
    setActionError(null)

    try {
      const bookingIdsList = Array.from(selectedBookingIds)
      const res = await createReminderLog({
        customerId: activeCustomer._id || activeCustomer.id || activeCustomer.customerId,
        bookingIds: bookingIdsList.length > 0 ? bookingIdsList : undefined,
        tone,
        language,
        templateSource: userEditedText ? "custom" : "default",
      })

      if (res?.id) {
        setLoggedReminderId(res.id)
        if (onReminderLogged) onReminderLogged(res)
      }
    } catch (err) {
      console.error("Failed to log reminder:", err)
      setActionError(err.message || "Failed to record reminder log")
    }
  }

  // Handle Mark as Sent
  const handleMarkSent = async () => {
    if (!loggedReminderId) return
    try {
      await markReminderSent(loggedReminderId)
      setIsSent(true)
    } catch (err) {
      console.error("Failed to mark reminder sent:", err)
      setActionError(err.message || "Failed to update reminder status")
    }
  }

  // Handle Next in Queue
  const handleNext = () => {
    if (!isQueueMode) {
      onClose()
      return
    }
    const nextIdx = currentIdx + 1
    if (nextIdx < queue.length) {
      setCurrentIdx(nextIdx)
      if (onQueueNext) onQueueNext(nextIdx)
    } else {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-brand" />
          <span>Send Payment Reminder</span>
          {isQueueMode && (
            <Badge variant="primary" size="sm" className="ml-2">
              Queue: {currentIdx + 1} of {queue.length}
            </Badge>
          )}
        </div>
      }
      size="lg"
    >
      <div className="space-y-4">
        {/* Customer Header Card */}
        {activeCustomer && (
          <div className="p-3.5 rounded-lg border border-border bg-surface-subtle flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-ink text-sm">
                  {activeCustomer.customerName || activeCustomer.name}
                </h4>
                {activeCustomer.isUnlinked && (
                  <Badge variant="neutral" size="sm">
                    Unlinked
                  </Badge>
                )}
              </div>
              <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 font-tabular">
                <span>{phoneCheck.valid ? `+91 ${phoneCheck.normalized}` : phone || "No phone"}</span>
                {activeCustomer.customerCity && <span>&bull; {activeCustomer.customerCity}</span>}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-ink-muted uppercase tracking-wider block">
                Total Due
              </span>
              <span className="font-mono font-bold text-base text-danger">
                {selectedValues.balance}
              </span>
            </div>
          </div>
        )}

        {/* 24h Frequency Warning */}
        {isWithin24Hours && (
          <div
            role="alert"
            className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2"
          >
            <Clock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <strong>Recent Reminder Sent:</strong> A reminder was sent to this customer{" "}
              {formatTimeAgo(activeCustomer.lastReminderAt)}. Avoid sending repeated messages within 24 hours.
            </div>
          </div>
        )}

        {/* Opt-out Alert Banner */}
        {isOptedOut && (
          <div
            role="alert"
            className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <strong>Customer Opted Out:</strong> This customer has opted out of WhatsApp messages.
              In accordance with privacy rules, reminder generation and WhatsApp links are disabled.
            </div>
          </div>
        )}

        {/* Invalid Phone Warning */}
        {!isOptedOut && !phoneCheck.valid && (
          <div
            role="alert"
            className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <strong>Invalid Phone Number:</strong> Please provide a valid 10-digit Indian mobile number
              starting with 6, 7, 8, or 9 in the customer master to send WhatsApp reminders.
            </div>
          </div>
        )}

        {/* Multiple Bookings Selector (if applicable) */}
        {!isOptedOut && activeBookings.length > 1 && (
          <div className="space-y-1.5 p-3 rounded-md border border-border bg-surface">
            <span className="text-xs font-semibold text-ink-secondary block">
              Include Bookings in Reminder:
            </span>
            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
              {activeBookings.map((b) => {
                const bId = b.bookingId || b.id || b._id
                const isChecked = selectedBookingIds.has(bId)
                const amt = b.outstanding || b.totalAmount || 0
                return (
                  <label
                    key={bId}
                    className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-surface-subtle cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleBooking(bId)}
                        className="rounded border-border text-brand focus:ring-brand"
                      />
                      <span className="font-semibold text-ink">#{b.invoiceNo}</span>
                      <span className="text-ink-muted truncate max-w-[160px]">{b.tourName}</span>
                    </div>
                    <span className="font-mono text-danger font-semibold">{formatRupees(amt)}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* Tone and Language Selection Row */}
        {!isOptedOut && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tone Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink-secondary">Reminder Tone</span>
                <span className="text-[11px] text-brand flex items-center gap-1 font-medium">
                  <Sparkles className="w-3 h-3" />
                  Suggested: {TONE_LABELS[suggestedTone]}
                </span>
              </div>
              <div
                className="flex items-center rounded-md border border-border p-0.5 bg-surface-subtle h-8"
                role="radiogroup"
                aria-label="Reminder tone"
              >
                {REMINDER_TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={tone === t}
                    onClick={() => {
                      setTone(t)
                      setUserEditedText(null)
                    }}
                    className={`flex-1 text-xs font-semibold rounded transition-colors cursor-pointer h-full ${
                      tone === t ? "bg-surface text-ink shadow-xs" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {TONE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Selector */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-ink-secondary block">Message Language</span>
              <div
                className="flex items-center rounded-md border border-border p-0.5 bg-surface-subtle h-8"
                role="radiogroup"
                aria-label="Message language"
              >
                {REMINDER_LANGUAGES.map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={language === l}
                    onClick={() => {
                      setLanguage(l)
                      setUserEditedText(null)
                    }}
                    className={`flex-1 text-xs font-semibold rounded transition-colors cursor-pointer h-full ${
                      language === l ? "bg-surface text-ink shadow-xs" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {LANGUAGE_LABELS[l]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Live Message Textarea & Character Count */}
        {!isOptedOut && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="reminder-message-editor" className="font-semibold text-ink-secondary">
                Message Preview (Editable)
              </label>
              <div className="flex items-center gap-2">
                {userEditedText !== null && (
                  <button
                    type="button"
                    onClick={() => setUserEditedText(null)}
                    className="text-brand hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to template
                  </button>
                )}
                <span
                  className={`font-mono text-[11px] ${
                    renderedMessage.length > 850 ? "text-danger font-bold" : "text-ink-muted"
                  }`}
                >
                  {renderedMessage.length} / 900
                </span>
              </div>
            </div>

            <textarea
              id="reminder-message-editor"
              rows={6}
              maxLength={900}
              value={renderedMessage}
              onChange={(e) => setUserEditedText(e.target.value)}
              disabled={isOptedOut}
              className="w-full text-xs p-3 rounded-lg border border-border bg-surface text-ink font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="Reminder message text..."
            />
          </div>
        )}

        {/* Error notice */}
        {actionError && (
          <div className="p-2.5 rounded bg-danger-subtle text-danger text-xs">{actionError}</div>
        )}

        {/* Modal Actions Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border-subtle">
          <div className="flex items-center gap-2">
            {!isOptedOut && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!renderedMessage}
                className="gap-1.5 text-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy Message"}
              </Button>
            )}

            {loggedReminderId && !isSent && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleMarkSent}
                className="gap-1.5 text-xs text-success border-success/40 hover:bg-success-soft"
              >
                <Check className="w-3.5 h-3.5" />
                Mark as Sent
              </Button>
            )}

            {isSent && (
              <Badge variant="success" size="sm" className="gap-1">
                <Check className="w-3 h-3" />
                Sent
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isQueueMode && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNext}
                className="text-xs"
              >
                Skip
              </Button>
            )}

            {!isOptedOut && waUrl ? (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleOpenWhatsApp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open WhatsApp
              </a>
            ) : null}

            {isQueueMode ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleNext}
                className="gap-1 text-xs"
              >
                {currentIdx < queue.length - 1 ? (
                  <>
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </>
                ) : (
                  "Finish"
                )}
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
                Close
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
