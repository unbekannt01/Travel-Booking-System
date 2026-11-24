import express from "express"
import rateLimit from "express-rate-limit"
import crypto from "crypto"
import verifyToken from "../middleware/auth.js"
import ImportBatch from "../models/ImportBatch.js"
import Customer from "../models/Customer.js"
import Expense from "../models/Expense.js"
import Booking from "../models/Booking.js"
import { logAudit } from "../models/AuditLog.js"
import {
  parseCsv,
  mapHeaders,
  parseMoney,
  parseDate,
  parseBool,
  CUSTOMER_IMPORT_SPEC,
  EXPENSE_IMPORT_SPEC,
  matchExpenseCategory,
  matchExpensePaymentMode,
} from "../../shared/csv.js"
import { normalizeIndianMobile } from "../../shared/customers.js"
import { getEffectiveLockDate, formatLockDateDisplay } from "../utils/booksLock.js"

const router = express.Router()

const importPreviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: "Too many import preview requests. Please try again later." },
})

const importCommitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: "Too many import commit requests. Please try again later." },
})

const importUndoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many import undo requests. Please try again later." },
})

const HMAC_SECRET = process.env.JWT_SECRET || "yatrahub-import-token-secret-key-2026"

function generatePreviewToken(userId, type, contentHash, expiry) {
  const payload = `${userId}:${type}:${contentHash}:${expiry}`
  const signature = crypto.createHmac("sha256", HMAC_SECRET).update(payload).digest("hex")
  return `${signature}.${expiry}`
}

function verifyPreviewToken(tokenWithExpiry, userId, type, contentHash) {
  if (!tokenWithExpiry || typeof tokenWithExpiry !== "string") return false
  const parts = tokenWithExpiry.split(".")
  if (parts.length !== 2) return false
  const [signature, expiryStr] = parts
  const expiry = parseInt(expiryStr, 10)
  if (isNaN(expiry) || Date.now() > expiry) return false

  const expectedPayload = `${userId}:${type}:${contentHash}:${expiry}`
  const expectedSignature = crypto.createHmac("sha256", HMAC_SECRET).update(expectedPayload).digest("hex")
  if (signature.length !== expectedSignature.length) return false
  return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"))
}

/**
 * GET /api/import/batches
 * Returns the latest 20 import batches for the authenticated operator.
 */
router.get("/batches", verifyToken, async (req, res) => {
  try {
    const batches = await ImportBatch.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    res.json({ batches })
  } catch (error) {
    console.error("Fetch import batches error:", error.name)
    res.status(500).json({ message: "Failed to fetch import batches." })
  }
})

/**
 * POST /api/import/:type/preview
 * Parses CSV, maps headers, validates data, evaluates books lock, and returns validation summary with token.
 */
