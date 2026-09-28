import { getBooking, updateBooking } from "./bookings"

export async function recordPayment(paymentData) {
  const { bookingId, paymentAmount } = paymentData
  const booking = await getBooking(bookingId)
  if (!booking) {
    throw new Error("Booking not found")
  }
  const updatedBooking = {
    ...booking,
    advanceReceived: Number(booking.advanceReceived || 0) + Number(paymentAmount),
  }
  return updateBooking(bookingId, updatedBooking)
}
