/**
 * YatraHub (TBS) — Pure Shared Cash Book & Books Close Engine (Part 6a)
 * Plain JavaScript ESM module with zero external dependencies.
 * Shared between backend (routes, models, books-close validation) and frontend (CashBook UI, DayBookTable, Print).
 *
 * RULES:
 * 1. Integer paise calculations internally to eliminate floating-point drift.
 * 2. Deterministic same-day transaction ordering.
 * 3. Multi-currency/account support: Cash and Bank accounts with running balances.
 * 4. Ledger-authoritative P&L rules: no double-counting between Payment records and Booking snapshots.
 * 5. Standalone CSP-compliant Day Book HTML renderer for printing/export.
 */

export const ACCOUNTS = Object.freeze(["cash", "bank"])

export const ENTRY_TYPES = Object.freeze([
  "receipt",
  "refund",
  "expense",
  "transfer-to-bank",
  "transfer-to-cash",
  "owner-in",
  "owner-out",
  "adjustment",
  "opening",
])

export const MANUAL_ENTRY_TYPES = Object.freeze([
  "transfer-to-bank",
  "transfer-to-cash",
  "owner-in",
  "owner-out",
  "adjustment",
])

export const TYPE_SORT_ORDER = Object.freeze({
  opening: 0,
  receipt: 1,
  "transfer-to-bank": 2,
  "transfer-to-cash": 2,
  refund: 3,
  expense: 4,
  "owner-in": 5,
  "owner-out": 5,
  adjustment: 6,
})

export const CASHBOOK_LABELS = Object.freeze({
  en: Object.freeze({
    cash: "Cash",
    bank: "Bank / Digital",
    all: "All Accounts",
    receipt: "Customer Receipt",
    refund: "Customer Refund",
    expense: "Operating Expense",
    "transfer-to-bank": "Cash Deposit to Bank",
    "transfer-to-cash": "Cash Withdrawal from Bank",
    "owner-in": "Capital Introduced (Owner In)",
    "owner-out": "Drawings / Personal (Owner Out)",
    adjustment: "Cash Adjustment",
    opening: "Opening Balance",
    balanced: "Balanced",
    excess: "Cash Excess",
    short: "Cash Shortage",
  }),
  hi: Object.freeze({
    cash: "नकद",
    bank: "बैंक / डिजिटल",
    all: "सभी खाते",
    receipt: "ग्राहक प्राप्ति",
    refund: "ग्राहक वापसी",
    expense: "व्यापारिक खर्च",
    "transfer-to-bank": "बैंक में नकद जमा",
    "transfer-to-cash": "बैंक से नकद निकासी",
    "owner-in": "पूंजी निवेश (मालिक इन)",
    "owner-out": "निजी आहरण (मालिक आउट)",
    adjustment: "रोकड़ समायोजन",
    opening: "प्रारंभिक शेष",
    balanced: "संतुलित",
    excess: "अधिशेष (Excess)",
    short: "कमी (Shortage)",
  }),
  gu: Object.freeze({
    cash: "રોકડ",
    bank: "બેંક / ડિજિટલ",
    all: "બધા ખાતાઓ",
    receipt: "ગ્રાહક આવક",
    refund: "ગ્રાહક રિફંડ",
    expense: "ધંધાકીય ખર્ચ",
    "transfer-to-bank": "બેંકમાં રોકડ જમા",
    "transfer-to-cash": "બેંકમાંથી રોકડ ઉપાડ",
    "owner-in": "મૂડી રોકાણ (ઓનર ઇન)",
    "owner-out": "ઉપાડ (ઓનર આઉટ)",
    adjustment: "રોકડ મેળવણી",
    opening: "શરૂઆતની બાકી",
    balanced: "સરભર",
    excess: "વધારો (Excess)",
    short: "ઘટ (Shortage)",
  }),
})

/**
 * Rounds a number to exactly 2 decimal places.
 * @param {number|string} num
 * @returns {number}
 */
