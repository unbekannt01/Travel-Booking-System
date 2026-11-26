import express from "express"
import rateLimit from "express-rate-limit"
import { z } from "zod"
import BookingGroup from "../models/BookingGroup.js"
import Booking from "../models/Booking.js"
import Payment from "../models/Payment.js"
import GroupPayment from "../models/GroupPayment.js"
import User from "../models/User.js"
import Tour from "../models/Tour.js"
import DepartureSeatConfig from "../models/DepartureSeatConfig.js"
import verifyToken from "../middleware/auth.js"
import { assertBooksOpen } from "../utils/booksLock.js"
import { getNextReceiptNo, syncBookingPayments } from "./payments.js"
import { parseDepartureKey, getBusCondition } from "../utils/departureKey.js"
import { createBookingCore, checkSeatConflicts, validateSeatLayout, maskBookingPaxAadhaar } from "./bookings.js"
import { logAudit } from "../models/AuditLog.js"
import {
  toPaise,
  fromPaise,
  calculateProportionalAllocation,
  calculateEqualAllocation,
  validateManualAllocation,
} from "../../shared/groupPayments.js"
import { getSeatLayout, layoutKeyForBusType, isValidBusType, normalizeBusType, isUpperBerthSeat } from "../../shared/seatLayouts.js"
import { validateIndianPhone, getDayBounds } from "../../shared/businessLogic.js"

const router = express.Router()

// Dedicated rate limiters matching project style
const groupReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { message: "Too many group requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
})

const groupWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: "Too many group write operations. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
})

