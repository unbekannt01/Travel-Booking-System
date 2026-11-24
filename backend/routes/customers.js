import express from "express"
import rateLimit from "express-rate-limit"
import Customer from "../models/Customer.js"
import Booking from "../models/Booking.js"
import User from "../models/User.js"
import ReminderLog from "../models/ReminderLog.js"
import verifyToken from "../middleware/auth.js"
import { logAudit } from "../models/AuditLog.js"
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerQuerySchema,
} from "../utils/customerValidation.js"
import { normalizeIndianMobile, summarizeCustomer, CUSTOMER_TAGS } from "../../shared/customers.js"
import { buildCustomerStatement } from "../../shared/statements.js"
import recordHistory from "../utils/recordHistory.js"
import { linkUnlinkedBookings, evaluateBookingLinkability } from "../utils/customerLinker.js"

const router = express.Router()

// Rate limiter for write operations (SEC-009)
const customerWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many customer write requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
})

// Rate limiter for phone lookup (non-blocking autocomplete)
const customerLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { message: "Too many lookup requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * GET /api/customers/lookup?phone=
 * Exact normalized phone lookup for BookingForm and quick checks.
 * STRICT PRIVACY: Returns name, email, city, language, tags only. NEVER returns Aadhaar or full history.
 */
router.get("/lookup", verifyToken, customerLookupLimiter, async (req, res) => {
  try {
    const rawPhone = req.query.phone
    if (!rawPhone) {
      return res.json({ found: false, customer: null })
    }

    const { valid, normalized } = normalizeIndianMobile(rawPhone)
    if (!valid || !normalized) {
      return res.json({ found: false, customer: null })
    }

    const customer = await Customer.findOne({
      userId: req.user.id,
      phone: normalized,
      deletedAt: null,
    }).lean()

    if (!customer) {
      return res.json({ found: false, customer: null })
    }

    res.json({
      found: true,
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        phone: customer.phone,
        email: customer.email || "",
        city: customer.city || "",
        address: customer.address || "",
        gstin: customer.gstin || "",
        language: customer.language || "en",
        tags: (customer.tags || []).filter((t) => CUSTOMER_TAGS.includes(t)),
        whatsappOptOut: customer.whatsappOptOut || false,
      },
    })
  } catch (error) {
    console.error("Customer lookup error:", error.name, error.code || "")
    res.status(500).json({ message: "Failed to perform customer lookup" })
  }
})

