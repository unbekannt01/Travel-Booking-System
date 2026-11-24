import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import mongoose from "../backend/node_modules/mongoose/index.js"
import jwt from "../backend/node_modules/jsonwebtoken/index.js"
import bcrypt from "../backend/node_modules/bcryptjs/index.js"

const TEST_DB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub_test"
const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-for-import-undo-2026"

process.env.NODE_ENV = "test"
process.env.JWT_SECRET = JWT_SECRET

let app
let server
let baseUrl
let isMongoAvailable = false

let User
let Expense
let ImportBatch
let BooksClose

describe("Integration: Non-Atomic Chunked Commit & Granular Per-Row Undo (Part 6c-fix)", () => {
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
    Expense = (await import("../backend/models/Expense.js")).default
    ImportBatch = (await import("../backend/models/ImportBatch.js")).default
    BooksClose = (await import("../backend/models/BooksClose.js")).default

    const appModule = await import("../backend/index.js")
    app = appModule.app || appModule.default

    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`

    await User.deleteMany({ email: "importundo@yatrahub.in" })
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash("Password123!", salt)

    const user = await User.create({
      userName: "ImportUndoTester",
      email: "importundo@yatrahub.in",
      password: hashedPassword,
      companyName: "Gir Yatra Travels",
      companyPhone: "9825000000",
    })
    userId = user._id.toString()
    token = jwt.sign({ id: userId, email: user.email }, JWT_SECRET, { expiresIn: "1h" })

    await Expense.deleteMany({ userId })
    await ImportBatch.deleteMany({ userId })
    await BooksClose.deleteMany({ userId })
  })

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve))
    if (isMongoAvailable) {
      await Expense.deleteMany({ userId })
      await ImportBatch.deleteMany({ userId })
      await BooksClose.deleteMany({ userId })
      await User.deleteMany({ _id: userId })
      await mongoose.disconnect()
    }
  })

  it("commits expenses with status 'committed', handles subsequent books lock with partial revert", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    // 1. Prepare 3 expenses in open period
    const expenseCsv = `Date,Category,Amount,Vendor\n2026-11-12,fuel,1200,Petrol Pump A\n2026-11-15,toll,350,Fastag B\n2026-11-18,maintenance,2500,Garage C`

    const prevRes = await fetch(`${baseUrl}/api/import/expenses/preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ csvText: expenseCsv }),
    })
    assert.equal(prevRes.status, 200)
    const prevData = await prevRes.json()
    assert.equal(prevData.counts.valid, 3)

    // 2. Commit batch
    const commitRes = await fetch(`${baseUrl}/api/import/expenses/commit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        csvText: expenseCsv,
        token: prevData.token,
      }),
    })
    assert.equal(commitRes.status, 201)
    const commitData = await commitRes.json()
    assert.equal(commitData.success, true)
    assert.equal(commitData.counts.imported, 3)
    const batchId = commitData.batchId

    const batchDoc = await ImportBatch.findById(batchId)
    assert.equal(batchDoc.status, "committed")
    assert.equal(batchDoc.recordIds.length, 3)

    // 3. Close books up to 2026-11-14 (locking the 2026-11-12 expense)
    await BooksClose.create({
      userId,
      closedUpTo: "2026-11-14",
      countedCash: 1000,
      systemCash: 1000,
      systemBank: 2000,
      difference: 0,
      closedBy: userId,
      status: "active",
      closedAt: new Date(),
    })

    // 4. Request Undo on the batch
    const undoRes = await fetch(`${baseUrl}/api/import/batches/${batchId}/undo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(undoRes.status, 200)
    const undoData = await undoRes.json()

    // Status must be partially_reverted because 1 record was locked by closed books
    assert.equal(undoData.status, "partially_reverted")
    assert.equal(undoData.revertedCount, 2)
    assert.equal(undoData.summary.undone, 2)
    assert.equal(undoData.summary.booksLocked, 1)
    assert.equal(undoData.summary.alreadyDeleted, 0)

    // Verify 2 open expenses are soft-deleted, but locked one remains active
    const activeExpenses = await Expense.find({ importBatchId: batchId, deletedAt: null })
    assert.equal(activeExpenses.length, 1)
    assert.equal(activeExpenses[0].category, "fuel")

    // 5. Test idempotency: Calling undo again reports alreadyDeleted and locked
    const undoRes2 = await fetch(`${baseUrl}/api/import/batches/${batchId}/undo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(undoRes2.status, 200)
    const undoData2 = await undoRes2.json()
    assert.equal(undoData2.summary.undone, 0)
    assert.equal(undoData2.summary.alreadyDeleted, 2)
    assert.equal(undoData2.summary.booksLocked, 1)
  })
})
