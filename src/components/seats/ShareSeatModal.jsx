import { useState, useEffect, useMemo, useRef } from "react"
import {
  Share2,
  Download,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  X,
  RotateCcw,
  Info,
  Phone,
  User,
} from "lucide-react"
import {
  generateSeatImageBlob,
  downloadSeatImage,
  formatWhatsAppSeatMessage,
  normalizeIndianPhone,
} from "../../utils/seatImage"
import { resolveSeatId } from "../../../shared/seatLayouts.js"
import { formatSeatLabel } from "../../utils/seatFormatting"
import { useToast } from "../common/ToastContext"
import { Button, Badge, FOCUS_RING_CLASS } from "../ui"

const EMPTY_OBJECT = Object.freeze({})

/**
 * ShareSeatModal (Part 6S-3a)
 *
 * Manual WhatsApp seat card and text sharing dialog for bus operators.
 * - Live preview of Canvas-drawn 1080px seat image matching coach layout
 * - Multi-passenger selection (default all booking passengers)
 * - Language selection (en, gu, hi)
 * - Opt-in balance due toggle (default OFF per privacy rule)
 * - Editable message template with localStorage persistence
 * - Web Share API / PNG download / Clipboard copy / wa.me chat launcher
 * - Accessible dialog with keyboard trapping and phone validation
 */
