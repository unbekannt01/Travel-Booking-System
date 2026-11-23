import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import mongoose from "../backend/node_modules/mongoose/index.js"
import jwt from "../backend/node_modules/jsonwebtoken/index.js"
import bcrypt from "../backend/node_modules/bcryptjs/index.js"

const TEST_DB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub_test"
const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-for-reminders-integration-2026"

process.env.NODE_ENV = "test"
process.env.JWT_SECRET = JWT_SECRET

let app
let server
let baseUrl
let isMongoAvailable = false

let User
let Booking
let Customer
let ReminderTemplate
let ReminderLog
let AuditLog

describe("Integration Harness: Real Express App against yatrahub_test (Reminders & Templates)", () => {
  let userAId
  let userBId
  let userAToken
  let userBToken
  let customerAId
  let customerOptedOutId
  let customerInvalidPhoneId
  let customerPaidId
  let bookingA1Id

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
    ReminderTemplate = (await import("../backend/models/ReminderTemplate.js")).default
    ReminderLog = (await import("../backend/models/ReminderLog.js")).default
    AuditLog = (await import("../backend/models/AuditLog.js")).default

    // Import real app
    const appModule = await import("../backend/index.js")
    app = appModule.app || appModule.default

    // Start server on ephemeral port
    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port
    baseUrl = `http://127.0.0.1:${port}`

    // Clean test collections for test users
    await User.deleteMany({ email: { $in: ["usera_rem@test.local", "userb_rem@test.local"] } })

    // Create User A
    const passwordHash = await bcrypt.hash("Password123!@#", 10)
    const userA = await User.create({
      userName: "Operator Alpha",
      email: "usera_rem@test.local",
      password: passwordHash,
      role: "admin",
      tokenVersion: 1,
      companyName: "Somnath Travels",
      companyPhone: "9876543210",
      bankDetails: { upiId: "somnath@upi" },
    })
    userAId = userA._id.toString()
    userAToken = jwt.sign({ id: userAId, tokenVersion: 1 }, JWT_SECRET, { expiresIn: "1h" })

    // Create User B (for tenant isolation tests)
    const userB = await User.create({
      userName: "Operator Beta",
      email: "userb_rem@test.local",
      password: passwordHash,
      role: "admin",
      tokenVersion: 1,
      companyName: "Dwarka Yatra",
    })
    userBId = userB._id.toString()
    userBToken = jwt.sign({ id: userBId, tokenVersion: 1 }, JWT_SECRET, { expiresIn: "1h" })

    // Create customers for User A
    const custA = await Customer.create({
      userId: userA._id,
      name: "Rameshbhai Patel",
      phone: "9876543210",
      language: "gu",
      whatsappOptOut: false,
    })
    customerAId = custA._id.toString()

    const custOptedOut = await Customer.create({
      userId: userA._id,
      name: "Dineshbhai Shah",
      phone: "9825012345",
      language: "hi",
      whatsappOptOut: true,
    })
    customerOptedOutId = custOptedOut._id.toString()

    const custInvalidPhoneRes = await Customer.collection.insertOne({
      userId: userA._id,
      name: "Non Indian Phone",
      phone: "1234567890", // invalid starting digit for Indian mobile
      language: "en",
      whatsappOptOut: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    customerInvalidPhoneId = custInvalidPhoneRes.insertedId.toString()

    const custPaid = await Customer.create({
      userId: userA._id,
      name: "Fully Paid Customer",
      phone: "9898989898",
      language: "en",
      whatsappOptOut: false,
    })
    customerPaidId = custPaid._id.toString()

    // Create bookings
    // Booking 1 for Customer A: ₹10,000 total, ₹4,000 paid -> ₹6,000 outstanding
    const b1 = await Booking.create({
      userId: userA._id,
      customerId: custA._id,
      bookingId: "BK-REM-001",
      invoiceNo: "INV-2026-001",
      customerName: custA.name,
      contactName: custA.name,
      contactPhone: custA.phone,
      tourName: "Somnath Special",
      date: "2026-11-20",
      journeyDate: "2026-11-28",
      totalAmount: 10000,
      advanceReceived: 4000,
      isPaid: false,
      status: "Confirmed",
      payments: [{ type: "cash", amount: 4000, isVoid: false }],
    })
    bookingA1Id = b1._id.toString()

    // Fully paid booking for customerPaid
    await Booking.create({
      userId: userA._id,
      customerId: custPaid._id,
      bookingId: "BK-REM-002",
      invoiceNo: "INV-2026-002",
      customerName: custPaid.name,
      contactName: custPaid.name,
      contactPhone: custPaid.phone,
      tourName: "Dwarka Darshan",
      date: "2026-11-20",
      journeyDate: "2026-11-29",
      totalAmount: 5000,
      advanceReceived: 5000,
      isPaid: true,
      status: "Confirmed",
      payments: [{ type: "cash", amount: 5000, isVoid: false }],
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
        await User.deleteMany({ email: { $in: ["usera_rem@test.local", "userb_rem@test.local"] } })
        if (userAId && userBId) {
          await Customer.deleteMany({ userId: { $in: [userAId, userBId] } })
          await Booking.deleteMany({ userId: { $in: [userAId, userBId] } })
          await ReminderTemplate.deleteMany({ userId: { $in: [userAId, userBId] } })
          await ReminderLog.deleteMany({ userId: { $in: [userAId, userBId] } })
          await AuditLog.deleteMany({ userId: { $in: [userAId, userBId] } })
        }
        await mongoose.disconnect()
      } catch {
        // Cleanup gracefully
      }
    }
  })

  it("returns 401 Unauthorized for /api/reminder-templates without token", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    const res = await fetch(`${baseUrl}/api/reminder-templates`)
    assert.equal(res.status, 401)
  })

  it("GET /api/reminder-templates returns all 9 templates with isCustom: false initially", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    const res = await fetch(`${baseUrl}/api/reminder-templates`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(data.templates)
    assert.ok(data.templates.en?.friendly)
    assert.ok(data.templates.hi?.["due-soon"])
    assert.ok(data.templates.gu?.overdue)
    assert.equal(data.templates.gu.overdue.isCustom, false)
  })

  it("PUT /api/reminder-templates/:language/:tone validates and saves custom template", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    // 1. Invalid placeholder test -> 400
    const badRes = await fetch(`${baseUrl}/api/reminder-templates/gu/friendly`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: "નમસ્તે {unknownTag}, બાકી છે {balance}" }),
    })
    assert.equal(badRes.status, 400)

    // 2. Valid template save
    const goodBody = "નમસ્તે {customerName}, {companyName} તરફથી. આપની {tourName} યાત્રાનું બાકી રકમ {balance} છે. કૃપા કરીને જલ્દી ચૂકવો. આભાર!"
    const goodRes = await fetch(`${baseUrl}/api/reminder-templates/gu/friendly`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: goodBody }),
    })
    assert.equal(goodRes.status, 200)
    const goodData = await goodRes.json()
    assert.equal(goodData.success, true)
    assert.equal(goodData.template.isCustom, true)
    assert.equal(goodData.template.body, goodBody)

    // Verify DB record
    const saved = await ReminderTemplate.findOne({
      userId: userAId,
      language: "gu",
      tone: "friendly",
    }).lean()
    assert.ok(saved)
    assert.equal(saved.body, goodBody)

    // Verify tenant isolation: User B still has default template
    const userBRes = await fetch(`${baseUrl}/api/reminder-templates`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    })
    const userBData = await userBRes.json()
    assert.equal(userBData.templates.gu.friendly.isCustom, false)
    assert.notEqual(userBData.templates.gu.friendly.body, goodBody)
  })

  it("DELETE /api/reminder-templates/:language/:tone resets template to default", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    const res = await fetch(`${baseUrl}/api/reminder-templates/gu/friendly`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.equal(data.template.isCustom, false)

    // Verify removed from DB
    const deleted = await ReminderTemplate.findOne({
      userId: userAId,
      language: "gu",
      tone: "friendly",
    }).lean()
    assert.equal(deleted, null)
  })

  it("POST /api/reminders rejects opted-out customer with 409 Conflict", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    const res = await fetch(`${baseUrl}/api/reminders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: customerOptedOutId,
        tone: "friendly",
        language: "hi",
        templateSource: "default",
      }),
    })
    assert.equal(res.status, 409)
    const data = await res.json()
    assert.match(data.message, /opted out/i)
  })

  it("POST /api/reminders rejects invalid phone with 422 Unprocessable Entity", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    const res = await fetch(`${baseUrl}/api/reminders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: customerInvalidPhoneId,
        tone: "friendly",
        language: "en",
        templateSource: "default",
      }),
    })
    assert.equal(res.status, 422)
    const data = await res.json()
    assert.match(data.message, /invalid Indian mobile/i)
  })

  it("POST /api/reminders rejects zero outstanding balance with 409 Conflict", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    const res = await fetch(`${baseUrl}/api/reminders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: customerPaidId,
        tone: "friendly",
        language: "en",
        templateSource: "default",
      }),
    })
    assert.equal(res.status, 409)
    const data = await res.json()
    assert.match(data.message, /No outstanding balance/i)
  })

  let createdReminderId
  it("POST /api/reminders creates log with server-calculated balance and privacy guarantees", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    const res = await fetch(`${baseUrl}/api/reminders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: customerAId,
        bookingIds: [bookingA1Id],
        tone: "due-soon",
        language: "gu",
        templateSource: "default",
      }),
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(data.id)
    assert.equal(data.status, "opened")
    assert.equal(data.amount, 6000) // ₹10,000 - ₹4,000 = ₹6,000 recomputed server-side
    createdReminderId = data.id

    // STRICT PRIVACY CHECK: Check MongoDB ReminderLog document directly
    const logDoc = await ReminderLog.findById(data.id).lean()
    assert.ok(logDoc)
    assert.equal(logDoc.amount, 6000)
    assert.equal(logDoc.status, "opened")
    // Assert NO message text or phone number stored
    assert.equal(logDoc.messageText, undefined)
    assert.equal(logDoc.body, undefined)
    assert.equal(logDoc.text, undefined)
    assert.equal(logDoc.phone, undefined)
    assert.equal(logDoc.mobile, undefined)

    // STRICT PRIVACY CHECK: Check AuditLog document directly
    const auditDoc = await AuditLog.findOne({
      userId: userAId,
      action: "reminder_prepared",
    }).sort({ _id: -1 }).lean()
    assert.ok(auditDoc)
    assert.equal(auditDoc.meta.customerId, customerAId)
    assert.equal(auditDoc.meta.amount, 6000)
    assert.equal(auditDoc.meta.phone, undefined)
    assert.equal(auditDoc.meta.text, undefined)
    assert.equal(auditDoc.meta.body, undefined)
  })

  it("POST /api/reminders/:id/sent marks status as sent with tenant isolation", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    // User B attempt -> 404
    const resB = await fetch(`${baseUrl}/api/reminders/${createdReminderId}/sent`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userBToken}` },
    })
    assert.equal(resB.status, 404)

    // User A attempt -> 200
    const resA = await fetch(`${baseUrl}/api/reminders/${createdReminderId}/sent`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(resA.status, 200)
    const data = await resA.json()
    assert.equal(data.success, true)
    assert.equal(data.reminder.status, "sent")
    assert.ok(data.reminder.markedSentAt)

    // Verify DB
    const updated = await ReminderLog.findById(createdReminderId).lean()
    assert.equal(updated.status, "sent")
    assert.ok(updated.markedSentAt)
  })

  it("GET /api/reminders returns chronological logs for tenant", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    const res = await fetch(`${baseUrl}/api/reminders?customerId=${customerAId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(Array.isArray(data.reminders))
    assert.equal(data.reminders.length, 1)
    assert.equal(data.reminders[0].id, createdReminderId)
    assert.equal(data.reminders[0].status, "sent")
  })

  it("verifies 400-day TTL index on ReminderLog", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    const indexes = await ReminderLog.collection.indexes()
    const ttlIndex = indexes.find((idx) => idx.expireAfterSeconds !== undefined)
    assert.ok(ttlIndex, "Expected TTL index on ReminderLog")
    assert.equal(ttlIndex.expireAfterSeconds, 400 * 24 * 60 * 60)
  })

  it("GET /api/reports/outstanding enriches customers with lastReminderAt and reminderCount30d", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    const res = await fetch(`${baseUrl}/api/reports/outstanding`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(Array.isArray(data.customers))
    const custAEntry = data.customers.find((c) => c.customerId === customerAId)
    assert.ok(custAEntry)
    assert.ok(custAEntry.lastReminderAt)
    assert.equal(custAEntry.reminderCount30d, 1)
    assert.equal(custAEntry.language, "gu")
    assert.equal(custAEntry.whatsappOptOut, false)
  })

  it("GET /api/customers/:id includes last 5 reminders", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB not running")

    const res = await fetch(`${baseUrl}/api/customers/${customerAId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(Array.isArray(data.reminders))
    assert.equal(data.reminders.length, 1)
    assert.equal(data.reminders[0].id, createdReminderId)
    assert.equal(data.reminders[0].status, "sent")
  })
})