export function round2(num) {
  const n = Number(num)
  if (isNaN(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Converts a rupee amount to integer paise.
 * @param {number|string} amount
 * @returns {number}
 */
export function toPaise(amount) {
  const n = Number(amount)
  if (isNaN(n)) return 0
  return Math.round(n * 100)
}

/**
 * Converts integer paise back to rupees.
 * @param {number} paise
 * @returns {number}
 */
export function fromPaise(paise) {
  if (!paise || isNaN(paise)) return 0
  return paise / 100
}

/**
 * Maps payment mode string to account category ('cash' | 'bank').
 * Unknown or unmapped modes default to 'bank' with a warning flag.
 *
 * @param {string} mode
 * @returns {{ account: "cash" | "bank", isFallback: boolean }}
 */
export function modeToAccount(mode) {
  if (!mode || typeof mode !== "string") {
    return { account: "cash", isFallback: false }
  }
  const clean = mode.trim().toLowerCase()
  if (clean === "cash" || clean === "rokar" || clean === "nakad") {
    return { account: "cash", isFallback: false }
  }
  if (
    clean === "upi" ||
    clean === "bank" ||
    clean === "card" ||
    clean === "net banking" ||
    clean === "cheque" ||
    clean === "neft" ||
    clean === "rtgs" ||
    clean === "imps" ||
    clean === "online" ||
    clean === "qr" ||
    clean === "dd" ||
    clean === "other"
  ) {
    return { account: "bank", isFallback: false }
  }
  // Unknown mode: default to bank with fallback flag
  return { account: "bank", isFallback: true }
}

/**
 * Normalizes any Date or ISO date string to YYYY-MM-DD.
 * @param {Date|string} date
 * @returns {string}
 */
export function toDateString(date) {
  if (!date) return ""
  if (typeof date === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
    const d = new Date(date)
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10)
    }
    return date.slice(0, 10)
  }
  if (date instanceof Date && !isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10)
  }
  return ""
}

/**
 * Validates a manual cash entry.
 *
 * @param {object} entry
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateManualEntry(entry) {
  const errors = []
  if (!entry || typeof entry !== "object") {
    return { valid: false, errors: ["INVALID_ENTRY_OBJECT"] }
  }

  if (!MANUAL_ENTRY_TYPES.includes(entry.type)) {
    errors.push(`INVALID_TYPE:${entry.type}`)
  }

  const numAmount = Number(entry.amount)
  if (isNaN(numAmount) || numAmount <= 0) {
    errors.push("INVALID_AMOUNT")
  }
  if (numAmount > 10000000) {
    errors.push("AMOUNT_EXCEEDS_MAX")
  }

  const dateStr = toDateString(entry.date)
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    errors.push("INVALID_DATE")
  }

  if (entry.account && !ACCOUNTS.includes(entry.account)) {
    errors.push(`INVALID_ACCOUNT:${entry.account}`)
  }

  // Adjustments require a note/reason
  if (entry.type === "adjustment" && (!entry.notes || !entry.notes.trim())) {
    errors.push("ADJUSTMENT_REQUIRES_NOTES")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Builds the complete Day Book ledger for a date range with running balances.
 *
 * @param {object} params
 * @param {string} params.startDate YYYY-MM-DD
 * @param {string} params.endDate YYYY-MM-DD
 * @param {object} [params.setup] { cashOpening: number, bankOpening: number, asOfDate: string }
 * @param {Array} [params.priorCloses] Array of past BooksClose documents to establish opening balance
 * @param {Array} [params.bookings] Array of Booking documents
 * @param {Array} [params.payments] Array of Payment ledger documents
 * @param {Array} [params.expenses] Array of Expense documents
 * @param {Array} [params.manualEntries] Array of CashEntry documents
 * @returns {object} DayBook object
 */
