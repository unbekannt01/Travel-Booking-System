/**
 * Backend Passenger Import & Merge Service (Part 6X)
 *
 * Implements authoritative direct booking creation and ledger synchronization
 * for yatriDesk (SeatDesk) exchange files.
 */

import Booking from "../models/Booking.js"
import Payment from "../models/Payment.js"
import SeatHold from "../models/SeatHold.js"
import Tour from "../models/Tour.js"
import User from "../models/User.js"
import { getNextInvoiceNo, checkSeatConflicts, upsertCustomerForBooking } from "../routes/bookings.js"
import { getNextReceiptNo, syncBookingPayments } from "../routes/payments.js"
import { ensureLegacyInvoiceDocument } from "../routes/documents.js"
import recordHistory from "./recordHistory.js"
import { encryptAadhaar } from "./aadhaar.js"
import { getDayBounds, round2 } from "../../shared/businessLogic.js"
import { getBusCondition } from "./departureKey.js"
import { getEffectiveLockDate } from "./booksLock.js"
import {
  SUPPORTED_LAYOUT,
  CANONICAL_BUS_TYPE,
  mapPaymentMode,
  planPassengerMerge,
} from "../../shared/passengerExchange.js"
import { resolveSeatId } from "../../shared/seatLayouts.js"

/**
 * Executes commit of a planned passenger merge for a single trip.
 */