// POST /api/groups - Create a group with its member bookings
router.post("/", verifyToken, groupWriteLimiter, async (req, res) => {
  try {
    const createGroupSchema = z
      .object({
        name: z.string().trim().min(1, "Group name is required").max(80),
        leaderName: z.string().trim().max(80).optional().default(""),
        leaderPhone: z.string().trim().optional().default(""),
        tourName: z.string().trim().min(1, "Tour name is required"),
        journeyDate: z.string().min(1, "Journey date is required"),
        busType: z.string().min(1, "Bus type is required"),
        note: z.string().max(200).optional().default(""),
        members: z.array(z.record(z.any())).min(1, "At least one member booking is required").max(60),
      })
      .strict()

    const parseResult = createGroupSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        message: "Validation failed: " + parseResult.error.errors.map((e) => e.message).join(", "),
      })
    }

    const { name, leaderName, leaderPhone, tourName, journeyDate, busType, note, members } = parseResult.data

    if (leaderPhone && !validateIndianPhone(leaderPhone)) {
      return res.status(400).json({ message: "Please provide a valid 10-digit Indian mobile number for group leader." })
    }

    if (!isValidBusType(busType)) {
      return res.status(400).json({ message: `Invalid bus type '${busType}'.` })
    }
    const canonicalBusType = normalizeBusType(busType)
    const layoutKey = layoutKeyForBusType(canonicalBusType)
    const layoutDef = getSeatLayout(layoutKey)
    const totalCapacity = layoutDef?.capacity || 60

    const { start: normalizedJourneyDate } = getDayBounds(journeyDate)

    // Pre-validation pass 1: Inter-member duplicate seats & capacity
    let totalSeatsAcrossMembers = 0
    const allAssignedSeats = new Set()

    for (let i = 0; i < members.length; i++) {
      const m = members[i]
      const paxList = Array.isArray(m.passengers) ? m.passengers : []
      if (paxList.length === 0) {
        return res.status(400).json({ message: `Member ${i + 1} must have at least one passenger.` })
      }

      const layoutErr = validateSeatLayout(paxList, canonicalBusType)
      if (layoutErr) {
        return res.status(layoutErr.status || 400).json({
          message: `Member ${i + 1} (${m.contactName || "Contact"}): ${layoutErr.message}`,
        })
      }

      for (const p of paxList) {
        totalSeatsAcrossMembers++
        if (p.seatId) {
          if (allAssignedSeats.has(p.seatId)) {
            return res.status(409).json({
              code: "SEAT_CONFLICT",
              message: `Duplicate seat '${p.seatId}' detected across group members. Each seat can be assigned to only one passenger.`,
              conflictingSeats: [p.seatId],
            })
          }
          allAssignedSeats.add(p.seatId)
        }
      }

      // Check books lock if member has advance
      const checkAdvance = Math.round(Number(m.advanceReceived || 0) * 100) / 100
      if (checkAdvance > 0) {
        const bDate = m.date || new Date()
        await assertBooksOpen(req.user.id, bDate)
      }
    }

    if (totalSeatsAcrossMembers > totalCapacity) {
      return res.status(400).json({
        message: `Total requested seats (${totalSeatsAcrossMembers}) exceeds coach layout capacity (${totalCapacity}).`,
      })
    }

    // Pre-validation pass 2: Seat conflicts on departure against existing bookings and active holds
    for (let i = 0; i < members.length; i++) {
      const m = members[i]
      const conflict = await checkSeatConflicts({
        userId: req.user.id,
        tourName,
        journeyDate: normalizedJourneyDate,
        busType: canonicalBusType,
        passengers: m.passengers,
        holdId: m.holdId || null,
        overrideLadies: m.overrideLadies,
        overrideReason: m.overrideReason,
      })
      if (conflict && (conflict.conflictingSeats || conflict.status)) {
        return res.status(conflict.status || 409).json({
          code: conflict.code || "SEAT_CONFLICT",
          message: `Member ${i + 1} (${m.contactName || "Contact"}): ${conflict.message}`,
          conflictingSeats: conflict.conflictingSeats,
          holdInfo: conflict.holdInfo,
        })
      }
    }

    // All pre-validations passed. Create group record.
    const group = new BookingGroup({
      userId: req.user.id,
      name,
      leaderName,
      leaderPhone,
      tourName,
      journeyDate: normalizedJourneyDate,
      busType: canonicalBusType,
      note,
      status: "active",
    })
    await group.save()

    // Sequentially create members using the shared core booking function
    const createdBookings = []
    try {
      for (let i = 0; i < members.length; i++) {
        const memberPayload = {
          ...members[i],
          tourName,
          journeyDate,
          busType: canonicalBusType,
          totalAmount: Number(members[i].totalAmount || members[i].fare || 0),
          groupId: group._id,
        }
        const { booking } = await createBookingCore({
          userId: req.user.id,
          user: req.user,
          userDoc: req.userDoc,
          body: memberPayload,
          req,
          groupId: group._id,
        })
        createdBookings.push(booking)
      }
    } catch (createErr) {
      console.error("[POST /api/groups member create error]:", createErr)
      // Mid-creation failure: rollback compensation
      if (createdBookings.length > 0) {
        const ids = createdBookings.map((b) => b._id)
        await Booking.updateMany(
          { _id: { $in: ids }, userId: req.user.id },
          { $set: { deletedAt: new Date() } }
        )
      }
      group.status = "disbanded"
      await group.save()

      await logAudit({
        userId: req.user.id,
        action: "GROUP_CREATE_FAILED_ROLLBACK",
        req,
        meta: {
          groupId: group._id,
          compensatedCount: createdBookings.length,
          error: createErr.message,
        },
      })

      return res.status(createErr.status || 409).json({
        code: createErr.code || "GROUP_CREATE_FAILED",
        message: `Group booking failed during member ${createdBookings.length + 1} creation: ${createErr.message}. Rolled back ${createdBookings.length} created members.`,
        compensatedBookingIds: createdBookings.map((b) => b._id),
      })
    }

    await logAudit({
      userId: req.user.id,
      action: "GROUP_CREATED",
      req,
      meta: {
        groupId: group._id,
        name: group.name,
        memberCount: createdBookings.length,
        seatCount: totalSeatsAcrossMembers,
      },
    })

    res.status(201).json({
      group,
      members: createdBookings.map(maskBookingPaxAadhaar),
    })
  } catch (error) {
    if (error.statusCode === 423 || error.name === "BooksLockedError") {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
    res.status(error.status || 400).json({
      code: error.code,
      message: error.message,
      conflictingSeats: error.conflictingSeats,
    })
  }
})

