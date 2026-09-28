import { getBooking, updateBooking } from "./bookings"

export async function recordPayment(paymentData) {
  const { bookingId, paymentAmount } = paymentData
  const booking = await getBooking(bookingId)
  if (!booking) {
    throw new Error("Booking not found")
  }

  const numPayment = Number(paymentAmount)
  if (isNaN(numPayment) || numPayment <= 0) {
    throw new Error("Please enter a valid payment amount greater than zero.")
  }

  const remainingBalance = booking.totalAmount - (booking.advanceReceived || 0)
  if (numPayment > remainingBalance) {
    throw new Error(`Payment cannot exceed remaining balance of ₹${remainingBalance.toLocaleString("en-IN")}.`)
  }

  const newAdvance = Number(booking.advanceReceived || 0) + numPayment
  const updatedBooking = {
    ...booking,
    advanceReceived: newAdvance,
    isPaid: newAdvance >= booking.totalAmount,
  }

  return updateBooking(bookingId, updatedBooking)
}