export async function commitTripPassengers({
  userId,
  trip,
  targetDeparture,
  batchId,
  options = {},
}) {
  const user = await User.findById(userId).lean()
  if (!user) throw new Error("Operator user not found.")

  const { tourName, journeyDateStr } = targetDeparture
  const { start, end } = getDayBounds(journeyDateStr)
  const journeyDate = new Date(journeyDateStr)
  const busCondition = getBusCondition(CANONICAL_BUS_TYPE)

  // 1. Fetch active bookings for this departure
  const existingBookings = await Booking.find({
    userId,
    tourName,
    journeyDate: { $gte: start, $lte: end },
    ...busCondition,
    status: { $ne: "Cancelled" },
    deletedAt: null,
  })

  // 2. Fetch active seat holds
  const now = new Date()
  const existingHolds = await SeatHold.find({
    userId,
    tourName,
    journeyDate: { $gte: start, $lte: end },
    status: "active",
    ...busCondition,
    $or: [{ mode: "manual" }, { expiresAt: { $gt: now } }],
  }).lean()

  const booksLockDate = await getEffectiveLockDate(userId)

  // 3. Re-run plan to verify against database
  const plan = planPassengerMerge({
    trip,
    existingBookings,
    existingHolds,
    booksLockDate,
    options,
  })

  const createdBookingIds = []
  const importedPaymentIds = []
  const mergedBookingIds = []

  // Group ADD rows by file 'group'
  const addRows = plan.results.filter((r) => r.action === "ADD")
  const groupsMap = new Map() // groupKey -> [rows]
  let ungroupedCounter = 1

  for (const row of addRows) {
    const groupKey = row.group !== null && row.group !== undefined ? `grp_${row.group}` : `single_${ungroupedCounter++}`
    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, [])
    }
    groupsMap.get(groupKey).push(row)
  }

  // 4. Create new bookings for ADD groups
  for (const [, rows] of groupsMap.entries()) {
    const passengers = rows.map((r) => {
      const p = r.passenger
      return {
        name: p.name,
        nameGu: p.nameGu || "",
        age: p.age,
        gender: p.gender || "Male",
        city: p.city,
        seatId: r.seatId,
        contact: p.phone,
        pickupPoint: p.pickup || "",
        pickupTime: "",
        aadhar: p.aadhaar ? encryptAadhaar(p.aadhaar) : undefined,
        aadharEncrypted: Boolean(p.aadhaar),
        checkedIn: false,
      }
    })

    // Check race seat conflicts
    const seatConflict = await checkSeatConflicts({
      userId,
      tourName,
      journeyDate,
      busType: CANONICAL_BUS_TYPE,
      passengers,
    })
    if (seatConflict && seatConflict.conflictingSeats?.length > 0) {
      console.warn(`[PassengerImport] Race seat conflict on seats: ${seatConflict.conflictingSeats.join(", ")}`)
      continue
    }

    // Determine contact person (first passenger with valid 10-digit phone, or fallback)
    let contactPax = rows.find((r) => r.passenger.phone && r.passenger.phone.length === 10)
    let contactName = contactPax ? contactPax.passenger.name : rows[0].passenger.name
    let contactPhone = contactPax ? contactPax.passenger.phone : options.fallbackPhone || ""

    if (!contactPhone) {
      console.warn("[PassengerImport] Skipping booking creation: no valid contact phone available.")
      continue
    }

    const totalAmount = round2(rows.reduce((sum, r) => sum + (r.fare || 0), 0))
    const invoiceNo = await getNextInvoiceNo(userId, tourName, journeyDate, user.invoicePrefix || "YHB")

    const newBooking = new Booking({
      userId,
      invoiceNo,
      date: new Date(),
      tourName,
      journeyDate,
      busType: CANONICAL_BUS_TYPE,
      seatLayoutKey: SUPPORTED_LAYOUT,
      contactName,
      contactPhone,
      contactEmail: "",
      pickupPoint: rows[0].passenger.pickup || "",
      pickupTime: "",
      dropPoint: "",
      paymentMode: "Cash",
      totalAmount,
      advanceReceived: 0,
      isPaid: false,
      status: "Confirmed",
      discount: 0,
      discountType: "fixed",
      gstRate: 0,
      taxAmount: 0,
      isTaxInclusive: false,
      payments: [],
      passengers,
      source: "import",
      importBatchId: batchId,
      pricingOverride: true,
      externalRef: {
        system: "yatriDesk",
        tripXid: trip.xid || "",
        group: rows[0].group || null,
        invoiceNo: rows[0].passenger.invoiceNo || "",
      },
    })

    // Upsert customer if valid phone was used (skip if fallback phone per rule)
    if (contactPax && contactPhone !== options.fallbackPhone) {
      try {
        const customer = await upsertCustomerForBooking(userId, {
          contactName,
          contactPhone,
          contactEmail: "",
        })
        if (customer?._id) {
          newBooking.customerId = customer._id
        }
      } catch (err) {
        console.warn("[PassengerImport] Customer upsert non-blocking error:", err.message)
      }
    }

    const savedBooking = await newBooking.save()
    createdBookingIds.push(savedBooking._id)

    // Legacy invoice & history
    try {
      await ensureLegacyInvoiceDocument(savedBooking, user)
      await recordHistory({
        userId,
        entityType: "Booking",
        entityId: savedBooking._id,
        action: "import",
        before: null,
        after: savedBooking.toObject(),
        operatorName: user.userName || "Operator",
      })
    } catch (hErr) {
      console.warn("[PassengerImport] History/document non-blocking error:", hErr.message)
    }

    // Process payments for newly created booking
    if (options.importPayments !== false) {
      let isFirstPayment = true
      let bookingAccumulatedPaid = 0

      for (const row of rows) {
        for (const pm of row.newPayments || []) {
          // Check books lock
          if (booksLockDate && pm.date && new Date(pm.date) <= new Date(booksLockDate)) {
            continue
          }

          // Check overpayment
          if (round2(bookingAccumulatedPaid + pm.amount) > totalAmount) {
            continue
          }

          const { mode: mappedMode, noteSuffix } = mapPaymentMode(pm.mode)
          const receiptNo = await getNextReceiptNo(userId, user.receiptPrefix || "REC", pm.date ? new Date(pm.date) : new Date())
          const notesText = [pm.notes, noteSuffix].filter(Boolean).join(" - ") || "Imported from yatriDesk"

          const paymentDoc = new Payment({
            userId,
            bookingId: savedBooking._id,
            receiptNo,
            amount: pm.amount,
            type: isFirstPayment ? "advance" : "partial",
            paymentMode: mappedMode,
            paymentDate: pm.date ? new Date(pm.date) : new Date(),
            referenceNo: pm.xid || "",
            notes: notesText,
            passengerSeatId: row.seatId || "",
            recordedBy: "Import",
          })

          const savedPayment = await paymentDoc.save()
          importedPaymentIds.push(savedPayment._id)
          bookingAccumulatedPaid = round2(bookingAccumulatedPaid + pm.amount)
          isFirstPayment = false
        }
      }

      await syncBookingPayments(savedBooking._id)
    }
  }

  // 5. Process MERGE on existing bookings
  const mergeRows = plan.results.filter((r) => r.action === "MERGE")
  const bookingsToUpdate = new Map() // bookingId -> { booking, fills, newPayments }

  for (const row of mergeRows) {
    const bId = row.existingBookingId.toString()
    if (!bookingsToUpdate.has(bId)) {
      const bDoc = existingBookings.find((b) => b._id.toString() === bId)
      if (bDoc) bookingsToUpdate.set(bId, { booking: bDoc, items: [] })
    }
    if (bookingsToUpdate.has(bId)) {
      bookingsToUpdate.get(bId).items.push(row)
    }
  }

  for (const { booking, items } of bookingsToUpdate.values()) {
    let bookingModified = false

    for (const item of items) {
      const pIdx = (booking.passengers || []).findIndex(
        (p) => resolveSeatId(SUPPORTED_LAYOUT, p.seatId) === item.seatId,
      )
      if (pIdx === -1) continue

      const targetPax = booking.passengers[pIdx]

      // Apply fills
      for (const [fKey, fVal] of Object.entries(item.fills || {})) {
        if (fKey === "aadhar" && fVal) {
          targetPax.aadhar = encryptAadhaar(fVal)
          targetPax.aadharEncrypted = true
          bookingModified = true
        } else if (fVal) {
          targetPax[fKey] = fVal
          bookingModified = true
        }
      }

      // Apply diffs if prefer === 'file'
      if (options.prefer === "file") {
        for (const [dKey, dObj] of Object.entries(item.diffs || {})) {
          if (dKey === "aadhar" && dObj.file) {
            targetPax.aadhar = encryptAadhaar(dObj.file)
            targetPax.aadharEncrypted = true
            bookingModified = true
          } else if (dObj.file !== undefined) {
            targetPax[dKey] = dObj.file
            bookingModified = true
          }
        }
      }

      // Add new payments for this merged passenger
      if (options.importPayments !== false && Array.isArray(item.newPayments)) {
        const currentPaid = booking.advanceReceived || 0
        let accumulatedPaid = currentPaid

        for (const pm of item.newPayments) {
          if (round2(accumulatedPaid + pm.amount) > booking.totalAmount) {
            continue
          }

          const { mode: mappedMode, noteSuffix } = mapPaymentMode(pm.mode)
          const receiptNo = await getNextReceiptNo(userId, user.receiptPrefix || "REC", pm.date ? new Date(pm.date) : new Date())
          const notesText = [pm.notes, noteSuffix].filter(Boolean).join(" - ") || "Imported from yatriDesk (Merged)"

          const paymentDoc = new Payment({
            userId,
            bookingId: booking._id,
            receiptNo,
            amount: pm.amount,
            type: "partial",
            paymentMode: mappedMode,
            paymentDate: pm.date ? new Date(pm.date) : new Date(),
            referenceNo: pm.xid || "",
            notes: notesText,
            passengerSeatId: item.seatId || "",
            recordedBy: "Import",
          })

          const savedPayment = await paymentDoc.save()
          importedPaymentIds.push(savedPayment._id)
          accumulatedPaid = round2(accumulatedPaid + pm.amount)
        }

        await syncBookingPayments(booking._id)
      }
    }

    if (bookingModified) {
      await booking.save()
      mergedBookingIds.push(booking._id)
    }
  }

  return {
    createdBookingIds,
    importedPaymentIds,
    mergedBookingIds,
    summary: plan.summary,
  }
}