export function buildDayBook({
  startDate,
  endDate,
  setup = null,
  bookings = [],
  payments = [],
  expenses = [],
  manualEntries = [],
}) {
  const start = toDateString(startDate)
  const end = toDateString(endDate || startDate)

  // 1. Establish base opening balances from setup
  let baseCashPaise = toPaise(setup?.cashOpening || 0)
  let baseBankPaise = toPaise(setup?.bankOpening || 0)
  const setupAsOfDate = toDateString(setup?.asOfDate || "2000-01-01")

  // Map to collect raw normalized transactions
  // We compute in 2 phases:
  // Phase 1: Transactions strictly before `start` (after setup as-of) to build `openingBalance`
  // Phase 2: Transactions between `start` and `end` (inclusive) for Day Book entries

  // Build a set of booking IDs that have payments in the Payment collection to prevent double-counting
  const bookingIdsWithPayments = new Set()
  const nonVoidPayments = (payments || []).filter((p) => !p.isVoid)
  for (const p of nonVoidPayments) {
    const bId = p.bookingId?._id ? String(p.bookingId._id) : String(p.bookingId)
    if (bId) bookingIdsWithPayments.add(bId)
  }

  const allRawTransactions = []

  // (A) Payments from Payment collection
  for (const p of nonVoidPayments) {
    const pDate = toDateString(p.paymentDate || p.createdAt)
    const { account } = modeToAccount(p.paymentMode)
    const amountPaise = toPaise(p.amount)
    const isRefund = p.type === "refund"

    const bDoc = p.bookingId && typeof p.bookingId === "object" ? p.bookingId : null
    const invoiceNo = bDoc?.invoiceNo || p.invoiceNo || ""
    const tourName = bDoc?.tourName || p.tourName || ""
    const customerName = bDoc?.contactName || p.customerName || ""

    allRawTransactions.push({
      id: `pay-${p._id || p.id}`,
      sourceId: String(p._id || p.id),
      sourceType: "Payment",
      date: pDate,
      type: isRefund ? "refund" : "receipt",
      account,
      amountPaise,
      amount: fromPaise(amountPaise),
      voucherNo: p.receiptNo || "",
      refNo: p.referenceNo || "",
      invoiceNo,
      tourName,
      partyName: customerName,
      description: isRefund
        ? `Refund for #${invoiceNo}${p.notes ? ` (${p.notes})` : ""}`
        : `Receipt for #${invoiceNo} (${p.type || "advance"})`,
      paymentMode: p.paymentMode || "Cash",
      createdAt: p.createdAt ? new Date(p.createdAt).getTime() : 0,
    })
  }

  // (B) Legacy bookings without Payment collection records
  for (const b of bookings || []) {
    if (b.deletedAt) continue
    const bId = String(b._id || b.id)
    if (bookingIdsWithPayments.has(bId)) {
      continue // Already captured via Payment collection
    }

    const bDate = toDateString(b.date || b.createdAt)
    const { account } = modeToAccount(b.paymentMode || "Cash")

    if (b.status === "Cancelled") {
      // Cancellation refund if any
      const refundPaise = toPaise(b.refundAmount || 0)
      if (refundPaise > 0) {
        const cancelDate = toDateString(b.cancelledAt || b.date)
        const { account: refundAccount } = modeToAccount(b.refundPaymentMode || "Cash")
        allRawTransactions.push({
          id: `b-ref-${bId}`,
          sourceId: bId,
          sourceType: "BookingRefund",
          date: cancelDate,
          type: "refund",
          account: refundAccount,
          amountPaise: refundPaise,
          amount: fromPaise(refundPaise),
          voucherNo: "",
          refNo: "",
          invoiceNo: b.invoiceNo || "",
          tourName: b.tourName || "",
          partyName: b.contactName || "",
          description: `Cancellation Refund #${b.invoiceNo}`,
          paymentMode: b.refundPaymentMode || "Cash",
          createdAt: b.cancelledAt ? new Date(b.cancelledAt).getTime() : 0,
        })
      }
      // If operator retained fee, advanceReceived was collected before cancellation
      const feePaise = toPaise(b.cancellationCharge || 0)
      if (feePaise > 0) {
        allRawTransactions.push({
          id: `b-fee-${bId}`,
          sourceId: bId,
          sourceType: "Booking",
          date: bDate,
          type: "receipt",
          account,
          amountPaise: feePaise,
          amount: fromPaise(feePaise),
          voucherNo: "",
          refNo: "",
          invoiceNo: b.invoiceNo || "",
          tourName: b.tourName || "",
          partyName: b.contactName || "",
          description: `Retained Fee #${b.invoiceNo}`,
          paymentMode: b.paymentMode || "Cash",
          createdAt: b.createdAt ? new Date(b.createdAt).getTime() : 0,
        })
      }
    } else {
      // Active booking: advance received
      const advPaise = toPaise(b.advanceReceived || 0)
      if (advPaise > 0) {
        allRawTransactions.push({
          id: `b-adv-${bId}`,
          sourceId: bId,
          sourceType: "Booking",
          date: bDate,
          type: "receipt",
          account,
          amountPaise: advPaise,
          amount: fromPaise(advPaise),
          voucherNo: "",
          refNo: "",
          invoiceNo: b.invoiceNo || "",
          tourName: b.tourName || "",
          partyName: b.contactName || "",
          description: `Advance for #${b.invoiceNo}`,
          paymentMode: b.paymentMode || "Cash",
          createdAt: b.createdAt ? new Date(b.createdAt).getTime() : 0,
        })
      }
    }
  }

  // (C) Paid Expenses
  for (const exp of expenses || []) {
    if (exp.deletedAt) continue
    if (exp.status !== "paid") continue // Only paid expenses affect cash/bank balance

    const expDate = toDateString(exp.paidOn || exp.date)
    const { account } = modeToAccount(exp.paymentMode || "cash")
    const amountPaise = toPaise(exp.amount)

    allRawTransactions.push({
      id: `exp-${exp._id || exp.id}`,
      sourceId: String(exp._id || exp.id),
      sourceType: "Expense",
      date: expDate,
      type: "expense",
      account,
      amountPaise,
      amount: fromPaise(amountPaise),
      voucherNo: "",
      refNo: "",
      invoiceNo: "",
      tourName: exp.tourName || "",
      partyName: exp.vendor || "",
      category: exp.category || "other",
      description: `${exp.category ? exp.category.toUpperCase() : "Expense"}: ${exp.vendor || exp.note || "Operating Expense"}`,
      paymentMode: exp.paymentMode || "cash",
      createdAt: exp.createdAt ? new Date(exp.createdAt).getTime() : 0,
    })
  }

  // (D) Manual Cash & Bank Entries
  for (const me of manualEntries || []) {
    if (me.deletedAt) continue

    const meDate = toDateString(me.date)
    const amountPaise = toPaise(me.amount)
    const account = me.account === "bank" ? "bank" : "cash"

    allRawTransactions.push({
      id: `manual-${me._id || me.id}`,
      sourceId: String(me._id || me.id),
      sourceType: "CashEntry",
      date: meDate,
      type: me.type,
      account,
      amountPaise,
      amount: fromPaise(amountPaise),
      voucherNo: me.voucherNo || "",
      refNo: me.referenceNo || "",
      invoiceNo: "",
      tourName: "",
      partyName: me.partyName || "",
      description: me.notes || CASHBOOK_LABELS.en[me.type] || me.type,
      paymentMode: account === "cash" ? "Cash" : "Bank Transfer",
      direction: me.direction || (me.type === "owner-in" ? "credit" : "debit"),
      createdAt: me.createdAt ? new Date(me.createdAt).getTime() : 0,
    })
  }

  // Helper to compute balance impact of an entry on cash & bank
  function applyTransaction(tx, currentCashPaise, currentBankPaise) {
    let nextCash = currentCashPaise
    let nextBank = currentBankPaise

    switch (tx.type) {
      case "receipt":
      case "owner-in":
        if (tx.account === "cash") nextCash += tx.amountPaise
        else nextBank += tx.amountPaise
        break

      case "refund":
      case "expense":
      case "owner-out":
        if (tx.account === "cash") nextCash -= tx.amountPaise
        else nextBank -= tx.amountPaise
        break

      case "transfer-to-bank":
        // Cash deposit to bank
        nextCash -= tx.amountPaise
        nextBank += tx.amountPaise
        break

      case "transfer-to-cash":
        // Cash withdrawal from bank
        nextBank -= tx.amountPaise
        nextCash += tx.amountPaise
        break

      case "adjustment":
        // Adjustments can be positive (excess) or negative (shortage)
        if (tx.direction === "debit") {
          if (tx.account === "cash") nextCash -= tx.amountPaise
          else nextBank -= tx.amountPaise
        } else {
          if (tx.account === "cash") nextCash += tx.amountPaise
          else nextBank += tx.amountPaise
        }
        break

      default:
        break
    }

    return { cash: nextCash, bank: nextBank }
  }

  // Deterministic sorting comparator
  function compareEntries(a, b) {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date)
    }
    const orderA = TYPE_SORT_ORDER[a.type] !== undefined ? TYPE_SORT_ORDER[a.type] : 99
    const orderB = TYPE_SORT_ORDER[b.type] !== undefined ? TYPE_SORT_ORDER[b.type] : 99
    if (orderA !== orderB) {
      return orderA - orderB
    }
    if (a.createdAt !== b.createdAt) {
      return a.createdAt - b.createdAt
    }
    return a.id.localeCompare(b.id)
  }

  allRawTransactions.sort(compareEntries)

  // Phase 1: Accumulate prior transactions into opening balance
  let runningCashPaise = baseCashPaise
  let runningBankPaise = baseBankPaise

  const inScopeEntries = []

  for (const tx of allRawTransactions) {
    if (tx.date < start) {
      // Prior to window: only count if on or after setup as-of date
      if (tx.date >= setupAsOfDate) {
        const next = applyTransaction(tx, runningCashPaise, runningBankPaise)
        runningCashPaise = next.cash
        runningBankPaise = next.bank
      }
    } else if (tx.date <= end) {
      inScopeEntries.push(tx)
    }
  }

  const openingCash = fromPaise(runningCashPaise)
  const openingBank = fromPaise(runningBankPaise)
  const openingTotal = fromPaise(runningCashPaise + runningBankPaise)

  // Phase 2: Process in-scope entries with running balances and calculate totals
  const totalsPaise = {
    receipts: { cash: 0, bank: 0 },
    refunds: { cash: 0, bank: 0 },
    expenses: { cash: 0, bank: 0 },
    transfers: { cash: 0, bank: 0 },
    owner: { cash: 0, bank: 0 },
    adjustments: { cash: 0, bank: 0 },
  }

  const dayBookEntries = []

  for (const tx of inScopeEntries) {
    const priorCash = runningCashPaise
    const priorBank = runningBankPaise

    const next = applyTransaction(tx, runningCashPaise, runningBankPaise)
    runningCashPaise = next.cash
    runningBankPaise = next.bank

    const cashDelta = runningCashPaise - priorCash
    const bankDelta = runningBankPaise - priorBank

    // Categorize for totals
    if (tx.type === "receipt") {
      if (tx.account === "cash") totalsPaise.receipts.cash += tx.amountPaise
      else totalsPaise.receipts.bank += tx.amountPaise
    } else if (tx.type === "refund") {
      if (tx.account === "cash") totalsPaise.refunds.cash += tx.amountPaise
      else totalsPaise.refunds.bank += tx.amountPaise
    } else if (tx.type === "expense") {
      if (tx.account === "cash") totalsPaise.expenses.cash += tx.amountPaise
      else totalsPaise.expenses.bank += tx.amountPaise
    } else if (tx.type === "transfer-to-bank" || tx.type === "transfer-to-cash") {
      totalsPaise.transfers.cash += Math.abs(cashDelta)
      totalsPaise.transfers.bank += Math.abs(bankDelta)
    } else if (tx.type === "owner-in" || tx.type === "owner-out") {
      if (tx.account === "cash") totalsPaise.owner.cash += (tx.type === "owner-in" ? 1 : -1) * tx.amountPaise
      else totalsPaise.owner.bank += (tx.type === "owner-in" ? 1 : -1) * tx.amountPaise
    } else if (tx.type === "adjustment") {
      if (tx.account === "cash") totalsPaise.adjustments.cash += cashDelta
      else totalsPaise.adjustments.bank += bankDelta
    }

    dayBookEntries.push({
      ...tx,
      cashDelta: fromPaise(cashDelta),
      bankDelta: fromPaise(bankDelta),
      cashBalance: fromPaise(runningCashPaise),
      bankBalance: fromPaise(runningBankPaise),
      totalBalance: fromPaise(runningCashPaise + runningBankPaise),
    })
  }

  const closingCash = fromPaise(runningCashPaise)
  const closingBank = fromPaise(runningBankPaise)
  const closingTotal = fromPaise(runningCashPaise + runningBankPaise)

  return {
    startDate: start,
    endDate: end,
    opening: {
      cash: openingCash,
      bank: openingBank,
      total: openingTotal,
    },
    totals: {
      receipts: {
        cash: fromPaise(totalsPaise.receipts.cash),
        bank: fromPaise(totalsPaise.receipts.bank),
        total: fromPaise(totalsPaise.receipts.cash + totalsPaise.receipts.bank),
      },
      refunds: {
        cash: fromPaise(totalsPaise.refunds.cash),
        bank: fromPaise(totalsPaise.refunds.bank),
        total: fromPaise(totalsPaise.refunds.cash + totalsPaise.refunds.bank),
      },
      expenses: {
        cash: fromPaise(totalsPaise.expenses.cash),
        bank: fromPaise(totalsPaise.expenses.bank),
        total: fromPaise(totalsPaise.expenses.cash + totalsPaise.expenses.bank),
      },
      transfers: {
        cash: fromPaise(totalsPaise.transfers.cash),
        bank: fromPaise(totalsPaise.transfers.bank),
      },
      owner: {
        cash: fromPaise(totalsPaise.owner.cash),
        bank: fromPaise(totalsPaise.owner.bank),
      },
      adjustments: {
        cash: fromPaise(totalsPaise.adjustments.cash),
        bank: fromPaise(totalsPaise.adjustments.bank),
      },
      netCashChange: fromPaise(runningCashPaise - toPaise(openingCash)),
      netBankChange: fromPaise(runningBankPaise - toPaise(openingBank)),
    },
    closing: {
      cash: closingCash,
      bank: closingBank,
      total: closingTotal,
    },
    entriesCount: dayBookEntries.length,
    entries: dayBookEntries,
  }
}

