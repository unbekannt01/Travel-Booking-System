import Counter from "../models/Counter.js"
import Booking from "../models/Booking.js"
import User from "../models/User.js"
import {
  getType,
  financialYearOf,
  formatNumber,
  getDefaultDocumentSettings,
} from "../../shared/documentTypes.js"

/**
 * Returns the next immutable document number for a user and document type.
 * Ensures:
 * - Atomic increment via Counter
 * - Key format: doc:<typeId>[:<fy>]
 * - tax-invoice continuity: first issued number continues from current invoice counter value
 * - Formatting with prefix, optional FY, and padded sequence
 */
export async function getNextDocumentNumber(
  userId,
  typeId,
  date = new Date(),
  userOverride = null,
  dependencies = {}
) {
  const CounterModel = dependencies.CounterModel || Counter
  const BookingModel = dependencies.BookingModel || Booking
  const UserModel = dependencies.UserModel || User

  const typeConfig = getType(typeId)
  if (!typeConfig) {
    throw new Error(`Invalid document type: ${typeId}`)
  }

  // 1. Resolve effective settings for this document type
  let user = userOverride
  if (!user && userId && UserModel) {
    user = await UserModel.findById(userId).select("documentSettings invoicePrefix")
  }

  const defaults = getDefaultDocumentSettings()[typeId]
  const userSettings = user?.documentSettings?.[typeId] || {}
  const effectiveSettings = {
    ...defaults,
    ...userSettings,
  }

  // 2. Compute Financial Year and determine counter key
  const fy = financialYearOf(date)
  const isYearly = effectiveSettings.resetPolicy === "yearly"
  const counterKey = isYearly ? `doc:${typeId}:${fy}` : `doc:${typeId}`

  // 3. Continuity check for tax-invoice: if counter does not exist yet, seed from existing invoice counter / bookings
  if (typeId === "tax-invoice") {
    const existingDocCounter = await CounterModel.findOne({ userId, prefix: counterKey })
    if (!existingDocCounter) {
      // Find max sequence from legacy invoice counters (not doc:* and not REC*)
      const legacyCounters = await CounterModel.find({
        userId,
        prefix: { $not: /^(doc:|REC)/ },
      }).select("seq")
      const maxCounterSeq = (legacyCounters || []).reduce((max, c) => Math.max(max, c.seq || 0), 0)

      // Also inspect existing booking invoice numbers to avoid collisions
      const existingBookings = await BookingModel.find({ userId }).select("invoiceNo")
      const maxBookingSeq = (existingBookings || []).reduce((max, b) => {
        if (!b.invoiceNo) return max
        const match = b.invoiceNo.match(/(\d+)$/)
        return match ? Math.max(max, parseInt(match[1], 10)) : max
      }, 0)

      const highestExisting = Math.max(maxCounterSeq, maxBookingSeq, 0)
      if (highestExisting > 0) {
        // Seed the counter with highestExisting so next increment starts at highestExisting + 1
        await CounterModel.findOneAndUpdate(
          { userId, prefix: counterKey },
          { $setOnInsert: { seq: highestExisting } },
          { upsert: true }
        )
      }
    }
  }

  // 4. Atomic increment
  const counter = await CounterModel.findOneAndUpdate(
    { userId, prefix: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  )

  // 5. Format number
  const formattedNumber = formatNumber({
    prefix: effectiveSettings.prefix,
    fy,
    seq: counter.seq,
    padding: effectiveSettings.padding,
    includeFy: effectiveSettings.includeFy,
  })

  return {
    number: formattedNumber,
    seq: counter.seq,
    fy,
    prefix: effectiveSettings.prefix,
    counterKey,
    settings: effectiveSettings,
  }
}