/**
 * GET /api/customers
 * Paginated list of customers with search, tag filter, outstanding filter, and authoritative summary metrics.
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const query = customerQuerySchema.parse(req.query)

    const mongoFilter = {
      userId: req.user.id,
      deletedAt: null,
    }

    if (query.tag && query.tag !== "all") {
      mongoFilter.tags = query.tag
    }

    if (query.q && query.q.trim()) {
      const escaped = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const regex = new RegExp(escaped, "i")
      mongoFilter.$or = [{ name: regex }, { phone: regex }]
    }

    // 1. Fetch matching customers
    const customers = await Customer.find(mongoFilter).lean()
    const customerIds = customers.map((c) => c._id)

    // 2. Fetch linked bookings in a single query
    const linkedBookings = await Booking.find({
      userId: req.user.id,
      customerId: { $in: customerIds },
      deletedAt: null,
    })
      .select("_id customerId totalAmount advanceReceived status journeyDate date createdAt payments passengers tourName cancellationCharge refundAmount")
      .lean()

    // Group bookings by customerId
    const bookingsByCustomer = new Map()
    for (const b of linkedBookings) {
      if (!b.customerId) continue
      const cid = b.customerId.toString()
      if (!bookingsByCustomer.has(cid)) {
        bookingsByCustomer.set(cid, [])
      }
      bookingsByCustomer.get(cid).push(b)
    }

    // 3. Compute summaries and attach to each customer
    let customerList = customers.map((c) => {
      const cBookings = bookingsByCustomer.get(c._id.toString()) || []
      const summary = summarizeCustomer(cBookings)
      return {
        ...c,
        id: c._id.toString(),
        tags: (c.tags || []).filter((t) => CUSTOMER_TAGS.includes(t)),
        summary,
      }
    })

    // 4. Apply hasOutstanding filter if requested
    if (query.hasOutstanding) {
      customerList = customerList.filter((c) => c.summary.totalOutstanding > 0)
    }

    // 5. Apply sorting
    customerList.sort((a, b) => {
      if (query.sort === "name_asc") {
        return a.name.localeCompare(b.name)
      }
      if (query.sort === "name_desc") {
        return b.name.localeCompare(a.name)
      }
      if (query.sort === "outstanding_desc") {
        return b.summary.totalOutstanding - a.summary.totalOutstanding
      }
      if (query.sort === "revenue_desc") {
        return b.summary.totalBookedRevenue - a.summary.totalBookedRevenue
      }
      // default: recent_booking
      const aDate = a.summary.lastBookingDate || (a.createdAt ? new Date(a.createdAt).toISOString() : "")
      const bDate = b.summary.lastBookingDate || (b.createdAt ? new Date(b.createdAt).toISOString() : "")
      return bDate.localeCompare(aDate)
    })

    // 6. Aggregate KPIs for operator StatCards
    const allActiveCustomers = await Customer.find({ userId: req.user.id, deletedAt: null }).lean()
    const allActiveCustomerIds = allActiveCustomers.map((c) => c._id)
    const allLinkedBookings = await Booking.find({
      userId: req.user.id,
      customerId: { $in: allActiveCustomerIds },
      deletedAt: null,
    })
      .select("customerId totalAmount advanceReceived status payments cancellationCharge refundAmount")
      .lean()

    const allBookingsMap = new Map()
    for (const b of allLinkedBookings) {
      if (!b.customerId) continue
      const cid = b.customerId.toString()
      if (!allBookingsMap.has(cid)) allBookingsMap.set(cid, [])
      allBookingsMap.get(cid).push(b)
    }

    let repeatCount = 0
    let withOutstandingCount = 0
    for (const c of allActiveCustomers) {
      const bList = allBookingsMap.get(c._id.toString()) || []
      const s = summarizeCustomer(bList)
      if (s.isRepeat) repeatCount++
      if (s.totalOutstanding > 0) withOutstandingCount++
    }

    // Count unlinked active bookings for the "Needs Attention" alert banner
    const unlinkedBookings = await Booking.find({
      userId: req.user.id,
      $or: [{ customerId: null }, { customerId: { $exists: false } }],
      deletedAt: null,
    })
      .select("_id invoiceNo date contactPhone")
      .lean()

    let actionableLinkableCount = 0
    const unlinkedUnresolved = []
    for (const b of unlinkedBookings) {
      const evalResult = evaluateBookingLinkability(b)
      if (evalResult.canLink) {
        actionableLinkableCount += 1
      } else {
        unlinkedUnresolved.push({
          bookingId: b._id.toString(),
          invoiceNo: b.invoiceNo || "—",
          date: b.date ? new Date(b.date).toISOString().slice(0, 10) : "—",
          reasonCode: evalResult.reasonCode,
          reasonDescription: evalResult.reasonDescription,
        })
      }
    }

    // 7. Paginate
    const total = customerList.length
    const totalPages = Math.ceil(total / query.limit) || 1
    const startIndex = (query.page - 1) * query.limit
    const paginatedCustomers = customerList.slice(startIndex, startIndex + query.limit)

    res.json({
      customers: paginatedCustomers,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
      counts: {
        total: allActiveCustomers.length,
        repeat: repeatCount,
        withOutstanding: withOutstandingCount,
        unlinkedBookingsCount: actionableLinkableCount,
        unresolvedBookings: unlinkedUnresolved,
      },
    })
  } catch (error) {
    console.error("Customer list fetch error:", error.name, error.code || "")
    if (error.name === "ZodError") {
      return res.status(400).json({ message: "Invalid query parameters", errors: error.errors })
    }
    res.status(500).json({ message: "Failed to fetch customers" })
  }
})

/**
 * GET /api/customers/:id
 * Fetches single customer with profile, summary metrics, and non-PII booking list.
 */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      userId: req.user.id,
      deletedAt: null,
    }).lean()

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" })
    }

    const bookings = await Booking.find({
      userId: req.user.id,
      customerId: customer._id,
      deletedAt: null,
    })
      .sort({ journeyDate: -1, createdAt: -1 })
      .lean()

    const summary = summarizeCustomer(bookings)

    // Sanitize bookings: strictly exclude Aadhaar or passenger PII
    const sanitizedBookings = bookings.map((b) => ({
      id: b._id.toString(),
      _id: b._id.toString(),
      invoiceNo: b.invoiceNo,
      date: b.date,
      tourName: b.tourName,
      journeyDate: b.journeyDate,
      duration: b.duration || "",
      busType: b.busType || "",
      paymentMode: b.paymentMode || "Cash",
      totalAmount: b.totalAmount,
      advanceReceived: b.advanceReceived,
      isPaid: b.isPaid,
      status: b.status,
      passengersCount: Array.isArray(b.passengers) ? b.passengers.length : 0,
      cancellationCharge: b.cancellationCharge || 0,
      refundAmount: b.refundAmount || 0,
    }))

    // Fetch last 5 reminder logs for this customer
    const reminderLogs = await ReminderLog.find({
      userId: req.user.id,
      customerId: customer._id,
    })
      .sort({ openedAt: -1, createdAt: -1 })
      .limit(5)
      .lean()

    const sanitizedReminders = reminderLogs.map((r) => ({
      id: r._id.toString(),
      tone: r.tone,
      language: r.language,
      amount: r.amount,
      status: r.status,
      openedAt: r.openedAt,
      markedSentAt: r.markedSentAt || null,
    }))

    res.json({
      customer: {
        ...customer,
        id: customer._id.toString(),
        tags: (customer.tags || []).filter((t) => CUSTOMER_TAGS.includes(t)),
      },
      summary,
      bookings: sanitizedBookings,
      reminders: sanitizedReminders,
    })
  } catch (error) {
    console.error("Customer detail fetch error:", error.name, error.code || "")
    res.status(500).json({ message: "Failed to retrieve customer details" })
  }
})

