/**
 * YatraHub (TBS) — Pure Shared History, Diffing & Restore Engine (Part 6b)
 * Plain JavaScript ESM module with zero external dependencies.
 * Shared between backend (RecordHistory, routes, restore validation) and frontend (Trash, HistoryDrawer).
 *
 * RULES:
 * 1. Integer paise and YYYY-MM-DD date normalization for deterministic comparisons.
 * 2. Privacy-first: personal and free-text fields (names, phones, emails, Aadhaar, notes,
 *    addresses, vendor names, party names) NEVER record before/after values — only `changed: true`.
 * 3. Multi-language human summaries (en, hi, gu) for change audit logs.
 * 4. Deterministic restore conflict classification (BOOKS_LOCKED, NUMBER_CONFLICT, SEAT_CONFLICT, PARENT_DELETED, ALREADY_ACTIVE).
 */

export const HISTORY_ENTITIES = Object.freeze(["booking", "expense", "customer", "cashEntry"])

export const HISTORY_ACTIONS = Object.freeze(["created", "updated", "deleted", "restored", "cancelled"])

export const RESTORE_REASON_CODES = Object.freeze([
  "BOOKS_LOCKED",
  "NUMBER_CONFLICT",
  "SEAT_CONFLICT",
  "PARENT_DELETED",
  "ALREADY_ACTIVE",
])

/**
 * Whitelist of tracked fields per entity.
 * Kinds:
 * - 'money': integer paise comparison
 * - 'date': normalized YYYY-MM-DD comparison
 * - 'status': enum/status value tracking
 * - 'enum': non-personal simple string tracking (e.g. paymentMode, category, account)
 * - 'count': numeric count tracking
 * - 'text': personal or free-text field — ONLY `changed: true`, NEVER stores from/to values!
 */
export const TRACKED_FIELDS = Object.freeze({
  booking: Object.freeze([
    { field: "totalAmount", kind: "money" },
    { field: "advanceReceived", kind: "money" },
    { field: "discount", kind: "money" },
    { field: "cancellationCharge", kind: "money" },
    { field: "refundAmount", kind: "money" },
    { field: "status", kind: "status" },
    { field: "paymentMode", kind: "enum" },
    { field: "date", kind: "date" },
    { field: "journeyDate", kind: "date" },
    { field: "passengerCount", kind: "count" },
    { field: "contactName", kind: "text" },
    { field: "contactPhone", kind: "text" },
    { field: "contactEmail", kind: "text" },
    { field: "passengers", kind: "text" },
    { field: "notes", kind: "text" },
  ]),
  expense: Object.freeze([
    { field: "amount", kind: "money" },
    { field: "date", kind: "date" },
    { field: "paidOn", kind: "date" },
    { field: "status", kind: "status" },
    { field: "category", kind: "enum" },
    { field: "paymentMode", kind: "enum" },
    { field: "vendor", kind: "text" },
    { field: "notes", kind: "text" },
    { field: "invoiceRef", kind: "text" },
  ]),
  customer: Object.freeze([
    { field: "name", kind: "text" },
    { field: "phone", kind: "text" },
    { field: "email", kind: "text" },
    { field: "city", kind: "text" },
    { field: "address", kind: "text" },
    { field: "notes", kind: "text" },
  ]),
  cashEntry: Object.freeze([
    { field: "amount", kind: "money" },
    { field: "date", kind: "date" },
    { field: "type", kind: "enum" },
    { field: "account", kind: "enum" },
    { field: "partyName", kind: "text" },
    { field: "notes", kind: "text" },
  ]),
})

/**
 * Normalizes date to YYYY-MM-DD.
 */
function toDateStr(val) {
  if (!val) return ""
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
    const d = new Date(val)
    return isNaN(d.getTime()) ? val.slice(0, 10) : d.toISOString().slice(0, 10)
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10)
  }
  return ""
}

/**
 * Normalizes money to integer paise.
 */
function toPaise(val) {
  const n = Number(val)
  return isNaN(n) ? 0 : Math.round(n * 100)
}

/**
 * Converts integer paise to rupee number.
 */
function fromPaise(paise) {
  return paise / 100
}

/**
 * Diffs two versions of an entity record and returns an array of tracked changes.
 * Pure and deterministic.
 *
 * @param {"booking"|"expense"|"customer"|"cashEntry"} entity
 * @param {object} before
 * @param {object} after
 * @returns {Array<object>}
 */
