import { request, setAuthToken, removeAuthToken, getAuthToken } from "../client"

// Normalizers
function normalizeBooking(b) {
  if (!b) return b
  return {
    ...b,
    id: b._id || b.id,
  }
}

function normalizeTour(t) {
  if (!t) return t
  return {
    ...t,
    id: t._id || t.id,
  }
}

// --- BOOKINGS ---
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

// --- TOURS ---
export async function listTours() {
  const data = await request("/api/tours")
  return (data || []).map(normalizeTour)
}

export async function createTour(tourData) {
  const data = await request("/api/tours", {
    method: "POST",
    body: JSON.stringify(tourData),
  })
  return normalizeTour(data)
}

export async function updateTour(id, tourData) {
  const data = await request(`/api/tours/${id}`, {
    method: "PUT",
    body: JSON.stringify(tourData),
  })
  return normalizeTour(data)
}

export async function deleteTour(id) {
  return request(`/api/tours/${id}`, {
    method: "DELETE",
  })
}

// --- PAYMENTS ---
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

// --- SETTINGS ---
export async function getCompanySettings(user) {
  return {
    companyName: user?.companyName || "XYZ Tourism",
    companyTagline: user?.companyTagline || "Tourism & Travels",
    companyHeadquarters: user?.companyHeadquarters || "City, State, 123456",
    companyPhone: user?.companyPhone || "+91 98765 43210",
    companyLogo: user?.companyLogo || "",
    organizers: user?.organizers || [],
  }
}

export async function updateCompanySettings(settings) {
  return updateCompany(settings)
}

// --- AUTH ---
export async function login(loginIdentifier, password) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ loginIdentifier, password }),
  })
  if (data.token) {
    setAuthToken(data.token)
    if (data.tokenId) localStorage.setItem("tokenId", data.tokenId)
    if (data.user) localStorage.setItem("user", JSON.stringify(data.user))
  }
  return data
}

export async function register(userName, email, password) {
  const data = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ userName, email, password }),
  })
  if (data.token) {
    setAuthToken(data.token)
    if (data.tokenId) localStorage.setItem("tokenId", data.tokenId)
    if (data.user) localStorage.setItem("user", JSON.stringify(data.user))
  }
  return data
}

export async function logout() {
  try {
    await request("/api/auth/logout", {
      method: "POST",
    })
  } catch {
    // Continue local cleanup even if network request fails
  } finally {
    removeAuthToken()
    localStorage.removeItem("user")
  }
}

export async function updateProfile(userName) {
  const data = await request("/api/auth/update-profile", {
    method: "PUT",
    body: JSON.stringify({ userName }),
  })
  if (data.user) {
    localStorage.setItem("user", JSON.stringify(data.user))
  }
  return data
}

export async function updateCompany(companySettings) {
  const data = await request("/api/auth/update-company", {
    method: "PUT",
    body: JSON.stringify(companySettings),
  })
  if (data.user) {
    localStorage.setItem("user", JSON.stringify(data.user))
  }
  return data
}

export async function setup2FA(tokenOverride) {
  const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : {}
  return request("/api/auth/setup-2fa", {
    method: "POST",
    headers,
  })
}

export async function verify2FASetup(code, tokenOverride) {
  const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : {}
  return request("/api/auth/verify-2fa-setup", {
    method: "POST",
    headers,
    body: JSON.stringify({ code }),
  })
}

export async function verify2FALogin(tempToken, code) {
  const data = await request("/api/auth/verify-2fa-login", {
    method: "POST",
    body: JSON.stringify({ tempToken, code }),
  })
  if (data.token) {
    setAuthToken(data.token)
    if (data.tokenId) localStorage.setItem("tokenId", data.tokenId)
    if (data.user) localStorage.setItem("user", JSON.stringify(data.user))
  }
  return data
}

export async function disable2FA(code) {
  return request("/api/auth/disable-2fa", {
    method: "POST",
    body: JSON.stringify({ code }),
  })
}

export async function forgotPassword(email) {
  return request("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function validateResetToken(token) {
  return request(`/api/auth/validate-reset-token/${token}`)
}

export async function resetPassword(token, newPassword) {
  return request("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  })
}

export async function request2FARecovery(email) {
  return request("/api/auth/request-2fa-recovery", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function validate2FAToken(token) {
  return request(`/api/auth/validate-2fa-token/${token}`)
}

export async function finalize2FARecovery(token) {
  return request("/api/auth/finalize-2fa-recovery", {
    method: "POST",
    body: JSON.stringify({ token }),
  })
}

export { getAuthToken, setAuthToken, removeAuthToken }
