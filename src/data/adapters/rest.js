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

// --- BACKUP & RESTORE (Web mode fallback) ---
export async function getBackupStats() {
  return { backupCount: 0, lastBackupTime: null, isWeb: true }
}

export async function exportDatabaseBackup() {
  throw new Error("Database backup is managed via MongoDB tools (mongodump). Direct database export is not supported from the browser.")
}

export async function restoreDatabaseBackup() {
  throw new Error("Database restore is managed via MongoDB tools (mongorestore). Direct database restore is not supported from the browser.")
}

// --- DOCUMENTS (Part 3.7a) ---
function normalizeDocument(d) {
  if (!d) return d
  return {
    ...d,
    id: d._id || d.id,
  }
}

export async function listDocuments(bookingId) {
  const query = bookingId ? `?bookingId=${encodeURIComponent(bookingId)}` : ""
  const res = await request(`/api/documents${query}`)
  return (res?.documents || []).map(normalizeDocument)
}

export async function getDocument(id) {
  const res = await request(`/api/documents/${id}`)
  return normalizeDocument(res?.document)
}

export async function issueDocument(payload) {
  const res = await request("/api/documents", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return {
    ...res,
    document: normalizeDocument(res?.document),
  }
}

export async function voidDocument(id, reason) {
  const res = await request(`/api/documents/${id}/void`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
  return {
    ...res,
    document: normalizeDocument(res?.document),
  }
}

export async function getDocumentSettings() {
  const res = await request("/api/documents/settings/all")
  return res?.settings || {}
}

export async function updateDocumentSettings(settings) {
  const res = await request("/api/documents/settings/all", {
    method: "PUT",
    body: JSON.stringify(settings),
  })
  return res?.settings || {}
}

export async function listTemplates() {
  const res = await request("/api/document-templates")
  return res?.templates || []
}

export async function getTemplate(id) {
  const res = await request(`/api/document-templates/${id}`)
  return res?.template || null
}

export async function createTemplate(payload) {
  const res = await request("/api/document-templates", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return res?.template
}

export async function updateTemplate(id, payload) {
  const res = await request(`/api/document-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
  return res?.template
}

export async function deleteTemplate(id) {
  return await request(`/api/document-templates/${id}`, {
    method: "DELETE",
  })
}

export async function duplicateTemplate(id) {
  const res = await request(`/api/document-templates/${id}/duplicate`, {
    method: "POST",
  })
  return res?.template
}

export async function uploadTemplateAsset(file, type = "logo") {
  const res = await request("/api/document-templates/assets", {
    method: "POST",
    body: JSON.stringify({ file, type }),
  })
  return res
}

export async function setDefaultTemplateForType(type, templateId) {
  const res = await request(`/api/document-templates/default/${type}`, {
    method: "PUT",
    body: JSON.stringify({ templateId }),
  })
  return res
}

function normalizeExpense(e) {
  if (!e) return e
  return {
    ...e,
    id: e._id || e.id,
  }
}

// --- EXPENSES ---
export async function listExpenses(params = {}) {
  const query = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      query.set(key, String(val))
    }
  }
  const qs = query.toString() ? `?${query.toString()}` : ""
  const res = await request(`/api/expenses${qs}`)
  return {
    expenses: (res?.expenses || []).map(normalizeExpense),
    total: res?.total || 0,
    page: res?.page || 1,
    limit: res?.limit || 50,
    totalPages: res?.totalPages || 1,
  }
}

export async function getExpenseSummary(params = {}) {
  const query = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      query.set(key, String(val))
    }
  }
  const qs = query.toString() ? `?${query.toString()}` : ""
  const res = await request(`/api/expenses/summary${qs}`)
  return res || {
    count: 0,
    totalExpenses: 0,
    paidTotal: 0,
    pendingTotal: 0,
    byCategory: [],
    byMonth: [],
    topCategory: null,
  }
}

export async function getExpense(id) {
  const res = await request(`/api/expenses/${id}`)
  return normalizeExpense(res)
}

export async function createExpense(data) {
  const res = await request("/api/expenses", {
    method: "POST",
    body: JSON.stringify(data),
  })
  return {
    ...res,
    expense: normalizeExpense(res?.expense),
  }
}

export async function updateExpense(id, data) {
  const res = await request(`/api/expenses/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
  return {
    ...res,
    expense: normalizeExpense(res?.expense),
  }
}

export async function deleteExpense(id) {
  return request(`/api/expenses/${id}`, {
    method: "DELETE",
  })
}

export async function getTourPnl(params = {}, options = {}) {
  const query = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      query.set(key, String(val))
    }
  }
  const qs = query.toString() ? `?${query.toString()}` : ""
  const res = await request(`/api/reports/tour-pnl${qs}`, options)
  return res || {
    success: false,
    summary: {},
    tours: [],
    departures: [],
    generalExpenses: [],
  }
}

export async function getOutstandingReport(params = {}, options = {}) {
  const query = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      query.set(key, String(val))
    }
  }
  const qs = query.toString() ? `?${query.toString()}` : ""
  const res = await request(`/api/reports/outstanding${qs}`, options)
  return res || {
    success: false,
    meta: {},
    summary: {},
    customers: [],
    rows: [],
  }
}

