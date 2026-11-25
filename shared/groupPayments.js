/**
 * YatraHub - Shared Group Payment Allocation Engine (Part 6S-3b)
 *
 * Integer paise arithmetic for splitting a single group payment across member bookings.
 * Zero floating-point rounding errors. Deterministic largest-balance remainder distribution.
 */

export const ALLOCATION_METHODS = Object.freeze(["proportional", "equal", "manual"])

/**
 * Convert rupee decimal to integer paise
 * @param {number|string} rupees
 * @returns {number} Integer paise
 */
export function toPaise(rupees) {
  const num = Number(rupees || 0)
  if (isNaN(num)) return 0
  return Math.round(num * 100)
}

/**
 * Convert integer paise to rupee decimal with 2 decimal places
 * @param {number} paise
 * @returns {number} Rupee float
 */
export function fromPaise(paise) {
  const num = Number(paise || 0)
  if (isNaN(num)) return 0
  return Math.round(num) / 100
}

/**
 * Distribute total payment in proportion to each member's balance due.
 * Remainder paise are distributed 1 paise at a time starting with the member
 * having the largest balance due (tie-break by original booking order).
 *
 * @param {Object} params
 * @param {number} params.totalPaise - Total payment to allocate in paise
 * @param {Array<{ bookingId: string, balancePaise: number, name?: string, invoiceNo?: string }>} params.members
 * @returns {{ valid: boolean, allocations: Array, totalAllocatedPaise: number, remainderPaise: number, error?: string }}
 */
export function calculateProportionalAllocation({ totalPaise = 0, members = [] }) {
  const tPaise = Math.round(Number(totalPaise || 0))
  if (tPaise <= 0) {
    return { valid: false, allocations: [], totalAllocatedPaise: 0, remainderPaise: 0, error: "Payment amount must be greater than zero." }
  }

  const memberList = members.map((m, idx) => ({
    bookingId: String(m.bookingId || m._id || m.id),
    name: m.name || m.contactName || "Traveler",
    invoiceNo: m.invoiceNo || "",
    balancePaise: Math.max(0, Math.round(Number(m.balancePaise ?? toPaise(m.balanceDue ?? m.balance ?? 0)))),
    index: idx,
    allocatedPaise: 0,
  }))

  const totalBalancePaise = memberList.reduce((acc, m) => acc + m.balancePaise, 0)
  if (totalBalancePaise <= 0) {
    return { valid: false, allocations: [], totalAllocatedPaise: 0, remainderPaise: 0, error: "All group members are already fully paid." }
  }

  if (tPaise > totalBalancePaise) {
    return {
      valid: false,
      allocations: [],
      totalAllocatedPaise: 0,
      remainderPaise: 0,
      error: `Payment amount ₹${fromPaise(tPaise)} exceeds total group balance due of ₹${fromPaise(totalBalancePaise)}. Maximum payable is ₹${fromPaise(totalBalancePaise)}.`,
    }
  }

  // Initial proportional allocation: floor(T * balance / totalBalance)
  let sumAllocated = 0
  for (const m of memberList) {
    if (m.balancePaise > 0) {
      const raw = Math.floor((tPaise * m.balancePaise) / totalBalancePaise)
      m.allocatedPaise = Math.min(raw, m.balancePaise)
      sumAllocated += m.allocatedPaise
    }
  }

  // Remainder distribution: one paise at a time to member with highest balance
  let remainder = tPaise - sumAllocated
  if (remainder > 0) {
    // Sort candidate members who have room (allocated < balance)
    const candidates = memberList
      .filter((m) => m.allocatedPaise < m.balancePaise)
      .sort((a, b) => {
        if (b.balancePaise !== a.balancePaise) {
          return b.balancePaise - a.balancePaise // Largest balance first
        }
        return a.index - b.index // Tie-break by booking order
      })

    let cIdx = 0
    while (remainder > 0 && candidates.length > 0) {
      const candidate = candidates[cIdx % candidates.length]
      if (candidate.allocatedPaise < candidate.balancePaise) {
        candidate.allocatedPaise += 1
        remainder -= 1
        sumAllocated += 1
      }
      cIdx++
      if (cIdx >= candidates.length * 2 && remainder > 0) {
        // Safety guard against infinite loop if all capped
        break
      }
    }
  }

  const finalAllocations = memberList.map((m) => ({
    bookingId: m.bookingId,
    name: m.name,
    invoiceNo: m.invoiceNo,
    balancePaise: m.balancePaise,
    balanceRupees: fromPaise(m.balancePaise),
    allocatedPaise: m.allocatedPaise,
    allocatedRupees: fromPaise(m.allocatedPaise),
    balanceAfterPaise: m.balancePaise - m.allocatedPaise,
    balanceAfterRupees: fromPaise(m.balancePaise - m.allocatedPaise),
  }))

  return {
    valid: sumAllocated === tPaise,
    allocations: finalAllocations,
    totalAllocatedPaise: sumAllocated,
    remainderPaise: tPaise - sumAllocated,
    error: sumAllocated === tPaise ? null : "Allocation rounding discrepancy detected.",
  }
}

