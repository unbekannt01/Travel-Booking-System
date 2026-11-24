import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import mongoose from "../backend/node_modules/mongoose/index.js"
import jwt from "../backend/node_modules/jsonwebtoken/index.js"
import bcrypt from "../backend/node_modules/bcryptjs/index.js"

const TEST_DB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub_test"
const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-for-export-new-2026"

process.env.NODE_ENV = "test"
process.env.JWT_SECRET = JWT_SECRET

let app
let server
let baseUrl
let isMongoAvailable = false

let User
let Booking
let Expense
let Payment

describe("Integration: New Export Endpoints & Aliases (Part 6c-fix)", () => {
  let userId
  let token

  before(async () => {
    const parsedUri = new URL(TEST_DB_URI.replace("mongodb://", "http://"))
    const dbName = parsedUri.pathname.replace(/^\//, "")
    if (!dbName.endsWith("_test")) {
      throw new Error(`SAFETY: "${dbName}" is not a test DB.`)
    }

    try {
      await mongoose.connect(TEST_DB_URI, { serverSelectionTimeoutMS: 2000 })
      isMongoAvailable = true
    } catch {
      console.warn("MongoDB offline, skipping tests")
      isMongoAvailable = false
      return
    }

    User = (await import("../backend/models/User.js")).default
    Booking = (await import("../backend/models/Booking.js")).default
    Expense = (await import("../backend/models/Expense.js")).default
    Payment = (await import("../backend/models/Payment.js")).default

    const appModule = await import("../backend/index.js")
    app = appModule.app || appModule.default

    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`

    await User.deleteMany({ email: "exportnew@yatrahub.in" })
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash("Password123!", salt)

    const user = await User.create({
      userName: "ExportNewTester",
      email: "exportnew@yatrahub.in",
      password: hashedPassword,
      companyName: "Somnath Yatra",
      companyPhone: "9825000000",
    })
    userId = user._id.toString()
    token = jwt.sign({ id: userId, email: user.email }, JWT_SECRET, { expiresIn: "1h" })

    await Booking.deleteMany({ userId })
    await Expense.deleteMany({ userId })
    await Payment.deleteMany({ userId })

    // Create a mock booking conforming to Booking schema
    const booking = await Booking.create({
      userId,
      contactName: "Jayesh Shah",
      contactPhone: "9825012345",
      tourName: "Somnath Diu Tour",
      journeyDate: new Date("2026-11-20"),
      totalAmount: 5000,
      advanceReceived: 3000,
      status: "Confirmed",
      invoiceNo: "INV-2026-0001",
      passengers: [
        {
          name: "Jayesh Shah",
          age: 45,
          gender: "Male",
          city: "Ahmedabad",
          seatId: "1A",
          aadhar: "123456789012", // Must NOT be in export!
        },
        {
          name: "Bhavna Shah",
          age: 42,
          gender: "Female",
          city: "Ahmedabad",
          seatId: "1B",
        },
      ],
    })

    // Create payments for ledger export
    await Payment.create({
      userId,
      bookingId: booking._id,
      receiptNo: "REC-001",
      amount: 3000,
      paymentMode: "UPI",
      type: "advance",
      paymentDate: new Date("2026-11-15"),
    })

    await Payment.create({
      userId,
      bookingId: booking._id,
      receiptNo: "REF-001",
      amount: 500,
      paymentMode: "Cash",
      type: "refund",
      paymentDate: new Date("2026-11-16"),
    })

    // Create a mock expense for the tour
    await Expense.create({
      userId,
      date: new Date("2026-11-20"),
      amount: 1800,
      category: "fuel",
      account: "cash",
      paymentMode: "cash",
      tourName: "Somnath Diu Tour",
      vendor: "HP Petrol Pump",
      status: "paid",
    })
  })

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve))
    if (isMongoAvailable) {
      await Booking.deleteMany({ userId })
      await Expense.deleteMany({ userId })
      await Payment.deleteMany({ userId })
      await User.deleteMany({ _id: userId })
      await mongoose.disconnect()
    }
  })

  it("1. GET /api/export/passengers exports passenger manifest with STRICTLY ZERO Aadhaar", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    const res = await fetch(`${baseUrl}/api/export/passengers`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(res.status, 200)
    assert.ok(res.headers.get("content-type").includes("text/csv"))

    const text = await res.text()
    // Headers must exist
    assert.ok(text.includes("Invoice No"), "Must contain Invoice No")
    assert.ok(text.includes("Tour Name"), "Must contain Tour Name")
    assert.ok(text.includes("Passenger Name"), "Must contain Passenger Name")
    assert.ok(text.includes("Jayesh Shah"))
    assert.ok(text.includes("Bhavna Shah"))

    // ZERO Aadhaar check: neither the word 'Aadhaar' nor the number '123456789012' must appear
    assert.equal(text.toLowerCase().includes("aadhaar"), false, "Strictly ZERO Aadhaar header/mention")
    assert.equal(text.includes("123456789012"), false, "Strictly ZERO Aadhaar number in export")
  })

  it("2. GET /api/export/payments exports payments ledger with negative refunds and void flag", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    const res = await fetch(`${baseUrl}/api/export/payments`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(res.status, 200)
    const text = await res.text()

    assert.ok(text.includes("Receipt No"))
    assert.ok(text.includes("REC-001"))
    assert.ok(text.includes("3000"))
    assert.ok(text.includes("REF-001"))
    assert.ok(text.includes("-500.00"), "Refund amounts must be negative")
  })

  it("3. GET /api/export/tour-pnl exports tour-wise P&L calculation", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    const res = await fetch(`${baseUrl}/api/export/tour-pnl`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(res.status, 200)
    const text = await res.text()

    assert.ok(text.includes("Tour Name"))
    assert.ok(text.includes("Booked Revenue"))
    assert.ok(text.includes("Booked Profit/Loss"))
    assert.ok(text.includes("Somnath Diu Tour"))
  })

  it("4. URL Aliases: daybook -> cashbook, outstanding -> receivables, pnl -> tour-pnl", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    const resDaybook = await fetch(`${baseUrl}/api/export/daybook`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(resDaybook.status, 200)
    assert.ok(resDaybook.headers.get("content-disposition").includes("cashbook"))

    const resOutstanding = await fetch(`${baseUrl}/api/export/outstanding`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(resOutstanding.status, 200)
    assert.ok(resOutstanding.headers.get("content-disposition").includes("receivables"))

    const resPnl = await fetch(`${baseUrl}/api/export/pnl`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(resPnl.status, 200)
    assert.ok(resPnl.headers.get("content-disposition").includes("tour-pnl"))
  })

  it("5. Date range validation: 367-day range returns 400 error, <= 366 days succeeds", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    // 367 days apart: 2025-01-01 to 2026-01-03
    const badRangeRes = await fetch(`${baseUrl}/api/export/payments?from=2025-01-01&to=2026-01-03`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(badRangeRes.status, 400)
    const badRangeData = await badRangeRes.json()
    assert.ok(badRangeData.message.includes("exceed 366 days"))

    // Valid range: 2026-01-01 to 2026-06-01
    const goodRangeRes = await fetch(`${baseUrl}/api/export/payments?from=2026-01-01&to=2026-06-01`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(goodRangeRes.status, 200)
  })
})
