/**
 * Shared Business & Money Logic for YatraHub (CommonJS export)
 */

function round2(num) {
  const n = Number(num)
  if (isNaN(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function calculatePricing({
  baseAmount = 0,
  discountType = "fixed",
  discountValue = 0,
  gstRate = 0,
  isTaxInclusive = false,
}) {
  const base = Math.max(0, round2(baseAmount))
  const dVal = Math.max(0, Number(discountValue) || 0)
  const gRate = Math.max(0, Number(gstRate) || 0)

  let discountAmount = 0
  if (discountType === "percentage") {
    const clampedPct = Math.min(100, dVal)
    discountAmount = round2((base * clampedPct) / 100)
  } else {
    discountAmount = Math.min(base, round2(dVal))
  }

  const netDiscounted = Math.max(0, round2(base - discountAmount))

  let netBeforeTax = 0
  let taxAmount = 0
  let finalTotal = 0

  if (isTaxInclusive) {
    if (gRate > 0) {
      netBeforeTax = round2(netDiscounted / (1 + gRate / 100))
      taxAmount = round2(netDiscounted - netBeforeTax)
    } else {
      netBeforeTax = netDiscounted
      taxAmount = 0
    }
    finalTotal = netDiscounted
  } else {
    netBeforeTax = netDiscounted
    if (gRate > 0) {
      taxAmount = round2((netBeforeTax * gRate) / 100)
    } else {
      taxAmount = 0
    }
    finalTotal = round2(netBeforeTax + taxAmount)
  }

  const cgstAmount = round2(taxAmount / 2)
  const sgstAmount = round2(taxAmount - cgstAmount)

  return {
    baseAmount: base,
    discountType,
    discountValue: dVal,
    discountAmount,
    netBeforeTax,
    gstRate: gRate,
    taxAmount,
    cgstAmount,
    sgstAmount,
    isTaxInclusive: Boolean(isTaxInclusive),
    finalTotal,
  }
}

function generateTourCode(tourName) {
  if (!tourName) return "GEN"
  const words = tourName.trim().split(/\s+/)
  if (words.length === 1) {
    return tourName.substring(0, 3).toUpperCase().padEnd(3, "X")
  }
  return words
    .map((w) => w.charAt(0).toUpperCase())
    .join("")
    .substring(0, 3)
    .padEnd(3, "X")
}

function getMonthCode(date) {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  const d = new Date(date)
  const month = isNaN(d.getMonth()) ? new Date().getMonth() : d.getMonth()
  return months[month]
}

function buildInvoicePrefix(customPrefix = "YHB", tourName = "", journeyDate = new Date()) {
  const pfx = (customPrefix || "YHB").toUpperCase().trim()
  const tourCode = generateTourCode(tourName)
  const monthCode = getMonthCode(journeyDate)
  return `${pfx}-${tourCode}-${monthCode}-`
}

function calculateNextInvoiceNo(existingInvoiceNumbers = [], prefix = "") {
  let maxSerial = 0
  for (const inv of existingInvoiceNumbers) {
    if (typeof inv === "string" && inv.startsWith(prefix)) {
      const match = inv.match(/(\d{3,})$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxSerial) maxSerial = num
      }
    }
  }
  const nextSerial = maxSerial + 1
  return `${prefix}${String(nextSerial).padStart(3, "0")}`
}

function buildReceiptPrefix(customPrefix = "REC", date = new Date()) {
  const pfx = (customPrefix || "REC").toUpperCase().trim()
  const d = new Date(date)
  const year = String(d.getFullYear()).slice(-2)
  const month = String(d.getMonth() + 1).padStart(2, "0")
  return `${pfx}-${year}${month}-`
}

function calculateNextReceiptNo(existingReceiptNumbers = [], prefix = "") {
  let maxSerial = 0
  for (const rec of existingReceiptNumbers) {
    if (typeof rec === "string" && rec.startsWith(prefix)) {
      const parts = rec.split("-")
      const serial = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(serial) && serial > maxSerial) {
        maxSerial = serial
      }
    }
  }
  const nextSerial = maxSerial + 1
  return `${prefix}${String(nextSerial).padStart(3, "0")}`
}

function getDayBounds(dateInput) {
  let dateStr = ""
  if (typeof dateInput === "string") {
    const match = dateInput.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) {
      dateStr = match[1]
    }
  }
  if (!dateStr) {
    const d = new Date(dateInput)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    dateStr = `${year}-${month}-${day}`
  }

  const start = new Date(`${dateStr}T00:00:00.000Z`)
  const end = new Date(`${dateStr}T23:59:59.999Z`)
  return { start, end, dateStr }
}