/**
 * Distribute total payment equally among members, capped at each member's balance due.
 *
 * @param {Object} params
 * @param {number} params.totalPaise - Total payment in paise
 * @param {Array<{ bookingId: string, balancePaise: number, name?: string, invoiceNo?: string }>} params.members
 * @returns {{ valid: boolean, allocations: Array, totalAllocatedPaise: number, remainderPaise: number, error?: string }}
 */
export function calculateEqualAllocation({ totalPaise = 0, members = [] }) {
  const tPaise = Math.round(Number(totalPaise || 0))
  if (tPaise <= 0) {
    return { valid: false, allocations: [], totalAllocatedPaise: 0, remainderPaise: 0, error: "Payment amount must be greater than zero." }
  }

  const memberList = members.map((m, idx) => ({
    bookingId: String(m.bookingId || m._id || m.id),
    name: m.name || m.contactName || "Traveler",
    invoiceNo: m.invoiceNo || "",
    balancePaise: Math.max(0, Math.round(Number(m.balancePaise ?? toPaise(m.balanceDue ?? m.balance ?? 0)))),
    index: idx,
    allocatedPaise: 0,
  }))

  const totalBalancePaise = memberList.reduce((acc, m) => acc + m.balancePaise, 0)
  if (totalBalancePaise <= 0) {
    return { valid: false, allocations: [], totalAllocatedPaise: 0, remainderPaise: 0, error: "All group members are already fully paid." }
  }

  if (tPaise > totalBalancePaise) {
    return {
      valid: false,
      allocations: [],
      totalAllocatedPaise: 0,
      remainderPaise: 0,
      error: `Payment amount ₹${fromPaise(tPaise)} exceeds total group balance due of ₹${fromPaise(totalBalancePaise)}. Maximum payable is ₹${fromPaise(totalBalancePaise)}.`,
    }
  }

  let remaining = tPaise
  // Iterative water-filling
  while (remaining > 0) {
    const active = memberList.filter((m) => m.allocatedPaise < m.balancePaise)
    if (active.length === 0) break

    const share = Math.floor(remaining / active.length)
    if (share > 0) {
      let allocatedThisRound = 0
      for (const m of active) {
        const room = m.balancePaise - m.allocatedPaise
        const chunk = Math.min(share, room)
        m.allocatedPaise += chunk
        allocatedThisRound += chunk
      }
      remaining -= allocatedThisRound
      if (allocatedThisRound === 0) {
        // No member could take the full share, break to 1-paise distribution
        break
      }
    } else {
      // Remaining < active.length: distribute 1 paise to members with most capacity
      active.sort((a, b) => {
        const roomA = a.balancePaise - a.allocatedPaise
        const roomB = b.balancePaise - b.allocatedPaise
        if (roomB !== roomA) return roomB - roomA
        if (b.balancePaise !== a.balancePaise) return b.balancePaise - a.balancePaise
        return a.index - b.index
      })
      for (let i = 0; i < remaining && i < active.length; i++) {
        active[i].allocatedPaise += 1
      }
      remaining = 0
      break
    }
  }

  const sumAllocated = memberList.reduce((acc, m) => acc + m.allocatedPaise, 0)
  const finalAllocations = memberList.map((m) => ({
    bookingId: m.bookingId,
    name: m.name,
    invoiceNo: m.invoiceNo,
    balancePaise: m.balancePaise,
    balanceRupees: fromPaise(m.balancePaise),
    allocatedPaise: m.allocatedPaise,
    allocatedRupees: fromPaise(m.allocatedPaise),
    balanceAfterPaise: m.balancePaise - m.allocatedPaise,
    balanceAfterRupees: fromPaise(m.balancePaise - m.allocatedPaise),
  }))

  return {
    valid: sumAllocated === tPaise,
    allocations: finalAllocations,
    totalAllocatedPaise: sumAllocated,
    remainderPaise: tPaise - sumAllocated,
    error: sumAllocated === tPaise ? null : "Could not allocate exact total.",
  }
}

