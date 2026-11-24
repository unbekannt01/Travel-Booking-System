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
let AuditLog

describe("Integration Harness: Real Express App against yatrahub_test (Part 6a: Cash Book & Books Close)", () => {
  let userAId
  let userAToken
  let userBId
  let userBToken
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
    AuditLog = (await import("../backend/models/AuditLog.js")).default

    const appModule = await import("../backend/index.js")
    app = appModule.app || appModule.default

    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port
    baseUrl = `http://127.0.0.1:${port}`

    // Cleanup past test data strictly scoped to this test suite's users
    const existingUsers = await User.find({ email: /cashbook_test_/ }).select("_id").lean()
    const existingIds = existingUsers.map((u) => u._id)
    if (existingIds.length > 0) {
      await Booking.deleteMany({ userId: { $in: existingIds } })
      await Payment.deleteMany({ userId: { $in: existingIds } })
      await Expense.deleteMany({ userId: { $in: existingIds } })
      await CashEntry.deleteMany({ userId: { $in: existingIds } })
      await CashBookSetup.deleteMany({ userId: { $in: existingIds } })
      await BooksClose.deleteMany({ userId: { $in: existingIds } })
      await AuditLog.deleteMany({ userId: { $in: existingIds } })
      await User.deleteMany({ _id: { $in: existingIds } })
    }

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

    // Seed test user B for tenant isolation
    const userB = await User.create({
      userName: "Cashbook Operator B",
      email: "cashbook_test_b@example.com",
      password: hashedPassword,
      companyName: "Dwarka Travels",
      companyPhone: "9825099999",
    })
    userBId = userB._id
    userBToken = jwt.sign({ id: userBId.toString(), email: userB.email }, JWT_SECRET, {
      expiresIn: "1h",
    })
  })

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
    if (isMongoAvailable && mongoose.connection.readyState !== 0) {
      const ids = [userAId, userBId].filter(Boolean)
      if (ids.length > 0) {
        await Booking.deleteMany({ userId: { $in: ids } })
        await Payment.deleteMany({ userId: { $in: ids } })
        await Expense.deleteMany({ userId: { $in: ids } })
        await CashEntry.deleteMany({ userId: { $in: ids } })
        await CashBookSetup.deleteMany({ userId: { $in: ids } })
        await BooksClose.deleteMany({ userId: { $in: ids } })
        await AuditLog.deleteMany({ userId: { $in: ids } })
        await User.deleteMany({ _id: { $in: ids } })
      }
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
    assert.equal(lockedEntryData.message, "Books are closed up to 10-11-2026. Reopen the books to change this.")

    // Booking with advance > 0 on closed date (2026-11-08 <= 2026-11-10) -> 423
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

    // BUT booking with advance = 0 on closed date touches NO money -> 201!
    const openAdvanceZeroRes = await fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contactName: "Locked Traveler Free",
        contactPhone: "9988776655",
        tourName: "Somnath Yatra",
        journeyDate: "2026-11-20",
        date: "2026-11-08",
        totalAmount: 5000,
        advanceReceived: 0,
        passengers: [{ name: "Traveler Zero", age: 35, gender: "Male", city: "Surat" }],
      }),
    })
    assert.equal(openAdvanceZeroRes.status, 201)
    const zeroBooking = await openAdvanceZeroRes.json()

    // Editing non-money field (e.g. contactName) on closed date booking -> 200!
    const updateNonMoneyRes = await fetch(`${baseUrl}/api/bookings/${zeroBooking._id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contactName: "Renamed Free Traveler",
      }),
    })
    assert.equal(updateNonMoneyRes.status, 200)

    // Editing money field (e.g. cancellationCharge) on closed date booking -> 423
    const updateMoneyRes = await fetch(`${baseUrl}/api/bookings/${zeroBooking._id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cancellationCharge: 500,
      }),
    })
    assert.equal(updateMoneyRes.status, 423)

    // Booking with advance > 0 on closed date: updating total amount or date -> 423
    const advanceBooking = await Booking.create({
      userId: userAId,
      contactName: "Advance Traveler",
      contactPhone: "9876543210",
      tourName: "Locked Test Tour",
      journeyDate: new Date("2026-11-20"),
      date: new Date("2026-11-08"),
      totalAmount: 5000,
      advanceReceived: 1000,
      invoiceNo: "CB-ADV-LOCK-TEST",
      passengers: [{ name: "Advance Traveler", age: 30, gender: "Male", city: "Surat" }],
    })

    const updateAdvanceClosedRes = await fetch(`${baseUrl}/api/bookings/${advanceBooking._id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        totalAmount: 6000,
      }),
    })
    assert.equal(updateAdvanceClosedRes.status, 423)

    // Recording payment on closed date (2026-11-09) -> 423
    const paymentClosedRes = await fetch(`${baseUrl}/api/bookings/${zeroBooking._id}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: 1000,
        paymentDate: "2026-11-09",
        paymentMode: "cash",
      }),
    })
    assert.equal(paymentClosedRes.status, 423)

    // Recording payment on OPEN date (2026-11-15) for historical booking -> 201!
    const paymentOpenRes = await fetch(`${baseUrl}/api/bookings/${zeroBooking._id}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: 1000,
        paymentDate: "2026-11-15",
        paymentMode: "cash",
      }),
    })
    assert.equal(paymentOpenRes.status, 201)

    // Attempt to create paid expense on 2026-11-09 (<= 2026-11-10) -> 423
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

    // Pending expense on closed date moves no money -> 201!
    const pendingExpenseRes = await fetch(`${baseUrl}/api/expenses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: "2026-11-09",
        amount: 800,
        category: "fuel",
        vendor: "CashbookTest Pending Vendor",
        status: "pending",
      }),
    })
    assert.equal(pendingExpenseRes.status, 201)
    const pendingExp = await pendingExpenseRes.json()

    // Editing vendor on pending expense -> 200!
    const expenseId = pendingExp.expense?._id || pendingExp.expense?.id || pendingExp._id
    const updateExpVendorRes = await fetch(`${baseUrl}/api/expenses/${expenseId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vendor: "CashbookTest Renamed Vendor",
      }),
    })
    assert.equal(updateExpVendorRes.status, 200)

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

    // Wrong password -> 401
    const badPasswordRes = await fetch(`${baseUrl}/api/cashbook/reopen`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password: "IncorrectPassword123!",
        reason: "Testing incorrect password verification",
      }),
    })
    assert.equal(badPasswordRes.status, 401)

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

    // Audit log verifies NO personal data (reasonLength recorded, no raw reason text)
    const auditEntry = await AuditLog.findOne({ action: "BOOKS_REOPENED", userId: userAId })
    assert.ok(auditEntry, "AuditLog entry for BOOKS_REOPENED must exist")
    assert.equal(auditEntry.meta.closedUpTo, "2026-11-10")
    assert.equal(typeof auditEntry.meta.reasonLength, "number")
    assert.equal(auditEntry.meta.reason, undefined, "AuditLog must not store raw reason or PII")

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

  it("7. Tenant Isolation: User B cannot access User A's cash book data or settings", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    // User B daybook is empty
    const resB = await fetch(`${baseUrl}/api/cashbook?startDate=2026-11-01&endDate=2026-11-30`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    })
    assert.equal(resB.status, 200)
    const dataB = await resB.json()
    assert.equal(dataB.dayBook.entries.length, 0)
    assert.equal(dataB.dayBook.closing.cash, 0)
    assert.equal(dataB.dayBook.closing.bank, 0)

    // User B setup has clean 0 defaults and is isolated from User A's setup
    const setupResB = await fetch(`${baseUrl}/api/cashbook/setup`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    })
    assert.equal(setupResB.status, 200)
    const setupDataB = await setupResB.json()
    assert.equal(setupDataB.setup.cashOpening, 0)
    assert.equal(setupDataB.setup.bankOpening, 0)
    assert.equal(setupDataB.isEditable, true)
  })
})