// GET /api/departures/:key/groups - List groups for a specific departure with authoritative totals
router.get("/departure/:key", verifyToken, groupReadLimiter, async (req, res) => {
  try {
    const parsed = parseDepartureKey(req.params.key)
    if (!parsed) {
      return res.status(400).json({ message: "Invalid departure key format." })
    }
    const { tourName, busType, start, end } = parsed
    const busCondition = getBusCondition(busType)

    const groups = await BookingGroup.find({
      userId: req.user.id,
      tourName,
      journeyDate: { $gte: start, $lte: end },
      ...busCondition,
      status: "active",
    }).sort({ createdAt: -1 })

    // Lazily bridge multi-passenger bookings (2+ pax or with groupName) into real BookingGroup records idempotently
    try {
      const standaloneMultiPax = await Booking.find({
        userId: req.user.id,
        tourName,
        journeyDate: { $gte: start, $lte: end },
        ...busCondition,
        deletedAt: null,
        $and: [
          { $or: [{ groupId: null }, { groupId: { $exists: false } }] },
          {
            $or: [
              { "passengers.1": { $exists: true } },
              { groupName: { $exists: true, $nin: ["", null] } },
            ],
          },
        ],
      })

      for (const b of standaloneMultiPax) {
        const pCount = b.passengers?.length || 1
        const leadName = b.passengers?.[0]?.name || b.contactName || "Traveler"
        const grpName = b.groupName?.trim() || `${leadName} + ${pCount - 1}`

        let targetGroup = groups.find((g) => g.name.toLowerCase() === grpName.toLowerCase())
        if (!targetGroup) {
          targetGroup = new BookingGroup({
            userId: req.user.id,
            name: grpName,
            leaderName: leadName,
            leaderPhone: b.contactPhone || "",
            tourName: b.tourName,
            journeyDate: b.journeyDate,
            busType: b.busType || "2x1 Sleeper Luxury",
            note: "Auto group from multi-passenger booking",
            status: "active",
          })
          await targetGroup.save()
          groups.push(targetGroup)
        }
        b.groupId = targetGroup._id
        if (!b.groupName) b.groupName = grpName
        await b.save()
      }
    } catch (lazyErr) {
      console.warn("[GroupsDeparture] Non-blocking lazy group bridging error:", lazyErr.message)
    }

    if (groups.length === 0) {
      return res.json({ groups: [] })
    }

    const groupIds = groups.map((g) => g._id)
    const memberBookings = await Booking.find({
      userId: req.user.id,
      groupId: { $in: groupIds },
      deletedAt: null,
    })

    const groupPayments = await GroupPayment.find({
      userId: req.user.id,
      groupId: { $in: groupIds },
      status: "recorded",
    })

    // Authoritative payment ledger lookup for all member bookings
    const memberBookingIds = memberBookings.map((b) => b._id)
    const ledgerPayments = await Payment.find({
      userId: req.user.id,
      bookingId: { $in: memberBookingIds },
      isVoid: false,
    })
    const paidByMemberBooking = new Map()
    for (const pay of ledgerPayments) {
      const bId = pay.bookingId.toString()
      const amt = pay.type === "refund" ? -pay.amount : pay.amount
      paidByMemberBooking.set(bId, (paidByMemberBooking.get(bId) || 0) + amt)
    }

    const tourDoc =
      (await Tour.findOne({ userId: req.user.id, name: tourName })) ||
      (await Tour.findOne({ name: tourName }))

    const seatConfig = await DepartureSeatConfig.findOne({
      userId: req.user.id,
      tourName,
      journeyDate: { $gte: start, $lte: end },
    })

    const lowerPrice = seatConfig?.fares?.lower || tourDoc?.lowerPrice || 0
    const upperPrice = seatConfig?.fares?.upper || tourDoc?.upperPrice || 0

    const enrichedGroups = groups.map((g) => {
      const members = memberBookings.filter((b) => b.groupId && b.groupId.toString() === g._id.toString())
      const payments = groupPayments.filter((p) => p.groupId && p.groupId.toString() === g._id.toString())

      let seatCount = 0
      let totalAmount = 0
      let advanceReceived = 0

      for (const m of members) {
        seatCount += m.passengers?.length || 0
        totalAmount += m.totalAmount || 0
        const mPaid = paidByMemberBooking.has(m._id.toString())
          ? Math.max(0, paidByMemberBooking.get(m._id.toString()))
          : (m.advanceReceived !== undefined && m.advanceReceived !== null
            ? Number(m.advanceReceived || 0)
            : (Array.isArray(m.payments) ? m.payments.filter((p) => !p.isVoid).reduce((s, p) => s + (Number(p.amount) || 0), 0) : 0))
        advanceReceived += mPaid
      }

      const gDiscount = Number(g.discount || 0)
      totalAmount = Math.round(totalAmount * 100) / 100
      advanceReceived = Math.round(advanceReceived * 100) / 100
      const netPayable = Math.max(0, Math.round((totalAmount - gDiscount) * 100) / 100)
      const balanceDue = Math.max(0, Math.round((netPayable - advanceReceived) * 100) / 100)

      return {
        ...g.toObject(),
        memberCount: members.length,
        seatCount,
        totalAmount,
        discount: gDiscount,
        netPayable,
        advanceReceived,
        balanceDue,
        lowerPrice,
        upperPrice,
        groupPaymentCount: payments.length,
      }
    })

    res.json({ groups: enrichedGroups })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// GET /api/groups/:id - Detail view of a single group
router.get("/:id", verifyToken, groupReadLimiter, async (req, res) => {
  try {
    let group = null
    try {
      group = await BookingGroup.findOne({ _id: req.params.id, userId: req.user.id })
    } catch {
      // not a valid ObjectId or not found
    }

    if (!group) {
      try {
        const b = await Booking.findOne({ _id: req.params.id, userId: req.user.id, deletedAt: null })
        if (b && (b.groupId || (b.passengers && b.passengers.length > 1) || b.groupName)) {
          if (b.groupId) {
            group = await BookingGroup.findOne({ _id: b.groupId, userId: req.user.id })
          } else {
            const pCount = b.passengers?.length || 1
            const leadName = b.passengers?.[0]?.name || b.contactName || "Traveler"
            const grpName = b.groupName?.trim() || `${leadName} + ${pCount - 1}`
            group = new BookingGroup({
              userId: req.user.id,
              name: grpName,
              leaderName: leadName,
              leaderPhone: b.contactPhone || "",
              tourName: b.tourName,
              journeyDate: b.journeyDate,
              busType: b.busType || "2x1 Sleeper Luxury",
              note: "Auto group from multi-passenger booking",
              status: "active",
            })
            await group.save()
            b.groupId = group._id
            if (!b.groupName) b.groupName = grpName
            await b.save()
          }
        }
      } catch (err) {
        console.warn("[GroupDetail] Error resolving group for booking ID:", err.message)
      }
    }

    if (!group) {
      return res.status(404).json({ message: "Group not found." })
    }

    const { start, end } = getDayBounds(group.journeyDate)
    const tourDoc =
      (await Tour.findOne({ userId: req.user.id, name: group.tourName })) ||
      (await Tour.findOne({ name: group.tourName }))

    const seatConfig = await DepartureSeatConfig.findOne({
      userId: req.user.id,
      tourName: group.tourName,
      journeyDate: { $gte: start, $lte: end },
    })

    const lowerPrice = seatConfig?.fares?.lower || tourDoc?.lowerPrice || 0
    const upperPrice = seatConfig?.fares?.upper || tourDoc?.upperPrice || 0

    const members = await Booking.find({
      userId: req.user.id,
      groupId: group._id,
      deletedAt: null,
    }).sort({ createdAt: 1 })

    const payments = await GroupPayment.find({
      userId: req.user.id,
      groupId: group._id,
    }).sort({ date: -1, createdAt: -1 })

    // Authoritative payment ledger lookup for all member bookings
    const memberIds = members.map((b) => b._id)
    const ledgerPayments = await Payment.find({
      userId: req.user.id,
      bookingId: { $in: memberIds },
      isVoid: false,
    })
    const paidByMemberBooking = new Map()
    for (const pay of ledgerPayments) {
      const bId = pay.bookingId.toString()
      const amt = pay.type === "refund" ? -pay.amount : pay.amount
      paidByMemberBooking.set(bId, (paidByMemberBooking.get(bId) || 0) + amt)
    }

    let seatCount = 0
    let totalAmount = 0
    let advanceReceived = 0

    const enrichedMembers = members.map((m) => {
      const masked = maskBookingPaxAadhaar(m)
      const mPaid = paidByMemberBooking.has(m._id.toString())
        ? Math.max(0, paidByMemberBooking.get(m._id.toString()))
        : (m.advanceReceived !== undefined && m.advanceReceived !== null
          ? Number(m.advanceReceived || 0)
          : (Array.isArray(m.payments) ? m.payments.filter((p) => !p.isVoid).reduce((s, p) => s + (Number(p.amount) || 0), 0) : 0))

      const mTotal = Number(m.totalAmount || 0)
      masked.advanceReceived = mPaid
      masked.balanceDue = Math.max(0, Math.round((mTotal - mPaid) * 100) / 100)
      masked.isPaid = masked.balanceDue === 0 && mTotal > 0
      masked.payments = ledgerPayments.filter((p) => p.bookingId.toString() === m._id.toString())
      masked.lowerPrice = lowerPrice
      masked.upperPrice = upperPrice

      // Enrich individual passengers with Upper/Lower berth pricing and proportional payment
      const pList = masked.passengers || []
      const pCount = Math.max(1, pList.length)
      const expectedFares = pList.map((p) => {
        if (p.fare !== undefined && p.fare !== null && Number(p.fare) > 0) {
          return Number(p.fare)
        }
        const isUp = isUpperBerthSeat(p.seatId)
        if (isUp && upperPrice > 0) return upperPrice
        if (!isUp && lowerPrice > 0) return lowerPrice
        return 0
      })
      const sumExpected = expectedFares.reduce((a, c) => a + c, 0)
      let pFares = []

      if (sumExpected > 0 && sumExpected === mTotal) {
        pFares = expectedFares
      } else if (sumExpected > 0 && mTotal > 0) {
        let assignedSum = 0
        pFares = expectedFares.map((f) => {
          const scaled = Math.floor((mTotal * f) / sumExpected)
          assignedSum += scaled
          return scaled
        })
        let rem = mTotal - assignedSum
        let idx = 0
        while (rem > 0 && idx < pFares.length * 2) {
          pFares[idx % pFares.length] += 1
          rem -= 1
          idx++
        }
      } else {
        const baseFare = Math.floor(mTotal / pCount)
        let fareRemainder = mTotal - (baseFare * pCount)
        pFares = pList.map(() => {
          const f = baseFare + (fareRemainder > 0 ? 1 : 0)
          if (fareRemainder > 0) fareRemainder--
          return f
        })
      }

      let pPaids = []
      if (mPaid >= mTotal && mTotal > 0) {
        pPaids = pFares.slice()
      } else if (mPaid > 0 && mTotal > 0) {
        let paidSum = 0
        pPaids = pFares.map((f) => {
          const pd = Math.min(f, Math.floor((mPaid * f) / mTotal))
          paidSum += pd
          return pd
        })
        let remPaid = mPaid - paidSum
        let pIdx = 0
        while (remPaid > 0 && pIdx < pPaids.length * 2) {
          const currIdx = pIdx % pPaids.length
          if (pPaids[currIdx] < pFares[currIdx]) {
            pPaids[currIdx] += 1
            remPaid -= 1
          }
          pIdx++
        }
      } else {
        pPaids = pList.map(() => 0)
      }

      masked.passengers = pList.map((p, idx) => {
        const isUp = isUpperBerthSeat(p.seatId)
        const fare = pFares[idx] || 0
        const paid = pPaids[idx] || 0
        const bal = Math.max(0, fare - paid)
        return {
          ...p,
          fare,
          paid,
          balance: bal,
          deck: isUp ? "Upper" : "Lower",
        }
      })

      seatCount += m.passengers?.length || 0
      totalAmount += mTotal
      advanceReceived += mPaid
      return masked
    })

    totalAmount = Math.round(totalAmount * 100) / 100
    advanceReceived = Math.round(advanceReceived * 100) / 100
    const groupDiscount = Math.max(0, Number(group.discount || 0))
    const netPayable = Math.max(0, Math.round((totalAmount - groupDiscount) * 100) / 100)
    const balanceDue = Math.max(0, Math.round((netPayable - advanceReceived) * 100) / 100)

    res.json({
      group: {
        ...group.toObject(),
        discount: groupDiscount,
        netPayable,
        lowerPrice,
        upperPrice,
      },
      members: enrichedMembers,
      payments,
      memberPayments: ledgerPayments,
      lowerPrice,
      upperPrice,
      totals: {
        memberCount: members.length,
        seatCount,
        totalAmount,
        discount: groupDiscount,
        netPayable,
        advanceReceived,
        balanceDue,
        lowerPrice,
        upperPrice,
      },
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// PATCH /api/groups/:id - Update group metadata & discount
router.patch("/:id", verifyToken, groupWriteLimiter, async (req, res) => {
  try {
    const group = await BookingGroup.findOne({ _id: req.params.id, userId: req.user.id })
    if (!group) {
      return res.status(404).json({ message: "Group not found." })
    }

    const { name, leaderName, leaderPhone, note, discount } = req.body
    if (name !== undefined) {
      const cleanName = String(name).trim()
      if (!cleanName) return res.status(400).json({ message: "Group name cannot be empty." })
      group.name = cleanName.slice(0, 80)
    }
    if (leaderName !== undefined) {
      group.leaderName = String(leaderName).trim().slice(0, 80)
    }
    if (leaderPhone !== undefined) {
      const cleanPhone = String(leaderPhone).trim()
      if (cleanPhone && !validateIndianPhone(cleanPhone)) {
        return res.status(400).json({ message: "Invalid leader phone number." })
      }
      group.leaderPhone = cleanPhone
    }
    if (note !== undefined) {
      group.note = String(note).slice(0, 200)
    }
    if (discount !== undefined) {
      group.discount = Math.max(0, Number(discount) || 0)
    }

    await group.save()

    await logAudit({
      userId: req.user.id,
      action: "GROUP_UPDATED",
      req,
      meta: { groupId: group._id, name: group.name },
    })

    res.json(group)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// POST /api/groups/:id/members - Add existing bookings to group
router.post("/:id/members", verifyToken, groupWriteLimiter, async (req, res) => {
  try {
    const group = await BookingGroup.findOne({ _id: req.params.id, userId: req.user.id })
    if (!group) {
      return res.status(404).json({ message: "Group not found." })
    }
    if (group.status !== "active") {
      return res.status(400).json({ message: "Cannot add members to a disbanded group." })
    }

    const bookingIds = Array.isArray(req.body.bookingIds)
      ? req.body.bookingIds
      : req.body.bookingId
        ? [req.body.bookingId]
        : []

    if (bookingIds.length === 0) {
      return res.status(400).json({ message: "No booking IDs provided." })
    }

    const bookings = await Booking.find({
      _id: { $in: bookingIds },
      userId: req.user.id,
      deletedAt: null,
    })

    if (bookings.length === 0) {
      return res.status(404).json({ message: "No valid bookings found to add." })
    }

    // Verify each booking belongs to same departure and is not in another group
    const { start: groupDate } = getDayBounds(group.journeyDate)
    const addedIds = []

    for (const b of bookings) {
      const { start: bDate } = getDayBounds(b.journeyDate)
      const sameDeparture =
        b.tourName === group.tourName &&
        bDate.getTime() === groupDate.getTime() &&
        normalizeBusType(b.busType) === normalizeBusType(group.busType)

      if (!sameDeparture) {
        return res.status(400).json({
          message: `Booking ${b.invoiceNo} belongs to a different departure and cannot be added to this group.`,
        })
      }

      if (b.groupId && b.groupId.toString() !== group._id.toString()) {
        return res.status(400).json({
          message: `Booking ${b.invoiceNo} is already assigned to another group.`,
        })
      }

      b.groupId = group._id
      await b.save()
      addedIds.push(b._id)
    }

    await logAudit({
      userId: req.user.id,
      action: "GROUP_MEMBERS_ADDED",
      req,
      meta: { groupId: group._id, addedCount: addedIds.length, bookingIds: addedIds },
    })

    res.json({ message: `Added ${addedIds.length} booking(s) to group.`, addedIds })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// DELETE /api/groups/:id/members/:bookingId - Remove a booking from the group
router.delete("/:id/members/:bookingId", verifyToken, groupWriteLimiter, async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.bookingId,
      userId: req.user.id,
      groupId: req.params.id,
    })

    if (!booking) {
      return res.status(404).json({ message: "Booking not found in this group." })
    }

    booking.groupId = null
    await booking.save()

    await logAudit({
      userId: req.user.id,
      action: "GROUP_MEMBER_REMOVED",
      req,
      meta: { groupId: req.params.id, bookingId: booking._id, invoiceNo: booking.invoiceNo },
    })

    res.json({ message: `Booking ${booking.invoiceNo} removed from group.` })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// POST /api/groups/:id/disband - Disband group (clears groupId on members, retains bookings & payments)
router.post("/:id/disband", verifyToken, groupWriteLimiter, async (req, res) => {
  try {
    const group = await BookingGroup.findOne({ _id: req.params.id, userId: req.user.id })
    if (!group) {
      return res.status(404).json({ message: "Group not found." })
    }

    group.status = "disbanded"
    await group.save()

    await Booking.updateMany(
      { userId: req.user.id, groupId: group._id },
      { $set: { groupId: null } }
    )

    await logAudit({
      userId: req.user.id,
      action: "GROUP_DISBANDED",
      req,
      meta: { groupId: group._id, name: group.name },
    })

    res.json({ message: "Group disbanded successfully. Member bookings remain intact." })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// POST /api/groups/:id/payments - Record a single total payment split across group members
router.post("/:id/payments", verifyToken, groupWriteLimiter, async (req, res) => {
  try {
    const paymentSchema = z
      .object({
        idempotencyKey: z.string().trim().min(1, "Idempotency key is required"),
        amount: z.number().positive("Payment amount must be greater than zero"),
        paymentDate: z.string().optional(),
        paymentMode: z.enum(["Cash", "UPI", "Card", "Net Banking", "Cheque"]).default("Cash"),
        referenceNo: z.string().max(80).optional().default(""),
        notes: z.string().max(200).optional().default(""),
        allocationMethod: z.enum(["proportional", "equal", "manual"]).default("proportional"),
        manualAllocations: z.record(z.number()).optional().default({}),
      })
      .strict()

    const parseResult = paymentSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        message: "Validation failed: " + parseResult.error.errors.map((e) => e.message).join(", "),
      })
    }

    const {
      idempotencyKey,
      amount,
      paymentDate,
      paymentMode,
      referenceNo,
      notes,
      allocationMethod,
      manualAllocations,
    } = parseResult.data

    // 1. Idempotency check: repeated key returns original payment record
    const existingPayment = await GroupPayment.findOne({
      userId: req.user.id,
      idempotencyKey,
    })
    if (existingPayment) {
      return res.status(200).json({
        groupPayment: existingPayment,
        message: "Payment already recorded (idempotent response).",
        repeated: true,
      })
    }

    // 2. Books lock check up front
    const targetDate = paymentDate ? new Date(paymentDate) : new Date()
    await assertBooksOpen(req.user.id, targetDate)

    const group = await BookingGroup.findOne({ _id: req.params.id, userId: req.user.id })
    if (!group) {
      return res.status(404).json({ message: "Group not found." })
    }

    const members = await Booking.find({
      userId: req.user.id,
      groupId: group._id,
      deletedAt: null,
    }).sort({ createdAt: 1 })

    if (members.length === 0) {
      return res.status(400).json({ message: "No active member bookings in this group." })
    }

    // 3. Prepare member balances in integer paise
    const membersWithBalances = members.map((m) => {
      const bal = Math.max(0, (m.totalAmount || 0) - (m.advanceReceived || 0))
      return {
        bookingId: m._id.toString(),
        name: m.contactName,
        invoiceNo: m.invoiceNo,
        balancePaise: toPaise(bal),
        balanceRupees: bal,
      }
    })

    const totalGroupBalancePaise = membersWithBalances.reduce((acc, m) => acc + m.balancePaise, 0)
    const totalPaise = toPaise(amount)

    if (totalGroupBalancePaise <= 0) {
      return res.status(400).json({ message: "All members of this group are already fully paid." })
    }

    if (totalPaise > totalGroupBalancePaise) {
      return res.status(400).json({
        message: `Payment amount ₹${fromPaise(totalPaise)} exceeds total group balance due of ₹${fromPaise(totalGroupBalancePaise)}. Maximum payable is ₹${fromPaise(totalGroupBalancePaise)}.`,
      })
    }

    // 4. Compute allocation based on selected method
    let allocationResult
    if (allocationMethod === "proportional") {
      allocationResult = calculateProportionalAllocation({
        totalPaise,
        members: membersWithBalances,
      })
    } else if (allocationMethod === "equal") {
      allocationResult = calculateEqualAllocation({
        totalPaise,
        members: membersWithBalances,
      })
    } else if (allocationMethod === "manual") {
      // Convert manual rupee allocations to integer paise
      const manualPaise = {}
      for (const [k, v] of Object.entries(manualAllocations || {})) {
        manualPaise[k] = toPaise(v)
      }
      allocationResult = validateManualAllocation({
        totalPaise,
        members: membersWithBalances,
        manualAllocations: manualPaise,
      })
    }

    if (!allocationResult || !allocationResult.valid) {
      return res.status(400).json({
        message: allocationResult?.error || "Payment allocation calculation failed.",
      })
    }

    // 5. Generate unique group payment ID
    const groupPaymentId = `GP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`

    // Fetch user for receiptPrefix
    const userDoc = await User.findById(req.user.id).select("receiptPrefix")
    const receiptPrefix = userDoc?.receiptPrefix || "REC"

    // 6. Record individual payment records using existing single-booking payment path
    const recordedAllocations = []
    const createdPayments = []

    try {
      for (const alloc of allocationResult.allocations) {
        if (alloc.allocatedPaise > 0) {
          const allocRupees = alloc.allocatedRupees

          // Retry loop for unique receipt number
          let newPayment = null
          let attempts = 0
          while (attempts < 5) {
            attempts++
            try {
              const receiptNo = await getNextReceiptNo(req.user.id, receiptPrefix)
              newPayment = new Payment({
                userId: req.user.id,
                bookingId: alloc.bookingId,
                groupId: group._id,
                groupPaymentId,
                receiptNo,
                amount: allocRupees,
                type: alloc.allocatedPaise >= alloc.balancePaise ? "balance" : "partial",
                paymentMode,
                paymentDate: targetDate,
                referenceNo: referenceNo || "",
                notes: `Group payment ${groupPaymentId}${referenceNo ? " [" + referenceNo + "]" : ""} (${group.name})`,
                recordedBy: req.user.userName || req.user.email || "Operator",
              })
              await newPayment.save()
              break
            } catch (err) {
              if (err.code === 11000 && err.keyPattern && err.keyPattern.receiptNo) {
                continue
              }
              throw err
            }
          }

          if (!newPayment) {
            throw new Error(`Failed to generate unique receipt number for member booking ${alloc.invoiceNo}`)
          }

          createdPayments.push(newPayment)
          await syncBookingPayments(alloc.bookingId, req.user.id)

          recordedAllocations.push({
            bookingId: alloc.bookingId,
            paymentId: newPayment._id,
            receiptNo: newPayment.receiptNo,
            amount: allocRupees,
            amountPaise: alloc.allocatedPaise,
          })
        }
      }
    } catch (payErr) {
      // Partial failure handling: void already-created payments
      for (const p of createdPayments) {
        try {
          p.isVoid = true
          p.voidReason = "Group payment mid-way failure compensation"
          p.voidedAt = new Date()
          p.voidedBy = "System Rollback"
          await p.save()
          await syncBookingPayments(p.bookingId, req.user.id)
        } catch (vErr) {
          console.error("Warning: Compensation void failed:", vErr)
        }
      }

      await logAudit({
        userId: req.user.id,
        action: "GROUP_PAYMENT_FAILED_ROLLBACK",
        req,
        meta: {
          groupId: group._id,
          groupPaymentId,
          attemptedTotal: amount,
          error: payErr.message,
        },
      })

      return res.status(500).json({
        message: `Group payment recording failed mid-way: ${payErr.message}. Successfully rolled back ${createdPayments.length} member payment records.`,
      })
    }

    // 7. Save GroupPayment record
    const groupPayment = new GroupPayment({
      userId: req.user.id,
      groupId: group._id,
      groupPaymentId,
      idempotencyKey,
      totalAmount: fromPaise(totalPaise),
      totalPaise,
      date: targetDate,
      paymentMode,
      referenceNo,
      notes,
      allocations: recordedAllocations,
      status: "recorded",
      recordedBy: req.user.userName || req.user.email || "Operator",
    })
    await groupPayment.save()

    await logAudit({
      userId: req.user.id,
      action: "GROUP_PAYMENT_RECORDED",
      req,
      meta: {
        groupId: group._id,
        groupPaymentId,
        totalAmount: groupPayment.totalAmount,
        allocationCount: recordedAllocations.length,
      },
    })

    res.status(201).json({
      groupPayment,
      allocations: recordedAllocations,
      message: "Group payment recorded successfully.",
    })
  } catch (error) {
    if (error.statusCode === 423 || error.name === "BooksLockedError") {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
    res.status(error.status || 400).json({ message: error.message })
  }
})

// POST /api/groups/:id/payments/:groupPaymentId/undo - Reverses all member payments of a group payment
router.post("/:id/payments/:groupPaymentId/undo", verifyToken, groupWriteLimiter, async (req, res) => {
  try {
    const groupPayment = await GroupPayment.findOne({
      userId: req.user.id,
      groupId: req.params.id,
      groupPaymentId: req.params.groupPaymentId,
    })

    if (!groupPayment) {
      return res.status(404).json({ message: "Group payment record not found." })
    }

    if (groupPayment.status === "undone") {
      return res.status(400).json({ message: "This group payment has already been undone." })
    }

    // Books lock check on both payment date and current date
    await assertBooksOpen(req.user.id, groupPayment.date)
    await assertBooksOpen(req.user.id, new Date())

    const payments = await Payment.find({
      userId: req.user.id,
      groupPaymentId: req.params.groupPaymentId,
      isVoid: false,
    })

    const voidReason = req.body.reason || "Group payment undone by operator"

    for (const p of payments) {
      p.isVoid = true
      p.voidReason = voidReason
      p.voidedAt = new Date()
      p.voidedBy = req.user.userName || req.user.email || "Operator"
      await p.save()
      await syncBookingPayments(p.bookingId, req.user.id)
    }

    groupPayment.status = "undone"
    groupPayment.undoneAt = new Date()
    groupPayment.undoneBy = req.user.userName || req.user.email || "Operator"
    await groupPayment.save()

    await logAudit({
      userId: req.user.id,
      action: "GROUP_PAYMENT_UNDONE",
      req,
      meta: {
        groupId: req.params.id,
        groupPaymentId: groupPayment.groupPaymentId,
        voidedPaymentsCount: payments.length,
      },
    })

    res.json({
      groupPayment,
      message: `Group payment ${groupPayment.groupPaymentId} undone successfully. Rebalanced ${payments.length} member booking(s).`,
    })
  } catch (error) {
    if (error.statusCode === 423 || error.name === "BooksLockedError") {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
    res.status(500).json({ message: error.message })
  }
})

export default router
