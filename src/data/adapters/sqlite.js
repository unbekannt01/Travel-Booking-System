// SQLite Desktop Adapter
// Interacts with Electron's main process via window.electron preload bridge.

function getElectron() {
  if (typeof window !== "undefined" && window.electron) {
    return window.electron
  }
  return null
}

async function invokeIpc(channel, ...args) {
  const electron = getElectron()
  if (!electron) {
    throw new Error(`Desktop SQLite adapter called outside Electron runtime (channel: ${channel})`)
  }
  if (typeof electron.invoke === "function") {
    return electron.invoke(channel, ...args)
  }
  throw new Error("Electron contextBridge does not expose .invoke")
}

// --- BOOKINGS ---
export async function listBookings() {
  return invokeIpc("bookings:list")
}

export async function getBooking(id) {
  return invokeIpc("bookings:get", id)
}

export async function createBooking(bookingData) {
  return invokeIpc("bookings:create", bookingData)
}

export async function updateBooking(id, bookingData) {
  return invokeIpc("bookings:update", id, bookingData)
}

export async function deleteBooking(id) {
  return invokeIpc("bookings:delete", id)
}

export async function restoreBooking(id) {
  return invokeIpc("bookings:restore", id)
}

export async function updatePassenger(bookingId, passengerIndex, passengerData) {
  return invokeIpc("bookings:updatePassenger", bookingId, passengerIndex, passengerData)
}

export async function togglePassengerCheckin(bookingId, passengerIndex) {
  return invokeIpc("bookings:toggleCheckin", bookingId, passengerIndex)
}

export async function togglePayment(bookingId) {
  return invokeIpc("bookings:togglePayment", bookingId)
}

export async function cancelBooking(id, options = {}) {
  const payload = typeof options === "string" ? { reason: options } : options
  return invokeIpc("bookings:cancel", id, payload)
}

export async function batchCheckin(bookingId, checkedIn = true) {
  return invokeIpc("bookings:batchCheckin", bookingId, checkedIn)
}

export async function swapSeat(bookingId, passengerIdentifier, newSeatId) {
  return invokeIpc("bookings:swapSeat", bookingId, passengerIdentifier, newSeatId)
}

// --- TOURS ---
export async function listTours() {
  return invokeIpc("tours:list")
}

export async function createTour(tourData) {
  return invokeIpc("tours:create", tourData)
}

export async function updateTour(id, tourData) {
  return invokeIpc("tours:update", id, tourData)
}

export async function deleteTour(id) {
  return invokeIpc("tours:delete", id)
}

// --- PAYMENTS ---
export async function listPayments(bookingId) {
  return invokeIpc("payments:list", bookingId)
}

export async function recordPayment(paymentData) {
  return invokeIpc("payments:record", paymentData)
}

export async function voidPayment(paymentId, reason = "Voided by operator") {
  return invokeIpc("payments:void", paymentId, reason)
}

// --- SETTINGS ---
export async function getCompanySettings(user) {
  return invokeIpc("settings:get", user)
}

export async function updateCompanySettings(settings) {
  const updatedSettings = await invokeIpc("settings:update", settings)
  const session = await invokeIpc("auth:getOperatorSession")
  return {
    ...updatedSettings,
    user: session.user,
  }
}

// --- AUTH (Desktop single-user operator) ---
export async function login() {
  return invokeIpc("auth:getOperatorSession")
}

export async function register() {
  return invokeIpc("auth:getOperatorSession")
}

export async function logout() {
  return { success: true }
}

export async function updateProfile(userName) {
  return invokeIpc("auth:updateProfile", userName)
}

export async function updateCompany(companySettings) {
  return updateCompanySettings(companySettings)
}

export async function setup2FA() {
  throw new Error("2FA is not required in single-user desktop mode.")
}

export async function verify2FASetup() {
  throw new Error("2FA is not required in single-user desktop mode.")
}

export async function verify2FALogin() {
  return invokeIpc("auth:getOperatorSession")
}

export async function disable2FA() {
  return { success: true }
}

export async function forgotPassword() {
  throw new Error("Password recovery is not applicable in offline desktop mode.")
}

export async function validateResetToken() {
  return { valid: true }
}

export async function resetPassword() {
  return { success: true }
}

export async function request2FARecovery() {
  throw new Error("2FA is not required in single-user desktop mode.")
}

export async function validate2FAToken() {
  return { valid: true }
}

export async function finalize2FARecovery() {
  return { success: true }
}

export function getAuthToken() {
  return "desktop-offline-operator-token"
}

export function setAuthToken() {}
export function removeAuthToken() {}

// --- BACKUP & RESTORE ---
export async function getBackupStats() {
  return invokeIpc("backup:getStats")
}

export async function exportDatabaseBackup() {
  return invokeIpc("backup:export")
}

export async function restoreDatabaseBackup() {
  return invokeIpc("backup:restore")
}