export function diffRecord(entity, before, after) {
  if (!HISTORY_ENTITIES.includes(entity) || !before || !after) {
    return []
  }

  const descriptors = TRACKED_FIELDS[entity] || []
  const changes = []

  for (const { field, kind } of descriptors) {
    if (field === "passengerCount") {
      const countBefore = Array.isArray(before.passengers) ? before.passengers.length : 0
      const countAfter = Array.isArray(after.passengers) ? after.passengers.length : 0
      if (countBefore !== countAfter) {
        changes.push({
          field,
          kind: "count",
          from: countBefore,
          to: countAfter,
        })
      }
      continue
    }

    if (field === "passengers") {
      const p1 = JSON.stringify(before.passengers || [])
      const p2 = JSON.stringify(after.passengers || [])
      if (p1 !== p2) {
        changes.push({ field, kind: "text", changed: true })
      }
      continue
    }

    const valBefore = before[field]
    const valAfter = after[field]

    if (kind === "money") {
      const pBefore = toPaise(valBefore)
      const pAfter = toPaise(valAfter)
      if (pBefore !== pAfter) {
        changes.push({
          field,
          kind: "money",
          from: fromPaise(pBefore),
          to: fromPaise(pAfter),
        })
      }
    } else if (kind === "date") {
      const dBefore = toDateStr(valBefore)
      const dAfter = toDateStr(valAfter)
      if (dBefore !== dAfter) {
        changes.push({
          field,
          kind: "date",
          from: dBefore,
          to: dAfter,
        })
      }
    } else if (kind === "status" || kind === "enum") {
      const sBefore = String(valBefore ?? "").trim()
      const sAfter = String(valAfter ?? "").trim()
      if (sBefore !== sAfter) {
        changes.push({
          field,
          kind,
          from: sBefore,
          to: sAfter,
        })
      }
    } else if (kind === "text") {
      // Personal / free-text fields: NEVER leak from or to values!
      const tBefore = String(valBefore ?? "").trim()
      const tAfter = String(valAfter ?? "").trim()
      if (tBefore !== tAfter) {
        changes.push({
          field,
          kind: "text",
          changed: true,
        })
      }
    }
  }

  return changes
}