router.post("/:type/preview", verifyToken, importPreviewLimiter, async (req, res) => {
  try {
    const { type } = req.params
    const { csvText, fileName = "", mapping: customMapping = null } = req.body
    const userId = req.user.id

    if (type !== "customers" && type !== "expenses") {
      return res.status(400).json({ message: `Import is only supported for 'customers' and 'expenses', not '${type}'.` })
    }

    if (!csvText || typeof csvText !== "string" || csvText.trim().length === 0) {
      return res.status(400).json({ message: "CSV content cannot be empty." })
    }

    let parsed
    try {
      parsed = parseCsv(csvText, { maxBytes: 1500000, maxRows: 2000, maxCols: 30, maxCell: 500 })
    } catch (parseErr) {
      return res.status(400).json({
        message: parseErr.message,
        code: parseErr.code || "PARSE_ERROR",
      })
    }

    const spec = type === "customers" ? CUSTOMER_IMPORT_SPEC : EXPENSE_IMPORT_SPEC
    const headerMapping = mapHeaders(parsed.headers, spec)

    if (headerMapping.hasUnsafeAadhaarHeader) {
      return res.status(400).json({
        message: "CSV contains an Aadhaar or UID column. For privacy and security reasons, Aadhaar numbers are never imported.",
        code: "UNSAFE_AADHAAR_COLUMN",
      })
    }

    const effectiveMapping = customMapping && typeof customMapping === "object"
      ? { ...headerMapping.mapping, ...customMapping }
      : headerMapping.mapping

    // Missing required fields check
    const missingRequired = []
    for (const [fieldKey, fieldDef] of Object.entries(spec.fields)) {
      if (fieldDef.required && !Object.values(effectiveMapping).includes(fieldKey)) {
        missingRequired.push(fieldKey)
      }
    }

    if (missingRequired.length > 0) {
      return res.status(400).json({
        message: `Missing required column mapping for: ${missingRequired.join(", ")}`,
        code: "MISSING_REQUIRED_COLUMNS",
        missingRequired,
        effectiveMapping,
        headers: parsed.headers,
      })
    }

    // Invert mapping for quick lookup: { fieldKey: csvHeader }
    const fieldToHeader = {}
    for (const [csvHeader, fieldKey] of Object.entries(effectiveMapping)) {
      fieldToHeader[fieldKey] = csvHeader
    }

    const lockDate = await getEffectiveLockDate(userId)
    const validRows = []
    const invalidRows = []
    const seenPhonesInFile = new Set()

    // For customers, check existing phone numbers in DB for deduplication
    let existingPhonesInDb = new Set()
    if (type === "customers") {
      const activeCustomers = await Customer.find({ userId, deletedAt: null }).select("phone").lean()
      existingPhonesInDb = new Set(activeCustomers.map((c) => c.phone))
    }

    parsed.rows.forEach((row, idx) => {
      const rowNum = idx + 2 // 1-based index including header row
      const errors = []

      if (type === "customers") {
        const rawName = row[fieldToHeader.name] || ""
        const cleanName = String(rawName).trim()
        if (cleanName.length < 2) {
          errors.push("Customer Name must be at least 2 characters")
        } else if (cleanName.length > 120) {
          errors.push("Customer Name cannot exceed 120 characters")
        }

        const rawPhone = row[fieldToHeader.phone] || ""
        const phoneNorm = normalizeIndianMobile(rawPhone)
        if (!phoneNorm.valid) {
          errors.push(`Invalid 10-digit Indian mobile number: '${rawPhone}'`)
        } else if (seenPhonesInFile.has(phoneNorm.normalized)) {
          errors.push(`Duplicate mobile number '${phoneNorm.normalized}' in file`)
        }

        const rawCity = row[fieldToHeader.city] || ""
        const rawEmail = row[fieldToHeader.email] || ""
        const rawEmergency = row[fieldToHeader.emergencyContact] || ""
        const rawBlood = row[fieldToHeader.bloodGroup] || ""
        const rawNotes = row[fieldToHeader.notes] || ""
        const rawOptOut = row[fieldToHeader.whatsappOptOut] || ""

        if (errors.length === 0) {
          seenPhonesInFile.add(phoneNorm.normalized)
          const isExisting = existingPhonesInDb.has(phoneNorm.normalized)
          validRows.push({
            rowNumber: rowNum,
            isExisting,
            data: {
              name: cleanName,
              phone: phoneNorm.normalized,
              city: String(rawCity).trim().slice(0, 100),
              email: String(rawEmail).trim().slice(0, 254),
              emergencyContact: String(rawEmergency).trim().slice(0, 20),
              bloodGroup: String(rawBlood).trim().toUpperCase(),
              notes: String(rawNotes).trim().slice(0, 1000),
              whatsappOptOut: parseBool(rawOptOut, false),
            },
          })
        } else {
          invalidRows.push({
            rowNumber: rowNum,
            errors,
            raw: row,
          })
        }
      } else if (type === "expenses") {
        const rawDate = row[fieldToHeader.date] || ""
        const parsedDateStr = parseDate(rawDate)
        if (!parsedDateStr) {
          errors.push(`Invalid date format '${rawDate}'. Expected YYYY-MM-DD or DD-MM-YYYY`)
        } else if (lockDate && parsedDateStr <= lockDate) {
          errors.push(`Date ${parsedDateStr} is in closed books period (locked up to ${formatLockDateDisplay(lockDate)})`)
        }

        const rawAmount = row[fieldToHeader.amount] || ""
        const moneyParsed = parseMoney(rawAmount)
        if (!moneyParsed.valid || moneyParsed.paise <= 0) {
          errors.push(`Invalid amount '${rawAmount}'. Must be a positive currency value`)
        }

        const rawCategory = row[fieldToHeader.category] || ""
        const categoryId = matchExpenseCategory(rawCategory)

        const rawAccount = row[fieldToHeader.account] || ""
        const normAccount = String(rawAccount).toLowerCase().includes("bank") ? "bank" : "cash"

        const rawMode = row[fieldToHeader.paymentMode] || ""
        const paymentMode = matchExpensePaymentMode(rawMode)

        const rawVendor = row[fieldToHeader.vendor] || ""
        const rawNotes = row[fieldToHeader.notes] || ""

        if (errors.length === 0) {
          validRows.push({
            rowNumber: rowNum,
            data: {
              date: parsedDateStr,
              amount: moneyParsed.paise / 100, // Rupees in DB
              category: categoryId,
              account: normAccount,
              paymentMode,
              vendor: String(rawVendor).trim().slice(0, 80),
              note: String(rawNotes).trim().slice(0, 300),
              status: "paid",
            },
          })
        } else {
          invalidRows.push({
            rowNumber: rowNum,
            errors,
            raw: row,
          })
        }
      }
    })

    const contentHash = crypto.createHash("sha256").update(csvText).digest("hex")
    const expiry = Date.now() + 15 * 60 * 1000 // 15 mins
    const token = generatePreviewToken(userId, type, contentHash, expiry)

    res.json({
      token,
      type,
      fileName,
      counts: {
        total: parsed.rowCount,
        valid: validRows.length,
        invalid: invalidRows.length,
        existing: validRows.filter((r) => r.isExisting).length,
      },
      mapping: effectiveMapping,
      unmapped: headerMapping.unmapped,
      missingRequired: [],
      hasUnsafeAadhaarHeader: false,
      sampleValid: validRows.slice(0, 10),
      sampleInvalid: invalidRows.slice(0, 20),
    })
  } catch (error) {
    console.error("Import preview error:", error.name)
    res.status(500).json({ message: "Failed to preview CSV import." })
  }
})

