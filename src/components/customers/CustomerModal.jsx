import { useState, useEffect } from "react"
import {
  Modal,
  Field,
  Input,
  Button,
  Select,
  Switch,
  Badge,
} from "../ui"
import {
  CUSTOMER_TAGS,
  CUSTOMER_LANGUAGES,
  normalizeIndianMobile,
  isValidEmail,
} from "../../../shared/customers.js"
import { createCustomer, updateCustomer } from "../../data/customers"
import { useToast } from "../common/ToastContext"
import { AlertCircle } from "lucide-react"

const LANGUAGE_LABELS = {
  en: "English",
  hi: "Hindi (हिंदी)",
  gu: "Gujarati (ગુજરાતી)",
}

const TAG_LABELS = {
  vip: "VIP",
  "group-leader": "Group Leader",
  agent: "Agent",
  frequent: "Frequent",
  corporate: "Corporate",
  "pilgrim-group": "Pilgrim Group",
  regular: "Regular",
}

export default function CustomerModal({
  isOpen,
  onClose,
  onSaved,
  customer = null,
}) {
  const toast = useToast()
  const isEditing = Boolean(customer && (customer.id || customer._id))

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    gstin: "",
    language: "en",
    tags: [],
    notes: "",
    whatsappOptOut: false,
  })

  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        city: customer.city || "",
        address: customer.address || "",
        gstin: customer.gstin || "",
        language: customer.language || "en",
        tags: Array.isArray(customer.tags) ? [...customer.tags] : [],
        notes: customer.notes || "",
        whatsappOptOut: Boolean(customer.whatsappOptOut),
      })
    } else {
      setFormData({
        name: "",
        phone: "",
        email: "",
        city: "",
        address: "",
        gstin: "",
        language: "en",
        tags: [],
        notes: "",
        whatsappOptOut: false,
      })
    }
    setErrors({})
    setServerError(null)
  }, [customer, isOpen])

  const validate = () => {
    const errs = {}
    if (!formData.name.trim()) {
      errs.name = "Customer name is required"
    } else if (formData.name.trim().length > 120) {
      errs.name = "Customer name cannot exceed 120 characters"
    }

    const phoneCheck = normalizeIndianMobile(formData.phone)
    if (!formData.phone.trim()) {
      errs.phone = "Mobile number is required"
    } else if (!phoneCheck.valid) {
      errs.phone = "Enter a valid 10-digit Indian mobile number (e.g. 98765 43210)"
    }

    if (formData.email.trim() && !isValidEmail(formData.email.trim())) {
      errs.email = "Please enter a valid email address"
    }

    if (formData.gstin.trim()) {
      const gstinVal = formData.gstin.trim().toUpperCase()
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
      if (!gstinRegex.test(gstinVal)) {
        errs.gstin = "Please enter a valid 15-character GSTIN (e.g. 24AAAAA0000A1Z5)"
      }
    }

    if (formData.tags.length > 5) {
      errs.tags = "Cannot select more than 5 tags"
    }

    if (formData.notes.length > 2000) {
      errs.notes = "Notes cannot exceed 2000 characters"
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const toggleTag = (tag) => {
    setFormData((prev) => {
      const hasTag = prev.tags.includes(tag)
      if (hasTag) {
        return { ...prev, tags: prev.tags.filter((t) => t !== tag) }
      }
      if (prev.tags.length >= 5) {
        toast.warning("Maximum 5 tags allowed per customer.")
        return prev
      }
      return { ...prev, tags: [...prev.tags, tag] }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError(null)

    if (!validate()) return

    setSubmitting(true)
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        city: formData.city.trim(),
        address: formData.address.trim(),
        gstin: formData.gstin.trim().toUpperCase(),
        language: formData.language,
        tags: formData.tags,
        notes: formData.notes.trim(),
        whatsappOptOut: formData.whatsappOptOut,
      }

      let saved = null
      if (isEditing) {
        const id = customer.id || customer._id
        saved = await updateCustomer(id, payload)
        toast.success(`Customer "${payload.name}" updated successfully`)
      } else {
        saved = await createCustomer(payload)
        toast.success(`Customer "${payload.name}" created successfully`)
      }

      if (onSaved) onSaved(saved)
      onClose()
    } catch (err) {
      console.error("Save customer error:", err)
      const msg = err.message || "Failed to save customer"
      setServerError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Customer Details" : "Add New Customer"}
      description="Store traveler contact profile, preferred language, and operator notes."
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {serverError && (
          <div
            role="alert"
            className="p-3 rounded-[var(--yh-radius-md)] bg-danger-soft text-danger border border-danger/30 text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="cust-name" label="Customer Name" required error={errors.name}>
            {({ id }) => (
              <Input
                id={id}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Ramesh Patel"
              />
            )}
          </Field>

          <Field id="cust-phone" label="Mobile Number" required error={errors.phone} hint="10-digit Indian mobile number">
            {({ id }) => (
              <Input
                id={id}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. 98765 43210"
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="cust-email" label="Email Address" error={errors.email}>
            {({ id }) => (
              <Input
                id={id}
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g. ramesh@example.com"
              />
            )}
          </Field>

          <Field id="cust-city" label="City / Hometown" error={errors.city}>
            {({ id }) => (
              <Input
                id={id}
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. Ahmedabad, Surat"
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="cust-language" label="Preferred Language">
            {({ id }) => (
              <Select
                id={id}
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              >
                {CUSTOMER_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {LANGUAGE_LABELS[lang] || lang}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field id="cust-gstin" label="GSTIN (Optional)" error={errors.gstin} hint="15-character uppercase GSTIN">
            {({ id }) => (
              <Input
                id={id}
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                placeholder="e.g. 24ABCDE1234F1Z5"
              />
            )}
          </Field>
        </div>

        <Field id="cust-address" label="Address" error={errors.address}>
          {({ id }) => (
            <Input
              id={id}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g. 104 Shantinagar Society, Ashram Road"
            />
          )}
        </Field>

        {/* Customer Tags */}
        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-ink">
            Customer Tags (Max 5)
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {CUSTOMER_TAGS.map((tag) => {
              const selected = formData.tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                    selected
                      ? "bg-brand text-brand-fg border-brand"
                      : "bg-surface text-ink-secondary border-border-subtle hover:bg-surface-hover hover:text-ink"
                  }`}
                >
                  {TAG_LABELS[tag] || tag}
                </button>
              )
            })}
          </div>
          {errors.tags && <p className="text-xs text-danger font-medium">{errors.tags}</p>}
        </div>

        {/* WhatsApp Opt-Out Toggle */}
        <div className="pt-2 border-t border-border-subtle">
          <Switch
            label="Opt-out of WhatsApp communications"
            description="If enabled, automated payment reminders and boarding passes will not be queued for WhatsApp dispatch."
            checked={formData.whatsappOptOut}
            onChange={(checked) => setFormData({ ...formData, whatsappOptOut: checked })}
          />
        </div>

        {/* Operator Notes */}
        <Field id="cust-notes" label="Operator Private Notes" error={errors.notes} hint="Internal references, seat preferences, medical alerts">
          {({ id }) => (
            <textarea
              id={id}
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Senior pilgrim, prefers lower berth. Annual Chardham group leader."
              className="w-full px-3 py-2 text-sm rounded-[var(--yh-radius-md)] bg-surface text-ink border border-border-subtle focus:outline-none focus:ring-2 focus:ring-focus-ring resize-none"
            />
          )}
        </Field>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-subtle">
          <Button type="button" variant="outline" size="md" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" loading={submitting}>
            {isEditing ? "Save Changes" : "Create Customer"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