/**
 * GET /api/customers/:id/statement
 * Generates an account statement for a customer over a date range.
 * Tenant isolated, strictly zero Aadhaar/PII projection.
 */
router.get("/:id/statement", verifyToken, async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      userId: req.user.id,
      deletedAt: null,
    }).lean()

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" })
    }

    // Fetch customer bookings (by customerId OR normalized phone fallback)
    const bookings = await Booking.find({
      userId: req.user.id,
      deletedAt: null,
      $or: [
        { customerId: customer._id },
        { contactPhone: { $regex: new RegExp(customer.phone + "$") } },
      ],
    })
      .select("-passengers.aadhar -passengers.aadhaar")
      .sort({ date: 1, createdAt: 1 })
      .lean()

    // Fetch operator settings for branding
    const user = await User.findById(req.user.id)
      .select("companyName companyTagline companyHeadquarters companyPhone companyLogo gstNumber email")
      .lean()

    const operatorSettings = {
      companyName: user?.companyName || "YatraHub Tours & Travels",
      companyTagline: user?.companyTagline || "",
      address: user?.companyHeadquarters || "",
      phone: user?.companyPhone || "",
      email: user?.email || "",
      gstin: user?.gstNumber || "",
      companyLogo: user?.companyLogo || "",
    }

    const { from, to } = req.query
    const statement = buildCustomerStatement({
      customer,
      bookings,
      from,
      to,
    })

    res.json({
      success: true,
      customer: statement.customer,
      statement,
      operatorSettings,
    })
  } catch (error) {
    console.error("Customer statement generation error:", error.name, error.code || "")
    res.status(500).json({ message: "Failed to generate customer statement" })
  }
})

/**
 * POST /api/customers/link-bookings
 * In-app auto-linker for unlinked bookings belonging to this operator.
 */
router.post("/link-bookings", verifyToken, customerWriteLimiter, async (req, res) => {
  try {
    const result = await linkUnlinkedBookings({ userId: req.user.id, apply: true })

    await logAudit({
      userId: req.user.id,
      action: "customers.link_bookings",
      req,
      meta: {
        linkedCount: result.linkedCount,
        skippedCount: result.skippedCount,
      },
    })

    res.json({
      success: true,
      message: `Successfully linked ${result.linkedCount} booking(s).`,
      summary: {
        scanned: result.scannedCount,
        linked: result.linkedCount,
        skipped: result.skippedCount,
      },
      linkedCount: result.linkedCount,
      skippedCount: result.skippedCount,
      unresolved: result.unresolved,
    })
  } catch (error) {
    console.error("Link bookings error:", error.name, error.code || "")
    res.status(500).json({ message: "Failed to link bookings to customer profiles" })
  }
})

/**
 * POST /api/customers
 * Creates a new customer manually with unique phone validation per operator.
 */
