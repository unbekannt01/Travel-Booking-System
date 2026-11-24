/**
 * YatraHub (TBS) — Pure Customer Linker Utility
 *
 * Scans active bookings without customerId, validates contact mobile numbers,
 * groups by (userId, normalizedPhone), links bookings, and creates Customer records.
 * Shared between backend routes (POST /api/customers/link-bookings) and CLI scripts.
 *
 * SAFETY & PRIVACY GUARANTEES:
 * - Scans only active bookings (deletedAt: null).
 * - Excludes cancelled or deleted bookings from modifying active customer accounts.
 * - Non-PII: returns counts, bookingIds, and error reason codes only (never customer names, phones, or emails).
 * - Enforces tenant isolation when userId is provided.
 */

import Booking from "../models/Booking.js"
import Customer from "../models/Customer.js"
import { normalizeIndianMobile, pickDisplayName } from "../../shared/customers.js"

export const UNLINKED_REASON_CODES = Object.freeze({
  MISSING_PHONE: "MISSING_PHONE",
  INVALID_PHONE: "INVALID_PHONE",
})

export const UNLINKED_REASON_DESCRIPTIONS = Object.freeze({
  MISSING_PHONE: "Contact mobile number is missing",
  INVALID_PHONE: "Contact mobile number is invalid (must be 10 digits starting with 6-9)",
})

/**
 * Evaluates an unlinked booking and returns its linking status and normalized phone.
 * @param {{ contactPhone?: string, contactName?: string }} booking
 * @returns {{ canLink: boolean, normalizedPhone?: string, reasonCode?: string, reasonDescription?: string }}
 */
export function evaluateBookingLinkability(booking) {
  if (!booking?.contactPhone || typeof booking.contactPhone !== "string" || !booking.contactPhone.trim()) {
    return {
      canLink: false,
      linkable: false,
      reasonCode: UNLINKED_REASON_CODES.MISSING_PHONE,
      reasonDescription: UNLINKED_REASON_DESCRIPTIONS.MISSING_PHONE,
    }
  }

  const { valid, normalized } = normalizeIndianMobile(booking.contactPhone)
  if (!valid || !normalized) {
    return {
      canLink: false,
      linkable: false,
      reasonCode: UNLINKED_REASON_CODES.INVALID_PHONE,
      reasonDescription: UNLINKED_REASON_DESCRIPTIONS.INVALID_PHONE,
    }
  }

  return {
    canLink: true,
    linkable: true,
    normalizedPhone: normalized,
    reasonCode: null,
    reasonDescription: null,
  }
}

/**
 * Scans unlinked bookings and links them to customer profiles.
 * @param {{ userId?: string|object, apply?: boolean }} options
 * @returns {Promise<{
 *   scannedCount: number,
 *   linkedCount: number,
 *   skippedCount: number,
 *   createdCustomerCount: number,
 *   existingCustomerCount: number,
 *   unresolved: Array<{ bookingId: string, invoiceNo: string, date: string, reasonCode: string, reasonDescription: string }>
 * }>}
 */
export async function linkUnlinkedBookings({ userId = null, apply = true } = {}) {
  const query = {
    $or: [{ customerId: null }, { customerId: { $exists: false } }],
    deletedAt: null,
  }

  if (userId) {
    query.userId = userId
  }

  const unlinkedBookings = await Booking.find(query)
    .select("_id userId invoiceNo contactName contactPhone contactEmail date createdAt")
    .lean()

  if (!unlinkedBookings || unlinkedBookings.length === 0) {
    return {
      scannedCount: 0,
      linkedCount: 0,
      skippedCount: 0,
      createdCustomerCount: 0,
      existingCustomerCount: 0,
      unresolved: [],
    }
  }

  const customerGroups = new Map() // key: `${userId}:::${normalizedPhone}`
  const unresolved = []

  for (const b of unlinkedBookings) {
    const evalResult = evaluateBookingLinkability(b)
    if (!evalResult.canLink) {
      unresolved.push({
        bookingId: b._id.toString(),
        invoiceNo: b.invoiceNo || "—",
        date: b.date ? new Date(b.date).toISOString().slice(0, 10) : "—",
        reasonCode: evalResult.reasonCode,
        reasonDescription: evalResult.reasonDescription,
      })
      continue
    }

    const key = `${b.userId.toString()}:::${evalResult.normalizedPhone}`
    if (!customerGroups.has(key)) {
      customerGroups.set(key, {
        userId: b.userId,
        phone: evalResult.normalizedPhone,
        names: [],
        emails: [],
        bookingIds: [],
      })
    }

    const group = customerGroups.get(key)
    if (b.contactName) group.names.push(b.contactName.trim())
    if (b.contactEmail) group.emails.push(b.contactEmail.trim())
    group.bookingIds.push(b._id)
  }

  let createdCustomerCount = 0
  let existingCustomerCount = 0
  let totalBookingsLinked = 0

  for (const [, group] of customerGroups) {
    const displayName = pickDisplayName(group.names) || "Customer"
    const candidateEmail = group.emails.find(Boolean) || ""
    const uniqueAliases = Array.from(new Set(group.names.filter((n) => n && n !== displayName))).slice(0, 5)

    if (apply) {
      // Find or create Customer
      let customer = await Customer.findOne({
        userId: group.userId,
        phone: group.phone,
        deletedAt: null,
      })

      if (customer) {
        existingCustomerCount++
        if (uniqueAliases.length > 0) {
          const currentAliases = new Set(customer.aliases || [])
          for (const alias of uniqueAliases) {
            if (currentAliases.size < 5) currentAliases.add(alias)
          }
          customer.aliases = Array.from(currentAliases)
          await customer.save().catch(() => {})
        }
      } else {
        createdCustomerCount++
        customer = new Customer({
          userId: group.userId,
          phone: group.phone,
          name: displayName,
          email: candidateEmail,
          language: "en",
          tags: [],
          notes: "",
          whatsappOptOut: false,
          aliases: uniqueAliases,
          source: "backfill",
          deletedAt: null,
        })
        await customer.save()
      }

      const updateRes = await Booking.updateMany(
        { _id: { $in: group.bookingIds } },
        { $set: { customerId: customer._id } }
      )
      totalBookingsLinked += updateRes.modifiedCount || group.bookingIds.length
    } else {
      // Dry-run mode
      const existing = await Customer.findOne({
        userId: group.userId,
        phone: group.phone,
        deletedAt: null,
      })
      if (existing) {
        existingCustomerCount++
      } else {
        createdCustomerCount++
      }
      totalBookingsLinked += group.bookingIds.length
    }
  }

  return {
    scannedCount: unlinkedBookings.length,
    linkedCount: totalBookingsLinked,
    skippedCount: unresolved.length,
    createdCustomerCount,
    existingCustomerCount,
    unresolved,
  }
}
