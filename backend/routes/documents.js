import express from "express"
import rateLimit from "express-rate-limit"
import verifyToken from "../middleware/auth.js"
import Booking from "../models/Booking.js"
import User from "../models/User.js"
import IssuedDocument from "../models/IssuedDocument.js"
import { logAudit } from "../models/AuditLog.js"
import { getNextDocumentNumber } from "../utils/documentNumbering.js"
import {
  getType,
  isValidType,
  getDefaultDocumentSettings,
} from "../../shared/documentTypes.js"
import { calculateCancellationRefund } from "../../shared/businessLogic.js"
import {
  issueDocumentInputSchema,
  voidDocumentInputSchema,
  documentSettingsUpdateSchema,
} from "../utils/documentValidation.js"

const router = express.Router()

const documentWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many document requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * Helper to build an immutable snapshot from booking, user, and settings
 */
export function buildDocumentSnapshots(booking, user, docTypeConfig, customNotes = "", customTerms = "") {
  const isTaxInclusive = Boolean(booking.isTaxInclusive)
  const gstRate = Number(booking.gstRate) || 0
  const totalAmount = Number(booking.totalAmount) || 0
  const advanceReceived = Number(booking.advanceReceived) || 0
  const balance = Math.max(0, totalAmount - advanceReceived)

  const amounts = {
    totalAmount,
    advanceReceived,
    balance,
    discount: Number(booking.discount) || 0,
    discountType: booking.discountType || "fixed",
    gstRate,
    taxAmount: Number(booking.taxAmount) || 0,
    isTaxInclusive,
    refundAmount: Number(booking.refundAmount) || 0,
    cancellationCharge: Number(booking.cancellationCharge) || 0,
  }

  const company = {
    name: user.companyName || "",
    tagline: user.companyTagline || "",
    address: user.companyHeadquarters || "",
    phone: user.companyPhone || "",
    gstin: user.gstNumber || "",
    logoUrl: user.companyLogo || "",
    bankDetails: {
      accountName: user.bankDetails?.accountName || "",
      accountNumber: user.bankDetails?.accountNumber || "",
      ifscCode: user.bankDetails?.ifscCode || "",
      bankName: user.bankDetails?.bankName || "",
      upiId: user.bankDetails?.upiId || "",
    },
  }

  // Customer snapshot (Strictly NO Aadhaar)
  const customer = {
    name: booking.contactName || "",
    phone: booking.contactPhone || "",
    email: booking.contactEmail || "",
    gstin: "",
    city: booking.passengers?.[0]?.city || "",
  }

  // Line items snapshot (Strictly NO Aadhaar)
  const lineItems = (booking.passengers || []).map((p) => ({
    description: `${booking.tourName || "Tour"} - Berth ${p.seatId || "Unassigned"}`,
    passengerName: p.name || "",
    seatId: p.seatId || "",
    age: p.age,
    gender: p.gender || "",
    amount: booking.passengers.length > 0 ? Math.round(totalAmount / booking.passengers.length) : totalAmount,
  }))

  const effectiveTerms = customTerms || (user.termsAndConditions || []).join("\n")
  const effectiveNotes = customNotes || ""

  const settings = {
    title: docTypeConfig.defaultTitle,
    prefix: docTypeConfig.defaultPrefix,
    terms: effectiveTerms,
    notes: effectiveNotes,
    showGstBreakup: docTypeConfig.showGstBreakup,
    requiresPayment: docTypeConfig.requiresPayment,
  }

  return { amounts, company, customer, lineItems, settings }
}

/**
 * Lazy-create tax invoice helper for old bookings that do not have an IssuedDocument record yet
 */
export async function ensureLegacyInvoiceDocument(booking, user) {
  if (!booking || !booking.invoiceNo) return null

  // Check if an issued tax-invoice already exists
  let doc = await IssuedDocument.findOne({
    bookingId: booking._id,
    type: "tax-invoice",
    userId: user._id || booking.userId,
  })

  if (doc) return doc

  const typeConfig = getType("tax-invoice")
  const snapshots = buildDocumentSnapshots(booking, user, typeConfig)

  doc = new IssuedDocument({
    userId: user._id || booking.userId,
    bookingId: booking._id,
    type: "tax-invoice",
    number: booking.invoiceNo,
    issuedAt: booking.createdAt || booking.date || new Date(),
    status: booking.status === "Cancelled" ? "void" : "issued",
    voidReason: booking.status === "Cancelled" ? (booking.cancellationReason || "Booking cancelled") : "",
    amounts: snapshots.amounts,
    company: snapshots.company,
    customer: snapshots.customer,
    lineItems: snapshots.lineItems,
    settings: {
      ...snapshots.settings,
      title: "TAX INVOICE",
      showGstBreakup: true,
    },
  })

  await doc.save()
  return doc
}

/**
 * POST /api/documents
 * Issues a new immutable document for a booking.
 */
