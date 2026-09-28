import test from "node:test"
import assert from "node:assert/strict"

/**
 * Pure simulation of the cancellation ledger calculations in backend/routes/bookings.js
 */
function processCancellation({
  booking,
  cancellationCharge,
  refundPaymentMode = "Cash",
  reason = "Cancelled by operator",
}) {
  const totalPaid = Math.round((booking.advanceReceived || 0) * 100) / 100
  let fee = 0

  if (cancellationCharge !== undefined && cancellationCharge !== null && cancellationCharge !== "") {
    fee = Math.round(Number(cancellationCharge) * 100) / 100
    if (isNaN(fee) || fee < 0) {
      throw new Error("Cancellation charge cannot be negative.")
    }
    if (fee > totalPaid) {
      throw new Error(`Cancellation charge ₹${fee} cannot exceed total amount collected ₹${totalPaid}.`)
    }
  }

  const refundAmount = Math.max(0, Math.round((totalPaid - fee) * 100) / 100)

  const updatedBooking = {
    ...booking,
    status: "Cancelled",
    cancellationReason: reason,
    cancelledAt: new Date(),
    cancellationCharge: fee,
    refundAmount,
    refundPaymentMode,
    advanceReceived: fee, // Operator keeps the retained fee
    isPaid: false,
    payments: [
      ...(booking.payments || []),
      ...(refundAmount > 0
        ? [
            {
              amount: -refundAmount,
              date: new Date(),
              mode: refundPaymentMode,
              notes: `Refund upon cancellation (Fee: ₹${fee})`,
            },
          ]
        : []),
    ],
  }

  return {
    updatedBooking,
    fee,
    refundAmount,
  }
}

test("Cancellation - full refund when fee is 0", () => {
  const booking = {
    _id: "b1",
    totalAmount: 10000,
    advanceReceived: 3000,
    payments: [{ amount: 3000, mode: "UPI" }],
    passengers: [{ name: "Rajesh", seatId: "lower-L1" }],
  }

  const result = processCancellation({ booking, cancellationCharge: 0 })
  assert.equal(result.fee, 0)
  assert.equal(result.refundAmount, 3000)
  assert.equal(result.updatedBooking.advanceReceived, 0)
  assert.equal(result.updatedBooking.status, "Cancelled")
  assert.equal(result.updatedBooking.payments.length, 2)
  assert.equal(result.updatedBooking.payments[1].amount, -3000)
})

test("Cancellation - partial retention with fee", () => {
  const booking = {
    _id: "b2",
    totalAmount: 10000,
    advanceReceived: 4000,
    payments: [{ amount: 4000, mode: "Cash" }],
    passengers: [{ name: "Pooja", seatId: "lower-L2" }],
  }

  const result = processCancellation({ booking, cancellationCharge: 1000 })
  assert.equal(result.fee, 1000)
  assert.equal(result.refundAmount, 3000)
  assert.equal(result.updatedBooking.advanceReceived, 1000)
  assert.equal(result.updatedBooking.cancellationCharge, 1000)
  assert.equal(result.updatedBooking.refundAmount, 3000)
})

test("Cancellation - full retention (non-refundable advance)", () => {
  const booking = {
    _id: "b3",
    totalAmount: 10000,
    advanceReceived: 2000,
    payments: [{ amount: 2000, mode: "Cash" }],
    passengers: [{ name: "Amit", seatId: "upper-R1" }],
  }

  const result = processCancellation({ booking, cancellationCharge: 2000 })
  assert.equal(result.fee, 2000)
  assert.equal(result.refundAmount, 0)
  assert.equal(result.updatedBooking.advanceReceived, 2000)
  assert.equal(result.updatedBooking.payments.length, 1) // No refund row created
})

test("Cancellation - rejects fee exceeding collected amount", () => {
  const booking = {
    _id: "b4",
    totalAmount: 10000,
    advanceReceived: 2000,
  }

  assert.throws(
    () => processCancellation({ booking, cancellationCharge: 3000 }),
    /cannot exceed total amount collected/
  )
})

test("Cancellation - rejects negative fee", () => {
  const booking = {
    _id: "b5",
    totalAmount: 10000,
    advanceReceived: 2000,
  }

  assert.throws(
    () => processCancellation({ booking, cancellationCharge: -500 }),
    /cannot be negative/
  )
})
