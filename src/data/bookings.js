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
