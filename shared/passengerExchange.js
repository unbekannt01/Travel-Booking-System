/**
 * Pure ESM Passenger Exchange Specification, Validation, and Merge Planner (Part 6X)
 *
 * Implements the shared contract between YatraHub (TBS) and yatriDesk (SeatDesk v18).
 * Pure JavaScript, zero external dependencies, safe for backend and frontend.
 */

import { resolveSeatId } from "./seatLayouts.js"
import { normalizeIndianMobile } from "./customers.js"
import { round2 } from "./businessLogic.js"

export const EXCHANGE_FORMAT = "yatri-passengers"
export const EXCHANGE_VERSION = 1
export const SUPPORTED_LAYOUT = "sleeper-2x2-48"
export const CANONICAL_BUS_TYPE = "2x2 Sleeper Luxury (48 berths)"

export const EXCHANGE_LIMITS = {
  MAX_FILE_BYTES: 5 * 1024 * 1024, // 5 MB
  MAX_TRIPS: 500,
  MAX_PAX_PER_TRIP: 60,
  MAX_PAYMENTS_PER_PAX: 60,
  MAX_STR_LEN: {
    name: 100,
    city: 100,
    pickup: 150,
    note: 300,
    route: 150,
  },
}

export const VALID_PAYMENT_MODES = ["Cash", "UPI", "Card", "Net Banking", "Cheque", "Other"]

/**
 * Sanitizes input string: strips control chars, trims, and enforces max length
 */
export function sanitizeExchangeString(str, maxLen = 100) {
  if (str === null || str === undefined) return ""
  const s = String(str)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
  return s.length > maxLen ? s.slice(0, maxLen) : s
}

/**
 * Normalizes name for matching comparison
 */
