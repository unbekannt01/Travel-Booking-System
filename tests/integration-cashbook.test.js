import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import mongoose from "../backend/node_modules/mongoose/index.js"
import jwt from "../backend/node_modules/jsonwebtoken/index.js"
import bcrypt from "../backend/node_modules/bcryptjs/index.js"

const TEST_DB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub_test"
const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-for-cashbook-integration-2026"

process.env.NODE_ENV = "test"
process.env.JWT_SECRET = JWT_SECRET

let app
let server
let baseUrl
let isMongoAvailable = false

let User
let Booking
let Payment
let Expense
let CashEntry
let CashBookSetup
let BooksClose

describe("Integration Harness: Real Express App against yatrahub_test (Part 6a: Cash Book & Books Close)", () => {
  let userAId
  let userAToken
  const rawPassword = "TestPassword123!"

  before(async () => {
    const parsedUri = new URL(TEST_DB_URI.replace("mongodb://", "http://"))
    const dbName = parsedUri.pathname.replace(/^\//, "")
    if (!dbName.endsWith("_test")) {
      throw new Error(`SAFETY ERROR: Test database name "${dbName}" does not end with "_test". Aborting!`)
    }

    try {
      await mongoose.connect(TEST_DB_URI, { serverSelectionTimeoutMS: 2000 })
      isMongoAvailable = true
    } catch {
      console.warn("MongoDB not reachable at", TEST_DB_URI, "- skipping live DB integration tests")
      isMongoAvailable = false
      return
    }

    User = (await import("../backend/models/User.js")).default
    Booking = (await import("../backend/models/Booking.js")).default
    Payment = (await import("../backend/models/Payment.js")).default
    Expense = (await import("../backend/models/Expense.js")).default
    CashEntry = (await import("../backend/models/CashEntry.js")).default
    CashBookSetup = (await import("../backend/models/CashBookSetup.js")).default
    BooksClose = (await import("../backend/models/BooksClose.js")).default

    const appModule = await import("../backend/index.js")
    app = appModule.app || appModule.default

    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port
    baseUrl = `http://127.0.0.1:${port}`

    // Cleanup past test data
    await User.deleteMany({ email: /cashbook_test_/ })
    await Booking.deleteMany({ contactPhone: "9988776655" })
    await Payment.deleteMany({ notes: /CashbookTest/ })
    await Expense.deleteMany({ vendor: /CashbookTest/ })
    await CashEntry.deleteMany({ partyName: /CashbookTest/ })
    await CashBookSetup.deleteMany({})
    await BooksClose.deleteMany({})

    // Seed test user A
    const hashedPassword = await bcrypt.hash(rawPassword, 10)
    const userA = await User.create({
      userName: "Cashbook Operator A",
      email: "cashbook_test_a@example.com",
      password: hashedPassword,
      companyName: "Somnath Travels",
      companyPhone: "9825012345",
    })
    userAId = userA._id
    userAToken = jwt.sign({ id: userAId.toString(), email: userA.email }, JWT_SECRET, {
      expiresIn: "1h",
    })
  })

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
    if (isMongoAvailable && mongoose.connection.readyState !== 0) {
      await User.deleteMany({ email: /cashbook_test_/ })
      await Booking.deleteMany({ contactPhone: "9988776655" })
      await Payment.deleteMany({ notes: /CashbookTest/ })
      await Expense.deleteMany({ vendor: /CashbookTest/ })
      await CashEntry.deleteMany({ partyName: /CashbookTest/ })
      await CashBookSetup.deleteMany({})
      await BooksClose.deleteMany({})
      await mongoose.disconnect()
    }
  })

  it("1. GET /api/cashbook: Rejects unauthenticated requests with HTTP 401", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    const res = await fetch(`${baseUrl}/api/cashbook`)
    assert.equal(res.status, 401)
  })

  it("2. Setup Flow: GET and PUT /api/cashbook/setup manages tenant opening balance", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    // Default setup
    const getRes = await fetch(`${baseUrl}/api/cashbook/setup`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(getRes.status, 200)
    const getData = await getRes.json()
    assert.equal(getData.isEditable, true)

    // Update setup
    const putRes = await fetch(`${baseUrl}/api/cashbook/setup`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cashOpening: 15000,
        bankOpening: 45000,
        asOfDate: "2026-11-01",
        notes: "Initial balance from bank statement",
      }),
    })
    assert.equal(putRes.status, 200)
    const putData = await putRes.json()
    assert.equal(putData.cashOpening, 15000)
    assert.equal(putData.bankOpening, 45000)
    assert.equal(putData.asOfDate, "2026-11-01")
  })

  it("3. Manual Entry: POST /api/cashbook/entries records transfer and owner entries", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    // Valid transfer to bank
    const res = await fetch(`${baseUrl}/api/cashbook/entries`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "transfer-to-bank",
        amount: 5000,
        account: "cash",
        date: "2026-11-10",
        partyName: "CashbookTest Bank Deposit",
        notes: "Deposited bus cash receipts to HDFC",
      }),
    })
    assert.equal(res.status, 201)
    const data = await res.json()
    assert.equal(data.type, "transfer-to-bank")
    assert.equal(data.amount, 5000)
    assert.equal(data.direction, "debit")
  })

  it("4. Close Day Flow & Preview: Preview calculates cash difference and Close requires password", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    // Preview
    const prevRes = await fetch(`${baseUrl}/api/cashbook/close/preview?asOfDate=2026-11-10&countedCash=10000`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(prevRes.status, 200)
    const prevData = await prevRes.json()
    assert.ok(prevData.preview)
    assert.equal(prevData.preview.asOfDate, "2026-11-10")
    assert.equal(prevData.preview.countedCash, 10000)
    // Opening cash 15000 - 5000 transfer = 10000 closing cash. So counted 10000 = balanced!
    assert.equal(prevData.preview.systemCash, 10000)
    assert.equal(prevData.preview.status, "balanced")

    // Try closing with wrong password -> 401
    const badCloseRes = await fetch(`${baseUrl}/api/cashbook/close`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asOfDate: "2026-11-10",
        countedCash: 10000,
        password: "WrongPassword!",
      }),
    })
    assert.equal(badCloseRes.status, 401)

    // Close with correct password -> 201
    const closeRes = await fetch(`${baseUrl}/api/cashbook/close`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asOfDate: "2026-11-10",
        countedCash: 10000,
        password: rawPassword,
        notes: "Books closed cleanly for 10 Nov",
      }),
    })
    assert.equal(closeRes.status, 201)
    const closeData = await closeRes.json()
    assert.equal(closeData.success, true)
    assert.equal(closeData.close.closedUpTo, "2026-11-10")
    assert.equal(closeData.close.status, "active")
  })

  it("5. Books Lock Rule: Mutations on or before close date return HTTP 423 Locked", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    // Attempt to add cashbook entry on 2026-11-05 (<= 2026-11-10) -> 423
    const lockedEntryRes = await fetch(`${baseUrl}/api/cashbook/entries`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "owner-in",
        amount: 2000,
        account: "cash",
        date: "2026-11-05",
        partyName: "CashbookTest Locked Entry",
      }),
    })
    assert.equal(lockedEntryRes.status, 423)
    const lockedEntryData = await lockedEntryRes.json()
    assert.ok(lockedEntryData.message.includes("closed up to 2026-11-10"))

    // Attempt to create booking on 2026-11-08 (<= 2026-11-10) -> 423
    const lockedBookingRes = await fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contactName: "Locked Traveler",
        contactPhone: "9988776655",
        tourName: "Somnath Yatra",
        journeyDate: "2026-11-20",
        date: "2026-11-08",
        totalAmount: 5000,
        advanceReceived: 2000,
        passengers: [{ name: "Traveler One", age: 35, gender: "Male", city: "Surat" }],
      }),
    })
    assert.equal(lockedBookingRes.status, 423)

    // Attempt to create expense on 2026-11-09 (<= 2026-11-10) -> 423
    const lockedExpenseRes = await fetch(`${baseUrl}/api/expenses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: "2026-11-09",
        amount: 1200,
        category: "fuel",
        vendor: "CashbookTest Diesel",
        status: "paid",
        paidOn: "2026-11-09",
        paymentMode: "cash",
      }),
    })
    assert.equal(lockedExpenseRes.status, 423)

    // BUT an entry on 2026-11-15 (> 2026-11-10) succeeds with 201!
    const openEntryRes = await fetch(`${baseUrl}/api/cashbook/entries`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "owner-in",
        amount: 3000,
        account: "cash",
        date: "2026-11-15",
        partyName: "CashbookTest Open Day Entry",
        notes: "Capital injection",
      }),
    })
    assert.equal(openEntryRes.status, 201)
  })

  it("6. Reopen Day Flow: POST /api/cashbook/reopen reopens the last close with password and audit", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    // Missing reason -> 400
    const noReasonRes = await fetch(`${baseUrl}/api/cashbook/reopen`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password: rawPassword,
        reason: "no",
      }),
    })
    assert.equal(noReasonRes.status, 400)

    // Reopen with valid reason & password -> 200
    const reopenRes = await fetch(`${baseUrl}/api/cashbook/reopen`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password: rawPassword,
        reason: "Owner missed cash expense voucher on 10 Nov",
      }),
    })
    assert.equal(reopenRes.status, 200)
    const reopenData = await reopenRes.json()
    assert.equal(reopenData.success, true)
    assert.equal(reopenData.reopenedClose.status, "reopened")
    assert.equal(reopenData.newLockDate, null)

    // Now, entry on 2026-11-05 is unlocked and succeeds!
    const unlockedEntryRes = await fetch(`${baseUrl}/api/cashbook/entries`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "owner-in",
        amount: 2000,
        account: "cash",
        date: "2026-11-05",
        partyName: "CashbookTest Unlocked Entry",
      }),
    })
    assert.equal(unlockedEntryRes.status, 201)
  })
})