router.post("/", verifyToken, documentWriteLimiter, async (req, res) => {
  try {
    const input = issueDocumentInputSchema.parse(req.body)
    const { bookingId, type, validUntil, linkedDocumentId, notes, terms } = input

    if (!isValidType(type)) {
      return res.status(400).json({ message: `Unsupported document type: ${type}` })
    }

    const typeConfig = getType(type)
    const booking = await Booking.findOne({ _id: bookingId, userId: req.user.id })
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" })
    }

    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Check allowed booking states
    const isCancelled = booking.status === "Cancelled"
    if (type === "credit-note") {
      if (!isCancelled) {
        return res.status(400).json({
          message: "Credit Note can only be issued for cancelled or refunded bookings",
        })
      }

      // Check idempotency: If active credit note already exists for this booking, return it
      const existingCreditNote = await IssuedDocument.findOne({
        bookingId: booking._id,
        type: "credit-note",
        status: "issued",
      })

      if (existingCreditNote) {
        return res.status(200).json({
          message: "Credit note already issued for this booking",
          document: existingCreditNote,
          isExisting: true,
        })
      }
    } else {
      if (isCancelled) {
        return res.status(400).json({
          message: `Cannot issue a ${typeConfig.label} for a cancelled booking`,
        })
      }
    }

    // Credit Note validations: link to original document and amount check
    let resolvedLinkedDocId = linkedDocumentId || null
    if (type === "credit-note") {
      let originalDoc = null
      if (linkedDocumentId) {
        originalDoc = await IssuedDocument.findOne({
          _id: linkedDocumentId,
          bookingId: booking._id,
          userId: req.user.id,
        })
        if (!originalDoc) {
          return res.status(400).json({ message: "Linked original document not found for this booking" })
        }
      } else {
        // Fallback: search for active tax-invoice or bill-of-supply for this booking
        originalDoc = await IssuedDocument.findOne({
          bookingId: booking._id,
          userId: req.user.id,
          type: { $in: ["tax-invoice", "bill-of-supply"] },
          status: "issued",
        })
        if (!originalDoc) {
          // Lazy-create legacy invoice document if old booking
          originalDoc = await ensureLegacyInvoiceDocument(booking, user)
        }
      }

      if (originalDoc) {
        resolvedLinkedDocId = originalDoc._id
      }

      // Compute refund amount from shared business logic
      const totalPaid = Number(booking.advanceReceived) || 0
      const cancellationCharge = Number(booking.cancellationCharge) || 0
      const calc = calculateCancellationRefund({ totalPaid, cancellationCharge })
      const refundAmount = booking.refundAmount !== undefined ? booking.refundAmount : calc.refundAmount

      if (originalDoc && refundAmount > originalDoc.amounts.totalAmount) {
        return res.status(400).json({
          message: `Credit note refund amount ₹${refundAmount} cannot exceed original document total ₹${originalDoc.amounts.totalAmount}`,
        })
      }
    }

    // Build immutable snapshots
    const snapshots = buildDocumentSnapshots(booking, user, typeConfig, notes, terms)

    // Calculate document number atomically
    const numberResult = await getNextDocumentNumber(req.user.id, type, new Date(), user)

    // Apply document settings overrides to snapshot
    snapshots.settings.title = numberResult.settings.title || typeConfig.defaultTitle
    snapshots.settings.prefix = numberResult.settings.prefix || typeConfig.defaultPrefix
    snapshots.settings.showGstBreakup =
      numberResult.settings.showGstBreakup !== undefined
        ? numberResult.settings.showGstBreakup
        : typeConfig.showGstBreakup
    if (notes) snapshots.settings.notes = notes
    if (terms) snapshots.settings.terms = terms

    // Compute validUntil date if quotation
    let resolvedValidUntil = null
    if (type === "quotation") {
      if (validUntil) {
        resolvedValidUntil = new Date(validUntil)
      } else {
        const validityDays = numberResult.settings.validityDays || 30
        resolvedValidUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)
      }
    }

    const newDoc = new IssuedDocument({
      userId: req.user.id,
      bookingId: booking._id,
      type,
      number: numberResult.number,
      issuedAt: new Date(),
      issuedBy: req.user.id,
      status: "issued",
      linkedDocumentId: resolvedLinkedDocId,
      validUntil: resolvedValidUntil,
      amounts: snapshots.amounts,
      company: snapshots.company,
      customer: snapshots.customer,
      lineItems: snapshots.lineItems,
      settings: snapshots.settings,
    })

    try {
      await newDoc.save()
    } catch (saveError) {
      // Idempotency guard for Credit Note: if race condition hit unique index, return existing document
      if (type === "credit-note" && saveError.code === 11000) {
        const existingCn = await IssuedDocument.findOne({
          bookingId: booking._id,
          type: "credit-note",
          status: "issued",
        })
        if (existingCn) {
          return res.status(200).json({
            message: "Credit note already issued for this booking",
            document: existingCn,
            isExisting: true,
          })
        }
      }
      throw saveError
    }

    // Update booking's invoiceNo if tax-invoice and invoiceNo was pending/unassigned
    if (type === "tax-invoice" && (!booking.invoiceNo || booking.invoiceNo === "PENDING")) {
      booking.invoiceNo = newDoc.number
      await booking.save()
    }

    await logAudit(req.user.id, "issue_document", req, {
      documentId: newDoc._id,
      type,
      number: newDoc.number,
      bookingId: booking._id,
    })

    return res.status(201).json({
      message: `${typeConfig.label} issued successfully`,
      document: newDoc,
    })
  } catch (error) {
    if (error.name === "ZodError" || error.issues) {
      return res.status(400).json({
        message: "Invalid input",
        errors: error.issues || error.errors,
      })
    }
    console.error("Issue document error:", error.message)
    res.status(500).json({
      message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
    })
  }
})