/**
 * Computes preview comparison between counted cash and system closing balance.
 *
 * @param {object} params
 * @param {string} params.asOfDate YYYY-MM-DD
 * @param {number|string} params.countedCash Physical cash counted in hand
 * @param {object} params.dayBook DayBook summary object from buildDayBook
 * @returns {object} Close preview object
 */
export function computeClosePreview({ asOfDate, countedCash, dayBook }) {
  const systemCash = round2(dayBook?.closing?.cash || 0)
  const systemBank = round2(dayBook?.closing?.bank || 0)
  const physicalCash = round2(Number(countedCash) || 0)

  const diffPaise = toPaise(physicalCash) - toPaise(systemCash)
  const difference = fromPaise(diffPaise)

  let status = "balanced"
  if (diffPaise > 0) status = "excess"
  else if (diffPaise < 0) status = "short"

  let suggestedAdjustment = null
  if (status !== "balanced") {
    const absDiff = Math.abs(difference)
    suggestedAdjustment = {
      type: "adjustment",
      account: "cash",
      amount: absDiff,
      direction: status === "excess" ? "credit" : "debit",
      date: asOfDate,
      notes: `Day close cash ${status} adjustment of ₹${absDiff.toLocaleString("en-IN")}`,
    }
  }

  return {
    asOfDate,
    systemCash,
    systemBank,
    countedCash: physicalCash,
    difference,
    status,
    isBalanced: status === "balanced",
    suggestedAdjustment,
  }
}

