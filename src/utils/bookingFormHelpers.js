import { isValidIndianPhone, isValidAadhaar } from "./validators.js"

/**
 * Pure helper utilities for the stepped BookingForm (Part 3.3).
 * Kept JSX-free so they can be unit-tested directly with node:test.
 */

export const BOOKING_STEPS = Object.freeze([
  { id: 0, key: "tour", label: "Tour & Date", shortLabel: "Tour" },
  { id: 1, key: "passengers", label: "Passengers & Seats", shortLabel: "Passengers" },
  { id: 2, key: "pricing", label: "Pricing & Payment", shortLabel: "Pricing" },
  { id: 3, key: "review", label: "Review", shortLabel: "Review" },
])

/**
 * Validates a single step (0: Tour & Date + Contact, 1: Passengers & Seats, 2: Pricing & Payment).
 * Mirrors every existing BookingForm validation rule without weakening any check.
 *
 * @param {number} stepIndex
 * @param {Object} formData
 * @param {{ pricingBreakdown?: Object, bookedSeats?: Array<{ seatId: string }> }} [context]
 * @returns {{
 *   valid: boolean,
 *   errors: Record<string, string>,
 *   summary: Array<{ fieldId: string, message: string }>,
 * }}
 */
export function validateBookingStep(stepIndex, formData, context = {}) {
  const errors = {}
  const summary = []
  const addError = (fieldId, message) => {
    if (!errors[fieldId]) {
      errors[fieldId] = message
      summary.push({ fieldId, message })
    }
  }

  if (stepIndex === 0) {
    if (!formData?.tourName?.trim()) {
      addError("tourName", "Please select or enter a tour package")
    }
    if (!formData?.journeyDate) {
      addError("journeyDate", "Please select a journey date")
    }
    if (!formData?.busType) {
      addError("busType", "Please select a bus arrangement")
    }
    if (!formData?.contactName?.trim()) {
      addError("contactName", "Please enter the primary traveler's name")
    }
    if (!isValidIndianPhone(formData?.contactPhone)) {
      addError("contactPhone", "Please provide a valid 10-digit Indian mobile number")
    }
  } else if (stepIndex === 1) {
    const passengers = Array.isArray(formData?.passengers) ? formData.passengers : []
    if (passengers.length === 0) {
      addError("passengers", "At least one passenger is required")
    }

    const seenSeats = new Map()
    const bookedSeatIds = new Set(
      (context.bookedSeats || []).map((bs) => bs.seatId).filter(Boolean),
    )

    passengers.forEach((p, i) => {
      const label = p?.name?.trim() || `Passenger ${i + 1}`
      if (!p?.name?.trim()) {
        addError(`passenger-${i}-name`, `Passenger ${i + 1}: Name is required`)
      }
      if (!p?.city?.trim()) {
        addError(`passenger-${i}-city`, `Passenger ${i + 1}: City is required`)
      }
      const ageRaw = p?.age
      const age = Number(ageRaw)
      if (ageRaw === "" || ageRaw === null || ageRaw === undefined || isNaN(age) || age < 1 || age > 120) {
        addError(`passenger-${i}-age`, `Passenger ${label}: Please enter a valid age (1–120)`)
      }
      if (p?.aadhar && !isValidAadhaar(p.aadhar, { allowMasked: true })) {
        addError(`passenger-${i}-aadhar`, `Passenger ${label}: Aadhaar must be a 12-digit number`)
      }
      if (p?.seatId) {
        if (seenSeats.has(p.seatId)) {
          addError(
            `passenger-${i}-seat`,
            `Seat ${p.seatId} is selected by multiple passengers in this booking`,
          )
        } else {
          seenSeats.set(p.seatId, i)
        }
        if (bookedSeatIds.has(p.seatId)) {
          addError(
            `passenger-${i}-seat`,
            `Seat ${p.seatId} is already booked for this tour on this date`,
          )
        }
      }
    })
  } else if (stepIndex === 2) {
    const baseAmount = Number(formData?.baseAmount ?? formData?.totalAmount ?? 0)
    const discount = Number(formData?.discount || 0)
    const numTotal = Number(
      context.pricingBreakdown?.finalTotal ?? formData?.totalAmount ?? 0,
    )
    const numAdvance = Number(formData?.advanceReceived || 0)

    if (isNaN(baseAmount) || baseAmount < 0) {
      addError("baseAmount", "Base package cost must be 0 or greater")
    }
    if (isNaN(discount) || discount < 0) {
      addError("discount", "Discount cannot be negative")
    } else if (formData?.discountType === "percentage" && discount > 100) {
      addError("discount", "Percentage discount cannot exceed 100%")
    }
    if (isNaN(numTotal) || numTotal < 0) {
      addError("baseAmount", "Total amount must be 0 or greater")
    }
    if (isNaN(numAdvance) || numAdvance < 0) {
      addError("advanceReceived", "Advance payment cannot be negative")
    } else if (numAdvance > numTotal) {
      addError("advanceReceived", "Advance payment cannot exceed total amount")
    }
  } else if (stepIndex === 3) {
    return validateAllBookingSteps(formData, context)
  }

  return {
    valid: summary.length === 0,
    errors,
    summary,
  }
}

