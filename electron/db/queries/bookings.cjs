const crypto = require("crypto")
const {
  buildInvoicePrefix,
  calculateNextInvoiceNo,
  buildReceiptPrefix,
  calculateNextReceiptNo,
  getDayBounds,
  calculateCancellationRefund,
  computeLedgerTotals,
  round2,
} = require("../../../shared/businessLogic.cjs")

function formatBooking(b, passengers = [], payments = []) {
  if (!b) return null
  return {
    ...b,
    id: b.id,
    _id: b.id,
    isPaid: Boolean(b.isPaid),
    passengers: (passengers || []).map((p) => ({
      ...p,
      id: p.id,
      _id: p.id,
      checkedIn: Boolean(p.checkedIn),
    })),
    payments: (payments || []).map((pm) => ({
      ...pm,
      id: pm.id,
      _id: pm.id,
      isVoid: Boolean(pm.isVoid),
    })),
  }
}

function getBookingFull(db, id) {
  const bStmt = db.prepare("SELECT * FROM bookings WHERE id = ?")
  const b = bStmt.get(id)
  if (!b) return null

  const pStmt = db.prepare("SELECT * FROM passengers WHERE bookingId = ? ORDER BY rowid ASC")
  const passengers = pStmt.all(id)

  const pmStmt = db.prepare("SELECT * FROM payments WHERE bookingId = ? ORDER BY createdAt ASC")
  const payments = pmStmt.all(id)

  return formatBooking(b, passengers, payments)
}

function listBookings(db) {
  const bStmt = db.prepare("SELECT * FROM bookings WHERE deletedAt IS NULL ORDER BY createdAt DESC")
  const bookings = bStmt.all()

  if (bookings.length === 0) return []

  const pStmt = db.prepare("SELECT * FROM passengers ORDER BY rowid ASC")
  const allPassengers = pStmt.all()

  const pmStmt = db.prepare("SELECT * FROM payments ORDER BY createdAt ASC")
  const allPayments = pmStmt.all()

  const passMap = new Map()
  for (const p of allPassengers) {
    if (!passMap.has(p.bookingId)) passMap.set(p.bookingId, [])
    passMap.get(p.bookingId).push(p)
  }

  const payMap = new Map()
  for (const pm of allPayments) {
    if (!payMap.has(pm.bookingId)) payMap.set(pm.bookingId, [])
    payMap.get(pm.bookingId).push(pm)
  }

  return bookings.map((b) => formatBooking(b, passMap.get(b.id) || [], payMap.get(b.id) || []))
}

function getBooking(db, id) {
  return getBookingFull(db, id)
}

function getSetting(db, key, defaultValue = "") {
  const stmt = db.prepare("SELECT value FROM settings WHERE key = ?")
  const row = stmt.get(key)
  return row ? row.value : defaultValue
}

function syncActiveSeats(db, bookingId) {
  const bStmt = db.prepare("SELECT * FROM bookings WHERE id = ?")
  const b = bStmt.get(bookingId)
  if (!b) return

  // Release seats if deleted or cancelled
  if (b.deletedAt || b.status === "Cancelled" || b.status === "cancelled") {
    db.prepare("DELETE FROM active_seats WHERE bookingId = ?").run(bookingId)
    return
  }

  const normDate = getDayBounds(b.journeyDate).dateStr
  const passengers = db.prepare("SELECT * FROM passengers WHERE bookingId = ?").all(bookingId)

  // Remove existing locks for this booking
  db.prepare("DELETE FROM active_seats WHERE bookingId = ?").run(bookingId)

  const insertSeat = db.prepare(`
    INSERT INTO active_seats (tourName, journeyDate, seatId, bookingId, passengerId)
    VALUES (?, ?, ?, ?, ?)
  `)

  for (const p of passengers) {
    if (p.seatId) {
      // Check if already taken by another booking
      const conflict = db.prepare(`
        SELECT * FROM active_seats
        WHERE tourName = ? AND journeyDate = ? AND seatId = ?
      `).get(b.tourName, normDate, p.seatId)

      if (conflict) {
        const err = new Error(`Seat ${p.seatId} is already booked for this tour on this date.`)
        err.status = 409
        err.conflictingSeats = [p.seatId]
        throw err
      }

      insertSeat.run(b.tourName, normDate, p.seatId, bookingId, p.id)
    }
  }
}

