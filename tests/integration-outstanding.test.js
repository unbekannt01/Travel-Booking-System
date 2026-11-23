import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import mongoose from "../backend/node_modules/mongoose/index.js"
import jwt from "../backend/node_modules/jsonwebtoken/index.js"
import bcrypt from "../backend/node_modules/bcryptjs/index.js"

const TEST_DB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub_test"
const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-for-outstanding-integration-2026"

process.env.NODE_ENV = "test"
process.env.JWT_SECRET = JWT_SECRET

let app
let server
let baseUrl
let isMongoAvailable = false

let User
let Booking
let Customer

describe("Integration Harness: Real Express App against yatrahub_test (Part 5b: Outstanding & Statements)", () => {
  let userAId
  let userBId
  let userAToken
  let userBToken
  let customerAId

  before(async () => {
    // Safety check
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

    // Load models
    User = (await import("../backend/models/User.js")).default
    Booking = (await import("../backend/models/Booking.js")).default
    Customer = (await import("../backend/models/Customer.js")).default

    // Import real app
    const appModule = await import("../backend/index.js")
    app = appModule.app || appModule.default

    // Start server on ephemeral port
    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port
    baseUrl = `http://127.0.0.1:${port}`

    // Clean test DB
    await User.deleteMany({ email: /@outstanding-test\.local$/ })
    await Customer.deleteMany({ email: /@outstanding-test\.local$/ })
    await Booking.deleteMany({ tourName: /Outstanding Test Tour/ })

    // Create Tenant A
    const passwordHash = await bcrypt.hash("SecurePass@1234", 10)
    const userA = await User.create({
      userName: "Operator A",
      email: "operatorA@outstanding-test.local",
      password: passwordHash,
      companyName: "Om Travels A",
      companyPhone: "9876543210",
      companyHeadquarters: "Ahmedabad, Gujarat",
      gstNumber: "24AAAAA0000A1Z5",
    })
    userAId = userA._id.toString()
    userAToken = jwt.sign({ id: userAId, email: userA.email }, JWT_SECRET, { expiresIn: "1h" })

    // Create Tenant B
    const userB = await User.create({
      userName: "Operator B",
      email: "operatorB@outstanding-test.local",
      password: passwordHash,
      companyName: "Shiv Travels B",
    })
    userBId = userB._id.toString()
    userBToken = jwt.sign({ id: userBId, email: userB.email }, JWT_SECRET, { expiresIn: "1h" })

    // Create Customer for Tenant A
    const custA = await Customer.create({
      userId: userAId,
      name: "Ramesh Patel",
      phone: "9876543210",
      email: "ramesh@outstanding-test.local",
      city: "Surat",
    })
    customerAId = custA._id.toString()

    // Create Active Booking with Balance Due for Tenant A
    await Booking.create({
      userId: userAId,
      customerId: custA._id,
      customerName: "Ramesh Patel",
      contactName: "Ramesh Patel",
      contactPhone: "9876543210",
      invoiceNo: "INV-TEST-001",
      bookingId: "B-TEST-001",
      tourName: "Outstanding Test Tour Chardham",
      journeyDate: new Date("2026-05-10"),
      date: new Date("2026-05-01"),
      totalAmount: 25000,
      advanceReceived: 10000,
      isPaid: false,
      status: "Confirmed",
      passengers: [
        { name: "Ramesh Patel", age: 45, gender: "Male", city: "Surat", aadhar: "123456789012" }, // Sensitive Aadhaar
      ],
      payments: [
        { amount: 10000, date: new Date("2026-05-01"), mode: "Cash", type: "cash", isVoid: false },
      ],
    })

    // Create Cancelled Booking for Tenant A (retained fee 1000)
    await Booking.create({
      userId: userAId,
      customerId: custA._id,
      customerName: "Ramesh Patel",
      contactName: "Ramesh Patel",
      contactPhone: "9876543210",
      invoiceNo: "INV-TEST-002",
      bookingId: "B-TEST-002",
      tourName: "Outstanding Test Tour Dwarka",
      journeyDate: new Date("2026-05-15"),
      date: new Date("2026-05-02"),
      totalAmount: 12000,
      advanceReceived: 4000,
      isPaid: false,
      status: "Cancelled",
      cancellationCharge: 1000,
      refundAmount: 3000,
      cancelledAt: new Date("2026-05-05"),
      passengers: [{ name: "P1", age: 30, gender: "Female", city: "Surat" }],
      payments: [
        { amount: 4000, date: new Date("2026-05-02"), mode: "UPI", type: "upi", isVoid: false },
      ],
    })
  })

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
    if (isMongoAvailable) {
      await User.deleteMany({ email: /@outstanding-test\.local$/ })
      await Customer.deleteMany({ email: /@outstanding-test\.local$/ })
      await Booking.deleteMany({ tourName: /Outstanding Test Tour/ })
      await mongoose.disconnect()
    }
  })

  it("GET /api/reports/outstanding returns calculated aging buckets and strictly excludes Aadhaar PII", async () => {
    if (!isMongoAvailable) return

    const res = await fetch(`${baseUrl}/api/reports/outstanding?asOf=2026-05-20`, {
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "X-Requested-With": "XMLHttpRequest",
      },
    })

    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.success, true)

    // Summary checks: b1 total 25000, paid 10000 -> 15000 outstanding (journey 2026-05-10, asOf 2026-05-20 -> 10 days overdue -> bucket 0-30)
    assert.equal(json.summary.totalOutstanding, 15000)
    assert.equal(json.summary.bucketTotals["0-30"], 15000)
    assert.equal(json.summary.customersOwingCount, 1)

    // Verify customers and rows
    assert.equal(json.customers.length, 1)
    assert.equal(json.customers[0].customerName, "Ramesh Patel")
    assert.equal(json.customers[0].totalOutstanding, 15000)

    // PRIVACY VERIFICATION: Payload must NEVER leak Aadhaar number or passenger list
    const payloadStr = JSON.stringify(json)
    assert.ok(!payloadStr.includes("123456789012"), "Response must NOT leak Aadhaar number")
    assert.ok(!payloadStr.includes('"aadhar"'), "Response must NOT include aadhar field")
    assert.ok(!payloadStr.includes('"aadhaar"'), "Response must NOT include aadhaar field")
  })

  it("GET /api/reports/outstanding enforces tenant isolation (User B sees 0 outstanding)", async () => {
    if (!isMongoAvailable) return

    const res = await fetch(`${baseUrl}/api/reports/outstanding`, {
      headers: {
        Authorization: `Bearer ${userBToken}`,
        "X-Requested-With": "XMLHttpRequest",
      },
    })

    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.success, true)
    assert.equal(json.summary.totalOutstanding, 0)
    assert.equal(json.customers.length, 0)
    assert.equal(json.rows.length, 0)
  })

  it("GET /api/reports/outstanding rejects unknown query parameters", async () => {
    if (!isMongoAvailable) return

    const res = await fetch(`${baseUrl}/api/reports/outstanding?maliciousParam=123`, {
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "X-Requested-With": "XMLHttpRequest",
      },
    })

    assert.equal(res.status, 400)
  })

  it("GET /api/customers/:id/statement generates statement with branding and zero Aadhaar", async () => {
    if (!isMongoAvailable) return

    const res = await fetch(`${baseUrl}/api/customers/${customerAId}/statement?from=2026-05-01&to=2026-05-31`, {
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "X-Requested-With": "XMLHttpRequest",
      },
    })

    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.success, true)

    // Operator settings branding
    assert.equal(json.operatorSettings.companyName, "Om Travels A")
    assert.equal(json.operatorSettings.gstin, "24AAAAA0000A1Z5")

    // Statement balance
    // b1: +25000 -10000 = +15000
    // b2: cancelled (+12000 -4000 -12000 +1000 +3000 = 0)
    assert.equal(json.statement.closingBalance, 15000)
    assert.ok(json.statement.lines.length >= 2)

    // Privacy
    const payloadStr = JSON.stringify(json)
    assert.ok(!payloadStr.includes("123456789012"), "Must not leak Aadhaar")
  })

  it("GET /api/customers/:id/statement returns 404 for other tenant's customer", async () => {
    if (!isMongoAvailable) return

    const res = await fetch(`${baseUrl}/api/customers/${customerAId}/statement`, {
      headers: {
        Authorization: `Bearer ${userBToken}`,
        "X-Requested-With": "XMLHttpRequest",
      },
    })

    assert.equal(res.status, 404)
  })
})