/**
 * POST /api/import/:type/commit
 * Re-validates data against books lock and server rules, executes chunk insert, records history & audit.
 */
router.post("/:type/commit", verifyToken, importCommitLimiter, async (req, res) => {
  try {
    const { type } = req.params
    const { csvText, fileName = "", mapping: customMapping = null, token } = req.body
    const userId = req.user.id

    if (type !== "customers" && type !== "expenses") {
      return res.status(400).json({ message: `Import not supported for '${type}'.` })
    }

    if (!token) {
      return res.status(400).json({ message: "Preview token is required to commit import." })
    }

    const contentHash = crypto.createHash("sha256").update(csvText).digest("hex")
    if (!verifyPreviewToken(token, userId, type, contentHash)) {
      return res.status(403).json({ message: "Invalid or expired import preview token. Please preview the file again." })
    }

    const parsed = parseCsv(csvText, { maxBytes: 1500000, maxRows: 2000, maxCols: 30, maxCell: 500 })
    const spec = type === "customers" ? CUSTOMER_IMPORT_SPEC : EXPENSE_IMPORT_SPEC
    const headerMapping = mapHeaders(parsed.headers, spec)

    if (headerMapping.hasUnsafeAadhaarHeader) {
      return res.status(400).json({ message: "Aadhaar columns are not permitted." })
    }

    const effectiveMapping = customMapping && typeof customMapping === "object"
      ? { ...headerMapping.mapping, ...customMapping }
      : headerMapping.mapping

    const fieldToHeader = {}
    for (const [csvHeader, fieldKey] of Object.entries(effectiveMapping)) {
      fieldToHeader[fieldKey] = csvHeader
    }

    const lockDate = await getEffectiveLockDate(userId)
    const validDocs = []
    let skippedCount = 0

    let existingPhonesInDb = new Set()
    if (type === "customers") {
      const activeCustomers = await Customer.find({ userId, deletedAt: null }).select("phone").lean()
      existingPhonesInDb = new Set(activeCustomers.map((c) => c.phone))
    }

    parsed.rows.forEach((row) => {
      if (type === "customers") {
        const rawName = String(row[fieldToHeader.name] || "").trim()
        const rawPhone = row[fieldToHeader.phone] || ""
        const phoneNorm = normalizeIndianMobile(rawPhone)

        if (rawName.length >= 2 && phoneNorm.valid) {
          if (existingPhonesInDb.has(phoneNorm.normalized)) {
            skippedCount++
          } else {
            existingPhonesInDb.add(phoneNorm.normalized)
            validDocs.push({
              userId,
              name: rawName.slice(0, 120),
              phone: phoneNorm.normalized,
              city: String(row[fieldToHeader.city] || "").trim().slice(0, 100),
              email: String(row[fieldToHeader.email] || "").trim().slice(0, 254),
              emergencyContact: String(row[fieldToHeader.emergencyContact] || "").trim().slice(0, 20),
              bloodGroup: String(row[fieldToHeader.bloodGroup] || "").trim().toUpperCase(),
              notes: String(row[fieldToHeader.notes] || "").trim().slice(0, 1000),
              whatsappOptOut: parseBool(row[fieldToHeader.whatsappOptOut], false),
              source: "import",
            })
          }
        } else {
          skippedCount++
        }
      } else if (type === "expenses") {
        const parsedDateStr = parseDate(row[fieldToHeader.date])
        const moneyParsed = parseMoney(row[fieldToHeader.amount])

        if (parsedDateStr && moneyParsed.valid && moneyParsed.paise > 0) {
          // Strict books lock check
          if (lockDate && parsedDateStr <= lockDate) {
            skippedCount++
          } else {
            validDocs.push({
              userId,
              date: new Date(parsedDateStr),
              amount: moneyParsed.paise / 100,
              category: matchExpenseCategory(row[fieldToHeader.category]),
              paymentMode: matchExpensePaymentMode(row[fieldToHeader.paymentMode]),
              vendor: String(row[fieldToHeader.vendor] || "").trim().slice(0, 80),
              note: String(row[fieldToHeader.notes] || "").trim().slice(0, 300),
              status: "paid",
              paidOn: new Date(parsedDateStr),
            })
          }
        } else {
          skippedCount++
        }
      }
    })

    if (validDocs.length === 0) {
      return res.status(400).json({
        message: "No valid rows found to import (all rows were duplicates, locked, or invalid).",
        counts: { total: parsed.rowCount, imported: 0, skipped: skippedCount },
      })
    }

    // Step 1: Create batch record
    const batch = new ImportBatch({
      userId,
      type,
      status: "committed",
      totalRows: parsed.rowCount,
      successCount: 0,
      skippedCount,
      recordIds: [],
      fileName: fileName || `${type}-import.csv`,
      mapping: effectiveMapping,
    })
    await batch.save()

    // Step 2: Assign importBatchId and insert documents
    validDocs.forEach((doc) => {
      doc.importBatchId = batch._id
    })

    let insertedRecords = []
    if (type === "customers") {
      insertedRecords = await Customer.insertMany(validDocs, { ordered: false })
    } else if (type === "expenses") {
      insertedRecords = await Expense.insertMany(validDocs, { ordered: false })
    }

    // Step 3: Update batch with inserted record IDs
    batch.recordIds = insertedRecords.map((r) => r._id)
    batch.successCount = insertedRecords.length
    await batch.save()

    await logAudit({
      userId,
      action: "IMPORT_CSV",
      req,
      meta: {
        batchId: batch._id,
        type,
        successCount: batch.successCount,
        skippedCount,
        fileName,
      },
    })

    res.status(201).json({
      success: true,
      batchId: batch._id,
      counts: {
        total: parsed.rowCount,
        imported: batch.successCount,
        skipped: skippedCount,
      },
    })
  } catch (error) {
    console.error("Import commit error:", error.name)
    res.status(500).json({ message: "Failed to commit import batch." })
  }
})