router.post("/", verifyToken, customerWriteLimiter, async (req, res) => {
  try {
    const input = createCustomerSchema.parse(req.body)

    // Check duplicate phone for this tenant
    const existing = await Customer.findOne({
      userId: req.user.id,
      phone: input.phone,
      deletedAt: null,
    })

    if (existing) {
      return res.status(409).json({ message: "A customer with this phone number already exists." })
    }

    const newCustomer = new Customer({
      ...input,
      userId: req.user.id,
      source: "manual",
      deletedAt: null,
    })

    const saved = await newCustomer.save()

    // Relink any bookings pointing to soft-deleted versions of this customer, or unlinked with this phone
    try {
      const oldSoftDeleted = await Customer.find({
        userId: req.user.id,
        phone: input.phone,
        deletedAt: { $ne: null },
      }).select("_id").lean()
      const oldCustomerIds = oldSoftDeleted.map((c) => c._id)

      const filterConditions = [
        { customerId: null, contactPhone: { $regex: new RegExp(input.phone + "$") } },
      ]
      if (oldCustomerIds.length > 0) {
        filterConditions.push({ customerId: { $in: oldCustomerIds } })
      }

      await Booking.updateMany(
        {
          userId: req.user.id,
          $or: filterConditions,
        },
        { $set: { customerId: saved._id } }
      )
    } catch {
      // Non-blocking relinking: never fail customer creation if relinking encounters an error
    }

    await logAudit({
      userId: req.user.id,
      action: "customer_created",
      req,
      meta: {
        customerId: saved._id.toString(),
      },
    })

    await recordHistory({
      userId: req.user.id,
      entityType: "customer",
      entityId: saved._id,
      action: "created",
      user: req.user,
    })

    res.status(201).json({
      ...saved.toObject(),
      id: saved._id.toString(),
    })
  } catch (error) {
    console.error("Customer create error:", error.name, error.code || "")
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: error.errors[0]?.message || "Invalid customer data",
        errors: error.errors,
      })
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: "A customer with this phone number already exists." })
    }
    res.status(500).json({ message: "Failed to create customer" })
  }
})

/**
 * PUT /api/customers/:id
 * Updates customer profile details.
 */
router.put("/:id", verifyToken, customerWriteLimiter, async (req, res) => {
  try {
    const input = updateCustomerSchema.parse(req.body)

    const customer = await Customer.findOne({
      _id: req.params.id,
      userId: req.user.id,
      deletedAt: null,
    })

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" })
    }

    const before = customer.toObject()

    // If phone is being changed, ensure it doesn't collide with another customer
    if (input.phone && input.phone !== customer.phone) {
      const duplicate = await Customer.findOne({
        userId: req.user.id,
        phone: input.phone,
        _id: { $ne: customer._id },
        deletedAt: null,
      })

      if (duplicate) {
        return res.status(409).json({ message: "Another customer already has this phone number." })
      }
    }

    Object.assign(customer, input)
    const updated = await customer.save()

    await recordHistory({
      userId: req.user.id,
      entityType: "customer",
      entityId: updated._id,
      action: "updated",
      before,
      after: updated.toObject(),
      user: req.user,
    })

    await logAudit({
      userId: req.user.id,
      action: "customer_updated",
      req,
      meta: {
        customerId: updated._id.toString(),
        changedFields: Object.keys(input),
      },
    })

    res.json({
      ...updated.toObject(),
      id: updated._id.toString(),
    })
  } catch (error) {
    console.error("Customer update error:", error.name, error.code || "")
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: error.errors[0]?.message || "Invalid customer update data",
        errors: error.errors,
      })
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: "Another customer already has this phone number." })
    }
    res.status(500).json({ message: "Failed to update customer" })
  }
})

/**
 * DELETE /api/customers/:id
 * Soft deletes customer without deleting associated historical bookings.
 */
router.delete("/:id", verifyToken, customerWriteLimiter, async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      userId: req.user.id,
      deletedAt: null,
    })

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" })
    }

    customer.deletedAt = new Date()
    customer.deletedBy = req.user.id
    await customer.save()

    await recordHistory({
      userId: req.user.id,
      entityType: "customer",
      entityId: customer._id,
      action: "deleted",
      user: req.user,
    })

    await logAudit({
      userId: req.user.id,
      action: "customer_deleted",
      req,
      meta: {
        customerId: customer._id.toString(),
      },
    })

    res.json({ message: "Customer deleted successfully" })
  } catch (error) {
    console.error("Customer deletion error:", error.name, error.code || "")
    res.status(500).json({ message: "Failed to delete customer" })
  }
})

export default router