/**
 * Runs full validation across steps 0, 1, and 2 before final save.
 * @param {Object} formData
 * @param {{ pricingBreakdown?: Object, bookedSeats?: Array<{ seatId: string }> }} [context]
 */
export function validateAllBookingSteps(formData, context = {}) {
  const combinedErrors = {}
  const combinedSummary = []
  let firstInvalidStep = -1

  for (let step = 0; step <= 2; step += 1) {
    const res = validateBookingStep(step, formData, context)
    if (!res.valid && firstInvalidStep === -1) {
      firstInvalidStep = step
    }
    Object.assign(combinedErrors, res.errors)
    combinedSummary.push(...res.summary)
  }

  return {
    valid: combinedSummary.length === 0,
    firstInvalidStep,
    errors: combinedErrors,
    summary: combinedSummary,
  }
}

/**
 * Determines whether a step button in the stepper can be clicked directly.
 * Users can always click completed/previous steps, or any step when editing an existing booking.
 * @param {number} targetStep
 * @param {{ currentStep: number, maxVisitedStep: number, isEditMode: boolean }} state
 * @returns {boolean}
 */
export function canNavigateToStep(targetStep, { currentStep, maxVisitedStep, isEditMode }) {
  if (targetStep === currentStep) return false
  if (isEditMode) return targetStep >= 0 && targetStep < BOOKING_STEPS.length
  return targetStep >= 0 && targetStep <= maxVisitedStep
}

/**
 * Composes the read-only summary data for the sticky summary rail & Review step.
 * Uses the already-computed `pricingBreakdown` from untouched `calculatePricing()`.
 * @param {Object} formData
 * @param {Object} pricingBreakdown
 */
export function buildBookingSummary(formData = {}, pricingBreakdown = {}) {
  const passengers = Array.isArray(formData.passengers) ? formData.passengers : []
  const assignedSeats = passengers.map((p) => p.seatId).filter(Boolean)
  const finalTotal = Number(pricingBreakdown.finalTotal) || 0
  const advanceReceived = Math.max(0, Number(formData.advanceReceived) || 0)
  const balanceDue = Math.max(0, finalTotal - advanceReceived)

  return {
    tourName: formData.tourName || "",
    journeyDate: formData.journeyDate || "",
    busType: formData.busType || "",
    duration: formData.duration || "",
    paymentMode: formData.paymentMode || "Cash",
    passengerCount: passengers.length,
    assignedSeats,
    unassignedCount: Math.max(0, passengers.length - assignedSeats.length),
    baseAmount: Number(pricingBreakdown.baseAmount) || 0,
    discountType: formData.discountType || "fixed",
    discountValue: Number(formData.discount) || 0,
    discountAmount: Number(pricingBreakdown.discountAmount) || 0,
    netBeforeTax: Number(pricingBreakdown.netBeforeTax) || 0,
    gstRate: Number(pricingBreakdown.gstRate) || 0,
    cgstAmount: Number(pricingBreakdown.cgstAmount) || 0,
    sgstAmount: Number(pricingBreakdown.sgstAmount) || 0,
    taxAmount: Number(pricingBreakdown.taxAmount) || 0,
    isTaxInclusive: Boolean(pricingBreakdown.isTaxInclusive),
    finalTotal,
    advanceReceived,
    balanceDue,
  }
}

/**
 * Normalizes a server error response (e.g. HTTP 400 pricing mismatch or HTTP 409 seat conflict)
 * into a concise user-facing alert message.
 * @param {unknown} errOrResult
 * @returns {string}
 */
export function formatServerBookingError(errOrResult) {
  if (!errOrResult) return "Failed to save booking. Please review your details and try again."
  if (typeof errOrResult === "string") return errOrResult

  const message =
    errOrResult.error ||
    errOrResult.message ||
    errOrResult.data?.message ||
    "Failed to save booking. Please review your details and try again."

  const conflicts =
    errOrResult.data?.conflictingSeats ||
    errOrResult.conflictingSeats

  if (Array.isArray(conflicts) && conflicts.length > 0) {
    const list = conflicts
      .map((c) => (typeof c === "string" ? c : c?.seatId))
      .filter(Boolean)
      .join(", ")
    if (list && !message.includes(list)) {
      return `${message} (Conflicting seats: ${list})`
    }
  }

  return message
}