export function normalizeName(name) {
  if (!name || typeof name !== "string") return ""
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * Determines whether two passenger names represent the same person
 * Rule: equal, or one contains the other (min len 3), or either is empty.
 */
export function sameName(a, b) {
  const normA = normalizeName(a)
  const normB = normalizeName(b)
  if (!normA || !normB) return true
  if (normA === normB) return true
  if (normA.length >= 3 && normB.length >= 3) {
    if (normA.includes(normB) || normB.includes(normA)) return true
  }
  return false
}

/**
 * Normalizes payment mode. Maps yatriDesk's "Other" to "Cash".
 */
export function mapPaymentMode(mode) {
  const m = String(mode || "Cash").trim()
  if (m.toLowerCase() === "other") {
    return { mode: "Cash", noteSuffix: "Mode: Other (imported)" }
  }
  const match = VALID_PAYMENT_MODES.find((v) => v.toLowerCase() === m.toLowerCase())
  return { mode: match || "Cash", noteSuffix: "" }
}

/**
 * Validates and sanitizes a complete exchange file object.
 */
export function validateExchangeFile(raw) {
  const errors = []
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, errors: ["Invalid file format: root must be a JSON object."], sanitized: null }
  }

  // Reject any prototype pollution attempts
  if (Object.prototype.hasOwnProperty.call(raw, "__proto__")) {
    return { valid: false, errors: ["Security violation: file contains prohibited keys."], sanitized: null }
  }

  const format = raw.format || raw.app
  if (format !== EXCHANGE_FORMAT) {
    errors.push(`Unrecognized format '${format}'. Expected '${EXCHANGE_FORMAT}'.`)
  }

  if (Number(raw.version) !== EXCHANGE_VERSION) {
    errors.push(`Unsupported exchange version '${raw.version}'. Expected ${EXCHANGE_VERSION}.`)
  }

  if (!Array.isArray(raw.trips)) {
    errors.push("Missing 'trips' array in exchange file.")
    return { valid: false, errors, sanitized: null }
  }

  if (raw.trips.length > EXCHANGE_LIMITS.MAX_TRIPS) {
    errors.push(`File exceeds maximum trips limit of ${EXCHANGE_LIMITS.MAX_TRIPS}. Found ${raw.trips.length}.`)
  }

  let totalPassengers = 0
  let totalPayments = 0
  let skippedTripsLayout = 0
  const sanitizedTrips = []

  for (let tIdx = 0; tIdx < raw.trips.length; tIdx++) {
    const trip = raw.trips[tIdx]
    if (!trip || typeof trip !== "object") {
      errors.push(`Trip at index ${tIdx} is not a valid object.`)
      continue
    }

    const layout = String(trip.layout || "").trim()
    if (layout !== SUPPORTED_LAYOUT) {
      skippedTripsLayout++
      continue
    }

    const sanitizedTrip = {
      xid: sanitizeExchangeString(trip.xid, 100),
      route: sanitizeExchangeString(trip.route, EXCHANGE_LIMITS.MAX_STR_LEN.route),
      date: String(trip.date || "").trim().slice(0, 10),
      time: sanitizeExchangeString(trip.time, 20),
      bus: sanitizeExchangeString(trip.bus || CANONICAL_BUS_TYPE, 100),
      layout: SUPPORTED_LAYOUT,
      fare: {
        lower: Math.max(0, Number(trip.fare?.lower) || 0),
        upper: Math.max(0, Number(trip.fare?.upper) || 0),
      },
      passengers: [],
    }

    if (!Array.isArray(trip.passengers)) {
      sanitizedTrip.passengers = []
    } else {
      if (trip.passengers.length > EXCHANGE_LIMITS.MAX_PAX_PER_TRIP) {
        errors.push(`Trip '${sanitizedTrip.route || tIdx}' exceeds max passengers (${EXCHANGE_LIMITS.MAX_PAX_PER_TRIP}).`)
      }

      for (let pIdx = 0; pIdx < Math.min(trip.passengers.length, EXCHANGE_LIMITS.MAX_PAX_PER_TRIP); pIdx++) {
        const p = trip.passengers[pIdx]
        if (!p || typeof p !== "object") continue

        totalPassengers++
        const rawSeat = String(p.seat || p.seatId || "").trim()
        const canonicalSeat = resolveSeatId(SUPPORTED_LAYOUT, rawSeat)

        const rawPhone = String(p.phone || p.contact || "").trim()
        const normalizedPhone = normalizeIndianMobile(rawPhone) || ""

        let gender = "Male"
        const gRaw = String(p.gender || "").trim().toLowerCase()
        if (gRaw === "female" || gRaw === "f") gender = "Female"
        else if (gRaw === "male" || gRaw === "m") gender = "Male"
        else gender = ""

        let ageNum = null
        if (p.age !== undefined && p.age !== null && p.age !== "") {
          const parsedAge = parseInt(p.age, 10)
          if (!isNaN(parsedAge) && parsedAge >= 1 && parsedAge <= 120) {
            ageNum = parsedAge
          }
        }

        const rawAadhaar = String(p.aadhaar || "").replace(/\D/g, "")
        const validAadhaar = rawAadhaar.length === 12 ? rawAadhaar : ""

        const sanitizedPax = {
          seat: canonicalSeat,
          rawSeat,
          name: sanitizeExchangeString(p.name, EXCHANGE_LIMITS.MAX_STR_LEN.name),
          age: ageNum,
          gender,
          phone: normalizedPhone,
          city: sanitizeExchangeString(p.city, EXCHANGE_LIMITS.MAX_STR_LEN.city),
          pickup: sanitizeExchangeString(p.pickup || p.pickupPoint, EXCHANGE_LIMITS.MAX_STR_LEN.pickup),
          note: sanitizeExchangeString(p.note || p.notes, EXCHANGE_LIMITS.MAX_STR_LEN.note),
          fare: Math.max(0, Number(p.fare) || 0),
          group: p.group !== undefined && p.group !== null && !isNaN(parseInt(p.group, 10)) ? parseInt(p.group, 10) : null,
          invoiceNo: sanitizeExchangeString(p.invoiceNo || p.ticketId, 50),
          aadhaar: validAadhaar,
          payments: [],
        }

        if (Array.isArray(p.payments)) {
          for (let pmIdx = 0; pmIdx < Math.min(p.payments.length, EXCHANGE_LIMITS.MAX_PAYMENTS_PER_PAX); pmIdx++) {
            const pm = p.payments[pmIdx]
            if (!pm || typeof pm !== "object") continue
            const amt = Math.max(0, round2(Number(pm.amount) || 0))
            if (amt <= 0) continue

            totalPayments++
            sanitizedPax.payments.push({
              xid: sanitizeExchangeString(pm.xid || pm.receiptId, 80),
              amount: amt,
              mode: sanitizeExchangeString(pm.mode || "Cash", 30),
              date: String(pm.date || "").trim().slice(0, 10),
              notes: sanitizeExchangeString(pm.notes || pm.note, 200),
            })
          }
        }

        sanitizedTrip.passengers.push(sanitizedPax)
      }
    }

    sanitizedTrips.push(sanitizedTrip)
  }

  const sanitized = {
    format: EXCHANGE_FORMAT,
    version: EXCHANGE_VERSION,
    source: sanitizeExchangeString(raw.source || raw.sourceApp || "yatriDesk", 50),
    exportedAt: raw.exportedAt || new Date().toISOString(),
    aadhaarIncluded: Boolean(raw.aadhaarIncluded),
    trips: sanitizedTrips,
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
    stats: {
      totalTrips: sanitizedTrips.length,
      skippedTripsLayout,
      totalPassengers,
      totalPayments,
    },
  }
}

/**
 * Derives passenger fares proportionally from booking total amount
 */
