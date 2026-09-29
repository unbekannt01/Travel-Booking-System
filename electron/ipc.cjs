const { ipcMain } = require("electron")
const tourQueries = require("./db/queries/tours.cjs")
const bookingQueries = require("./db/queries/bookings.cjs")
const paymentQueries = require("./db/queries/payments.cjs")
const settingsQueries = require("./db/queries/settings.cjs")
const authQueries = require("./db/queries/auth.cjs")
const { getDbPath } = require("./db/database.cjs")

function registerIpcHandlers(db, app) {
  // BOOKINGS
  ipcMain.handle("bookings:list", async () => {
    return bookingQueries.listBookings(db)
  })

  ipcMain.handle("bookings:get", async (_event, id) => {
    return bookingQueries.getBooking(db, id)
  })

  ipcMain.handle("bookings:create", async (_event, data) => {
    return bookingQueries.createBooking(db, data)
  })

  ipcMain.handle("bookings:update", async (_event, id, data) => {
    return bookingQueries.updateBooking(db, id, data)
  })

  ipcMain.handle("bookings:delete", async (_event, id) => {
    return bookingQueries.deleteBooking(db, id)
  })

  ipcMain.handle("bookings:restore", async (_event, id) => {
    return bookingQueries.restoreBooking(db, id)
  })

  ipcMain.handle("bookings:updatePassenger", async (_event, bookingId, passengerIndex, data) => {
    return bookingQueries.updatePassenger(db, bookingId, passengerIndex, data)
  })

  ipcMain.handle("bookings:toggleCheckin", async (_event, bookingId, passengerIndex) => {
    return bookingQueries.togglePassengerCheckin(db, bookingId, passengerIndex)
  })

  ipcMain.handle("bookings:batchCheckin", async (_event, bookingId, checkedIn) => {
    return bookingQueries.batchCheckin(db, bookingId, checkedIn)
  })

  ipcMain.handle("bookings:swapSeat", async (_event, bookingId, passengerId, newSeatId) => {
    return bookingQueries.swapSeat(db, bookingId, passengerId, newSeatId)
  })

  ipcMain.handle("bookings:togglePayment", async (_event, bookingId) => {
    return bookingQueries.togglePayment(db, bookingId)
  })

  ipcMain.handle("bookings:cancel", async (_event, id, options) => {
    return bookingQueries.cancelBooking(db, id, options)
  })

  // TOURS
  ipcMain.handle("tours:list", async () => {
    return tourQueries.listTours(db)
  })

  ipcMain.handle("tours:get", async (_event, id) => {
    return tourQueries.getTour(db, id)
  })

  ipcMain.handle("tours:create", async (_event, data) => {
    return tourQueries.createTour(db, data)
  })

  ipcMain.handle("tours:update", async (_event, id, data) => {
    return tourQueries.updateTour(db, id, data)
  })

  ipcMain.handle("tours:delete", async (_event, id) => {
    return tourQueries.deleteTour(db, id)
  })

  // PAYMENTS
  ipcMain.handle("payments:list", async (_event, bookingId) => {
    return paymentQueries.listPayments(db, bookingId)
  })

  ipcMain.handle("payments:record", async (_event, data) => {
    return paymentQueries.recordPayment(db, data)
  })

  ipcMain.handle("payments:void", async (_event, id, reason) => {
    return paymentQueries.voidPayment(db, id, reason)
  })

  // SETTINGS
  ipcMain.handle("settings:get", async () => {
    return settingsQueries.getAllSettings(db)
  })

  ipcMain.handle("settings:update", async (_event, data) => {
    return settingsQueries.updateSettings(db, data)
  })

  // AUTH (Local Single Operator)
  ipcMain.handle("auth:getOperatorSession", async () => {
    return authQueries.getOperatorSession(db)
  })

  ipcMain.handle("auth:updateProfile", async (_event, userName) => {
    return authQueries.updateProfile(db, userName)
  })

  // APP INFO
  ipcMain.handle("app:getInfo", async () => {
    return {
      name: "YatraHub",
      version: app ? app.getVersion() : "1.0.0",
      isPackaged: app ? app.isPackaged : false,
      dbPath: getDbPath(),
    }
  })

  // BACKUP & RESTORE
  const {
    getBackupStats,
    exportDatabaseBackup,
    restoreDatabaseBackup,
    performAutoDailyBackup,
  } = require("./backup.cjs")

  ipcMain.handle("backup:getStats", async () => {
    return getBackupStats()
  })

  ipcMain.handle("backup:export", async (event) => {
    const { BrowserWindow } = require("electron")
    const win = BrowserWindow.fromWebContents(event.sender)
    return exportDatabaseBackup(db, win)
  })

  ipcMain.handle("backup:restore", async (event) => {
    const { BrowserWindow } = require("electron")
    const win = BrowserWindow.fromWebContents(event.sender)
    return restoreDatabaseBackup(
      () => db,
      (newDb) => {
        db = newDb
      },
      win
    )
  })

  ipcMain.handle("backup:runNow", async () => {
    return performAutoDailyBackup(db)
  })
}

module.exports = {
  registerIpcHandlers,
}