function createBooking(db, bookingData) {
  const executeTx = db.transaction(() => {
    const id = bookingData.id || bookingData._id || crypto.randomUUID()
    const now = new Date().toISOString()
    const journeyDate = bookingData.journeyDate || now
    const normDate = getDayBounds(journeyDate).dateStr
    const tourName = bookingData.tourName || "General Tour"

    // Check internal duplicates in passengers
    const passengers = bookingData.passengers || []
    const seatIds = passengers.map((p) => p.seatId).filter(Boolean)
    const seen = new Set()
    for (const s of seatIds) {
      if (seen.has(s)) {
        const err = new Error(`Seat ${s} is assigned to multiple passengers in this booking.`)
        err.status = 400
        throw err
      }
      seen.add(s)
    }

    // Check external collisions in active_seats
    for (const s of seatIds) {
      const conflict = db.prepare(`
        SELECT * FROM active_seats
        WHERE tourName = ? AND journeyDate = ? AND seatId = ?
      `).get(tourName, normDate, s)

      if (conflict) {
        const err = new Error(`Seat ${s} is already booked for this tour on this date.`)
        err.status = 409
        err.conflictingSeats = [s]
        throw err
      }
    }

    // Generate Invoice Number if not provided
    let invoiceNo = bookingData.invoiceNo
    if (!invoiceNo) {
      const invPrefix = getSetting(db, "invoicePrefix", "YHB")
      const prefix = buildInvoicePrefix(invPrefix, tourName, journeyDate)
      const existingInvoices = db.prepare(`
        SELECT invoiceNo FROM bookings WHERE invoiceNo LIKE ?
      `).all(`${prefix}%`).map((r) => r.invoiceNo)

      invoiceNo = calculateNextInvoiceNo(existingInvoices, prefix)
    }

    const totalAmount = round2(bookingData.totalAmount || 0)
    const advanceReceived = round2(bookingData.advanceReceived || 0)
    const discount = round2(bookingData.discount || 0)
    const gstPercent = round2(bookingData.gstPercent || 0)
    const baseAmount = round2(bookingData.baseAmount || 0)
    const gstAmount = round2(bookingData.gstAmount || 0)
    const isPaid = bookingData.isPaid !== undefined ? (bookingData.isPaid ? 1 : 0) : (advanceReceived >= totalAmount && totalAmount > 0 ? 1 : 0)

    const insertBooking = db.prepare(`
      INSERT INTO bookings (
        id, invoiceNo, tourId, tourName, journeyDate, busType,
        totalAmount, advanceReceived, discount, gstPercent, baseAmount, gstAmount,
        isPaid, paymentMode, status, contactName, contactPhone, notes,
        bookingDate, deletedAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `)

    insertBooking.run(
      id,
      invoiceNo,
      bookingData.tourId || "",
      tourName,
      journeyDate,
      bookingData.busType || "2x1 Sleeper",
      totalAmount,
      advanceReceived,
      discount,
      gstPercent,
      baseAmount,
      gstAmount,
      isPaid,
      bookingData.paymentMode || "Cash",
      bookingData.status || "Confirmed",
      bookingData.contactName || "",
      bookingData.contactPhone || "",
      bookingData.notes || "",
      bookingData.bookingDate || now,
      now,
      now
    )

    // Insert Passengers
    const insertPassenger = db.prepare(`
      INSERT INTO passengers (id, bookingId, seatId, name, age, gender, phone, aadhar, checkedIn, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const p of passengers) {
      const pId = p.id || p._id || crypto.randomUUID()
      insertPassenger.run(
        pId,
        id,
        p.seatId || "",
        p.name || "",
        Number(p.age) || null,
        p.gender || "",
        p.phone || "",
        p.aadhar || "",
        p.checkedIn ? 1 : 0,
        now
      )
    }

    // Insert Initial Payment into Ledger if advanceReceived > 0
    if (advanceReceived > 0) {
      const recPrefix = getSetting(db, "receiptPrefix", "REC")
      const prefix = buildReceiptPrefix(recPrefix, new Date())
      const existingReceipts = db.prepare(`
        SELECT receiptNo FROM payments WHERE receiptNo LIKE ?
      `).all(`${prefix}%`).map((r) => r.receiptNo)

      const receiptNo = calculateNextReceiptNo(existingReceipts, prefix)
      const payId = crypto.randomUUID()

      db.prepare(`
        INSERT INTO payments (
          id, bookingId, receiptNo, amount, type, paymentMode, paymentDate,
          referenceNo, notes, recordedBy, isVoid, voidReason, voidedAt, voidedBy, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, ?)
      `).run(
        payId,
        id,
        receiptNo,
        advanceReceived,
        isPaid ? "full" : "advance",
        bookingData.paymentMode || "Cash",
        now,
        "",
        "Initial advance payment at booking",
        "Operator",
        now
      )
    }

    // Lock Active Seats
    syncActiveSeats(db, id)

    return id
  })

  const newId = executeTx()
  return getBookingFull(db, newId)
}

function updateBooking(db, id, bookingData) {
  const executeTx = db.transaction(() => {
    const existing = getBookingFull(db, id)
    if (!existing) throw new Error(`Booking ${id} not found`)

    const now = new Date().toISOString()
    const tourName = bookingData.tourName !== undefined ? bookingData.tourName : existing.tourName
    const journeyDate = bookingData.journeyDate !== undefined ? bookingData.journeyDate : existing.journeyDate
    const busType = bookingData.busType !== undefined ? bookingData.busType : existing.busType
    const contactName = bookingData.contactName !== undefined ? bookingData.contactName : existing.contactName
    const contactPhone = bookingData.contactPhone !== undefined ? bookingData.contactPhone : existing.contactPhone
    const notes = bookingData.notes !== undefined ? bookingData.notes : existing.notes
    const status = bookingData.status !== undefined ? bookingData.status : existing.status

    db.prepare(`
      UPDATE bookings
      SET tourName = ?, journeyDate = ?, busType = ?, contactName = ?, contactPhone = ?, notes = ?, status = ?, updatedAt = ?
      WHERE id = ?
    `).run(tourName, journeyDate, busType, contactName, contactPhone, notes, status, now, id)

    // If passengers list is updated
    if (Array.isArray(bookingData.passengers)) {
      db.prepare("DELETE FROM passengers WHERE bookingId = ?").run(id)
      const insertPassenger = db.prepare(`
        INSERT INTO passengers (id, bookingId, seatId, name, age, gender, phone, aadhar, checkedIn, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const p of bookingData.passengers) {
        const pId = p.id || p._id || crypto.randomUUID()
        insertPassenger.run(
          pId,
          id,
          p.seatId || "",
          p.name || "",
          Number(p.age) || null,
          p.gender || "",
          p.phone || "",
          p.aadhar || "",
          p.checkedIn ? 1 : 0,
          now
        )
      }
    }

    syncActiveSeats(db, id)
    return id
  })

  executeTx()
  return getBookingFull(db, id)
}