export function derivePassengerFares(passengers = [], tour = null, totalAmount = 0) {
  if (!passengers || passengers.length === 0) return []
  const roundTotal = round2(totalAmount || 0)
  const n = passengers.length

  // Calculate base fare per passenger
  const baseFares = passengers.map((p) => {
    if (!tour) return 1
    if (tour.pricingType === "fixed" || (tour.fixedPrice && !tour.pricingType)) {
      return Number(tour.fixedPrice) || 1
    }
    const isUpper = p.seatId && (p.seatId.toLowerCase().includes("-u") || p.seatId.toLowerCase().startsWith("u"))
    return isUpper ? Number(tour.upperPrice) || 1 : Number(tour.lowerPrice) || 1
  })

  const sumBase = baseFares.reduce((a, b) => a + b, 0)
  if (sumBase <= 0 || roundTotal <= 0) {
    const equalShare = round2(roundTotal / n)
    const fares = Array(n).fill(equalShare)
    const diff = round2(roundTotal - equalShare * n)
    fares[0] = round2(fares[0] + diff)
    return fares
  }

  let accumulated = 0
  const fares = baseFares.map((b, idx) => {
    if (idx === n - 1) {
      // Last passenger absorbs rounding remainder so sum matches exactly
      return round2(roundTotal - accumulated)
    }
    const share = round2((b / sumBase) * roundTotal)
    accumulated = round2(accumulated + share)
    return share
  })

  return fares
}

/**
 * Plan passenger merge against existing bookings and holds
 */