/**
 * Formats currency in Indian Rupee format.
 * @param {number} amount
 * @returns {string}
 */
export function formatINR(amount) {
  const n = Number(amount) || 0
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n)
}

/**
 * Escapes HTML characters for secure print rendering (SEC-001).
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * Renders a complete, standalone, printable HTML Day Book document.
 * Includes Content Security Policy (CSP) meta tag and print media queries.
 *
 * @param {object} params
 * @param {object} params.dayBook
 * @param {object} params.company
 * @param {string} [params.language="en"]
 * @returns {string} Standalone HTML document string
 */
export function renderDayBookHtml({ dayBook, company = {}, language = "en" }) {
  const lang = ["en", "hi", "gu"].includes(language) ? language : "en"
  const dict = CASHBOOK_LABELS[lang] || CASHBOOK_LABELS.en

  const companyName = escapeHtml(company.companyName || "Yatra Tour Operator")
  const companyPhone = escapeHtml(company.companyPhone || "")
  const startDate = escapeHtml(dayBook.startDate)
  const endDate = escapeHtml(dayBook.endDate)
  const dateRangeStr = startDate === endDate ? startDate : `${startDate} to ${endDate}`

  const openingCash = formatINR(dayBook.opening.cash)
  const openingBank = formatINR(dayBook.opening.bank)
  const openingTotal = formatINR(dayBook.opening.total)

  const closingCash = formatINR(dayBook.closing.cash)
  const closingBank = formatINR(dayBook.closing.bank)
  const closingTotal = formatINR(dayBook.closing.total)

  const rowsHtml = (dayBook.entries || [])
    .map((e, idx) => {
      const typeLabel = escapeHtml(dict[e.type] || e.type)
      const desc = escapeHtml(e.description || "")
      const party = escapeHtml(e.partyName || "—")
      const voucher = escapeHtml(e.voucherNo || e.invoiceNo || "—")
      const acctLabel = escapeHtml(dict[e.account] || e.account)

      const cashIn = e.cashDelta > 0 ? formatINR(e.cashDelta) : "—"
      const cashOut = e.cashDelta < 0 ? formatINR(Math.abs(e.cashDelta)) : "—"
      const bankIn = e.bankDelta > 0 ? formatINR(e.bankDelta) : "—"
      const bankOut = e.bankDelta < 0 ? formatINR(Math.abs(e.bankDelta)) : "—"

      const cashBal = formatINR(e.cashBalance)
      const bankBal = formatINR(e.bankBalance)

      return `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>${escapeHtml(e.date)}</td>
        <td>${voucher}</td>
        <td><strong>${typeLabel}</strong><br><small style="color:#64748b;">${desc}</small></td>
        <td>${party}</td>
        <td style="text-align:center;">${acctLabel}</td>
        <td style="text-align:right;color:#047857;">${cashIn}</td>
        <td style="text-align:right;color:#b91c1c;">${cashOut}</td>
        <td style="text-align:right;font-weight:600;">${cashBal}</td>
        <td style="text-align:right;color:#047857;">${bankIn}</td>
        <td style="text-align:right;color:#b91c1c;">${bankOut}</td>
        <td style="text-align:right;font-weight:600;">${bankBal}</td>
      </tr>`
    })
    .join("")

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <title>Day Book — ${dateRangeStr}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 16px;
      color: #0f172a;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.4;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .company-title {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }
    .report-title {
      text-align: right;
    }
    .report-title h2 {
      margin: 0;
      font-size: 16px;
      color: #0f172a;
    }
    .stat-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .stat-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      background: #f8fafc;
    }
    .stat-card-title {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
    .stat-card-val {
      font-size: 14px;
      font-weight: 700;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 6px 8px;
      vertical-align: top;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
      text-align: left;
      font-size: 10px;
      color: #334155;
    }
    .text-right { text-align: right; }
    .footer {
      display: flex;
      justify-content: space-between;
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #cbd5e1;
      font-size: 10px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-title">${companyName}</div>
      ${companyPhone ? `<div>Phone: ${companyPhone}</div>` : ""}
    </div>
    <div class="report-title">
      <h2>DAILY CASH & BANK BOOK</h2>
      <div>Period: <strong>${dateRangeStr}</strong></div>
    </div>
  </div>

  <div class="stat-cards">
    <div class="stat-card">
      <div class="stat-card-title">Opening Balance</div>
      <div class="stat-card-val">${openingTotal}</div>
      <small style="color:#64748b;">Cash: ${openingCash} | Bank: ${openingBank}</small>
    </div>
    <div class="stat-card">
      <div class="stat-card-title">Total Receipts</div>
      <div class="stat-card-val" style="color:#047857;">${formatINR(dayBook.totals.receipts.total)}</div>
      <small style="color:#64748b;">Cash: ${formatINR(dayBook.totals.receipts.cash)} | Bank: ${formatINR(dayBook.totals.receipts.bank)}</small>
    </div>
    <div class="stat-card">
      <div class="stat-card-title">Total Payments / Outflow</div>
      <div class="stat-card-val" style="color:#b91c1c;">${formatINR(dayBook.totals.expenses.total + dayBook.totals.refunds.total)}</div>
      <small style="color:#64748b;">Exp: ${formatINR(dayBook.totals.expenses.total)} | Ref: ${formatINR(dayBook.totals.refunds.total)}</small>
    </div>
    <div class="stat-card">
      <div class="stat-card-title">Closing Balance</div>
      <div class="stat-card-val">${closingTotal}</div>
      <small style="color:#64748b;">Cash: ${closingCash} | Bank: ${closingBank}</small>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th rowspan="2" style="width:25px;text-align:center;">#</th>
        <th rowspan="2" style="width:70px;">Date</th>
        <th rowspan="2" style="width:75px;">Voucher #</th>
        <th rowspan="2">Particulars / Description</th>
        <th rowspan="2" style="width:110px;">Party Name</th>
        <th rowspan="2" style="width:50px;text-align:center;">Acct</th>
        <th colspan="3" style="text-align:center;background:#e2e8f0;">CASH ACCOUNT</th>
        <th colspan="3" style="text-align:center;background:#e2e8f0;">BANK ACCOUNT</th>
      </tr>
      <tr>
        <th class="text-right" style="width:65px;">In (+)</th>
        <th class="text-right" style="width:65px;">Out (-)</th>
        <th class="text-right" style="width:75px;">Balance</th>
        <th class="text-right" style="width:65px;">In (+)</th>
        <th class="text-right" style="width:65px;">Out (-)</th>
        <th class="text-right" style="width:75px;">Balance</th>
      </tr>
    </thead>
    <tbody>
      <tr style="background:#f8fafc;font-weight:600;">
        <td colspan="6">OPENING BALANCE</td>
        <td class="text-right">—</td>
        <td class="text-right">—</td>
        <td class="text-right">${openingCash}</td>
        <td class="text-right">—</td>
        <td class="text-right">—</td>
        <td class="text-right">${openingBank}</td>
      </tr>
      ${rowsHtml || '<tr><td colspan="12" style="text-align:center;padding:16px;color:#64748b;">No transactions recorded in this period.</td></tr>'}
      <tr style="background:#f1f5f9;font-weight:700;">
        <td colspan="6">CLOSING BALANCE</td>
        <td class="text-right" style="color:#047857;">${formatINR(dayBook.totals.receipts.cash)}</td>
        <td class="text-right" style="color:#b91c1c;">${formatINR(dayBook.totals.expenses.cash + dayBook.totals.refunds.cash)}</td>
        <td class="text-right">${closingCash}</td>
        <td class="text-right" style="color:#047857;">${formatINR(dayBook.totals.receipts.bank)}</td>
        <td class="text-right" style="color:#b91c1c;">${formatINR(dayBook.totals.expenses.bank + dayBook.totals.refunds.bank)}</td>
        <td class="text-right">${closingBank}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div>Prepared by: YatraHub Books System</div>
    <div>Generated on: ${new Date().toLocaleString("en-IN")}</div>
    <div>Authorised Signatory: _________________________</div>
  </div>
</body>
</html>`
}