export const HISTORY_LABELS = Object.freeze({
  en: Object.freeze({
    actions: Object.freeze({
      created: "Created",
      updated: "Updated",
      deleted: "Moved to Trash",
      restored: "Restored",
      cancelled: "Cancelled",
    }),
    fields: Object.freeze({
      totalAmount: "Total Amount",
      advanceReceived: "Advance Received",
      discount: "Discount",
      cancellationCharge: "Cancellation Charge",
      refundAmount: "Refund Amount",
      status: "Status",
      paymentMode: "Payment Mode",
      date: "Date",
      journeyDate: "Journey Date",
      passengerCount: "Passenger Count",
      contactName: "Contact Name",
      contactPhone: "Contact Phone",
      contactEmail: "Contact Email",
      passengers: "Passenger Details",
      notes: "Notes",
      amount: "Amount",
      paidOn: "Paid On",
      category: "Category",
      vendor: "Vendor",
      invoiceRef: "Invoice / Bill Ref",
      name: "Customer Name",
      phone: "Phone Number",
      email: "Email Address",
      city: "City",
      address: "Address",
      type: "Entry Type",
      account: "Account",
      partyName: "Party / Payee",
    }),
    restoreReasons: Object.freeze({
      BOOKS_LOCKED: "Books are closed for this date. Reopen books first.",
      NUMBER_CONFLICT: "An active record already exists with the same number or phone.",
      SEAT_CONFLICT: "Selected seats on this departure are already booked by another traveler.",
      PARENT_DELETED: "The parent tour or customer was deleted. Restore it first.",
      ALREADY_ACTIVE: "Record is already active and not in trash.",
    }),
    changedText: "updated",
    fromTo: "changed from {from} to {to}",
  }),
  hi: Object.freeze({
    actions: Object.freeze({
      created: "बनाया गया",
      updated: "अपडेट किया गया",
      deleted: "ट्रैश में डाला गया",
      restored: "पुनर्स्थापित (Restored)",
      cancelled: "रद्द किया गया",
    }),
    fields: Object.freeze({
      totalAmount: "कुल राशि",
      advanceReceived: "अग्रिम भुगतान",
      discount: "छूट (Discount)",
      cancellationCharge: "रद्दीकरण शुल्क",
      refundAmount: "वापसी राशि (Refund)",
      status: "स्थिति (Status)",
      paymentMode: "भुगतान माध्यम",
      date: "तारीख",
      journeyDate: "यात्रा की तारीख",
      passengerCount: "यात्रियों की संख्या",
      contactName: "संपर्क नाम",
      contactPhone: "मोबाइल नंबर",
      contactEmail: "ईमेल",
      passengers: "यात्री विवरण",
      notes: "टिप्पणी",
      amount: "राशि",
      paidOn: "भुगतान की तारीख",
      category: "श्रेणी (Category)",
      vendor: "विक्रेता (Vendor)",
      invoiceRef: "बिल / इनवॉइस नंबर",
      name: "ग्राहक का नाम",
      phone: "फोन नंबर",
      email: "ईमेल पता",
      city: "शहर",
      address: "पता",
      type: "प्रविष्टि प्रकार",
      account: "खाता (Account)",
      partyName: "पार्टी / प्राप्तकर्ता",
    }),
    restoreReasons: Object.freeze({
      BOOKS_LOCKED: "इस तारीख की बहियां बंद हैं। पहले बहियां पुनः खोलें।",
      NUMBER_CONFLICT: "समान नंबर या फोन वाला सक्रिय रिकॉर्ड पहले से मौजूद है।",
      SEAT_CONFLICT: "इस यात्रा की सीटें पहले से किसी अन्य यात्री द्वारा आरक्षित हैं।",
      PARENT_DELETED: "मूल टूर या ग्राहक हटा दिया गया है। पहले उसे पुनर्स्थापित करें।",
      ALREADY_ACTIVE: "रिकॉर्ड पहले से सक्रिय है।",
    }),
    changedText: "अपडेट किया गया",
    fromTo: "{from} से बदलकर {to} हुआ",
  }),
  gu: Object.freeze({
    actions: Object.freeze({
      created: "બનાવ્યું",
      updated: "સુધાર્યું (Updated)",
      deleted: "ટ્રેશમાં ખસેડ્યું",
      restored: "પુનઃસ્થાપિત કર્યું (Restored)",
      cancelled: "રદ કર્યું (Cancelled)",
    }),
    fields: Object.freeze({
      totalAmount: "કુલ રકમ",
      advanceReceived: "એડવાન્સ રકમ",
      discount: "ડિસ્કાઉન્ટ",
      cancellationCharge: "કેન્સલેશન ચાર્જ",
      refundAmount: "રિફંડ રકમ",
      status: "સ્થિતિ (Status)",
      paymentMode: "ચુકવણી મોડ",
      date: "તારીખ",
      journeyDate: "મુસાફરી તારીખ",
      passengerCount: "મુસાફરોની સંખ્યા",
      contactName: "સંપર્ક નામ",
      contactPhone: "મોબાઇલ નંબર",
      contactEmail: "ઇમેઇલ",
      passengers: "મુસાફર વિગતો",
      notes: "નોંધ",
      amount: "રકમ",
      paidOn: "ચુકવણી તારીખ",
      category: "ખર્ચ કેટેગરી",
      vendor: "વેપારી / વેન્ડર",
      invoiceRef: "બિલ / ઇનવોઇસ નંબર",
      name: "ગ્રાહક નામ",
      phone: "ફોન નંબર",
      email: "ઇમેઇલ એડ્રેસ",
      city: "શહેર",
      address: "સરનામું",
      type: "એન્ટ્રી પ્રકાર",
      account: "ખાતું (Account)",
      partyName: "પાર્ટી / પેયી",
    }),
    restoreReasons: Object.freeze({
      BOOKS_LOCKED: "આ તારીખના ચોપડા બંધ છે. પહેલાં ચોપડા ફરીથી ખોલો.",
      NUMBER_CONFLICT: "આ નંબર અથવા ફોન વાળો સક્રિય રેકોર્ડ પહેલેથી અસ્તિત્વમાં છે.",
      SEAT_CONFLICT: "આ ટૂરની પસંદ કરેલી બેઠકો પહેલેથી જ બુક થઈ ગઈ છે.",
      PARENT_DELETED: "મૂળ ટૂર અથવા ગ્રાહક ડિલીટ થઈ ગયો છે. પહેલાં તેને પુનઃસ્થાપિત કરો.",
      ALREADY_ACTIVE: "રેકોર્ડ પહેલેથી સક્રિય છે.",
    }),
    changedText: "અપડેટ કર્યું",
    fromTo: "{from} થી બદલીને {to} થયું",
  }),
})

