import { useState, useMemo } from "react"
import {
  MapPin,
  Plus,
  Trash2,
  Bus,
  Clock,
  Calendar,
  Edit3,
  Receipt,
  Sparkles,
} from "lucide-react"
import {
  Button,
  IconButton,
  Input,
  Select,
  Field,
  Modal,
  Badge,
  EmptyState,
  SearchInput,
  Card,
} from "./ui/index"
import { formatINR } from "../utils/formatters"
import { cn } from "../utils/cn"

const BUS_TYPE_OPTIONS = ["2x1 Sleeper Luxury", "2x2 Sleeper Luxury"]

/**
 * Derives the invoice sequence prefix format preview from destination name and date.
 * E.g., "Nepal Special" on 2026-05-15 -> "YHB-NEP-MAY-001"
 */
const getInvoicePreview = (name, date) => {
  if (!name || !date) return "YHB-DEST-MON-XXX"
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, "")
  const destCode = (cleanName.slice(0, 3) || name.slice(0, 3) || "DST").toUpperCase()
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  const d = new Date(date)
  const monthCode = !isNaN(d.getTime()) ? months[d.getMonth()] : "MON"
  return `YHB-${destCode}-${monthCode}-001`
}

const DEFAULT_FORM_STATE = {
  name: "",
  duration: "",
  busType: BUS_TYPE_OPTIONS[0],
  journeyDate: "",
  pricingType: "berth",
  fixedPrice: "",
  lowerPrice: "",
  upperPrice: "",
}

