import express from "express"
import rateLimit from "express-rate-limit"
import crypto from "crypto"
import verifyToken from "../middleware/auth.js"
import ImportBatch from "../models/ImportBatch.js"
import Customer from "../models/Customer.js"
import Expense from "../models/Expense.js"
import Booking from "../models/Booking.js"
import Payment from "../models/Payment.js"
import Tour from "../models/Tour.js"
import SeatHold from "../models/SeatHold.js"
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
  CSV_PARSER_LIMITS,
} from "../../shared/csv.js"
import { normalizeIndianMobile } from "../../shared/customers.js"
import { getEffectiveLockDate } from "../utils/booksLock.js"
import {
  validateExchangeFile,
  planPassengerMerge,
  CANONICAL_BUS_TYPE,
  SUPPORTED_LAYOUT,
} from "../../shared/passengerExchange.js"
import { commitTripPassengers } from "../utils/passengerImport.js"
import { parseDepartureKey, getBusCondition } from "../utils/departureKey.js"
import { getDayBounds, round2 } from "../../shared/businessLogic.js"
import { syncBookingPayments } from "./payments.js"

const router = express.Router()

// Rate Limiting: 20 previews per 15 min, 10 commits/undos per 15 min
export const importPreviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many import preview requests. Please try again later." },
})

export const importCommitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many import commit/undo requests. Please try again later." },
})

const HMAC_SECRET = process.env.JWT_SECRET || "yatrahub-import-token-secret-key-2026"

function computeMappingHash(mapping) {
  if (!mapping || typeof mapping !== "object") return ""
  const sorted = Object.keys(mapping)
    .sort()
    .reduce((acc, k) => {
      acc[k] = mapping[k]
      return acc
    }, {})
  return crypto.createHash("sha256").update(JSON.stringify(sorted)).digest("hex")
}

export function generatePreviewToken(userId, type, mapping, contentHash, expiry) {
  const mappingHash = computeMappingHash(mapping)
  const payload = `${userId}:${type}:${mappingHash}:${contentHash}:${expiry}`
  const signature = crypto.createHmac("sha256", HMAC_SECRET).update(payload).digest("hex")
  return `${signature}.${expiry}`
}

export function verifyPreviewToken(tokenWithExpiry, userId, type, mapping, contentHash) {
  if (!tokenWithExpiry || typeof tokenWithExpiry !== "string") return false
  const parts = tokenWithExpiry.split(".")
  if (parts.length !== 2) return false
  const [signature, expiryStr] = parts
  const expiry = parseInt(expiryStr, 10)
  if (isNaN(expiry) || Date.now() > expiry) return false

  const mappingHash = computeMappingHash(mapping)
  const expectedPayload = `${userId}:${type}:${mappingHash}:${contentHash}:${expiry}`
  const expectedSignature = crypto.createHmac("sha256", HMAC_SECRET).update(expectedPayload).digest("hex")
  if (signature.length !== expectedSignature.length) return false
  return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"))
}

/**
 * GET /api/import/batches
 * Returns the latest 20 import batches for the authenticated operator.
 * Privacy guarantee: does not store or return file names.
 */