function deleteBooking(db, id) {
  const executeTx = db.transaction(() => {
    const now = new Date().toISOString()
    db.prepare("UPDATE bookings SET deletedAt = ?, updatedAt = ? WHERE id = ?").run(now, now, id)
    db.prepare("DELETE FROM active_seats WHERE bookingId = ?").run(id)
    return { success: true, id }
  })
  return executeTx()
}

function restoreBooking(db, id) {
  const executeTx = db.transaction(() => {
    const existing = getBookingFull(db, id)
    if (!existing) throw new Error(`Booking ${id} not found`)

    // Check seat conflicts before restoring
    const normDate = getDayBounds(existing.journeyDate).dateStr
    for (const p of existing.passengers) {
      if (p.seatId) {
        const conflict = db.prepare(`
          SELECT * FROM active_seats
          WHERE tourName = ? AND journeyDate = ? AND seatId = ?
        `).get(existing.tourName, normDate, p.seatId)

        if (conflict) {
          const err = new Error(`Cannot restore: Seat ${p.seatId} is now booked by another reservation.`)
          err.status = 409
          throw err
        }
      }
    }

    db.prepare("UPDATE bookings SET deletedAt = NULL, updatedAt = ? WHERE id = ?").run(
      new Date().toISOString(),
      id
    )
    syncActiveSeats(db, id)
    return getBookingFull(db, id)
  })
  return executeTx()
}

function cancelBooking(db, id, options = {}) {
  const executeTx = db.transaction(() => {
    const existing = getBookingFull(db, id)
    if (!existing) throw new Error(`Booking ${id} not found`)

    const reason = options.reason || "Cancelled by operator"
    const cancellationCharge = options.cancellationCharge
    const refundPaymentMode = options.refundPaymentMode || "Cash"

    const totalPaid = round2(existing.advanceReceived || 0)
    const calc = calculateCancellationRefund({ totalPaid, cancellationCharge })
    const fee = calc.cancellationCharge
    const refundAmount = calc.refundAmount
    const now = new Date().toISOString()

    if (refundAmount > 0) {
      const recPrefix = getSetting(db, "receiptPrefix", "REC")
      const prefix = buildReceiptPrefix(recPrefix, new Date())
      const existingReceipts = db.prepare(`
        SELECT receiptNo FROM payments WHERE receiptNo LIKE ?
      `).all(`${prefix}%`).map((r) => r.receiptNo)
      const receiptNo = calculateNextReceiptNo(existingReceipts, prefix)

      db.prepare(`
        INSERT INTO payments (
          id, bookingId, receiptNo, amount, type, paymentMode, paymentDate,
          referenceNo, notes, recordedBy, isVoid, voidReason, voidedAt, voidedBy, createdAt
        ) VALUES (?, ?, ?, ?, 'refund', ?, ?, '', ?, 'Operator', 0, NULL, NULL, NULL, ?)
      `).run(
        crypto.randomUUID(),
        id,
        receiptNo,
        refundAmount,
        refundPaymentMode,
        now,
        `Refund upon cancellation (Cancellation fee retained: ₹${fee})`,
        now
      )
    }

    db.prepare(`
      UPDATE bookings
      SET status = 'Cancelled', advanceReceived = ?, updatedAt = ?
      WHERE id = ?
    `).run(fee, now, id)

    // Release seats
    db.prepare("DELETE FROM active_seats WHERE bookingId = ?").run(id)
    return getBookingFull(db, id)
  })
  return executeTx()
}