export default function TourInventory({ tours = [], onAdd, onDelete }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTourId, setEditingTourId] = useState(null)
  const [formData, setFormData] = useState(DEFAULT_FORM_STATE)
  const [formErrors, setFormErrors] = useState({})

  // Filter tours by search term
  const filteredTours = useMemo(() => {
    if (!searchTerm.trim()) return tours
    const term = searchTerm.toLowerCase().trim()
    return tours.filter((t) => {
      const nameMatch = (t.name || "").toLowerCase().includes(term)
      const durationMatch = (t.duration || "").toLowerCase().includes(term)
      const busMatch = (t.busType || "").toLowerCase().includes(term)
      return nameMatch || durationMatch || busMatch
    })
  }, [tours, searchTerm])

  const openAddModal = () => {
    setEditingTourId(null)
    setFormData(DEFAULT_FORM_STATE)
    setFormErrors({})
    setIsModalOpen(true)
  }

  const openEditModal = (tour) => {
    setEditingTourId(tour._id || tour.id)
    setFormData({
      name: tour.name || "",
      duration: tour.duration || "",
      busType: tour.busType || BUS_TYPE_OPTIONS[0],
      journeyDate: tour.journeyDate || "",
      pricingType: tour.pricingType || (tour.upperPrice ? "berth" : "fixed"),
      fixedPrice: tour.fixedPrice !== undefined && tour.fixedPrice !== null ? String(tour.fixedPrice) : "",
      lowerPrice: tour.lowerPrice !== undefined && tour.lowerPrice !== null ? String(tour.lowerPrice) : "",
      upperPrice: tour.upperPrice !== undefined && tour.upperPrice !== null ? String(tour.upperPrice) : "",
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingTourId(null)
    setFormErrors({})
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errors = {}

    if (!formData.name.trim()) {
      errors.name = "Tour name is required"
    }
    if (!formData.duration.trim()) {
      errors.duration = "Duration is required"
    }

    if (formData.pricingType === "fixed") {
      if (!formData.fixedPrice || Number(formData.fixedPrice) <= 0) {
        errors.fixedPrice = "Enter a valid fixed price"
      }
    } else {
      if (!formData.lowerPrice || Number(formData.lowerPrice) <= 0) {
        errors.lowerPrice = "Enter lower berth price"
      }
      if (!formData.upperPrice || Number(formData.upperPrice) <= 0) {
        errors.upperPrice = "Enter upper berth price"
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    const payload = {
      ...(editingTourId ? { _id: editingTourId, id: editingTourId } : {}),
      name: formData.name.trim(),
      duration: formData.duration.trim(),
      busType: formData.busType,
      journeyDate: formData.journeyDate,
      pricingType: formData.pricingType,
      fixedPrice: formData.pricingType === "fixed" ? Math.max(0, Number(formData.fixedPrice) || 0) : undefined,
      lowerPrice: formData.pricingType === "berth" ? Math.max(0, Number(formData.lowerPrice) || 0) : Math.max(0, Number(formData.fixedPrice) || 0),
      upperPrice: formData.pricingType === "berth" ? Math.max(0, Number(formData.upperPrice) || 0) : 0,
    }

    if (onAdd) {
      onAdd(payload)
    }

    closeModal()
  }

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="w-full sm:max-w-md">
          <SearchInput
            placeholder="Search by name, duration, bus type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm("")}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={openAddModal}
            icon={<Plus size={16} />}
            className="w-full sm:w-auto"
          >
            Add Destination
          </Button>
        </div>
      </div>

      {/* Destination Grid / Cards */}
      {tours.length === 0 ? (
        <EmptyState
          icon={<MapPin className="w-8 h-8 text-(--yh-text-muted)" />}
          title="No destinations yet"
          description="Create tour package templates with predefined routes, seating layouts, and fare structures."
          action={
            <Button variant="primary" onClick={openAddModal} icon={<Plus size={16} />}>
              Create Destination
            </Button>
          }
        />
      ) : filteredTours.length === 0 ? (
        <EmptyState
          icon={<MapPin className="w-8 h-8 text-(--yh-text-muted)" />}
          title="No destinations match your search"
          description={`No destination matched "${searchTerm}". Try searching with a different keyword.`}
          action={
            <Button variant="outline" onClick={() => setSearchTerm("")}>
              Clear Search
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTours.map((tour) => {
            const tourId = tour._id || tour.id
            const isFixed = tour.pricingType === "fixed" || (!tour.pricingType && !tour.upperPrice)
            const invoicePreview = getInvoicePreview(tour.name, tour.journeyDate)

            return (
              <Card
                key={tourId}
                elevation="sm"
                className="flex flex-col justify-between border-(--yh-border-subtle) hover:border-(--yh-border-strong) transition-colors p-5 rounded-2xl"
              >
                <div className="space-y-4">
                  {/* Card Header: Icon + Title */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-(--yh-brand)/10 text-(--yh-brand) flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin size={20} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-(--yh-text-primary) text-base truncate leading-snug">
                          {tour.name}
                        </h3>
                        <p className="text-xs text-(--yh-text-muted) flex items-center gap-1.5 mt-0.5">
                          <Clock size={13} className="shrink-0" />
                          <span className="truncate">{tour.duration}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bus Layout & Date Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="primary" size="sm" className="gap-1 font-medium">
                      <Bus size={12} />
                      <span>{tour.busType}</span>
                    </Badge>
                    {tour.journeyDate && (
                      <Badge variant="neutral" size="sm" className="gap-1 font-medium">
                        <Calendar size={12} />
                        <span>{tour.journeyDate}</span>
                      </Badge>
                    )}
                  </div>

                  {/* Invoice Code Format Preview */}
                  <div className="p-2.5 rounded-xl bg-(--yh-surface-muted) border border-(--yh-border-subtle) flex items-center justify-between text-xs">
                    <span className="text-(--yh-text-muted) font-medium text-[11px] flex items-center gap-1">
                      <Receipt size={13} />
                      Format
                    </span>
                    <code className="font-mono text-xs font-semibold text-(--yh-brand)">
                      {invoicePreview}
                    </code>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="pt-3 border-t border-(--yh-border-subtle)">
                    {isFixed ? (
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-(--yh-text-muted) font-medium">Fixed Fare</span>
                        <span className="text-lg font-bold text-(--yh-text-primary)">
                          {formatINR(tour.fixedPrice || tour.lowerPrice || 0)}
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded-lg bg-(--yh-surface-muted)/60">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-(--yh-text-muted) block">
                            Lower Berth
                          </span>
                          <span className="text-sm font-bold text-(--yh-text-primary)">
                            {formatINR(tour.lowerPrice || 0)}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-(--yh-surface-muted)/60">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-(--yh-text-muted) block">
                            Upper Berth
                          </span>
                          <span className="text-sm font-bold text-(--yh-text-primary)">
                            {formatINR(tour.upperPrice || 0)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Action Buttons */}
                <div className="mt-5 pt-3 border-t border-(--yh-border-subtle) flex items-center justify-between">
                  <Badge variant="neutral" size="sm">
                    {isFixed ? "Fixed Fare" : "Berth Pricing"}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(tour)}
                      icon={<Edit3 size={15} />}
                    >
                      Edit
                    </Button>
                    {onDelete && (
                      <IconButton
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(tourId)}
                        icon={<Trash2 size={15} className="text-(--yh-danger)" />}
                        label={`Delete ${tour.name}`}
                      />
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create / Edit Destination Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingTourId ? "Edit Destination" : "Create Tour Template"}
        description={
          editingTourId
            ? "Update destination route, layout structure, or berth pricing."
            : "Define a reusable package template for journeys and bookings."
        }
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Tour / Destination Name" required error={formErrors.name}>
            <Input
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value })
                if (formErrors.name) setFormErrors({ ...formErrors, name: null })
              }}
              placeholder="e.g. Nepal Special Tour"
              required
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Duration" required error={formErrors.duration}>
              <Input
                value={formData.duration}
                onChange={(e) => {
                  setFormData({ ...formData, duration: e.target.value })
                  if (formErrors.duration) setFormErrors({ ...formErrors, duration: null })
                }}
                placeholder="e.g. 10 Days / 11 Nights"
                required
              />
            </Field>

            <Field label="Bus Type & Layout" required>
              <Select
                value={formData.busType}
                onChange={(e) => setFormData({ ...formData, busType: e.target.value })}
              >
                {BUS_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Default Journey Date"
            hint="Optional default departure date for quick booking prefill"
          >
            <Input
              type="date"
              value={formData.journeyDate}
              onChange={(e) => setFormData({ ...formData, journeyDate: e.target.value })}
            />
          </Field>

          {/* Invoice Format Preview */}
          <div className="p-3 bg-(--yh-brand)/5 rounded-xl border border-(--yh-brand)/15">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-(--yh-brand) flex items-center gap-1.5">
                <Sparkles size={14} />
                Invoice Code Format Preview
              </span>
              <code className="font-mono font-bold text-xs text-(--yh-brand) bg-(--yh-brand)/10 px-2 py-0.5 rounded">
                {getInvoicePreview(formData.name, formData.journeyDate)}
              </code>
            </div>
            <p className="text-[11px] text-(--yh-text-muted) mt-1">
              Generated bookings for this destination will automatically adopt this sequential prefix.
            </p>
          </div>

          {/* Pricing Model Segmented Controls */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-(--yh-text-primary)">
              Pricing Model
            </label>
            <div className="flex rounded-xl p-1 bg-(--yh-surface-muted) border border-(--yh-border-subtle)">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, pricingType: "berth" })}
                className={cn(
                  "flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all",
                  formData.pricingType === "berth"
                    ? "bg-(--yh-surface) text-(--yh-text-primary) shadow-xs"
                    : "text-(--yh-text-muted) hover:text-(--yh-text-primary)"
                )}
              >
                Berth-based Fare
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, pricingType: "fixed" })}
                className={cn(
                  "flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all",
                  formData.pricingType === "fixed"
                    ? "bg-(--yh-surface) text-(--yh-text-primary) shadow-xs"
                    : "text-(--yh-text-muted) hover:text-(--yh-text-primary)"
                )}
              >
                Fixed Fare
              </button>
            </div>
          </div>

          {/* Conditional Pricing Inputs */}
          {formData.pricingType === "fixed" ? (
            <Field
              label="Price Per Person (₹)"
              required
              error={formErrors.fixedPrice}
            >
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="12000"
                value={formData.fixedPrice}
                onChange={(e) => {
                  setFormData({ ...formData, fixedPrice: e.target.value })
                  if (formErrors.fixedPrice) setFormErrors({ ...formErrors, fixedPrice: null })
                }}
              />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Lower Berth Fare (₹)"
                required
                error={formErrors.lowerPrice}
              >
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="12000"
                  value={formData.lowerPrice}
                  onChange={(e) => {
                    setFormData({ ...formData, lowerPrice: e.target.value })
                    if (formErrors.lowerPrice) setFormErrors({ ...formErrors, lowerPrice: null })
                  }}
                />
              </Field>
              <Field
                label="Upper Berth Fare (₹)"
                required
                error={formErrors.upperPrice}
              >
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="11000"
                  value={formData.upperPrice}
                  onChange={(e) => {
                    setFormData({ ...formData, upperPrice: e.target.value })
                    if (formErrors.upperPrice) setFormErrors({ ...formErrors, upperPrice: null })
                  }}
                />
              </Field>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-(--yh-border-subtle)">
            <Button variant="outline" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingTourId ? "Update Destination" : "Save Tour Template"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
