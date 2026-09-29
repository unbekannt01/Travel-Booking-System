const crypto = require("crypto")
const {
  buildReceiptPrefix,
  calculateNextReceiptNo,
  computeLedgerTotals,
  round2,
} = require("../../../shared/businessLogic.cjs")

function formatPayment(row, bookingRow = null) {
  if (!row) return null

  let bookingInfo = row.bookingId
  if (bookingRow) {
    bookingInfo = {
      id: bookingRow.id,
      _id: bookingRow.id,
      invoiceNo: bookingRow.invoiceNo,
      tourName: bookingRow.tourName,
      journeyDate: bookingRow.journeyDate,
      contactName: bookingRow.contactName,
      contactPhone: bookingRow.contactPhone,
    }
  }

  return {
    ...row,
    id: row.id,
    _id: row.id,
    bookingId: bookingInfo,
    isVoid: Boolean(row.isVoid),
  }
}

function listPayments(db, bookingId = null) {
  let query = `
    SELECT p.*, b.invoiceNo, b.tourName, b.journeyDate, b.contactName, b.contactPhone
    FROM payments p
    LEFT JOIN bookings b ON p.bookingId = b.id
  `
  let params = []
  if (bookingId) {
    query += " WHERE p.bookingId = ?"
    params.push(bookingId)
  }
  query += " ORDER BY p.createdAt DESC"

  const rows = db.prepare(query).all(...params)
  return rows.map((r) =>
    formatPayment(r, {
      id: r.bookingId,
      invoiceNo: r.invoiceNo,
      tourName: r.tourName,
      journeyDate: r.journeyDate,
      contactName: r.contactName,
      contactPhone: r.contactPhone,
    })
  )
}

function syncBookingPayments(db, bookingId) {
  const payments = db.prepare("SELECT * FROM payments WHERE bookingId = ? AND isVoid = 0").all(bookingId)
  const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId)
  if (!booking) return null

  const { advanceReceived, isPaid } = computeLedgerTotals(payments, booking.totalAmount)
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE bookings
    SET advanceReceived = ?, isPaid = ?, updatedAt = ?
    WHERE id = ?
  `).run(advanceReceived, isPaid ? 1 : 0, now, bookingId)

  const updatedBooking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId)
  return updatedBooking
}

function recordPayment(db, paymentData) {
  const executeTx = db.transaction(() => {
    const bookingId = paymentData.bookingId
    const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId)
    if (!booking) throw new Error("Booking not found")

    const amount = round2(paymentData.paymentAmount || paymentData.amount || 0)
    if (isNaN(amount) || amount <= 0) {
      throw new Error("Payment amount must be greater than zero.")
    }

    const type = paymentData.type || "partial"
    const mode = paymentData.paymentMode || paymentData.mode || "Cash"
    const notes = paymentData.paymentNotes || paymentData.notes || ""
    const referenceNo = paymentData.referenceNo || ""

    if (type !== "refund") {
      const remaining = round2(booking.totalAmount - (booking.advanceReceived || 0))
      if (amount > remaining) {
        throw new Error(`Payment amount ₹${amount} exceeds remaining balance of ₹${remaining}.`)
      }
    }

    // Generate receipt number
    const recPrefixRow = db.prepare("SELECT value FROM settings WHERE key = 'receiptPrefix'").get()
    const recPrefix = (recPrefixRow && recPrefixRow.value) || "REC"
    const prefix = buildReceiptPrefix(recPrefix, new Date())

    const existingReceipts = db.prepare(`
      SELECT receiptNo FROM payments WHERE receiptNo LIKE ?
    `).all(`${prefix}%`).map((r) => r.receiptNo)

    const receiptNo = calculateNextReceiptNo(existingReceipts, prefix)
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO payments (
        id, bookingId, receiptNo, amount, type, paymentMode, paymentDate,
        referenceNo, notes, recordedBy, isVoid, voidReason, voidedAt, voidedBy, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, ?)
    `).run(id, bookingId, receiptNo, amount, type, mode, now, referenceNo, notes, "Operator", now)

    const updatedBooking = syncBookingPayments(db, bookingId)
    const newPayment = db.prepare("SELECT * FROM payments WHERE id = ?").get(id)

    return {
      ...newPayment,
      id: newPayment.id,
      _id: newPayment.id,
      booking: updatedBooking,
    }
  })

  return executeTx()
}

function voidPayment(db, paymentId, reason = "Voided by operator") {
  const executeTx = db.transaction(() => {
    const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId)
    if (!payment) throw new Error("Payment record not found")
    if (payment.isVoid) throw new Error("This payment has already been voided")

    const now = new Date().toISOString()
    db.prepare(`
      UPDATE payments
      SET isVoid = 1, voidReason = ?, voidedAt = ?, voidedBy = 'Operator'
      WHERE id = ?
    `).run(reason, now, paymentId)

    const updatedBooking = syncBookingPayments(db, payment.bookingId)
    const updatedPayment = db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId)

    return {
      payment: formatPayment(updatedPayment),
      booking: updatedBooking,
      message: "Payment voided successfully.",
    }
  })

  return executeTx()
}

module.exports = {
  listPayments,
  recordPayment,
  voidPayment,
  syncBookingPayments,
}