/**
 * POST /api/import/batches/:id/undo
 * Undoes an import batch with books lock checks and dependency validation.
 */
router.post("/batches/:id/undo", verifyToken, importUndoLimiter, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const batch = await ImportBatch.findOne({ _id: id, userId })
    if (!batch) {
      return res.status(404).json({ message: "Import batch not found." })
    }

    if (batch.status === "reverted") {
      return res.status(400).json({ message: "This import batch has already been reverted." })
    }

    const lockDate = await getEffectiveLockDate(userId)
    const reasons = []
    let revertedCount = 0
    let skippedCount = 0

    if (batch.type === "expenses") {
      const expenses = await Expense.find({
        _id: { $in: batch.recordIds },
        userId,
        deletedAt: null,
      })

      for (const exp of expenses) {
        const expDateStr = exp.date.toISOString().slice(0, 10)
        if (lockDate && expDateStr <= lockDate) {
          skippedCount++
          if (!reasons.includes("BOOKS_LOCKED")) reasons.push("BOOKS_LOCKED")
        } else {
          exp.deletedAt = new Date()
          exp.deletedBy = userId
          await exp.save()
          revertedCount++
        }
      }
    } else if (batch.type === "customers") {
      const customers = await Customer.find({
        _id: { $in: batch.recordIds },
        userId,
        deletedAt: null,
      })

      for (const cust of customers) {
        // Check if customer has active bookings
        const hasBookings = await Booking.exists({ customerId: cust._id, deletedAt: null })
        if (hasBookings) {
          skippedCount++
          if (!reasons.includes("IN_USE")) reasons.push("IN_USE")
        } else {
          cust.deletedAt = new Date()
          cust.deletedBy = userId
          await cust.save()
          revertedCount++
        }
      }
    }

    batch.revertedCount = (batch.revertedCount || 0) + revertedCount
    batch.revertedAt = new Date()
    batch.status = skippedCount > 0 ? "partially_reverted" : "reverted"
    await batch.save()

    await logAudit({
      userId,
      action: "UNDO_IMPORT_BATCH",
      req,
      meta: {
        batchId: batch._id,
        type: batch.type,
        revertedCount,
        skippedCount,
        reasons,
      },
    })

    res.json({
      success: true,
      status: batch.status,
      revertedCount,
      skippedCount,
      reasons,
      message:
        revertedCount > 0
          ? `Successfully reverted ${revertedCount} records.`
          : "No records could be reverted.",
    })
  } catch (error) {
    console.error("Import undo error:", error.name)
    res.status(500).json({ message: "Failed to undo import batch." })
  }
})

export default router
