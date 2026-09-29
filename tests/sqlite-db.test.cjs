const { test, describe } = require("node:test")
const assert = require("node:assert/strict")
const Database = require("better-sqlite3")
const { runMigrations } = require("../electron/db/migrate.cjs")
const tourQueries = require("../electron/db/queries/tours.cjs")
const bookingQueries = require("../electron/db/queries/bookings.cjs")
const paymentQueries = require("../electron/db/queries/payments.cjs")
const settingsQueries = require("../electron/db/queries/settings.cjs")
const authQueries = require("../electron/db/queries/auth.cjs")

describe("SQLite Offline Engine & Relational Schema", () => {
  let db

  test("runs PRAGMA user_version schema migrations", () => {
    db = new Database(":memory:")
    db.pragma("foreign_keys = ON")
    const version = runMigrations(db)
    assert.strictEqual(version, 1)

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((t) => t.name)
    assert.ok(tables.includes("tours"))
    assert.ok(tables.includes("bookings"))
    assert.ok(tables.includes("passengers"))
    assert.ok(tables.includes("payments"))
    assert.ok(tables.includes("settings"))
    assert.ok(tables.includes("active_seats"))
  })

  test("creates and lists tours", () => {
    const tour = tourQueries.createTour(db, {
      name: "Kedarnath Dham Yatra",
      destination: "Kedarnath",
      duration: "7 Days",
      busType: "2x1 Sleeper",
      totalSeats: 36,
      pricing: { baseFare: 12000, sleeperRate: 15000, gstRate: 5 },
    })

    assert.ok(tour.id)
    assert.strictEqual(tour.name, "Kedarnath Dham Yatra")
    assert.strictEqual(tour.pricing.baseFare, 12000)

    const list = tourQueries.listTours(db)
    assert.strictEqual(list.length, 1)
    assert.strictEqual(list[0].id, tour.id)
  })

  test("creates booking, locks active seats, and generates invoice number", () => {
    const booking = bookingQueries.createBooking(db, {
      tourName: "Kedarnath Dham Yatra",
      journeyDate: "2026-10-25T00:00:00.000Z",
      busType: "2x1 Sleeper",
      totalAmount: 24000,
      advanceReceived: 10000,
      contactName: "Ramesh Sharma",
      contactPhone: "9876543210",
      passengers: [
        { name: "Ramesh Sharma", age: 45, gender: "Male", seatId: "L1" },
        { name: "Suresh Sharma", age: 42, gender: "Male", seatId: "L2" },
      ],
    })

    assert.ok(booking.id)
    assert.ok(booking.invoiceNo.startsWith("YHB-KDY-OCT-"))
    assert.strictEqual(booking.passengers.length, 2)
    assert.strictEqual(booking.payments.length, 1)
    assert.strictEqual(booking.advanceReceived, 10000)
    assert.strictEqual(booking.isPaid, false)

    // Verify active_seats has L1 and L2 locked
    const activeSeats = db.prepare("SELECT * FROM active_seats").all()
    assert.strictEqual(activeSeats.length, 2)
    assert.strictEqual(activeSeats[0].seatId, "L1")
    assert.strictEqual(activeSeats[1].seatId, "L2")
  })

  test("rejects booking with conflicting seats on same tour and date (409)", () => {
    assert.throws(
      () => {
        bookingQueries.createBooking(db, {
          tourName: "Kedarnath Dham Yatra",
          journeyDate: "2026-10-25T00:00:00.000Z",
          totalAmount: 12000,
          contactName: "Another Traveler",
          contactPhone: "9811122233",
          passengers: [{ name: "Traveler 2", age: 30, seatId: "L1" }],
        })
      },
      (err) => {
        assert.strictEqual(err.status, 409)
        assert.ok(err.message.includes("already booked"))
        return true
      }
    )
  })

  test("allows same seat on different date or different tour", () => {
    const differentDate = bookingQueries.createBooking(db, {
      tourName: "Kedarnath Dham Yatra",
      journeyDate: "2026-10-26T00:00:00.000Z",
      totalAmount: 12000,
      advanceReceived: 5000,
      contactName: "Traveler 2",
      contactPhone: "9811122233",
      passengers: [{ name: "Traveler 2", age: 30, seatId: "L1" }],
    })
    assert.ok(differentDate.id)

    const differentTour = bookingQueries.createBooking(db, {
      tourName: "Somnath Yatra",
      journeyDate: "2026-10-25T00:00:00.000Z",
      totalAmount: 12000,
      contactName: "Traveler 3",
      contactPhone: "9811122233",
      passengers: [{ name: "Traveler 3", age: 30, seatId: "L1" }],
    })
    assert.ok(differentTour.id)
  })

  test("records subsequent payment and recalculates balance", () => {
    const bookings = bookingQueries.listBookings(db)
    const firstBooking = bookings[bookings.length - 1] // Kedarnath Ramesh

    const payment = paymentQueries.recordPayment(db, {
      bookingId: firstBooking.id,
      amount: 14000,
      paymentMode: "UPI",
      notes: "Remaining balance paid via UPI",
    })

    assert.ok(payment.id)
    assert.strictEqual(payment.booking.isPaid, 1)
    assert.strictEqual(payment.booking.advanceReceived, 24000)
  })

  test("cancellation releases active seats and records refund if applicable", () => {
    const bookings = bookingQueries.listBookings(db)
    const b = bookings.find((x) => x.contactName === "Traveler 2")

    const cancelled = bookingQueries.cancelBooking(db, b.id, {
      reason: "Personal emergency",
      cancellationCharge: 2000,
    })

    assert.strictEqual(cancelled.status, "Cancelled")
    assert.strictEqual(cancelled.advanceReceived, 2000)

    // Seat L1 on 2026-10-26 must now be released in active_seats
    const activeOnDate = db
      .prepare("SELECT * FROM active_seats WHERE journeyDate = '2026-10-26' AND seatId = 'L1'")
      .all()
    assert.strictEqual(activeOnDate.length, 0)
  })

  test("soft-delete releases seats and restore re-locks seats", () => {
    const bookings = bookingQueries.listBookings(db)
    const b = bookings.find((x) => x.contactName === "Traveler 3")

    // Soft delete
    bookingQueries.deleteBooking(db, b.id)
    const activeOnDate = db
      .prepare("SELECT * FROM active_seats WHERE tourName = 'Somnath Yatra' AND seatId = 'L1'")
      .all()
    assert.strictEqual(activeOnDate.length, 0)

    // Restore
    bookingQueries.restoreBooking(db, b.id)
    const activeRestored = db
      .prepare("SELECT * FROM active_seats WHERE tourName = 'Somnath Yatra' AND seatId = 'L1'")
      .all()
    assert.strictEqual(activeRestored.length, 1)
  })

  test("manages settings and single-user operator session", () => {
    settingsQueries.updateSettings(db, {
      companyName: "Shree Ganesh Yatra Travels",
      invoicePrefix: "SGY",
      operatorName: "Vikram Mehta",
    })

    const settings = settingsQueries.getAllSettings(db)
    assert.strictEqual(settings.companyName, "Shree Ganesh Yatra Travels")
    assert.strictEqual(settings.invoicePrefix, "SGY")

    const session = authQueries.getOperatorSession(db)
    assert.strictEqual(session.user.userName, "Vikram Mehta")
    assert.strictEqual(session.user.companyName, "Shree Ganesh Yatra Travels")
    assert.strictEqual(session.token, "desktop-offline-operator-token")
  })
})