// --- CUSTOMERS ---
function normalizeCustomer(c) {
  if (!c) return null
  return {
    ...c,
    id: c._id || c.id,
  }
}

export async function listCustomers(params = {}, options = {}) {
  const query = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      query.set(key, String(val))
    }
  }
  const qs = query.toString() ? `?${query.toString()}` : ""
  const res = await request(`/api/customers${qs}`, options)
  return {
    customers: (res?.customers || []).map(normalizeCustomer),
    pagination: res?.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 },
    counts: res?.counts || { total: 0, repeat: 0, withOutstanding: 0, unlinkedBookingsCount: 0 },
  }
}

export async function lookupCustomerByPhone(phone, options = {}) {
  if (!phone) return { found: false, customer: null }
  const res = await request(`/api/customers/lookup?phone=${encodeURIComponent(phone)}`, options)
  return res || { found: false, customer: null }
}

export async function getCustomer(id, options = {}) {
  const res = await request(`/api/customers/${id}`, options)
  return {
    ...res,
    customer: normalizeCustomer(res?.customer),
  }
}

export async function getCustomerStatement(id, params = {}, options = {}) {
  const query = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      query.set(key, String(val))
    }
  }
  const qs = query.toString() ? `?${query.toString()}` : ""
  const res = await request(`/api/customers/${id}/statement${qs}`, options)
  return {
    ...res,
    customer: normalizeCustomer(res?.customer),
  }
}

export async function createCustomer(data) {
  const res = await request("/api/customers", {
    method: "POST",
    body: JSON.stringify(data),
  })
  return normalizeCustomer(res?.customer || res)
}

export async function updateCustomer(id, data) {
  const res = await request(`/api/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
  return normalizeCustomer(res?.customer || res)
}

export async function deleteCustomer(id) {
  return request(`/api/customers/${id}`, {
    method: "DELETE",
  })
}

// --- REMINDERS & TEMPLATES ---
export async function listReminderTemplates() {
  const res = await request("/api/reminder-templates")
  return res?.templates || {}
}

export async function saveReminderTemplate(language, tone, body) {
  const res = await request(`/api/reminder-templates/${language}/${tone}`, {
    method: "PUT",
    body: JSON.stringify({ body }),
  })
  return res?.template
}

export async function resetReminderTemplate(language, tone) {
  const res = await request(`/api/reminder-templates/${language}/${tone}`, {
    method: "DELETE",
  })
  return res?.template
}

export async function listReminders(params = {}) {
  const query = new URLSearchParams()
  if (params.customerId) query.set("customerId", params.customerId)
  if (params.limit) query.set("limit", String(params.limit))
  const qs = query.toString() ? `?${query.toString()}` : ""
  const res = await request(`/api/reminders${qs}`)
  return res?.reminders || []
}

export async function createReminderLog(data) {
  return request("/api/reminders", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function markReminderSent(id) {
  return request(`/api/reminders/${id}/sent`, {
    method: "POST",
  })
}

// --- CASH BOOK & BOOKS CLOSE (Part 6a) ---
export async function getCashBook(params = {}) {
  const query = new URLSearchParams()
  if (params.startDate) query.set("startDate", params.startDate)
  if (params.endDate) query.set("endDate", params.endDate)
  if (params.account) query.set("account", params.account)
  const qs = query.toString() ? `?${query.toString()}` : ""
  return request(`/api/cashbook${qs}`)
}

export async function getCashBookSetup() {
  return request("/api/cashbook/setup")
}

export async function saveCashBookSetup(data) {
  return request("/api/cashbook/setup", {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function createCashEntry(data) {
  return request("/api/cashbook/entries", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateCashEntry(id, data) {
  return request(`/api/cashbook/entries/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteCashEntry(id) {
  return request(`/api/cashbook/entries/${id}`, {
    method: "DELETE",
  })
}

export async function getClosePreview(params = {}) {
  const query = new URLSearchParams()
  if (params.asOfDate) query.set("asOfDate", params.asOfDate)
  if (params.countedCash !== undefined) query.set("countedCash", String(params.countedCash))
  const qs = query.toString() ? `?${query.toString()}` : ""
  return request(`/api/cashbook/close/preview${qs}`)
}

export async function closeDay(data) {
  return request("/api/cashbook/close", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function reopenDay(data) {
  return request("/api/cashbook/reopen", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getTrash(params = {}) {
  const query = new URLSearchParams()
  if (params.type) query.set("type", params.type)
  if (params.q) query.set("q", params.q)
  if (params.page) query.set("page", String(params.page))
  if (params.limit) query.set("limit", String(params.limit))
  const qs = query.toString() ? `?${query.toString()}` : ""
  return request(`/api/trash${qs}`)
}

export async function restoreTrashItem(type, id) {
  return request(`/api/trash/${encodeURIComponent(type)}/${encodeURIComponent(id)}/restore`, {
    method: "POST",
  })
}

export async function getRecordHistory(params = {}) {
  const query = new URLSearchParams()
  if (params.entityType) query.set("entityType", params.entityType)
  if (params.entityId) query.set("entityId", String(params.entityId))
  if (params.limit) query.set("limit", String(params.limit))
  const qs = query.toString() ? `?${query.toString()}` : ""
  return request(`/api/history${qs}`)
}




