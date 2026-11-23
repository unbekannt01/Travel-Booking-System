import { useState, useEffect, useMemo, useRef } from "react"
import {
  Card,
  Button,
  Badge,
  Spinner,
} from "../ui"
import {
  REMINDER_TONES,
  REMINDER_LANGUAGES,
  REMINDER_PLACEHOLDERS,
  DEFAULT_REMINDER_TEMPLATES,
  validateTemplate,
  renderReminder,
} from "../../../shared/reminders"
import {
  listReminderTemplates,
  saveReminderTemplate,
  resetReminderTemplate,
} from "../../data/reminders"
import {
  RotateCcw,
  Save,
  Sparkles,
  Info,
  Check,
  AlertCircle,
  ShieldAlert,
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

const PLACEHOLDER_DESCRIPTIONS = {
  customerName: "Customer name",
  companyName: "Agency name",
  companyPhone: "Agency contact phone",
  tourName: "Tour / Route name",
  journeyDate: "Trip departure date",
  invoiceNo: "Invoice number",
  balance: "Outstanding balance due",
  totalAmount: "Total booked trip amount",
  paidAmount: "Advance paid so far",
  daysOverdue: "Days past due date",
  upiId: "UPI VPA ID for payment",
}

export default function ReminderTemplateEditor({ user = null }) {
  const [language, setLanguage] = useState("en")
  const [tone, setTone] = useState("friendly")

  const [templates, setTemplates] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [error, setError] = useState(null)

  // Current working text
  const [currentText, setCurrentText] = useState("")
  const textareaRef = useRef(null)

  // Load all 9 templates
  const loadTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listReminderTemplates()
      setTemplates(res)
    } catch (err) {
      console.warn("Failed to load templates from server; using defaults", err)
      setTemplates(DEFAULT_REMINDER_TEMPLATES)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  // Resolve current template object
  const activeTemplateObj = useMemo(() => {
    if (!templates) return { body: DEFAULT_REMINDER_TEMPLATES[language]?.[tone] || "", isCustom: false }
    const t = templates[language]?.[tone]
    if (typeof t === "string") return { body: t, isCustom: false }
    if (t?.body) return t
    return { body: DEFAULT_REMINDER_TEMPLATES[language]?.[tone] || "", isCustom: false }
  }, [templates, language, tone])

  // Update working text when language or tone changes
  useEffect(() => {
    setCurrentText(activeTemplateObj.body || "")
    setError(null)
  }, [activeTemplateObj])

  // Check if modified from saved
  const isDirty = useMemo(() => {
    return currentText.trim() !== (activeTemplateObj.body || "").trim()
  }, [currentText, activeTemplateObj])

  // Validation
  const validation = useMemo(() => {
    return validateTemplate(currentText)
  }, [currentText])

  // Realistic sample values for preview
  const sampleValues = useMemo(() => {
    return {
      customerName: "Rameshbhai Patel",
      companyName: user?.companyName || "Shree Somnath Travels",
      companyPhone: user?.companyPhone || "9876543210",
      tourName: "Dwarka Somnath Special",
      journeyDate: "28-11-2026",
      invoiceNo: "INV-2026-042",
      balance: "₹4,500",
      totalAmount: "₹12,000",
      paidAmount: "₹7,500",
      daysOverdue: 5,
      upiId: user?.bankDetails?.upiId || "somnath@upi",
    }
  }, [user])

  // Live preview text
  const previewText = useMemo(() => {
    if (!validation.valid && validation.errors.length > 0) {
      return "Cannot preview: template contains errors."
    }
    return renderReminder({
      template: currentText,
      values: sampleValues,
    })
  }, [currentText, sampleValues, validation])

  // Insert placeholder at cursor position
  const handleInsertPlaceholder = (key) => {
    const el = textareaRef.current
    const token = `{${key}}`
    if (!el) {
      setCurrentText((prev) => prev + token)
      return
    }

    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    const before = currentText.substring(0, start)
    const after = currentText.substring(end)
    const newText = before + token + after
    setCurrentText(newText)

    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    }, 0)
  }

  // Handle Save
  const handleSave = async () => {
    if (!validation.valid) return
    setSaving(true)
    setError(null)
    try {
      const res = await saveReminderTemplate(language, tone, currentText)
      if (res) {
        setTemplates((prev) => {
          const next = { ...prev }
          if (!next[language]) next[language] = {}
          next[language][tone] = res
          return next
        })
        setToastMessage("Template saved successfully!")
        setTimeout(() => setToastMessage(null), 3000)
      }
    } catch (err) {
      console.error("Save template error:", err)
      setError(err.message || "Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  // Handle Reset to Default
  const handleReset = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await resetReminderTemplate(language, tone)
      const defaultBody = DEFAULT_REMINDER_TEMPLATES[language]?.[tone] || ""
      setTemplates((prev) => {
        const next = { ...prev }
        if (!next[language]) next[language] = {}
        next[language][tone] = res || { language, tone, body: defaultBody, isCustom: false }
        return next
      })
      setCurrentText(defaultBody)
      setToastMessage("Template reset to system default.")
      setTimeout(() => setToastMessage(null), 3000)
    } catch (err) {
      console.error("Reset template error:", err)
      setError(err.message || "Failed to reset template")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card elevation="sm" className="p-6 space-y-6 rounded-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-border-subtle pb-4 gap-2">
        <div>
          <h3 className="font-bold text-base text-ink flex items-center gap-2">
            <span>WhatsApp Reminder Templates</span>
            {activeTemplateObj.isCustom && (
              <Badge variant="primary" size="sm">
                Custom Template
              </Badge>
            )}
          </h3>
          <p className="text-xs text-ink-muted mt-0.5">
            Configure default and custom messages sent to customers for balance payments.
          </p>
        </div>

        {toastMessage && (
          <div className="flex items-center gap-1.5 text-xs text-success font-semibold">
            <Check className="w-4 h-4" />
            {toastMessage}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-ink-muted">
          <Spinner size="md" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tone & Language Matrix Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tone Selector */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-ink-secondary block">Reminder Tone</span>
              <div
                className="flex items-center rounded-md border border-border p-0.5 bg-surface-subtle h-9"
                role="radiogroup"
                aria-label="Reminder tone"
              >
                {REMINDER_TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={tone === t}
                    onClick={() => setTone(t)}
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
                className="flex items-center rounded-md border border-border p-0.5 bg-surface-subtle h-9"
                role="radiogroup"
                aria-label="Message language"
              >
                {REMINDER_LANGUAGES.map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={language === l}
                    onClick={() => setLanguage(l)}
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

          {/* Placeholder Chips Bar */}
          <div className="space-y-2 p-3 rounded-lg border border-border-subtle bg-surface-subtle/50">
            <span className="text-xs font-semibold text-ink-secondary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              Click placeholders to insert at cursor:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {REMINDER_PLACEHOLDERS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleInsertPlaceholder(key)}
                  title={PLACEHOLDER_DESCRIPTIONS[key]}
                  className="px-2 py-1 text-[11px] font-mono rounded bg-surface hover:bg-surface-hover text-ink border border-border hover:border-brand cursor-pointer transition-colors shadow-2xs"
                >
                  {`{${key}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Template Body Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="reminder-template-input" className="font-semibold text-ink-secondary">
                Template Body
              </label>
              <div className="flex items-center gap-2">
                {isDirty && (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                    Unsaved changes
                  </span>
                )}
                <span
                  className={`font-mono text-[11px] ${
                    currentText.length > 550 ? "text-danger font-bold" : "text-ink-muted"
                  }`}
                >
                  {currentText.length} / 600 characters
                </span>
              </div>
            </div>

            <textarea
              id="reminder-template-input"
              ref={textareaRef}
              rows={6}
              maxLength={600}
              value={currentText}
              onChange={(e) => setCurrentText(e.target.value)}
              className="w-full text-xs p-3 rounded-lg border border-border bg-surface text-ink font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand font-mono"
              placeholder="Enter reminder template with placeholders..."
            />

            {/* Validation Errors */}
            {!validation.valid && (
              <div className="p-2.5 rounded bg-danger-subtle text-danger text-xs space-y-1">
                {validation.errors.map((err, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="p-2.5 rounded bg-danger-subtle text-danger text-xs">{error}</div>
            )}
          </div>

          {/* Template Actions: Save & Reset */}
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={saving || !activeTemplateObj.isCustom}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Default
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving || !isDirty || !validation.valid}
              className="gap-1.5 text-xs"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving..." : "Save Template"}
            </Button>
          </div>

          {/* Live Sample Preview Card */}
          <div className="p-4 rounded-xl border border-border bg-surface-subtle space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <Info className="w-4 h-4 text-brand" />
                Live Preview (Simulated Sample Data)
              </span>
              <Badge variant="neutral" size="sm">
                Preview
              </Badge>
            </div>
            <div className="p-3 rounded-lg bg-surface border border-border-subtle text-xs text-ink whitespace-pre-wrap font-sans leading-relaxed">
              {previewText}
            </div>
          </div>

          {/* Legal and TRAI / DND Consent Advisory */}
          <div className="p-3.5 rounded-lg border border-border-subtle bg-slate-50 dark:bg-slate-900/60 text-[11px] text-ink-muted flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-brand shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-ink block">Compliance & Communication Advisory:</strong>
              <p>
                WhatsApp reminders are semi-automated and dispatched manually via official wa.me links
                by the tour operator. In accordance with TRAI Telecom Commercial Communications Customer
                Preference Regulations (TCCCPR) and customer privacy guidelines, always respect customer
                opt-outs and avoid transmitting unsolicited commercial communications.
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