/**
 * Summarizes an array of diff changes into human-readable strings.
 *
 * @param {Array<object>} changes
 * @param {"en"|"hi"|"gu"} [language="en"]
 * @returns {Array<string>}
 */
export function summarizeChanges(changes, language = "en") {
  if (!Array.isArray(changes) || changes.length === 0) return []
  const lang = ["en", "hi", "gu"].includes(language) ? language : "en"
  const dict = HISTORY_LABELS[lang] || HISTORY_LABELS.en

  return changes.map((ch) => {
    const fieldLabel = dict.fields[ch.field] || ch.field

    if (ch.kind === "text" || ch.changed) {
      return `${fieldLabel} ${dict.changedText}`
    }

    if (ch.kind === "money") {
      const fromStr = `₹${Number(ch.from).toLocaleString("en-IN")}`
      const toStr = `₹${Number(ch.to).toLocaleString("en-IN")}`
      return `${fieldLabel} ${dict.fromTo.replace("{from}", fromStr).replace("{to}", toStr)}`
    }

    const fromVal = ch.from !== undefined && ch.from !== null ? String(ch.from) : "—"
    const toVal = ch.to !== undefined && ch.to !== null ? String(ch.to) : "—"
    return `${fieldLabel} ${dict.fromTo.replace("{from}", fromVal).replace("{to}", toVal)}`
  })
}

/**
 * Classifies whether a soft-deleted record is safe to restore.
 *
 * @param {object} params
 * @param {"booking"|"expense"|"customer"|"cashEntry"} params.entity
 * @param {object} params.record
 * @param {string|null} params.lockDate - YYYY-MM-DD format if books closed, else null
 * @param {object} [params.conflicts={}] - Pre-computed conflict flags from database
 * @returns {{ allowed: boolean, reasons: string[] }}
 */
export function classifyRestore({ entity, record, lockDate, conflicts = {} }) {
  const reasons = []

  if (!record) {
    return { allowed: false, reasons: ["RECORD_NOT_FOUND"] }
  }

  // 1. Check if record is already active
  if (!record.deletedAt) {
    reasons.push("ALREADY_ACTIVE")
  }

  // 2. Check Books Lock
  if (lockDate) {
    const lockDateStr = toDateStr(lockDate)

    if (entity === "booking") {
      // Check booking advance date
      const bookingDateStr = toDateStr(record.date || record.createdAt)
      const advancePaise = toPaise(record.advanceReceived)
      if (advancePaise > 0 && bookingDateStr && bookingDateStr <= lockDateStr) {
        reasons.push("BOOKS_LOCKED")
      } else if (Array.isArray(record.payments)) {
        // Any linked payment date in closed period
        const hasLockedPayment = record.payments.some((p) => {
          const pDate = toDateStr(p.paymentDate || p.date)
          return pDate && pDate <= lockDateStr
        })
        if (hasLockedPayment) {
          reasons.push("BOOKS_LOCKED")
        }
      } else if (record.refundAmount && toPaise(record.refundAmount) > 0) {
        const cancelDateStr = toDateStr(record.cancelledAt || record.date)
        if (cancelDateStr && cancelDateStr <= lockDateStr) {
          reasons.push("BOOKS_LOCKED")
        }
      }
    } else if (entity === "expense") {
      // Paid expense touches money
      if (record.status === "paid") {
        const expDateStr = toDateStr(record.paidOn || record.date)
        if (expDateStr && expDateStr <= lockDateStr) {
          reasons.push("BOOKS_LOCKED")
        }
      }
    } else if (entity === "cashEntry") {
      const entryDateStr = toDateStr(record.date)
      if (entryDateStr && entryDateStr <= lockDateStr) {
        reasons.push("BOOKS_LOCKED")
      }
    }
  }

  // 3. Database conflicts
  if (conflicts.numberConflict || conflicts.phoneConflict) {
    reasons.push("NUMBER_CONFLICT")
  }
  if (conflicts.seatConflict) {
    reasons.push("SEAT_CONFLICT")
  }
  if (conflicts.parentDeleted) {
    reasons.push("PARENT_DELETED")
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  }
}