router.get("/batches", verifyToken, async (req, res) => {
  try {
    const batches = await ImportBatch.find({ userId: req.user.id })
      .select("-errors -recordIds")
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
 * POST /api/import/passengers/preview
 * Validates yatriDesk exchange JSON, maps trips to departures, plans merge, and returns summary with HMAC token.
 */
router.post("/passengers/preview", verifyToken, importPreviewLimiter, async (req, res) => {
  try {
    const userId = req.user.id
    const { exchange, mapping = {}, options = {} } = req.body

    const validation = validateExchangeFile(exchange)
    if (!validation.valid) {
      return res.status(400).json({
        message: "Invalid exchange file.",
        errors: validation.errors,
      })
    }

    const sanitized = validation.sanitized
    const lockDate = await getEffectiveLockDate(userId)
    const busCondition = getBusCondition(CANONICAL_BUS_TYPE)

    // Load user's tours for inventory checks
    const availableTours = await Tour.find({ userId }).select("name pricingType fixedPrice lowerPrice upperPrice busType").lean()
    const tourNamesSet = new Set(availableTours.map((t) => t.name.toLowerCase()))

    const tripsPlan = []
    let totalAdd = 0
    let totalMerge = 0
    let totalSame = 0
    let totalConflict = 0
    let totalHold = 0
    let totalDup = 0
    let totalInvalid = 0
    let totalNewFares = 0
    let totalNewPayments = 0

    for (const trip of sanitized.trips) {
      // Determine target departure
      let targetDep = mapping[trip.xid]

      if (!targetDep) {
        // 1. Previous link
        const prevBooking = await Booking.findOne({
          userId,
          "externalRef.tripXid": trip.xid,
          status: { $ne: "Cancelled" },
          deletedAt: null,
        }).select("tourName journeyDate busType").lean()

        if (prevBooking) {
          targetDep = {
            tourName: prevBooking.tourName,
            journeyDateStr: prevBooking.journeyDate.toISOString().slice(0, 10),
            busType: CANONICAL_BUS_TYPE,
            matchedBy: "previous_link",
          }
        } else if (trip.xid?.startsWith("tbs:")) {
          // 2. TBS departureKey hint
          const parsed = parseDepartureKey(trip.xid.slice(4))
          if (parsed) {
            targetDep = {
              tourName: parsed.tourName,
              journeyDateStr: parsed.dateStr,
              busType: CANONICAL_BUS_TYPE,
              matchedBy: "tbs_xid",
            }
          }
        }

        // 3. Match by date + contained tour name
        if (!targetDep && trip.date) {
          const { start, end } = getDayBounds(trip.date)
          const candidateBookings = await Booking.find({
            userId,
            journeyDate: { $gte: start, $lte: end },
            ...busCondition,
            status: { $ne: "Cancelled" },
            deletedAt: null,
          }).select("tourName journeyDate").lean()

          const normTripRoute = trip.route.toLowerCase()
          const matched = candidateBookings.find((cb) => {
            const cbNorm = cb.tourName.toLowerCase()
            return cbNorm === normTripRoute || cbNorm.includes(normTripRoute) || normTripRoute.includes(cbNorm)
          })

          if (matched) {
            targetDep = {
              tourName: matched.tourName,
              journeyDateStr: trip.date,
              busType: CANONICAL_BUS_TYPE,
              matchedBy: "date_and_route",
            }
          }
        }

        // 4. Default to new departure
        if (!targetDep) {
          targetDep = {
            tourName: trip.route,
            journeyDateStr: trip.date,
            busType: CANONICAL_BUS_TYPE,
            isNew: true,
            tourExists: tourNamesSet.has(trip.route.toLowerCase()),
          }
        }
      }

      // Fetch bookings & holds for target departure
      let existingBookings = []
      let existingHolds = []

      if (targetDep.tourName && targetDep.journeyDateStr) {
        const { start, end } = getDayBounds(targetDep.journeyDateStr)
        existingBookings = await Booking.find({
          userId,
          tourName: targetDep.tourName,
          journeyDate: { $gte: start, $lte: end },
          ...busCondition,
          status: { $ne: "Cancelled" },
          deletedAt: null,
        }).lean()

        if (existingBookings.length > 0) {
          const bIds = existingBookings.map((b) => b._id)
          const activePayments = await Payment.find({
            userId,
            bookingId: { $in: bIds },
            isVoid: false,
          }).lean()

          const pmsByBooking = new Map()
          for (const p of activePayments) {
            const k = p.bookingId.toString()
            if (!pmsByBooking.has(k)) pmsByBooking.set(k, [])
            pmsByBooking.get(k).push(p)
          }
          for (const b of existingBookings) {
            const pList = pmsByBooking.get(b._id.toString()) || []
            b.activePayments = pList
            b.payments = pList
          }
        }

        const now = new Date()
        existingHolds = await SeatHold.find({
          userId,
          tourName: targetDep.tourName,
          journeyDate: { $gte: start, $lte: end },
          status: "active",
          ...busCondition,
          $or: [{ mode: "manual" }, { expiresAt: { $gt: now } }],
        }).lean()
      }

      const plan = planPassengerMerge({
        trip,
        existingBookings,
        existingHolds,
        booksLockDate: lockDate,
        options,
      })

      totalAdd += plan.summary.add
      totalMerge += plan.summary.merge
      totalSame += plan.summary.same
      totalConflict += plan.summary.conflict
      totalHold += plan.summary.hold
      totalDup += plan.summary.dup
      totalInvalid += plan.summary.invalid
      totalNewFares = round2(totalNewFares + plan.summary.totalNewFares)
      totalNewPayments = round2(totalNewPayments + plan.summary.totalNewPaymentsAmount)

      tripsPlan.push({
        tripXid: trip.xid,
        route: trip.route,
        date: trip.date,
        targetDeparture: targetDep,
        plan,
      })
    }

    const contentHash = crypto.createHash("sha256").update(JSON.stringify(sanitized)).digest("hex")
    const expiry = Date.now() + 30 * 60 * 1000 // 30 minutes
    const previewToken = generatePreviewToken(userId, "passengers", mapping, contentHash, expiry)

    res.json({
      valid: true,
      previewToken,
      tokenExpiry: expiry,
      tripsPlan,
      summary: {
        totalTrips: sanitized.trips.length,
        totalPassengers: validation.stats.totalPassengers,
        skippedTripsLayout: validation.stats.skippedTripsLayout,
        add: totalAdd,
        merge: totalMerge,
        same: totalSame,
        conflict: totalConflict,
        hold: totalHold,
        dup: totalDup,
        invalid: totalInvalid,
        totalNewFares,
        totalNewPayments,
      },
    })
  } catch (error) {
    console.error("Passenger import preview error:", error)
    res.status(500).json({ message: "Failed to generate passenger import preview." })
  }
})

/**
 * POST /api/import/passengers/commit
 * Authoritatively executes the passenger import plan, creates bookings and payments, and creates an ImportBatch.
 */
router.post("/passengers/commit", verifyToken, importCommitLimiter, async (req, res) => {
  try {
    const userId = req.user.id
    const { exchange, mapping = {}, options = {}, previewToken } = req.body

    const validation = validateExchangeFile(exchange)
    if (!validation.valid) {
      return res.status(400).json({ message: "Invalid exchange file.", errors: validation.errors })
    }

    const sanitized = validation.sanitized
    const contentHash = crypto.createHash("sha256").update(JSON.stringify(sanitized)).digest("hex")

    const isValidToken = verifyPreviewToken(previewToken, userId, "passengers", mapping, contentHash)
    if (!isValidToken) {
      return res.status(400).json({
        message: "Preview token is invalid or expired. Please preview again.",
        code: "STALE_PREVIEW_TOKEN",
      })
    }

    // Initialize ImportBatch
    const batch = new ImportBatch({
      userId,
      type: "passengers",
      status: "committing",
      totalRows: validation.stats.totalPassengers,
      successCount: 0,
      skippedCount: 0,
      recordIds: [],
      createdBookingIds: [],
      importedPaymentIds: [],
      mergedBookingIds: [],
      summary: {},
    })
    await batch.save()

    const allCreatedBookings = []
    const allImportedPayments = []
    const allMergedBookings = []
    let totalAdded = 0
    let totalMerged = 0

    for (const trip of sanitized.trips) {
      const targetDep = mapping[trip.xid] || {
        tourName: trip.route,
        journeyDateStr: trip.date,
        busType: CANONICAL_BUS_TYPE,
      }

      const result = await commitTripPassengers({
        userId,
        trip,
        targetDeparture: targetDep,
        batchId: batch._id,
        options,
      })

      allCreatedBookings.push(...result.createdBookingIds)
      allImportedPayments.push(...result.importedPaymentIds)
      allMergedBookings.push(...result.mergedBookingIds)
      totalAdded += result.summary.add
      totalMerged += result.summary.merge
    }

    batch.createdBookingIds = allCreatedBookings
    batch.importedPaymentIds = allImportedPayments
    batch.mergedBookingIds = allMergedBookings
    batch.recordIds = [...allCreatedBookings, ...allImportedPayments]
    batch.successCount = allCreatedBookings.length + allMergedBookings.length
    batch.skippedCount = Math.max(0, validation.stats.totalPassengers - (totalAdded + totalMerged))
    batch.status = "committed"
    batch.summary = {
      createdBookingsCount: allCreatedBookings.length,
      importedPaymentsCount: allImportedPayments.length,
      mergedBookingsCount: allMergedBookings.length,
      addedPassengers: totalAdded,
      mergedPassengers: totalMerged,
    }
    await batch.save()

    await logAudit({
      userId,
      action: "IMPORT_PASSENGERS",
      req,
      meta: {
        batchId: batch._id,
        createdBookings: allCreatedBookings.length,
        importedPayments: allImportedPayments.length,
        mergedBookings: allMergedBookings.length,
      },
    })

    res.status(201).json({
      success: true,
      batchId: batch._id,
      createdBookingIds: allCreatedBookings,
      importedPaymentIds: allImportedPayments,
      mergedBookingIds: allMergedBookings,
      summary: batch.summary,
      message: `Successfully processed ${allCreatedBookings.length} new bookings and merged ${allMergedBookings.length} existing bookings.`,
    })
  } catch (error) {
    console.error("Passenger import commit error:", error)
    res.status(500).json({ message: "Failed to commit passenger import." })
  }
})

/**
 * POST /api/import/:type/preview
 * Parses CSV, maps headers, validates data, evaluates books lock, and returns validation summary with HMAC token.
 */
router.post("/:type/preview", verifyToken, importPreviewLimiter, async (req, res) => {
  try {
    const { type } = req.params
    const { csvText, mapping: customMapping = null } = req.body
    const userId = req.user.id

    if (type !== "customers" && type !== "expenses") {
      return res.status(400).json({ message: `Import is only supported for 'customers' and 'expenses', not '${type}'.` })
    }

    if (!csvText || typeof csvText !== "string" || csvText.trim().length === 0) {
      return res.status(400).json({ message: "CSV content cannot be empty." })
    }

    let parsed
    try {
      parsed = parseCsv(csvText, {
        maxBytes: CSV_PARSER_LIMITS.MAX_BYTES,
        maxRows: CSV_PARSER_LIMITS.MAX_ROWS,
        maxCols: CSV_PARSER_LIMITS.MAX_COLS,
        maxCell: CSV_PARSER_LIMITS.MAX_CELL,
      })
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
    const invalidErrors = []
    const invalidRows = []
    const invalidRowNumbers = new Set()
    const seenPhonesInFile = new Set()

    // For customers, check existing phone numbers in DB for deduplication
    let existingPhonesInDb = new Set()
    if (type === "customers") {
      const activeCustomers = await Customer.find({ userId, deletedAt: null }).select("phone").lean()
      existingPhonesInDb = new Set(activeCustomers.map((c) => c.phone))
    }

    parsed.rows.forEach((row, idx) => {
      const rowNum = idx + 2 // 1-based index including header row
      const rowErrors = []

      if (type === "customers") {
        const rawName = row[fieldToHeader.name] || ""
        const cleanName = String(rawName).trim()
        if (cleanName.length < 2) {
          rowErrors.push({ row: rowNum, field: "name", code: "NAME_TOO_SHORT", message: "Customer name must be at least 2 characters." })
        } else if (cleanName.length > 120) {
          rowErrors.push({ row: rowNum, field: "name", code: "NAME_TOO_LONG", message: "Customer name cannot exceed 120 characters." })
        }

        const rawPhone = row[fieldToHeader.phone] || ""
        const phoneNorm = normalizeIndianMobile(rawPhone)
        if (!phoneNorm.valid) {
          rowErrors.push({ row: rowNum, field: "phone", code: "INVALID_PHONE", message: "Invalid 10-digit Indian phone number." })
        } else if (seenPhonesInFile.has(phoneNorm.normalized)) {
          rowErrors.push({ row: rowNum, field: "phone", code: "DUPLICATE_PHONE", message: "Duplicate phone number in CSV file." })
        }

        const rawCity = row[fieldToHeader.city] || ""
        const rawEmail = row[fieldToHeader.email] || ""
        const rawEmergency = row[fieldToHeader.emergencyContact] || ""
        const rawBlood = row[fieldToHeader.bloodGroup] || ""
        const rawNotes = row[fieldToHeader.notes] || ""
        const rawOptOut = row[fieldToHeader.whatsappOptOut] || ""

        if (rowErrors.length === 0) {
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
          invalidRowNumbers.add(rowNum)
          invalidErrors.push(...rowErrors)
          invalidRows.push({
            rowNumber: rowNum,
            row: rowNum,
            field: rowErrors[0]?.field || "general",
            code: rowErrors[0]?.code || "INVALID_ROW",
            errors: rowErrors.map((e) => e.message || e.code),
            errorDetails: rowErrors,
          })
        }
      } else if (type === "expenses") {
        const rawDate = row[fieldToHeader.date] || ""
        const parsedDateStr = parseDate(rawDate)
        if (!parsedDateStr) {
          rowErrors.push({ row: rowNum, field: "date", code: "INVALID_DATE", message: "Invalid date format." })
        } else if (lockDate && parsedDateStr <= lockDate) {
          rowErrors.push({ row: rowNum, field: "date", code: "BOOKS_LOCKED", message: "Cannot backdate expense into closed books period." })
        }

        const rawAmount = row[fieldToHeader.amount] || ""
        const moneyParsed = parseMoney(rawAmount)
        if (!moneyParsed.valid || moneyParsed.paise <= 0) {
          rowErrors.push({ row: rowNum, field: "amount", code: "INVALID_AMOUNT", message: "Invalid positive amount." })
        }

        const rawCategory = row[fieldToHeader.category] || ""
        const categoryId = matchExpenseCategory(rawCategory)

        const rawAccount = row[fieldToHeader.account] || ""
        const normAccount = String(rawAccount).toLowerCase().includes("bank") ? "bank" : "cash"

        const rawMode = row[fieldToHeader.paymentMode] || ""
        const paymentMode = matchExpensePaymentMode(rawMode)

        const rawVendor = row[fieldToHeader.vendor] || ""
        const rawNotes = row[fieldToHeader.notes] || ""

        if (rowErrors.length === 0) {
          validRows.push({
            rowNumber: rowNum,
            data: {
              date: parsedDateStr,
              amount: moneyParsed.paise / 100,
              category: categoryId,
              account: normAccount,
              paymentMode,
              vendor: String(rawVendor).trim().slice(0, 80),
              note: String(rawNotes).trim().slice(0, 300),
              status: "paid",
            },
          })
        } else {
          invalidRowNumbers.add(rowNum)
          invalidErrors.push(...rowErrors)
          invalidRows.push({
            rowNumber: rowNum,
            row: rowNum,
            field: rowErrors[0]?.field || "general",
            code: rowErrors[0]?.code || "INVALID_ROW",
            errors: rowErrors.map((e) => e.message || e.code),
            errorDetails: rowErrors,
          })
        }
      }
    })

    const contentHash = crypto.createHash("sha256").update(csvText).digest("hex")
    const expiry = Date.now() + 15 * 60 * 1000 // 15 mins
    const token = generatePreviewToken(userId, type, effectiveMapping, contentHash, expiry)

    res.json({
      token,
      type,
      counts: {
        total: parsed.rowCount,
        valid: validRows.length,
        invalid: invalidRowNumbers.size,
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
 * Re-validates data, executes chunked non-atomic insert, updates status from 'committing' to 'committed'/'failed'.
 */
router.post("/:type/commit", verifyToken, importCommitLimiter, async (req, res) => {
  try {
    const { type } = req.params
    const { csvText, mapping: customMapping = null, token } = req.body
    const userId = req.user.id

    if (type !== "customers" && type !== "expenses") {
      return res.status(400).json({ message: `Import not supported for '${type}'.` })
    }

    if (!token) {
      return res.status(400).json({ message: "Preview token is required to commit import." })
    }

    const parsed = parseCsv(csvText, {
      maxBytes: CSV_PARSER_LIMITS.MAX_BYTES,
      maxRows: CSV_PARSER_LIMITS.MAX_ROWS,
      maxCols: CSV_PARSER_LIMITS.MAX_COLS,
      maxCell: CSV_PARSER_LIMITS.MAX_CELL,
    })
    const spec = type === "customers" ? CUSTOMER_IMPORT_SPEC : EXPENSE_IMPORT_SPEC
    const headerMapping = mapHeaders(parsed.headers, spec)

    if (headerMapping.hasUnsafeAadhaarHeader) {
      return res.status(400).json({ message: "Aadhaar columns are not permitted." })
    }

    const effectiveMapping = customMapping && typeof customMapping === "object"
      ? { ...headerMapping.mapping, ...customMapping }
      : headerMapping.mapping

    const contentHash = crypto.createHash("sha256").update(csvText).digest("hex")
    if (!verifyPreviewToken(token, userId, type, effectiveMapping, contentHash)) {
      return res.status(403).json({ message: "Invalid or expired import preview token. Please preview the file again." })
    }

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

    // Step 1: Initialize batch in 'committing' state
    const batch = new ImportBatch({
      userId,
      type,
      status: "committing",
      totalRows: parsed.rowCount,
      successCount: 0,
      skippedCount: 0,
      recordIds: [],
      mapping: effectiveMapping,
    })
    await batch.save()

    // Step 2: Assign importBatchId and insert documents in chunks of 50
    const CHUNK_SIZE = 50
    const insertedIds = []
    let insertFailed = false

    for (let i = 0; i < validDocs.length; i += CHUNK_SIZE) {
      const chunk = validDocs.slice(i, i + CHUNK_SIZE)
      chunk.forEach((doc) => {
        doc.importBatchId = batch._id
      })

      try {
        let insertedChunk = []
        if (type === "customers") {
          insertedChunk = await Customer.insertMany(chunk, { ordered: false })
        } else if (type === "expenses") {
          insertedChunk = await Expense.insertMany(chunk, { ordered: false })
        }
        insertedChunk.forEach((r) => insertedIds.push(r._id))
      } catch (chunkErr) {
        insertFailed = true
        console.error("Chunk insert error:", chunkErr.name)
        if (chunkErr.insertedDocs) {
          chunkErr.insertedDocs.forEach((r) => insertedIds.push(r._id))
        }
        break
      }
    }

    // Step 3: Finalize batch with inserted record IDs and final status
    batch.recordIds = insertedIds
    batch.successCount = insertedIds.length
    batch.skippedCount = skippedCount + (validDocs.length - insertedIds.length)
    batch.status = insertFailed ? "failed" : "committed"
    await batch.save()

    await logAudit({
      userId,
      action: "IMPORT_CSV",
      req,
      meta: {
        batchId: batch._id,
        type,
        successCount: batch.successCount,
        skippedCount: batch.skippedCount,
      },
    })

    res.status(201).json({
      success: !insertFailed,
      batchId: batch._id,
      status: batch.status,
      counts: {
        total: parsed.rowCount,
        imported: batch.successCount,
        skipped: batch.skippedCount,
      },
      message: insertFailed
        ? `Import partially completed with errors: ${batch.successCount} imported, ${batch.skippedCount} skipped.`
        : `Successfully imported ${batch.successCount} ${type}.`,
    })
  } catch (error) {
    console.error("Import commit error:", error.name)
    res.status(500).json({ message: "Failed to commit CSV import." })
  }
})

/**
 * POST /api/import/batches/:id/undo
 * Performs per-row undo with idempotency and granular reason reporting. Never blocks whole batch.
 */
router.post("/batches/:id/undo", verifyToken, importCommitLimiter, async (req, res) => {
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
    const undoSummary = {
      undone: 0,
      booksLocked: 0,
      inUse: 0,
      alreadyDeleted: 0,
    }

    if (batch.type === "expenses") {
      for (const recId of batch.recordIds) {
        const exp = await Expense.findOne({ _id: recId, userId })
        if (!exp || exp.deletedAt) {
          undoSummary.alreadyDeleted++
        } else {
          const expDateStr = exp.date ? exp.date.toISOString().slice(0, 10) : ""
          if (lockDate && expDateStr <= lockDate) {
            undoSummary.booksLocked++
          } else {
            exp.deletedAt = new Date()
            exp.deletedBy = userId
            await exp.save()
            undoSummary.undone++
          }
        }
      }
    } else if (batch.type === "customers") {
      for (const recId of batch.recordIds) {
        const cust = await Customer.findOne({ _id: recId, userId })
        if (!cust || cust.deletedAt) {
          undoSummary.alreadyDeleted++
        } else {
          const hasBookings = await Booking.exists({ customerId: cust._id, deletedAt: null })
          if (hasBookings) {
            undoSummary.inUse++
          } else {
            cust.deletedAt = new Date()
            cust.deletedBy = userId
            await cust.save()
            undoSummary.undone++
          }
        }
      }
    } else if (batch.type === "passengers") {
      // 1. Revert imported payments (void them if not books-locked)
      for (const payId of batch.importedPaymentIds || []) {
        const pm = await Payment.findOne({ _id: payId, userId })
        if (!pm || pm.isVoid) continue

        const pmDateStr = pm.paymentDate ? pm.paymentDate.toISOString().slice(0, 10) : ""
        if (lockDate && pmDateStr <= lockDate) {
          undoSummary.booksLocked++
        } else {
          pm.isVoid = true
          pm.voidReason = "Import batch undo"
          pm.voidedAt = new Date()
          pm.voidedBy = req.user.userName || "Operator"
          await pm.save()
          await syncBookingPayments(pm.bookingId)
          undoSummary.undone++
        }
      }

      // 2. Soft-delete created bookings if they have no other active payments
      for (const bId of batch.createdBookingIds || []) {
        const booking = await Booking.findOne({ _id: bId, userId })
        if (!booking || booking.deletedAt) {
          undoSummary.alreadyDeleted++
        } else {
          const hasOtherPayments = await Payment.exists({
            bookingId: booking._id,
            _id: { $nin: batch.importedPaymentIds || [] },
            isVoid: false,
          })

          if (hasOtherPayments) {
            undoSummary.inUse++
          } else {
            booking.deletedAt = new Date()
            booking.cancellationReason = "Import batch undo"
            await booking.save()
            undoSummary.undone++
          }
        }
      }
    }

    batch.revertedCount = (batch.revertedCount || 0) + undoSummary.undone
    batch.revertedAt = new Date()
    batch.undoSummary = undoSummary

    const totalRecords = batch.recordIds.length
    if (undoSummary.undone === totalRecords || (undoSummary.undone + undoSummary.alreadyDeleted === totalRecords)) {
      batch.status = "reverted"
    } else {
      batch.status = "partially_reverted"
    }

    await batch.save()

    await logAudit({
      userId,
      action: "UNDO_IMPORT_BATCH",
      req,
      meta: {
        batchId: batch._id,
        type: batch.type,
        revertedCount: undoSummary.undone,
        undoSummary,
      },
    })

    res.json({
      success: true,
      status: batch.status,
      revertedCount: undoSummary.undone,
      skippedCount: undoSummary.booksLocked + undoSummary.inUse + undoSummary.alreadyDeleted,
      summary: undoSummary,
      message:
        undoSummary.undone > 0
          ? `Successfully reverted ${undoSummary.undone} record(s).`
          : "No records could be reverted.",
    })
  } catch (error) {
    console.error("Import undo error:", error.name)
    res.status(500).json({ message: "Failed to undo import batch." })
  }
})

export default router