export default function ShareSeatModal({
  isOpen,
  onClose,
  booking = EMPTY_OBJECT,
  departureInfo = EMPTY_OBJECT,
  initialSeatId = null,
  occupiedSeatsMap = EMPTY_OBJECT,
  operatorInfo = EMPTY_OBJECT,
}) {
  const { toast } = useToast()
  const modalRef = useRef(null)
  const prevModalStateRef = useRef(`${booking._id || booking.invoiceNo || ""}_${initialSeatId || ""}`)
  const generationCountRef = useRef(0)
  const isMountedRef = useRef(true)

  // Selected passengers for this share card
  const [selectedPaxKeys, setSelectedPaxKeys] = useState(() => {
    const list = booking.passengers || []
    if (initialSeatId) {
      const match = list.find(
        (p) =>
          resolveSeatId(booking.seatLayoutKey, p.seatId) ===
          resolveSeatId(booking.seatLayoutKey, initialSeatId),
      )
      if (match) {
        return new Set([String(match._id || list.indexOf(match))])
      }
    }
    return new Set(list.map((p, idx) => String(p._id || idx)))
  })

  const [lang, setLang] = useState("en")
  const [showBalance, setShowBalance] = useState(false)
  const [imageBlob, setImageBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [customTemplate, setCustomTemplate] = useState("")
  const [isTemplateCustomized, setIsTemplateCustomized] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [isWebShareSupported, setIsWebShareSupported] = useState(false)

  // Track mounted status
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Check Web Share API support
  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setIsWebShareSupported(true)
    }
  }, [])

  // All valid passengers in booking with a seat
  const passengers = useMemo(() => {
    return (booking.passengers || []).map((p, idx) => ({
      ...p,
      _key: String(p._id || idx),
      seatId: p.seatId || "",
    }))
  }, [booking.passengers])

  // Reset selected passengers and balance toggle when modal opens or target booking changes
  useEffect(() => {
    if (!isOpen) return
    const stateKey = `${booking._id || booking.invoiceNo || ""}_${initialSeatId || ""}`
    if (prevModalStateRef.current !== stateKey) {
      prevModalStateRef.current = stateKey
      const list = booking.passengers || []
      const keys = new Set()
      if (initialSeatId) {
        const match = list.find(
          (p) =>
            resolveSeatId(booking.seatLayoutKey, p.seatId) ===
            resolveSeatId(booking.seatLayoutKey, initialSeatId),
        )
        if (match) {
          keys.add(String(match._id || list.indexOf(match)))
        }
      }
      if (keys.size === 0) {
        list.forEach((p, idx) => keys.add(String(p._id || idx)))
      }
      setSelectedPaxKeys(keys)
      setShowBalance(false)
    }
  }, [isOpen, booking._id, booking.invoiceNo, initialSeatId, booking.seatLayoutKey, booking.passengers])

  // Sync custom template from localStorage when language changes
  useEffect(() => {
    if (!isOpen) return
    try {
      const saved = localStorage.getItem(`yatrahub_seat_msg_template_${lang}`)
      if (saved && saved.trim()) {
        setCustomTemplate(saved)
        setIsTemplateCustomized(true)
      } else {
        setCustomTemplate("")
        setIsTemplateCustomized(false)
      }
    } catch {
      // Fallback
    }
  }, [isOpen, lang])

  // Target passenger seats array
  const sharedSeatIds = useMemo(() => {
    return passengers
      .filter((p) => selectedPaxKeys.has(p._key) && p.seatId)
      .map((p) => p.seatId)
  }, [passengers, selectedPaxKeys])

  // Compute recipient phone number
  const recipientPhone = useMemo(() => {
    const selectedPax = passengers.filter((p) => selectedPaxKeys.has(p._key))
    // First try contact of selected passengers
    for (const p of selectedPax) {
      if (p.contact && p.contact.trim()) {
        return p.contact.trim()
      }
    }
    // Fall back to booking contact phone
    return booking.contactPhone || ""
  }, [passengers, selectedPaxKeys, booking.contactPhone])

  const normalizedPhone = useMemo(() => {
    return normalizeIndianPhone(recipientPhone)
  }, [recipientPhone])

  const isPhoneValid = Boolean(normalizedPhone)

  // Compute final WhatsApp text message
  const messageText = useMemo(() => {
    return formatWhatsAppSeatMessage({
      departureInfo,
      booking,
      sharedSeatIds,
      operatorInfo,
      showBalance,
      lang,
      customTemplate: isTemplateCustomized ? customTemplate : "",
    })
  }, [
    departureInfo,
    booking,
    sharedSeatIds,
    operatorInfo,
    showBalance,
    lang,
    isTemplateCustomized,
    customTemplate,
  ])

  // Stable primitive keys for image generation dependencies
  const bookingKey = booking._id || booking.invoiceNo || ""
  const layoutKey = booking.seatLayoutKey || departureInfo.layoutKey || booking.busType || departureInfo.busType || ""
  const busType = booking.busType || departureInfo.busType || ""
  const tourName = departureInfo.tourName || booking.tourName || ""
  const journeyDate = String(departureInfo.journeyDate || booking.journeyDate || "")
  const companyName = operatorInfo.companyName || departureInfo.companyName || ""
  const companyPhone = operatorInfo.phone || departureInfo.companyPhone || ""
  const sharedSeatsKey = sharedSeatIds.slice().sort().join(",")
  const occupiedSeatsKey = useMemo(() => {
    if (!occupiedSeatsMap || typeof occupiedSeatsMap !== "object") return ""
    return Object.entries(occupiedSeatsMap)
      .filter(([, v]) => v && (v.status === "booked" || v.status === "held" || v.status === "blocked"))
      .map(([k, v]) => `${k}:${v.status}`)
      .sort()
      .join(";")
  }, [occupiedSeatsMap])

  // Generate Canvas image blob on parameters change
  useEffect(() => {
    if (!isOpen) return

    isMountedRef.current = true
    const currentGenId = ++generationCountRef.current
    setGenerating(true)
    setGenerationError(null)

    const timer = setTimeout(async () => {
      try {
        const blob = await generateSeatImageBlob({
          layoutKey,
          busType,
          departureInfo,
          booking,
          sharedSeatIds,
          occupiedSeatsMap,
          operatorInfo,
          showBalance,
          lang,
        })

        if (!isMountedRef.current || currentGenId !== generationCountRef.current) return

        setImageBlob(blob)
        setGenerationError(null)
        const url = URL.createObjectURL(blob)
        setPreviewUrl((prevUrl) => {
          if (prevUrl) URL.revokeObjectURL(prevUrl)
          return url
        })
      } catch (err) {
        if (isMountedRef.current && currentGenId === generationCountRef.current) {
          console.error("Failed to generate seat image:", err)
          setGenerationError(err?.message || "Failed to generate seat preview image")
          toast.error("Failed to generate seat preview image")
        }
      } finally {
        if (isMountedRef.current && currentGenId === generationCountRef.current) {
          setGenerating(false)
        }
      }
    }, 50)

    return () => {
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    bookingKey,
    layoutKey,
    busType,
    tourName,
    journeyDate,
    companyName,
    companyPhone,
    sharedSeatsKey,
    occupiedSeatsKey,
    showBalance,
    lang,
    retryKey,
  ])

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Passenger toggle handler
  const handleTogglePassenger = (paxKey) => {
    setSelectedPaxKeys((prev) => {
      const next = new Set(prev)
      if (next.has(paxKey)) {
        if (next.size > 1) next.delete(paxKey)
        else toast.info("At least one passenger must remain selected.")
      } else {
        next.add(paxKey)
      }
      return next
    })
  }

  // Template text edit handler
  const handleTemplateChange = (val) => {
    setCustomTemplate(val)
    setIsTemplateCustomized(true)
    try {
      localStorage.setItem(`yatrahub_seat_msg_template_${lang}`, val)
    } catch {
      // Non-blocking localStorage error
    }
  }

  // Reset to default template handler
  const handleResetTemplate = () => {
    setIsTemplateCustomized(false)
    setCustomTemplate("")
    try {
      localStorage.removeItem(`yatrahub_seat_msg_template_${lang}`)
    } catch {
      // Non-blocking
    }
    toast.success("Reset to default template")
  }

  // Helper to ensure blob is available (generates on-demand if not ready yet)
  const getOrGenerateBlob = async () => {
    if (imageBlob) return imageBlob
    setGenerating(true)
    setGenerationError(null)
    try {
      const blob = await generateSeatImageBlob({
        layoutKey,
        busType,
        departureInfo,
        booking,
        sharedSeatIds,
        occupiedSeatsMap,
        operatorInfo,
        showBalance,
        lang,
      })
      setImageBlob(blob)
      setGenerationError(null)
      const url = URL.createObjectURL(blob)
      setPreviewUrl((prevUrl) => {
        if (prevUrl) URL.revokeObjectURL(prevUrl)
        return url
      })
      return blob
    } catch (err) {
      setGenerationError(err?.message || "Failed to generate seat image")
      throw err
    } finally {
      setGenerating(false)
    }
  }

  // Action 1: Web Share API
  const handleWebShare = async () => {
    setIsSharing(true)
    try {
      const blob = await getOrGenerateBlob()
      const filename = `seat-confirmation-${booking.invoiceNo || "bus"}.png`
      const file = new File(
        [blob],
        filename,
        { type: "image/png" },
      )
      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "Seat Confirmation",
          text: messageText,
          files: [file],
        })
        toast.success("Shared successfully via system share!")
      } else {
        // Fallback: download and open chat with clear toast
        downloadSeatImage(blob, filename)
        toast.info("Image downloaded (system file share not supported). Opening WhatsApp...")
        handleOpenWhatsApp()
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        toast.error(err.message || "Sharing failed")
      }
    } finally {
      setIsSharing(false)
    }
  }

  // Action 2: Download PNG Image
  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const blob = await getOrGenerateBlob()
      const filename = `seat-confirmation-${booking.invoiceNo || "booking"}.png`
      downloadSeatImage(blob, filename)
      toast.success("Seat confirmation image downloaded!")
    } catch (err) {
      toast.error(err.message || "Failed to download seat confirmation image")
    } finally {
      setIsDownloading(false)
    }
  }

  // Action 3: Copy Message Text
  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText)
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
      toast.success("WhatsApp message copied to clipboard!")
    } catch {
      toast.error("Failed to copy message to clipboard")
    }
  }

  // Action 4: Open WhatsApp Web / App
  const handleOpenWhatsApp = () => {
    if (!isPhoneValid) return
    const waUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(messageText)}`
    window.open(waUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-seat-modal-title"
      ref={modalRef}
    >
      <div className="relative w-full max-w-4xl bg-surface border border-border-subtle rounded-[var(--yh-radius-2xl)] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Share2 size={20} />
            </div>
            <div>
              <h2
                id="share-seat-modal-title"
                className="text-base sm:text-lg font-bold text-ink"
              >
                Share Seat Confirmation via WhatsApp
              </h2>
              <p className="text-xs text-ink-muted">
                {departureInfo.tourName || booking.tourName} • Invoice #{booking.invoiceNo || "—"}
              </p>
            </div>
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

        {/* Modal Body: Split 2-Column on Desktop */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT COLUMN: Controls & Options (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* 1. Language Toggle */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                Language (ભાષા / भाषा)
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-muted rounded-lg border border-border-subtle text-xs">
                {[
                  { id: "en", label: "English" },
                  { id: "gu", label: "ગુજરાતી" },
                  { id: "hi", label: "हिन्दी" },
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLang(l.id)}
                    className={`py-1.5 px-2 rounded-md font-bold transition-all cursor-pointer ${
                      lang === l.id
                        ? "bg-brand text-brand-fg shadow-xs"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Passenger Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink uppercase tracking-wider">
                  Select Passenger(s) to Include
                </span>
                <span className="text-[11px] text-ink-muted">
                  {selectedPaxKeys.size} of {passengers.length} selected
                </span>
              </div>

              <div className="p-2.5 rounded-xl border border-border-subtle bg-surface-muted/20 space-y-2 max-h-40 overflow-y-auto">
                {passengers.map((p) => {
                  const isChecked = selectedPaxKeys.has(p._key)
                  return (
                    <label
                      key={p._key}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-hover cursor-pointer text-xs transition-colors border border-transparent hover:border-border-subtle"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePassenger(p._key)}
                          className="rounded border-border text-brand focus:ring-brand"
                        />
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-ink-muted" />
                          <span className="font-semibold text-ink">{p.name}</span>
                        </div>
                      </div>
                      <Badge variant="primary" size="sm">
                        {formatSeatLabel(p.seatId)}
                      </Badge>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* 3. Balance Due Toggle (Default OFF per privacy rule) */}
            <div className="p-3 rounded-xl border border-border-subtle bg-surface-muted/30 space-y-1.5">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-ink">
                  Include Balance Due on Image &amp; Message
                </span>
                <input
                  type="checkbox"
                  checked={showBalance}
                  onChange={(e) => setShowBalance(e.target.checked)}
                  className="rounded border-border text-brand focus:ring-brand h-4 w-4"
                />
              </label>
              <p className="text-[11px] text-ink-muted">
                Off by default. When checked, shows remaining ledger balance (or &quot;Paid in Full&quot;).
              </p>
            </div>

            {/* 4. Editable WhatsApp Message Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="share-message-textarea"
                  className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1"
                >
                  <MessageSquare size={13} />
                  WhatsApp Message Text
                </label>
                {isTemplateCustomized && (
                  <button
                    type="button"
                    onClick={handleResetTemplate}
                    className="text-[11px] font-semibold text-brand hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={11} /> Reset
                  </button>
                )}
              </div>

              <textarea
                id="share-message-textarea"
                value={isTemplateCustomized ? customTemplate : messageText}
                onChange={(e) => handleTemplateChange(e.target.value)}
                rows={7}
                className={`w-full text-xs font-mono p-2.5 rounded-xl border border-border-subtle bg-surface text-ink resize-y ${FOCUS_RING_CLASS}`}
                placeholder="WhatsApp message text..."
              />
            </div>

            {/* Recipient Phone Validation Banner */}
            <div className="p-2.5 rounded-xl border border-border-subtle bg-surface-muted/40 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink flex items-center gap-1">
                  <Phone size={13} className="text-ink-muted" /> Recipient Phone:
                </span>
                <span className="font-mono font-bold text-brand">
                  {recipientPhone || "None specified"}
                </span>
              </div>
              {!isPhoneValid && (
                <p
                  id="invalid-phone-hint"
                  className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-0.5"
                >
                  <AlertCircle size={12} className="shrink-0" />
                  Invalid or missing 10-digit Indian phone number. WhatsApp chat link will be disabled.
                </p>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Live Image Preview (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink uppercase tracking-wider">
                Live Seat Image Preview (1080px)
              </span>
              {generating && !previewUrl && (
                <span className="text-xs text-brand animate-pulse font-medium">
                  Generating canvas...
                </span>
              )}
              {generationError && !previewUrl && !generating && (
                <span className="text-xs text-rose-600 font-medium">
                  Generation failed
                </span>
              )}
            </div>

            <div className="relative flex-1 min-h-[360px] max-h-[500px] rounded-2xl border-2 border-border-subtle bg-surface-muted/30 p-2 overflow-auto flex items-center justify-center shadow-inner">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Seat Confirmation Card Preview"
                  className="max-w-full h-auto max-h-[460px] rounded-xl shadow-md object-contain border border-border-subtle transition-opacity duration-200"
                />
              ) : generationError ? (
                <div className="text-center text-xs p-6 space-y-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                    <AlertCircle size={20} />
                  </div>
                  <p className="font-semibold text-rose-600 dark:text-rose-400">{generationError}</p>
                  <p className="text-ink-muted text-[11px]">Could not generate the canvas seat card preview.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() => setRetryKey((k) => k + 1)}
                    icon={<RotateCcw size={13} />}
                  >
                    Retry Generation
                  </Button>
                </div>
              ) : (
                <div className="text-center text-ink-muted text-xs p-6 space-y-2">
                  <div className="inline-block animate-spin text-brand">
                    <RotateCcw size={24} />
                  </div>
                  <p>Rendering seat card...</p>
                </div>
              )}
            </div>

            {/* Helpful Hint on WhatsApp Web */}
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs">
              <Info size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>Tip for WhatsApp Web:</strong> Download the image card, click &quot;Open WhatsApp Chat&quot;, then drag &amp; drop or paste the downloaded image directly into the chat.
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer: Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-3.5 border-t border-border-subtle bg-surface-muted/40">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {/* Copy Message */}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyMessage}
              icon={copyFeedback ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            >
              {copyFeedback ? "Copied!" : "Copy Message"}
            </Button>

            {/* Download Image */}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              icon={<Download size={14} />}
              loading={isDownloading}
              loadingText="Downloading..."
            >
              Download PNG
            </Button>

            {/* System Web Share (Mobile / Chrome) */}
            {isWebShareSupported && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleWebShare}
                icon={<Share2 size={14} />}
                loading={isSharing}
                loadingText="Sharing..."
              >
                Share
              </Button>
            )}

            {/* Open WhatsApp Chat */}
            <Button
              variant="primary"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
              onClick={handleOpenWhatsApp}
              disabled={!isPhoneValid}
              aria-describedby={!isPhoneValid ? "invalid-phone-hint" : undefined}
              icon={<ExternalLink size={14} />}
            >
              Open WhatsApp Chat
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
