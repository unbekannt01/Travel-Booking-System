import { request } from "./client"

export async function recordPayment(paymentData) {
  const { bookingId, paymentAmount, paymentMode = "Cash", paymentNotes = "" } = paymentData
  const numPayment = Number(paymentAmount)
  if (isNaN(numPayment) || numPayment <= 0) {
    throw new Error("Please enter a valid payment amount greater than zero.")
  }

  const data = await request(`/api/bookings/${bookingId}/payments`, {
    method: "POST",
    body: JSON.stringify({
      amount: numPayment,
      mode: paymentMode,
      notes: paymentNotes,
    }),
  })

  return {
    ...data,
    id: data._id || data.id,
  }
}
