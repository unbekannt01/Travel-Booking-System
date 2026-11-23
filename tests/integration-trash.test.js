import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import mongoose from "../backend/node_modules/mongoose/index.js"
import jwt from "../backend/node_modules/jsonwebtoken/index.js"
import bcrypt from "../backend/node_modules/bcryptjs/index.js"

const TEST_DB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub_test"
const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-for-trash-integration-2026"

process.env.NODE_ENV = "test"
process.env.JWT_SECRET = JWT_SECRET

let app
let server
let baseUrl
let isMongoAvailable = false

let User
let Booking
let Expense
let Customer
let CashEntry
let BooksClose
let RecordHistory

describe("Integration Harness: Real Express App against yatrahub_test (Part 6b: Trash & History)", () => {
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
    Expense = (await import("../backend/models/Expense.js")).default
    Customer = (await import("../backend/models/Customer.js")).default
    CashEntry = (await import("../backend/models/CashEntry.js")).default
    BooksClose = (await import("../backend/models/BooksClose.js")).default
    RecordHistory = (await import("../backend/models/RecordHistory.js")).default

    const appModule = await import("../backend/index.js")
    app = appModule.app || appModule.default

    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port
    baseUrl = `http://127.0.0.1:${port}`

    // Cleanup past test data strictly scoped to this test suite's users
    const existingUsers = await User.find({ email: /trash_test_/ }).select("_id").lean()
    const existingIds = existingUsers.map((u) => u._id)
    if (existingIds.length > 0) {
      await Booking.deleteMany({ userId: { $in: existingIds } })
      await Expense.deleteMany({ userId: { $in: existingIds } })
      await Customer.deleteMany({ userId: { $in: existingIds } })
      await CashEntry.deleteMany({ userId: { $in: existingIds } })
      await BooksClose.deleteMany({ userId: { $in: existingIds } })
      await RecordHistory.deleteMany({ userId: { $in: existingIds } })
      await User.deleteMany({ _id: { $in: existingIds } })
    }

    // Seed test user A
    const hashedPassword = await bcrypt.hash(rawPassword, 10)
    const userA = await User.create({
      userName: "Trash Operator A",
      email: "trash_test_a@example.com",
      password: hashedPassword,
      companyName: "Somnath Travels",
      companyPhone: "9825012345",
    })
    userAId = userA._id
    userAToken = jwt.sign({ id: userAId.toString(), email: userA.email }, JWT_SECRET, {
      expiresIn: "1h",
    })

    // Seed test user B (for tenant isolation)
    const userB = await User.create({
      userName: "Trash Operator B",
      email: "trash_test_b@example.com",
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
        await Expense.deleteMany({ userId: { $in: ids } })
        await Customer.deleteMany({ userId: { $in: ids } })
        await CashEntry.deleteMany({ userId: { $in: ids } })
        await BooksClose.deleteMany({ userId: { $in: ids } })
        await RecordHistory.deleteMany({ userId: { $in: ids } })
        await User.deleteMany({ _id: { $in: ids } })
      }
      await mongoose.disconnect()
    }
  })

  it("1. Trash & History lifecycle: Customer create, update, delete, history inspection, and restore", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    // Create customer
    const createRes = await fetch(`${baseUrl}/api/customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "TrashTest Customer",
        phone: "9988771122",
        city: "Surat",
      }),
    })
    assert.equal(createRes.status, 201)
    const customer = await createRes.json()
    const customerId = customer._id || customer.id

    // Update customer name & city
    const updateRes = await fetch(`${baseUrl}/api/customers/${customerId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "TrashTest Customer Renamed",
        city: "Vadodara",
      }),
    })
    assert.equal(updateRes.status, 200)

    // Soft delete customer
    const deleteRes = await fetch(`${baseUrl}/api/customers/${customerId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(deleteRes.status, 200)

    // Inspect history
    const historyRes = await fetch(`${baseUrl}/api/history?entityType=customer&entityId=${customerId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(historyRes.status, 200)
    const historyData = await historyRes.json()
    assert.ok(Array.isArray(historyData.history))
    assert.ok(historyData.history.length >= 3) // created, updated, deleted

    const updateEvent = historyData.history.find((h) => h.action === "updated")
    assert.ok(updateEvent)
    // PRIVACY VERIFICATION: no leaked values in changes array
    for (const ch of updateEvent.changes) {
      assert.equal(ch.kind, "text")
      assert.equal(ch.changed, true)
      assert.equal(ch.from, undefined)
      assert.equal(ch.to, undefined)
    }

    // Inspect trash
    const trashRes = await fetch(`${baseUrl}/api/trash?type=customer`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(trashRes.status, 200)
    const trashData = await trashRes.json()
    assert.equal(trashData.counts.customer, 1)
    const itemInTrash = trashData.items.find((i) => i._id === customerId)
    assert.ok(itemInTrash)
    assert.equal(itemInTrash.restore.allowed, true)

    // Restore customer
    const restoreRes = await fetch(`${baseUrl}/api/trash/customer/${customerId}/restore`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(restoreRes.status, 200)
    const restoreData = await restoreRes.json()
    assert.equal(restoreData.success, true)

    // Verify customer is active again
    const activeCustomer = await Customer.findById(customerId)
    assert.equal(activeCustomer.deletedAt, null)
  })

  it("2. Restore collision prevention: Rejects customer restore with 409 when phone collides", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    // Create customer 1 and delete it
    const c1Res = await fetch(`${baseUrl}/api/customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Old Person",
        phone: "9988771133",
        city: "Rajkot",
      }),
    })
    assert.equal(c1Res.status, 201)
    const c1 = await c1Res.json()
    const c1Id = c1._id || c1.id

    await fetch(`${baseUrl}/api/customers/${c1Id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${userAToken}` },
    })

    // Now create customer 2 with the SAME phone number while customer 1 is in trash
    const c2Res = await fetch(`${baseUrl}/api/customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "New Person With Same Phone",
        phone: "9988771133",
        city: "Rajkot",
      }),
    })
    assert.equal(c2Res.status, 201)

    // Attempt to restore customer 1 -> 409 Conflict!
    const conflictRestoreRes = await fetch(`${baseUrl}/api/trash/customer/${c1Id}/restore`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(conflictRestoreRes.status, 409)
    const conflictData = await conflictRestoreRes.json()
    assert.ok(conflictData.reasons.includes("NUMBER_CONFLICT"))
  })

  it("3. Books lock enforcement on restore: Rejects restore with 423 when booking has money in closed period", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    // Close books up to 2026-11-10
    await BooksClose.create({
      userId: userAId,
      closedUpTo: "2026-11-10",
      status: "active",
      closedAt: new Date(),
      countedCash: 5000,
      systemCash: 5000,
      systemBank: 10000,
      difference: 0,
      closedBy: userAId,
    })

    // Create a booking on 2026-11-15 (open date) with advance, then delete it
    const bookingRes = await fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contactName: "Locked Restore Traveler",
        contactPhone: "9988771144",
        tourName: "Somnath Yatra",
        journeyDate: "2026-11-20",
        date: "2026-11-05", // closed period! with advance 0 initially
        totalAmount: 3000,
        advanceReceived: 0,
        passengers: [{ name: "Traveler One", age: 30, gender: "Male", city: "Surat" }],
      }),
    })
    assert.equal(bookingRes.status, 201)
    const booking = await bookingRes.json()
    const bId = booking._id

    // Soft delete this booking
    await fetch(`${baseUrl}/api/bookings/${bId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${userAToken}` },
    })

    // Manually set advance on the deleted booking to simulate historical paid booking in closed period
    await Booking.updateOne({ _id: bId }, { $set: { advanceReceived: 1500 } })

    // Attempt to restore -> should return 423 Locked!
    const lockedRestoreRes = await fetch(`${baseUrl}/api/trash/booking/${bId}/restore`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(lockedRestoreRes.status, 423)
    const lockedData = await lockedRestoreRes.json()
    assert.ok(lockedData.reasons.includes("BOOKS_LOCKED"))
    assert.equal(lockedData.message, "Books are closed up to 10-11-2026. Reopen the books to change this.")
  })

  it("4. Tenant isolation: User B cannot view User A's trash items or history", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    // User B fetches trash
    const trashBRes = await fetch(`${baseUrl}/api/trash`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    })
    assert.equal(trashBRes.status, 200)
    const trashBData = await trashBRes.json()
    assert.equal(trashBData.items.length, 0)
    assert.equal(trashBData.counts.all, 0)

    // User B attempts to restore User A's item -> 404
    const anyUserAItem = await Customer.findOne({ userId: userAId, deletedAt: { $ne: null } })
    if (anyUserAItem) {
      const hijackRes = await fetch(`${baseUrl}/api/trash/customer/${anyUserAItem._id}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userBToken}` },
      })
      assert.equal(hijackRes.status, 404)
    }
  })
})
