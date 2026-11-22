import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import mongoose from "../backend/node_modules/mongoose/index.js"
import jwt from "../backend/node_modules/jsonwebtoken/index.js"
import bcrypt from "../backend/node_modules/bcryptjs/index.js"

const TEST_DB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub_test"
const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-for-pnl-integration-2026"

// Ensure environment is set to test so backend/index does not auto-listen
process.env.NODE_ENV = "test"
process.env.JWT_SECRET = JWT_SECRET

// Dynamic import of real Express app
let app
let server
let baseUrl
let isMongoAvailable = false

let User
let Booking
let Expense

describe("Integration Harness: Real Express App against yatrahub_test", () => {
  let userAId
  let userBId
  let userAToken
  let userBToken

  before(async () => {
    // 1. Safety check: Refuse to run if database name does not end with _test
    const parsedUri = new URL(TEST_DB_URI.replace("mongodb://", "http://"))
    const dbName = parsedUri.pathname.replace(/^\//, "")
    if (!dbName.endsWith("_test")) {
      throw new Error(`SAFETY ERROR: Test database name "${dbName}" does not end with "_test". Aborting!`)
    }

    // 2. Check MongoDB reachability
    try {
      await mongoose.connect(TEST_DB_URI, {
        serverSelectionTimeoutMS: 2500,
      })
      isMongoAvailable = true
    } catch (err) {
      console.warn("Local MongoDB is not reachable on 127.0.0.1:27017; skipping live Express integration harness. Cause:", err.message)
      return
    }

    // Load models
    const userMod = await import("../backend/models/User.js")
    const bookingMod = await import("../backend/models/Booking.js")
    const expenseMod = await import("../backend/models/Expense.js")
    User = userMod.default
    Booking = bookingMod.default
    Expense = expenseMod.default

    // Clear test collections for our test operators only
    await User.deleteMany({ email: { $in: ["operatorA@test.com", "operatorB@test.com"] } })

    // Create User A
    const hashedPass = await bcrypt.hash("Password123!#", 8)
    const userA = await User.create({
      userName: "Operator A",
      email: "operatorA@test.com",
      password: hashedPass,
      companyName: "Yatra Tours A",
    })
    userAId = userA._id.toString()
    userAToken = jwt.sign({ id: userAId, email: userA.email }, JWT_SECRET, { expiresIn: "1h" })
    userA.activeTokens = [{ token: userAToken, createdAt: new Date() }]
    await userA.save()

    // Create User B
    const userB = await User.create({
      userName: "Operator B",
      email: "operatorB@test.com",
      password: hashedPass,
      companyName: "Yatra Tours B",
    })
    userBId = userB._id.toString()
    userBToken = jwt.sign({ id: userBId, email: userB.email }, JWT_SECRET, { expiresIn: "1h" })
    userB.activeTokens = [{ token: userBToken, createdAt: new Date() }]
    await userB.save()

    // Start ephemeral HTTP server on random port
    const appMod = await import("../backend/index.js")
    app = appMod.default || appMod.app
    server = http.createServer(app)
    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const port = server.address().port
        baseUrl = `http://127.0.0.1:${port}`
        resolve()
      })
    })
  })

  after(async () => {
    if (server) {
      if (typeof server.closeAllConnections === "function") {
        server.closeAllConnections()
      }
      await new Promise((resolve) => server.close(resolve))
    }
    if (isMongoAvailable) {
      try {
        await User.deleteMany({ email: { $in: ["operatorA@test.com", "operatorB@test.com"] } })
        if (userAId && userBId) {
          await Booking.deleteMany({ userId: { $in: [userAId, userBId] } })
          await Expense.deleteMany({ userId: { $in: [userAId, userBId] } })
        }
        await mongoose.disconnect()
      } catch {
        // Cleanup gracefully
      }
    }
  })

  it("returns 401 Unauthorized for /api/expenses without session cookie", async (t) => {
    if (!isMongoAvailable) {
      t.skip("MongoDB not available")
      return
    }

    const res = await fetch(`${baseUrl}/api/expenses`)
    assert.equal(res.status, 401)
  })

  it("returns 401 Unauthorized for /api/reports/tour-pnl without session cookie", async (t) => {
    if (!isMongoAvailable) {
      t.skip("MongoDB not available")
      return
    }

    const res = await fetch(`${baseUrl}/api/reports/tour-pnl`)
    assert.equal(res.status, 401)
  })

  it("enforces tenant isolation and records data under User A's session", async (t) => {
    if (!isMongoAvailable) {
      t.skip("MongoDB not available")
      return
    }

    // 1. User A records a booking
    await Booking.create({
      userId: userAId,
      invoiceNo: "YHB-TST-001",
      tourName: "Integration Test Yatra",
      journeyDate: new Date("2026-06-15"),
      totalAmount: 12000,
      advanceReceived: 12000,
      status: "Confirmed",
      contactName: "Secret Customer",
      contactPhone: "9876543210",
      passengers: [{ name: "Secret Pax", aadhar: "123412341234", age: 30, gender: "M", city: "Test" }],
    })

    // 2. User A creates an expense via POST /api/expenses
    const postRes = await fetch(`${baseUrl}/api/expenses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        Cookie: `token=${userAToken}`,
      },
      body: JSON.stringify({
        date: "2026-06-14",
        category: "fuel",
        amount: 4500,
        tourName: "Integration Test Yatra",
        tourRef: "Integration Test Yatra",
        vendor: "HPCL Station",
        paymentMode: "cash",
        status: "paid",
        note: "Diesel for integration test",
      }),
    })

    assert.equal(postRes.status, 201)
    const postData = await postRes.json()
    assert.equal(postData.expense.category, "fuel")
    assert.equal(postData.expense.amount, 4500)

    // 3. User B queries expenses via GET /api/expenses
    const getResB = await fetch(`${baseUrl}/api/expenses`, {
      headers: {
        Cookie: `token=${userBToken}`,
      },
    })
    assert.equal(getResB.status, 200)
    const dataB = await getResB.json()
    // User B should see 0 expenses
    assert.equal(dataB.expenses.length, 0)

    // 4. User A queries expenses via GET /api/expenses
    const getResA = await fetch(`${baseUrl}/api/expenses`, {
      headers: {
        Cookie: `token=${userAToken}`,
      },
    })
    assert.equal(getResA.status, 200)
    const dataA = await getResA.json()
    assert.equal(dataA.expenses.length, 1)
    assert.equal(dataA.expenses[0].tourName, "Integration Test Yatra")
  })

  it("verifies NO PII is leaked in the P&L report endpoint payload", async (t) => {
    if (!isMongoAvailable) {
      t.skip("MongoDB not available")
      return
    }

    const res = await fetch(`${baseUrl}/api/reports/tour-pnl?from=2026-06-01&to=2026-06-30`, {
      headers: {
        Cookie: `token=${userAToken}`,
      },
    })

    assert.equal(res.status, 200)
    const bodyText = await res.text()

    // Assert strictly that NO PII keywords or customer values appear anywhere in the raw response text
    assert.equal(bodyText.includes("Secret Customer"), false, "Customer contactName must not appear in report")
    assert.equal(bodyText.includes("Secret Pax"), false, "Passenger name must not appear in report")
    assert.equal(bodyText.includes("9876543210"), false, "Phone number must not appear in report")
    assert.equal(bodyText.includes("123412341234"), false, "Aadhaar number must not appear in report")

    const reportJson = JSON.parse(bodyText)
    assert.equal(reportJson.success, true)
    assert.equal(reportJson.summary.bookedRevenue, 12000)
    assert.equal(reportJson.summary.allExpensesTotal, 4500)
    assert.equal(reportJson.summary.tourProfitBooked, 7500)
  })
})