function updatePassenger(db, bookingId, passengerIdentifier, passengerData) {
  const executeTx = db.transaction(() => {
    const existing = getBookingFull(db, bookingId)
    if (!existing) throw new Error(`Booking ${bookingId} not found`)

    const passengers = existing.passengers
    let target = null

    // Find by ID or index
    if (typeof passengerIdentifier === "number" || /^\d+$/.test(passengerIdentifier)) {
      const idx = Number(passengerIdentifier)
      target = passengers[idx]
    } else {
      target = passengers.find((p) => p.id === passengerIdentifier || p._id === passengerIdentifier)
    }

    if (!target) throw new Error(`Passenger ${passengerIdentifier} not found`)

    const name = passengerData.name !== undefined ? passengerData.name : target.name
    const age = passengerData.age !== undefined ? Number(passengerData.age) : target.age
    const gender = passengerData.gender !== undefined ? passengerData.gender : target.gender
    const phone = passengerData.phone !== undefined ? passengerData.phone : target.phone
    const aadhar = passengerData.aadhar !== undefined ? passengerData.aadhar : target.aadhar
    const checkedIn = passengerData.checkedIn !== undefined ? (passengerData.checkedIn ? 1 : 0) : (target.checkedIn ? 1 : 0)
    const newSeatId = passengerData.seatId !== undefined ? passengerData.seatId : target.seatId

    if (newSeatId && newSeatId !== target.seatId) {
      const normDate = getDayBounds(existing.journeyDate).dateStr
      const conflict = db.prepare(`
        SELECT * FROM active_seats
        WHERE tourName = ? AND journeyDate = ? AND seatId = ? AND bookingId != ?
      `).get(existing.tourName, normDate, newSeatId, bookingId)

      if (conflict) {
        const err = new Error(`Seat ${newSeatId} is already booked for this tour on this date.`)
        err.status = 409
        err.conflictingSeats = [newSeatId]
        throw err
      }
    }

    db.prepare(`
      UPDATE passengers
      SET name = ?, age = ?, gender = ?, phone = ?, aadhar = ?, checkedIn = ?, seatId = ?
      WHERE id = ?
    `).run(name, age, gender, phone, aadhar, checkedIn, newSeatId, target.id)

    syncActiveSeats(db, bookingId)
    return getBookingFull(db, bookingId)
  })
  return executeTx()
}

function togglePassengerCheckin(db, bookingId, passengerIndex) {
  const executeTx = db.transaction(() => {
    const existing = getBookingFull(db, bookingId)
    if (!existing) throw new Error(`Booking ${bookingId} not found`)

    const p = existing.passengers[passengerIndex]
    if (!p) throw new Error(`Passenger at index ${passengerIndex} not found`)

    const newCheckin = p.checkedIn ? 0 : 1
    db.prepare("UPDATE passengers SET checkedIn = ? WHERE id = ?").run(newCheckin, p.id)
    return getBookingFull(db, bookingId)
  })
  return executeTx()
}

function batchCheckin(db, bookingId, checkedIn = true) {
  const val = checkedIn ? 1 : 0
  db.prepare("UPDATE passengers SET checkedIn = ? WHERE bookingId = ?").run(val, bookingId)
  return getBookingFull(db, bookingId)
}

function swapSeat(db, bookingId, passengerIdentifier, newSeatId) {
  return updatePassenger(db, bookingId, passengerIdentifier, { seatId: newSeatId })
}

function togglePayment(db, bookingId) {
  const executeTx = db.transaction(() => {
    const existing = getBookingFull(db, bookingId)
    if (!existing) throw new Error(`Booking ${bookingId} not found`)

    const newIsPaid = existing.isPaid ? 0 : 1
    const newAdvance = newIsPaid ? existing.totalAmount : existing.advanceReceived
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE bookings
      SET isPaid = ?, advanceReceived = ?, updatedAt = ?
      WHERE id = ?
    `).run(newIsPaid, newAdvance, now, bookingId)

    return getBookingFull(db, bookingId)
  })
  return executeTx()
}

module.exports = {
  listBookings,
  getBooking,
  createBooking,
  updateBooking,
  deleteBooking,
  restoreBooking,
  cancelBooking,
  updatePassenger,
  togglePassengerCheckin,
  batchCheckin,
  swapSeat,
  togglePayment,
  syncActiveSeats,
}