/**
 * Validate operator manual allocation
 *
 * @param {Object} params
 * @param {number} params.totalPaise
 * @param {Array<{ bookingId: string, balancePaise: number }>} params.members
 * @param {Object<string, number>} params.manualAllocations - Map of bookingId -> paise
 */
export function validateManualAllocation({ totalPaise = 0, members = [], manualAllocations = {} }) {
  const tPaise = Math.round(Number(totalPaise || 0))
  if (tPaise <= 0) {
    return { valid: false, allocations: [], totalAllocatedPaise: 0, remainderPaise: 0, error: "Payment amount must be greater than zero." }
  }

  const memberList = members.map((m, idx) => ({
    bookingId: String(m.bookingId || m._id || m.id),
    name: m.name || m.contactName || "Traveler",
    invoiceNo: m.invoiceNo || "",
    balancePaise: Math.max(0, Math.round(Number(m.balancePaise ?? toPaise(m.balanceDue ?? m.balance ?? 0)))),
    index: idx,
    allocatedPaise: Math.max(0, Math.round(Number(manualAllocations[String(m.bookingId || m._id || m.id)] || 0))),
  }))

  for (const m of memberList) {
    if (m.allocatedPaise > m.balancePaise) {
      return {
        valid: false,
        allocations: [],
        totalAllocatedPaise: 0,
        remainderPaise: 0,
        error: `Allocation ₹${fromPaise(m.allocatedPaise)} for ${m.name} exceeds balance due ₹${fromPaise(m.balancePaise)}.`,
      }
    }
  }

  const sumAllocated = memberList.reduce((acc, m) => acc + m.allocatedPaise, 0)
  if (sumAllocated !== tPaise) {
    const diff = tPaise - sumAllocated
    return {
      valid: false,
      allocations: [],
      totalAllocatedPaise: sumAllocated,
      remainderPaise: diff,
      error: `Sum of member allocations (₹${fromPaise(sumAllocated)}) does not equal total payment (₹${fromPaise(tPaise)}). Difference: ₹${fromPaise(Math.abs(diff))}.`,
    }
  }

  const finalAllocations = memberList.map((m) => ({
    bookingId: m.bookingId,
    name: m.name,
    invoiceNo: m.invoiceNo,
    balancePaise: m.balancePaise,
    balanceRupees: fromPaise(m.balancePaise),
    allocatedPaise: m.allocatedPaise,
    allocatedRupees: fromPaise(m.allocatedPaise),
    balanceAfterPaise: m.balancePaise - m.allocatedPaise,
    balanceAfterRupees: fromPaise(m.balancePaise - m.allocatedPaise),
  }))

  return {
    valid: true,
    allocations: finalAllocations,
    totalAllocatedPaise: sumAllocated,
    remainderPaise: 0,
    error: null,
  }
}