/**
 * GET /api/documents
 * Lists issued documents, optionally filtered by bookingId.
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const { bookingId } = req.query
    const query = { userId: req.user.id }

    if (bookingId) {
      query.bookingId = bookingId
    }

    let documents = await IssuedDocument.find(query).sort({ issuedAt: -1 })

    // Lazy create tax invoice for legacy booking if no documents exist yet
    if (bookingId && documents.length === 0) {
      const booking = await Booking.findOne({ _id: bookingId, userId: req.user.id })
      if (booking && booking.invoiceNo) {
        const user = await User.findById(req.user.id)
        const lazyDoc = await ensureLegacyInvoiceDocument(booking, user)
        if (lazyDoc) {
          documents = [lazyDoc]
        }
      }
    }

    res.json({ documents })
  } catch (error) {
    console.error("List documents error:", error.message)
    res.status(500).json({
      message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
    })
  }
})

/**
 * GET /api/documents/:id
 * Fetches single document by ID.
 */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const doc = await IssuedDocument.findOne({ _id: req.params.id, userId: req.user.id })
    if (!doc) {
      return res.status(404).json({ message: "Document not found" })
    }
    res.json({ document: doc })
  } catch (error) {
    console.error("Get document error:", error.message)
    res.status(500).json({
      message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
    })
  }
})

/**
 * POST /api/documents/:id/void
 * Voids an issued document with an audit log reason.
 */
router.post("/:id/void", verifyToken, documentWriteLimiter, async (req, res) => {
  try {
    const input = voidDocumentInputSchema.parse(req.body)
    const { reason } = input

    const doc = await IssuedDocument.findOne({ _id: req.params.id, userId: req.user.id })
    if (!doc) {
      return res.status(404).json({ message: "Document not found" })
    }

    if (doc.status === "void") {
      return res.status(400).json({ message: "Document is already void" })
    }

    doc.status = "void"
    doc.voidReason = reason.trim()
    doc.voidedAt = new Date()
    doc.voidedBy = req.user.id

    await doc.save()

    await logAudit(req.user.id, "void_document", req, {
      documentId: doc._id,
      type: doc.type,
      number: doc.number,
      reason: doc.voidReason,
    })

    res.json({
      message: "Document voided successfully",
      document: doc,
    })
  } catch (error) {
    if (error.name === "ZodError" || error.issues) {
      return res.status(400).json({
        message: "Invalid input",
        errors: error.issues || error.errors,
      })
    }
    console.error("Void document error:", error.message)
    res.status(500).json({
      message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
    })
  }
})

/**
 * GET /api/documents/settings
 * Retrieves user's document settings merged with defaults.
 */
router.get("/settings/all", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("documentSettings")
    const defaults = getDefaultDocumentSettings()
    const userSettings = user?.documentSettings || {}

    const merged = {}
    for (const [key, defaultConfig] of Object.entries(defaults)) {
      merged[key] = {
        ...defaultConfig,
        ...(userSettings[key] || {}),
      }
    }

    res.json({ settings: merged })
  } catch (error) {
    console.error("Get document settings error:", error.message)
    res.status(500).json({
      message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
    })
  }
})

/**
 * PUT /api/documents/settings
 * Updates user's document settings with strict Zod validation.
 */
router.put("/settings/all", verifyToken, documentWriteLimiter, async (req, res) => {
  try {
    const parsed = documentSettingsUpdateSchema.parse(req.body)
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { documentSettings: parsed } },
      { new: true }
    )

    res.json({
      message: "Document settings updated successfully",
      settings: user.documentSettings,
    })
  } catch (error) {
    if (error.name === "ZodError" || error.issues) {
      return res.status(400).json({
        message: "Invalid document settings",
        errors: error.issues || error.errors,
      })
    }
    console.error("Update document settings error:", error.message)
    res.status(500).json({
      message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
    })
  }
})

export default router