export function planPassengerMerge({
  trip,
  existingBookings = [],
  existingHolds = [],
  existingPayments = [],
  booksLockDate = null,
  options = {},
}) {
  const prefer = options.prefer === "file" ? "file" : "keep"
  const defaultAge = options.defaultAge ? parseInt(options.defaultAge, 10) : null
  const defaultCity = options.defaultCity ? String(options.defaultCity).trim() : ""
  const fallbackPhone = options.fallbackPhone ? normalizeIndianMobile(options.fallbackPhone) : ""
  const importPayments = options.importPayments !== false

  // Index active seats in target departure
  const occupiedSeatMap = new Map()
  const paxByPhoneAndName = new Map()

  for (const b of existingBookings) {
    if (b.status === "Cancelled" || b.status === "cancelled" || b.deletedAt) continue
    for (const p of b.passengers || []) {
      if (!p.seatId) continue
      const canon = resolveSeatId(SUPPORTED_LAYOUT, p.seatId)
      occupiedSeatMap.set(canon, { booking: b, passenger: p })

      const normName = normalizeName(p.name)
      const phone = normalizeIndianMobile(p.contact || b.contactPhone) || ""
      if (normName && phone) {
        paxByPhoneAndName.set(`${normName}:${phone}`, { seatId: canon, booking: b, passenger: p })
      }
    }
  }

  // Index active holds
  const holdSeatMap = new Map()
  for (const h of existingHolds) {
    if (h.status !== "active") continue
    for (const s of h.seatIds || []) {
      const canon = resolveSeatId(SUPPORTED_LAYOUT, s)
      holdSeatMap.set(canon, h)
    }
  }

  const results = []
  let countAdd = 0
  let countMerge = 0
  let countSame = 0
  let countConflict = 0
  let countHold = 0
  let countDup = 0
  let countInvalid = 0
  let totalNewFares = 0
  let totalNewPaymentsAmount = 0
  let skippedBooksLockedPayments = 0
  let skippedOverpayments = 0

  for (const filePax of trip.passengers || []) {
    const seatId = filePax.seat
    if (!seatId) {
      countInvalid++
      results.push({
        seatId: filePax.rawSeat || "unknown",
        passenger: filePax,
        action: "INVALID",
        reason: "Missing or unresolvable seat ID",
      })
      continue
    }

    const occupied = occupiedSeatMap.get(seatId)

    if (occupied) {
      // Seat is occupied -> Check if same person or conflict
      const isSame = sameName(occupied.passenger.name, filePax.name)
      if (!isSame) {
        countConflict++
        results.push({
          seatId,
          passenger: filePax,
          occupiedBy: occupied.passenger.name,
          action: "CONFLICT",
          reason: `Seat occupied by different passenger '${occupied.passenger.name}'`,
        })
        continue
      }

      // Same person -> Evaluate MERGE
      const fills = {}
      const diffs = {}

      const fieldPairs = [
        ["contact", occupied.passenger.contact || occupied.booking.contactPhone, filePax.phone],
        ["city", occupied.passenger.city, filePax.city],
        ["age", occupied.passenger.age, filePax.age],
        ["gender", occupied.passenger.gender, filePax.gender],
        ["pickupPoint", occupied.passenger.pickupPoint, filePax.pickup],
        ["aadhar", occupied.passenger.aadhar, filePax.aadhaar],
      ]

      for (const [field, existingVal, fileVal] of fieldPairs) {
        if (!existingVal && fileVal) {
          fills[field] = fileVal
        } else if (existingVal && fileVal && String(existingVal) !== String(fileVal)) {
          diffs[field] = { existing: existingVal, file: fileVal, applied: prefer === "file" ? fileVal : existingVal }
        }
      }

      // Check payments to merge
      const newPayments = []
      if (importPayments && Array.isArray(filePax.payments)) {
        for (const pm of filePax.payments) {
          // Check if payment already exists in booking's ledger
          const isDup = (occupied.booking.payments || []).some((bp) => {
            if (pm.xid && bp.referenceNo && (bp.referenceNo === pm.xid || bp.referenceNo.startsWith(pm.xid))) return true
            return bp.amount === pm.amount && String(bp.mode).toLowerCase() === String(pm.mode).toLowerCase()
          })

          if (!isDup) {
            // Check books lock
            if (booksLockDate && pm.date && new Date(pm.date) <= new Date(booksLockDate)) {
              skippedBooksLockedPayments++
              continue
            }
            newPayments.push(pm)
            totalNewPaymentsAmount = round2(totalNewPaymentsAmount + pm.amount)
          }
        }
      }

      const hasChanges = Object.keys(fills).length > 0 || Object.keys(diffs).length > 0 || newPayments.length > 0

      if (hasChanges) {
        countMerge++
        results.push({
          seatId,
          passenger: filePax,
          action: "MERGE",
          existingBookingId: occupied.booking._id,
          existingBookingInvoice: occupied.booking.invoiceNo,
          fills,
          diffs,
          newPayments,
        })
      } else {
        countSame++
        results.push({
          seatId,
          passenger: filePax,
          action: "SAME",
          existingBookingInvoice: occupied.booking.invoiceNo,
        })
      }
    } else {
      // Seat is empty -> Check if held
      const hold = holdSeatMap.get(seatId)
      if (hold) {
        countHold++
        results.push({
          seatId,
          passenger: filePax,
          action: "HOLD",
          holdInfo: {
            kind: hold.kind,
            holderName: hold.holderName,
            expiresAt: hold.expiresAt,
          },
          reason: `Seat has an active ${hold.kind}`,
        })
        continue
      }

      // Check if duplicate on another seat
      const normName = normalizeName(filePax.name)
      const phone = filePax.phone || fallbackPhone
      const dup = normName && phone ? paxByPhoneAndName.get(`${normName}:${phone}`) : null

      if (dup && !options.allowDups) {
        countDup++
        results.push({
          seatId,
          passenger: filePax,
          action: "DUP",
          existingSeat: dup.seatId,
          existingInvoice: dup.booking.invoiceNo,
          reason: `Same passenger '${filePax.name}' already on seat ${dup.seatId}`,
        })
        continue
      }

      // Check required fields for ADD
      const effectiveAge = filePax.age || defaultAge
      const effectiveCity = filePax.city || defaultCity
      const effectivePhone = filePax.phone || fallbackPhone

      if (!effectiveAge || !effectiveCity || !effectivePhone) {
        countInvalid++
        results.push({
          seatId,
          passenger: filePax,
          action: "INVALID",
          missing: [
            !effectiveAge && "age",
            !effectiveCity && "city",
            !effectivePhone && "phone",
          ].filter(Boolean),
          reason: "Missing mandatory fields (age, city, or phone)",
        })
        continue
      }

      // ADD new passenger
      countAdd++
      totalNewFares = round2(totalNewFares + filePax.fare)

      const newPayments = []
      if (importPayments && Array.isArray(filePax.payments)) {
        for (const pm of filePax.payments) {
          if (booksLockDate && pm.date && new Date(pm.date) <= new Date(booksLockDate)) {
            skippedBooksLockedPayments++
            continue
          }
          newPayments.push(pm)
          totalNewPaymentsAmount = round2(totalNewPaymentsAmount + pm.amount)
        }
      }

      results.push({
        seatId,
        passenger: {
          ...filePax,
          age: effectiveAge,
          city: effectiveCity,
          phone: effectivePhone,
        },
        action: "ADD",
        fare: filePax.fare,
        group: filePax.group,
        newPayments,
      })
    }
  }

  return {
    summary: {
      total: trip.passengers?.length || 0,
      add: countAdd,
      merge: countMerge,
      same: countSame,
      conflict: countConflict,
      hold: countHold,
      dup: countDup,
      invalid: countInvalid,
      totalNewFares,
      totalNewPaymentsAmount,
      skippedBooksLockedPayments,
      skippedOverpayments,
    },
    results,
  }
}
