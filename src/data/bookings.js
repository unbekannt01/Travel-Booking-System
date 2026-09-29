import { request } from "./client"

function normalizeBooking(b) {
  if (!b) return b
  return {
    ...b,
    id: b._id || b.id,
  }
}

export async function listBookings() {
  const data = await request("/api/bookings")
  return (data || []).map(normalizeBooking)
}

export async function getBooking(id) {
  const data = await request(`/api/bookings/${id}`)
  return normalizeBooking(data)
}

export async function createBooking(bookingData) {
  const data = await request("/api/bookings", {
    method: "POST",
    body: JSON.stringify(bookingData),
  })
  return normalizeBooking(data)
}

export async function updateBooking(id, bookingData) {
  const data = await request(`/api/bookings/${id}`, {
    method: "PUT",
    body: JSON.stringify(bookingData),
  })
  return normalizeBooking(data)
}

export async function deleteBooking(id) {
  return request(`/api/bookings/${id}`, {
    method: "DELETE",
  })
}

export async function restoreBooking(id) {
  const data = await request(`/api/bookings/${id}/restore`, {
    method: "PUT",
  })
  return normalizeBooking(data)
}

export async function updatePassenger(bookingId, passengerIndex, passengerData) {
  const data = await request(`/api/bookings/${bookingId}/passengers/${passengerIndex}`, {
    method: "PUT",
    body: JSON.stringify(passengerData),
  })
  return normalizeBooking(data)
}

export async function togglePassengerCheckin(bookingId, passengerIndex) {
  const data = await request(`/api/bookings/${bookingId}/passengers/${passengerIndex}/checkin`, {
    method: "PUT",
  })
  return normalizeBooking(data)
}

export async function togglePayment(bookingId) {
  const data = await request(`/api/bookings/${bookingId}/toggle-payment`, {
    method: "PUT",
  })
  return normalizeBooking(data)
}

export async function cancelBooking(id, options = {}) {
  const payload = typeof options === "string" ? { reason: options } : options
  const data = await request(`/api/bookings/${id}/cancel`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
  return normalizeBooking(data)
}

export async function batchCheckin(bookingId, checkedIn = true) {
  const data = await request(`/api/bookings/${bookingId}/passengers/batch-checkin`, {
    method: "PUT",
    body: JSON.stringify({ checkedIn }),
  })
  return normalizeBooking(data)
}

export async function swapSeat(bookingId, passengerIdentifier, newSeatId) {
  const data = await request(`/api/bookings/${bookingId}/passengers/${passengerIdentifier}`, {
    method: "PUT",
    body: JSON.stringify({ seatId: newSeatId }),
  })
  return normalizeBooking(data)
}

