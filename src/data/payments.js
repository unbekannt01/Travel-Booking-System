import { request } from "./client"

export async function listPayments(bookingId) {
  const url = bookingId ? `/api/payments?bookingId=${bookingId}` : "/api/payments"
  return request(url)
}

export async function recordPayment(paymentData) {
  const {
    bookingId,
    paymentAmount,
    paymentMode = "Cash",
    paymentNotes = "",
    type = "partial",
    referenceNo = "",
  } = paymentData

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
      type,
      referenceNo,
    }),
  })

  return {
    ...data,
    id: data._id || data.id,
  }
}

export async function voidPayment(paymentId, reason = "Voided by operator") {
  return request(`/api/payments/${paymentId}/void`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}
