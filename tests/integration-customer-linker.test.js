import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import mongoose from "../backend/node_modules/mongoose/index.js"
import jwt from "../backend/node_modules/jsonwebtoken/index.js"
import bcrypt from "../backend/node_modules/bcryptjs/index.js"

const TEST_DB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub_test"
const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-customer-linker-2026"

process.env.NODE_ENV = "test"
process.env.JWT_SECRET = JWT_SECRET

let app
let server
let baseUrl
let isMongoAvailable = false

let User
let Booking
let Customer

describe("Integration Harness: Customer Linker Endpoint (POST /api/customers/link-bookings)", () => {
  let userAId
  let userBId
  let userAToken
  let userBToken

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
    Customer = (await import("../backend/models/Customer.js")).default

    const appModule = await import("../backend/index.js")
    app = appModule.app || appModule.default

    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port
    baseUrl = `http://127.0.0.1:${port}`

    // Clean test records for this suite
    await User.deleteMany({ email: { $in: ["linkera@example.com", "linkerb@example.com"] } })
    await Booking.deleteMany({ invoiceNo: { $in: ["YHB-LINK-001", "YHB-LINK-002", "YHB-LINK-B01"] } })
    await Customer.deleteMany({ phone: { $in: ["9876543210", "9876543211"] } })

    // Create User A and User B
    const passwordHash = await bcrypt.hash("Password123!", 10)
    const uA = await User.create({
      userName: "linkera",
      email: "linkera@example.com",
      password: passwordHash,
      role: "admin",
    })
    userAId = uA._id.toString()
    userAToken = jwt.sign({ id: userAId, email: uA.email, role: uA.role }, JWT_SECRET, { expiresIn: "1h" })

    const uB = await User.create({
      userName: "linkerb",
      email: "linkerb@example.com",
      password: passwordHash,
      role: "admin",
    })
    userBId = uB._id.toString()
    userBToken = jwt.sign({ id: userBId, email: uB.email, role: uB.role }, JWT_SECRET, { expiresIn: "1h" })

    // Seed User A: 1 linkable booking, 1 invalid phone booking
    await Booking.create({
      userId: userAId,
      invoiceNo: "YHB-LINK-001",
      customerName: "Ramesh Patel",
      contactName: "Ramesh Patel",
      contactPhone: "9876543210",
      tourName: "Chardham Special",
      journeyDate: new Date("2026-06-01"),
      totalAmount: 5000,
      customerId: null,
      deletedAt: null,
    })

    await Booking.create({
      userId: userAId,
      invoiceNo: "YHB-LINK-002",
      customerName: "Unknown Traveler",
      contactName: "Unknown Traveler",
      contactPhone: "12345",
      tourName: "Dwarka Special",
      journeyDate: new Date("2026-07-01"),
      totalAmount: 3000,
      customerId: null,
      deletedAt: null,
    })

    // Seed User B: 1 linkable booking
    await Booking.create({
      userId: userBId,
      invoiceNo: "YHB-LINK-B01",
      customerName: "Suresh Shah",
      contactName: "Suresh Shah",
      contactPhone: "9825098765",
      tourName: "Kashi Yatra",
      journeyDate: new Date("2026-08-01"),
      totalAmount: 4000,
      customerId: null,
      deletedAt: null,
    })
  })

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
    }
  })

  it("links User A's unlinked booking without touching User B's bookings (tenant isolation)", async () => {
    if (!isMongoAvailable) return

    const res = await fetch(`${baseUrl}/api/customers/link-bookings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
    })

    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.success, true)
    assert.equal(json.summary.scanned, 2)
    assert.equal(json.summary.linked, 1)
    assert.equal(json.summary.skipped, 1)

    // Verify User A's customer was created
    const createdCust = await Customer.findOne({ userId: userAId, phone: "9876543210" })
    assert.ok(createdCust)
    assert.equal(createdCust.name, "Ramesh Patel")

    // Verify User A's booking was updated
    const bA1 = await Booking.findOne({ invoiceNo: "YHB-LINK-001" })
    assert.equal(bA1.customerId.toString(), createdCust._id.toString())

    // Verify User B's booking remains unlinked (untouched by User A's action)
    const bB = await Booking.findOne({ invoiceNo: "YHB-LINK-B01" })
    assert.equal(bB.customerId, null)
  })

  it("GET /api/customers returns updated unlinked count and unresolved bookings for User A", async () => {
    if (!isMongoAvailable) return

    const res = await fetch(`${baseUrl}/api/customers`, {
      headers: {
        Authorization: `Bearer ${userAToken}`,
      },
    })

    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.counts.unlinkedBookingsCount, 1)
    assert.equal(json.counts.unresolvedBookings.length, 1)
    assert.equal(json.counts.unresolvedBookings[0].invoiceNo, "YHB-LINK-002")
    assert.equal(json.counts.unresolvedBookings[0].reasonCode, "INVALID_PHONE")
  })

  it("User B can link their own bookings independently using userBToken", async () => {
    if (!isMongoAvailable) return

    const res = await fetch(`${baseUrl}/api/customers/link-bookings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userBToken}`,
        "Content-Type": "application/json",
      },
    })

    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.summary.scanned, 1)
    assert.equal(json.summary.linked, 1)
  })
})
