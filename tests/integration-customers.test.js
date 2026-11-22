import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import mongoose from "../backend/node_modules/mongoose/index.js"
import jwt from "../backend/node_modules/jsonwebtoken/index.js"
import bcrypt from "../backend/node_modules/bcryptjs/index.js"

const TEST_DB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub_test"
const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-for-customers-integration-2026"

process.env.NODE_ENV = "test"
process.env.JWT_SECRET = JWT_SECRET

let app
let server
let baseUrl
let isMongoAvailable = false

let User
let Booking
let Customer
let Counter

describe("Integration Harness: Real Express App against yatrahub_test (Customer Master)", () => {
  let userAId
  let userBId
  let userAToken
  let userBToken

  before(async () => {
    // 1. Safety check
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
    Counter = (await import("../backend/models/Counter.js")).default

    // Import real app
    const appModule = await import("../backend/index.js")
    app = appModule.app || appModule.default

    // Start server on ephemeral port
    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port
    baseUrl = `http://127.0.0.1:${port}`

    // Clean test collections for test users
    await User.deleteMany({ email: { $in: ["usera_cust@test.local", "userb_cust@test.local"] } })

    // Create User A
    const passwordHash = await bcrypt.hash("Password123!@#", 10)
    const userA = await User.create({
      userName: "Operator Alpha",
      email: "usera_cust@test.local",
      password: passwordHash,
      role: "admin",
      tokenVersion: 1,
    })
    userAId = userA._id.toString()
    userAToken = jwt.sign({ id: userAId, tokenVersion: 1 }, JWT_SECRET, { expiresIn: "1h" })

    // Create User B (for tenant isolation tests)
    const userB = await User.create({
      userName: "Operator Beta",
      email: "userb_cust@test.local",
      password: passwordHash,
      role: "admin",
      tokenVersion: 1,
    })
    userBId = userB._id.toString()
    userBToken = jwt.sign({ id: userBId, tokenVersion: 1 }, JWT_SECRET, { expiresIn: "1h" })
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
        await User.deleteMany({ email: { $in: ["usera_cust@test.local", "userb_cust@test.local"] } })
        if (userAId && userBId) {
          await Customer.deleteMany({ userId: { $in: [userAId, userBId] } })
          await Booking.deleteMany({ userId: { $in: [userAId, userBId] } })
        }
        await mongoose.disconnect()
      } catch {
        // Cleanup gracefully
      }
    }
  })

  it("returns 401 Unauthorized for /api/customers without session cookie or token", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    const res = await fetch(`${baseUrl}/api/customers`)
    assert.equal(res.status, 401)
  })

  it("creates customer via POST /api/customers with CSRF protection and tenant isolation", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    const res = await fetch(`${baseUrl}/api/customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Jignesh Shah",
        phone: "+91 98250 12345",
        email: "jignesh@example.com",
        city: "Vadodara",
        language: "gu",
        tags: ["vip", "group-leader"],
      }),
    })

    assert.equal(res.status, 201)
    const data = await res.json()
    assert.equal(data.name, "Jignesh Shah")
    assert.equal(data.phone, "9825012345")
    assert.equal(data.language, "gu")
    assert.deepEqual(data.tags, ["vip", "group-leader"])
    assert.equal(data.userId.toString(), userAId)
  })

  it("prevents duplicate phone number for the same tenant (409 Conflict)", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    const res = await fetch(`${baseUrl}/api/customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Jignesh Alternate",
        phone: "9825012345", // same phone
      }),
    })

    assert.equal(res.status, 409)
    const err = await res.json()
    assert.match(err.message, /already exists/i)
  })

  it("enforces tenant isolation: User B can register the same phone without collision", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    const res = await fetch(`${baseUrl}/api/customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userBToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Beta Pilgrim",
        phone: "9825012345", // same phone under User B
      }),
    })

    assert.equal(res.status, 201)
    const data = await res.json()
    assert.equal(data.userId.toString(), userBId)
  })

  it("lookup route GET /api/customers/lookup?phone= returns profile without Aadhaar", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    const res = await fetch(`${baseUrl}/api/customers/lookup?phone=%2B91%2098250%2012345`, {
      headers: {
        Authorization: `Bearer ${userAToken}`,
      },
    })

    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.found, true)
    assert.equal(data.customer.name, "Jignesh Shah")
    assert.equal(data.customer.phone, "9825012345")
    // Ensure zero Aadhaar or PII leakage
    assert.equal(data.customer.aadhar, undefined)
    assert.equal(data.customer.passengers, undefined)
  })

  it("soft-deletes customer and allows re-registering phone afterwards", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    // Find customer created for User A
    const cust = await Customer.findOne({ userId: userAId, phone: "9825012345", deletedAt: null })
    assert.ok(cust)

    // Soft delete
    const delRes = await fetch(`${baseUrl}/api/customers/${cust._id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${userAToken}`,
      },
    })
    assert.equal(delRes.status, 200)

    // Verify deletedAt is set
    const archived = await Customer.findById(cust._id)
    assert.ok(archived.deletedAt)

    // User A can now create a customer with that same phone again (partial unique index)
    const reCreateRes = await fetch(`${baseUrl}/api/customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Jignesh Shah New",
        phone: "9825012345",
      }),
    })
    assert.equal(reCreateRes.status, 201)
  })
})
