import test from "node:test"
import assert from "node:assert/strict"

/**
 * Pure helper function mirroring the payment logic in backend/routes/bookings.js
 */
function applyPayment(booking, { amount, mode = "Cash", notes = "" }) {
  const paymentAmount = Number(amount)
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    throw new Error("Payment amount must be greater than 0")
  }

  const remainingBalance = Math.max(0, (booking.totalAmount || 0) - (booking.advanceReceived || 0))
  if (paymentAmount > remainingBalance) {
    throw new Error(`Payment (₹${paymentAmount}) cannot exceed remaining balance (₹${remainingBalance})`)
  }

  const updatedPayments = [
    ...(booking.payments || []),
    {
      amount: paymentAmount,
      mode,
      notes,
      date: new Date(),
    },
  ]

  const newAdvance = (booking.advanceReceived || 0) + paymentAmount
  const isPaid = newAdvance >= booking.totalAmount

  return {
    ...booking,
    advanceReceived: newAdvance,
    isPaid,
    payments: updatedPayments,
  }
}

test("Payment calculation - Initial advance and balance calculation", () => {
  const booking = {
    totalAmount: 15000,
    advanceReceived: 5000,
    isPaid: false,
    payments: [
      { amount: 5000, mode: "UPI", notes: "Initial booking token" },
    ],
  }

  const balance = Math.max(0, booking.totalAmount - booking.advanceReceived)
  assert.equal(balance, 10000)
  assert.equal(booking.isPaid, false)
  assert.equal(booking.payments.length, 1)
})

test("Payment calculation - Partial payment updates ledger and decreases balance", () => {
  let booking = {
    totalAmount: 20000,
    advanceReceived: 5000,
    isPaid: false,
    payments: [
      { amount: 5000, mode: "Cash", notes: "Advance" },
    ],
  }

  // Installment 1: 5000
  booking = applyPayment(booking, { amount: 5000, mode: "UPI", notes: "2nd Installment" })
  assert.equal(booking.advanceReceived, 10000)
  assert.equal(booking.isPaid, false)
  assert.equal(booking.payments.length, 2)
  assert.equal(booking.totalAmount - booking.advanceReceived, 10000)

  // Installment 2: 10000 (completes balance)
  booking = applyPayment(booking, { amount: 10000, mode: "Bank Transfer", notes: "Final Settlement" })
  assert.equal(booking.advanceReceived, 20000)
  assert.equal(booking.isPaid, true)
  assert.equal(booking.payments.length, 3)
  assert.equal(booking.totalAmount - booking.advanceReceived, 0)
})

test("Payment calculation - Overpayment is rejected", () => {
  const booking = {
    totalAmount: 10000,
    advanceReceived: 8000,
    isPaid: false,
    payments: [{ amount: 8000, mode: "Cash" }],
  }

  // Attempting to pay 3000 when only 2000 is due
  assert.throws(
    () => applyPayment(booking, { amount: 3000 }),
    /cannot exceed remaining balance/
  )
})

test("Payment calculation - Invalid non-positive amounts rejected", () => {
  const booking = {
    totalAmount: 10000,
    advanceReceived: 5000,
    isPaid: false,
  }

  assert.throws(() => applyPayment(booking, { amount: 0 }), /must be greater than 0/)
  assert.throws(() => applyPayment(booking, { amount: -500 }), /must be greater than 0/)
  assert.throws(() => applyPayment(booking, { amount: "abc" }), /must be greater than 0/)
})
