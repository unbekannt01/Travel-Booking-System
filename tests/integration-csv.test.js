import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import mongoose from "../backend/node_modules/mongoose/index.js"
import jwt from "../backend/node_modules/jsonwebtoken/index.js"
import bcrypt from "../backend/node_modules/bcryptjs/index.js"

const TEST_DB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub_test"
const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-for-csv-integration-2026"

process.env.NODE_ENV = "test"
process.env.JWT_SECRET = JWT_SECRET

let app
let server
let baseUrl
let isMongoAvailable = false

let User
let Customer
let Expense
let Booking
let ImportBatch
let BooksClose

describe("Integration Harness: Real Express App against yatrahub_test (Part 6c: Export & Import)", () => {
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
    Customer = (await import("../backend/models/Customer.js")).default
    Expense = (await import("../backend/models/Expense.js")).default
    Booking = (await import("../backend/models/Booking.js")).default
    ImportBatch = (await import("../backend/models/ImportBatch.js")).default
    BooksClose = (await import("../backend/models/BooksClose.js")).default

    const appModule = await import("../backend/index.js")
    app = appModule.app || appModule.default

    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port
    baseUrl = `http://127.0.0.1:${port}`

    // Cleanup previous test state
    await User.deleteMany({ email: { $in: ["csva@yatrahub.in", "csvb@yatrahub.in"] } })

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(rawPassword, salt)

    const userA = await User.create({
      userName: "CsvTesterA",
      email: "csva@yatrahub.in",
      password: hashedPassword,
      companyName: "Somnath Yatra Travels",
      companyPhone: "9825000001",
    })
    userAId = userA._id.toString()
    userAToken = jwt.sign({ id: userAId, email: userA.email }, JWT_SECRET, { expiresIn: "1h" })

    const userB = await User.create({
      userName: "CsvTesterB",
      email: "csvb@yatrahub.in",
      password: hashedPassword,
      companyName: "Dwarka Tours",
      companyPhone: "9825000002",
    })
    userBId = userB._id.toString()
    userBToken = jwt.sign({ id: userBId, email: userB.email }, JWT_SECRET, { expiresIn: "1h" })

    await Customer.deleteMany({ userId: { $in: [userAId, userBId] } })
    await Expense.deleteMany({ userId: { $in: [userAId, userBId] } })
    await Booking.deleteMany({ userId: { $in: [userAId, userBId] } })
    await ImportBatch.deleteMany({ userId: { $in: [userAId, userBId] } })
    await BooksClose.deleteMany({ userId: { $in: [userAId, userBId] } })
  })

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
    if (isMongoAvailable) {
      await Customer.deleteMany({ userId: { $in: [userAId, userBId] } })
      await Expense.deleteMany({ userId: { $in: [userAId, userBId] } })
      await Booking.deleteMany({ userId: { $in: [userAId, userBId] } })
      await ImportBatch.deleteMany({ userId: { $in: [userAId, userBId] } })
      await BooksClose.deleteMany({ userId: { $in: [userAId, userBId] } })
      await User.deleteMany({ email: { $in: ["csva@yatrahub.in", "csvb@yatrahub.in"] } })
      await mongoose.disconnect()
    }
  })

  it("1. Authentication & Security: Export and Import endpoints reject unauthenticated requests with 401", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    const resExport = await fetch(`${baseUrl}/api/export/customers`)
    assert.equal(resExport.status, 401)

    const resPreview = await fetch(`${baseUrl}/api/import/customers/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csvText: "Name,Phone\nTest,9825012345" }),
    })
    assert.equal(resPreview.status, 401)

    const resBatches = await fetch(`${baseUrl}/api/import/batches`)
    assert.equal(resBatches.status, 401)
  })

  it("2. CSV Export: GET /api/export/:type produces UTF-8 BOM, formula injection defense, and tenant isolation", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    // Create a customer with formula injection trigger in note
    await Customer.create({
      userId: userAId,
      name: "Ramesh Patel",
      phone: "9825012345",
      city: "Surat",
      notes: "=SUM(A1:A10)",
    })

    // User A exports customers
    const resA = await fetch(`${baseUrl}/api/export/customers`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(resA.status, 200)
    assert.ok(resA.headers.get("content-type").includes("text/csv"))
    assert.ok(resA.headers.get("content-disposition").includes("yatrahub-customers-"))

    const arrayBufferA = await resA.arrayBuffer()
    const bytesA = new Uint8Array(arrayBufferA)
    assert.equal(bytesA[0], 0xEF, "First byte must be UTF-8 BOM EF")
    assert.equal(bytesA[1], 0xBB, "Second byte must be UTF-8 BOM BB")
    assert.equal(bytesA[2], 0xBF, "Third byte must be UTF-8 BOM BF")

    const textA = Buffer.from(arrayBufferA).toString("utf8")
    assert.ok(textA.includes("Ramesh Patel"), "Contains User A customer")
    assert.ok(textA.includes("'+12345") || textA.includes("9825012345"))
    assert.ok(textA.includes("'=SUM(A1:A10)"), "Formula injection must be sanitized with leading quote")

    // User B exports customers -> gets empty file with only headers
    const resB = await fetch(`${baseUrl}/api/export/customers`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    })
    assert.equal(resB.status, 200)
    const textB = await resB.text()
    assert.ok(!textB.includes("Ramesh Patel"), "Tenant isolation: User B must not see User A's data")
  })

  it("3. Import Preview: POST /api/import/:type/preview validates rows and rejects Aadhaar columns", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    // 1. Aadhaar column present -> 400
    const aadhaarCsv = `Name,Phone,Aadhaar\nRamesh,9825099991,123456789012`
    const badAadhaarRes = await fetch(`${baseUrl}/api/import/customers/preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ csvText: aadhaarCsv }),
    })
    assert.equal(badAadhaarRes.status, 400)
    const badAadhaarData = await badAadhaarRes.json()
    assert.equal(badAadhaarData.code, "UNSAFE_AADHAAR_COLUMN")

    // 2. Valid customer CSV preview
    const validCsv = `Customer Name,મોબાઈલ નંબર,City,Notes\nKetan Shah,9825011111,Surat,VIP client\nInvalid Phone,12345,Baroda,Bad\nJignesh,9825022222,Rajkot,Regular`
    const previewRes = await fetch(`${baseUrl}/api/import/customers/preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ csvText: validCsv, fileName: "test-customers.csv" }),
    })
    assert.equal(previewRes.status, 200)
    const previewData = await previewRes.json()
    assert.ok(previewData.token, "Must return preview token")
    assert.equal(previewData.counts.total, 3)
    assert.equal(previewData.counts.valid, 2)
    assert.equal(previewData.counts.invalid, 1)
    assert.equal(previewData.sampleValid.length, 2)
    assert.equal(previewData.sampleInvalid.length, 1)
    assert.ok(previewData.sampleInvalid[0].errors[0].includes("Invalid 10-digit"))
  })

  it("4. Import Commit & Undo Lifecycle: Commit creates records & batch; Undo soft-deletes with lock check", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    const importCsv = `Name,Phone,City\nDeepak Patel,9825033333,Ahmedabad\nMahesh Bhai,9825044444,Bhavnagar`

    // Preview first to get token
    const prevRes = await fetch(`${baseUrl}/api/import/customers/preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ csvText: importCsv }),
    })
    assert.equal(prevRes.status, 200)
    const { token } = await prevRes.json()

    // Commit import
    const commitRes = await fetch(`${baseUrl}/api/import/customers/commit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        csvText: importCsv,
        token,
        fileName: "batch-cust.csv",
      }),
    })
    assert.equal(commitRes.status, 201)
    const commitData = await commitRes.json()
    assert.equal(commitData.success, true)
    assert.equal(commitData.counts.imported, 2)
    const batchId = commitData.batchId

    // Verify records created in DB with importBatchId
    const importedCusts = await Customer.find({ importBatchId: batchId })
    assert.equal(importedCusts.length, 2)
    assert.equal(importedCusts[0].source, "import")

    // Verify batch listed in GET /api/import/batches
    const batchesRes = await fetch(`${baseUrl}/api/import/batches`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(batchesRes.status, 200)
    const batchesData = await batchesRes.json()
    assert.ok(batchesData.batches.some((b) => b._id === batchId))

    // Now test Undo
    const undoRes = await fetch(`${baseUrl}/api/import/batches/${batchId}/undo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userAToken}` },
    })
    assert.equal(undoRes.status, 200)
    const undoData = await undoRes.json()
    assert.equal(undoData.status, "reverted")
    assert.equal(undoData.revertedCount, 2)

    // Verify records are soft-deleted
    const activeAfterUndo = await Customer.find({ importBatchId: batchId, deletedAt: null })
    assert.equal(activeAfterUndo.length, 0)
  })

  it("5. Expense Import Books Lock Guard: Rejects expenses in closed books period during preview and commit", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    // Close books up to 2026-11-10 for User A
    await BooksClose.create({
      userId: userAId,
      closedUpTo: "2026-11-10",
      countedCash: 5000,
      systemCash: 5000,
      systemBank: 10000,
      difference: 0,
      closedBy: userAId,
      status: "active",
      closedAt: new Date(),
    })

    const expenseCsv = `Date,Category,Amount,Vendor\n2026-11-05,fuel,1500,Closed Period Petrol\n2026-11-20,toll,450,Open Fastag`

    const expPrevRes = await fetch(`${baseUrl}/api/import/expenses/preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ csvText: expenseCsv }),
    })
    assert.equal(expPrevRes.status, 200)
    const expPrevData = await expPrevRes.json()

    // 2026-11-05 must be flagged invalid because books are closed up to 2026-11-10!
    assert.equal(expPrevData.counts.valid, 1)
    assert.equal(expPrevData.counts.invalid, 1)
    assert.ok(expPrevData.sampleInvalid[0].errors[0].includes("closed books period"))

    // Commit only imports the 1 valid open expense
    const commitExpRes = await fetch(`${baseUrl}/api/import/expenses/commit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        csvText: expenseCsv,
        token: expPrevData.token,
      }),
    })
    assert.equal(commitExpRes.status, 201)
    const commitExpData = await commitExpRes.json()
    assert.equal(commitExpData.counts.imported, 1)
    assert.equal(commitExpData.counts.skipped, 1)
  })
})