function validateIndianPhone(phone) {
  if (!phone) return false
  const clean = phone.toString().replace(/[\s\-()+]/g, "")
  if (clean.length === 12 && clean.startsWith("91")) {
    return /^[6-9]\d{9}$/.test(clean.slice(2))
  }
  if (clean.length === 11 && clean.startsWith("0")) {
    return /^[6-9]\d{9}$/.test(clean.slice(1))
  }
  return /^[6-9]\d{9}$/.test(clean)
}

function validateAadhaar(aadhar) {
  if (!aadhar) return true
  const clean = aadhar.toString().replace(/\s+/g, "")
  return /^\d{12}$/.test(clean)
}

function calculateCancellationRefund({ totalPaid = 0, cancellationCharge = 0 }) {
  const paid = Math.max(0, round2(totalPaid))
  let fee = 0

  if (cancellationCharge !== undefined && cancellationCharge !== null && cancellationCharge !== "") {
    fee = round2(cancellationCharge)
    if (isNaN(fee) || fee < 0) {
      throw new Error("Cancellation charge cannot be negative.")
    }
    if (fee > paid) {
      throw new Error(`Cancellation charge ₹${fee} cannot exceed total amount collected ₹${paid}.`)
    }
  }

  const refundAmount = Math.max(0, round2(paid - fee))
  return {
    totalPaid: paid,
    cancellationCharge: fee,
    refundAmount,
    retainedAdvance: fee,
  }
}

function computeLedgerTotals(payments = [], totalAmount = 0) {
  let totalReceived = 0
  for (const p of payments) {
    if (p.isVoid) continue
    const amt = Number(p.amount) || 0
    if (p.type === "refund") {
      totalReceived -= amt
    } else {
      totalReceived += amt
    }
  }

  const advanceReceived = Math.max(0, round2(totalReceived))
  const tot = round2(totalAmount)
  const isPaid = tot > 0 && advanceReceived >= tot
  const balanceDue = Math.max(0, round2(tot - advanceReceived))

  return {
    advanceReceived,
    balanceDue,
    isPaid,
  }
}

function findSeatConflicts({ passengers = [], occupiedSeatMap = new Map() }) {
  const seatIds = passengers.map((p) => p.seatId).filter(Boolean)
  if (seatIds.length === 0) return null

  const seen = new Set()
  for (const s of seatIds) {
    if (seen.has(s)) {
      return {
        status: 400,
        message: `Seat ${s} is assigned to multiple passengers in this booking.`,
      }
    }
    seen.add(s)
  }

  const conflicts = seatIds.filter((s) => occupiedSeatMap.has(s))
  if (conflicts.length > 0) {
    return {
      status: 409,
      message: `Seat(s) ${conflicts.join(", ")} already booked for this tour on this date.`,
      conflictingSeats: conflicts,
    }
  }

  return null
}

module.exports = {
  round2,
  calculatePricing,
  generateTourCode,
  getMonthCode,
  buildInvoicePrefix,
  calculateNextInvoiceNo,
  buildReceiptPrefix,
  calculateNextReceiptNo,
  getDayBounds,
  validateIndianPhone,
  validateAadhaar,
  calculateCancellationRefund,
  computeLedgerTotals,
  findSeatConflicts,
}
