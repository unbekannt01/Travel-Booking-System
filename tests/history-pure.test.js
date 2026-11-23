import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  HISTORY_ENTITIES,
  HISTORY_ACTIONS,
  RESTORE_REASON_CODES,
  TRACKED_FIELDS,
  diffRecord,
  summarizeChanges,
  classifyRestore,
  HISTORY_LABELS,
} from "../shared/history.js"

describe("History & Restore Pure Engine (Part 6b)", () => {
  test("Constants and catalogs are frozen and properly populated", () => {
    assert.ok(Object.isFrozen(HISTORY_ENTITIES))
    assert.deepEqual([...HISTORY_ENTITIES], ["booking", "expense", "customer", "cashEntry"])

    assert.ok(Object.isFrozen(HISTORY_ACTIONS))
    assert.ok(HISTORY_ACTIONS.includes("created"))
    assert.ok(HISTORY_ACTIONS.includes("updated"))
    assert.ok(HISTORY_ACTIONS.includes("deleted"))
    assert.ok(HISTORY_ACTIONS.includes("restored"))
    assert.ok(HISTORY_ACTIONS.includes("cancelled"))

    assert.ok(Object.isFrozen(RESTORE_REASON_CODES))
    assert.ok(RESTORE_REASON_CODES.includes("BOOKS_LOCKED"))
    assert.ok(RESTORE_REASON_CODES.includes("NUMBER_CONFLICT"))
    assert.ok(RESTORE_REASON_CODES.includes("SEAT_CONFLICT"))
    assert.ok(RESTORE_REASON_CODES.includes("PARENT_DELETED"))
    assert.ok(RESTORE_REASON_CODES.includes("ALREADY_ACTIVE"))

    assert.ok(Object.isFrozen(TRACKED_FIELDS))
    assert.ok(TRACKED_FIELDS.booking)
    assert.ok(TRACKED_FIELDS.expense)
    assert.ok(TRACKED_FIELDS.customer)
    assert.ok(TRACKED_FIELDS.cashEntry)
  })

  test("diffRecord: detects booking updates and normalizes money and dates", () => {
    const before = {
      totalAmount: 5000,
      advanceReceived: 2000,
      status: "Confirmed",
      date: "2026-11-01",
      paymentMode: "Cash",
      passengers: [{ name: "Alice", age: 30 }],
      contactName: "Old Contact",
      contactPhone: "9825012345",
      notes: "First note",
    }
    const after = {
      totalAmount: 6000,
      advanceReceived: 2000, // unchanged
      status: "Cancelled",
      date: "2026-11-01", // unchanged
      paymentMode: "UPI",
      passengers: [{ name: "Alice", age: 30 }, { name: "Bob", age: 35 }],
      contactName: "New Contact",
      contactPhone: "9825012345", // unchanged
      notes: "Updated note",
    }

    const changes = diffRecord("booking", before, after)
    assert.ok(changes.length > 0)

    // totalAmount changed
    const totalCh = changes.find((c) => c.field === "totalAmount")
    assert.ok(totalCh)
    assert.equal(totalCh.kind, "money")
    assert.equal(totalCh.from, 5000)
    assert.equal(totalCh.to, 6000)

    // status changed
    const statusCh = changes.find((c) => c.field === "status")
    assert.ok(statusCh)
    assert.equal(statusCh.from, "Confirmed")
    assert.equal(statusCh.to, "Cancelled")

    // paymentMode changed
    const modeCh = changes.find((c) => c.field === "paymentMode")
    assert.ok(modeCh)
    assert.equal(modeCh.from, "Cash")
    assert.equal(modeCh.to, "UPI")

    // passengerCount changed
    const countCh = changes.find((c) => c.field === "passengerCount")
    assert.ok(countCh)
    assert.equal(countCh.from, 1)
    assert.equal(countCh.to, 2)

    // contactName changed (text)
    const nameCh = changes.find((c) => c.field === "contactName")
    assert.ok(nameCh)
    assert.equal(nameCh.kind, "text")
    assert.equal(nameCh.changed, true)
    // PRIVACY VERIFICATION: no leaked values!
    assert.equal(nameCh.from, undefined)
    assert.equal(nameCh.to, undefined)

    // notes changed (text)
    const notesCh = changes.find((c) => c.field === "notes")
    assert.ok(notesCh)
    assert.equal(notesCh.kind, "text")
    assert.equal(notesCh.changed, true)
    assert.equal(notesCh.from, undefined)
    assert.equal(notesCh.to, undefined)

    // unchanged fields should NOT appear
    assert.equal(changes.find((c) => c.field === "advanceReceived"), undefined)
    assert.equal(changes.find((c) => c.field === "contactPhone"), undefined)
  })

  test("diffRecord: returns empty array when records are identical", () => {
    const record = {
      amount: 1500,
      category: "fuel",
      vendor: "IOCL Petrol",
      notes: "Regular fill",
      date: "2026-11-20",
      status: "paid",
    }
    const changes = diffRecord("expense", record, { ...record })
    assert.deepEqual(changes, [])
  })

  test("diffRecord: strict privacy check on customer personal details", () => {
    const before = {
      name: "Ramesh Patel",
      phone: "9825012345",
      email: "ramesh@example.com",
      city: "Ahmedabad",
      address: "123 Navrangpura",
      notes: "VIP guest",
    }
    const after = {
      name: "Rameshchandra Patel",
      phone: "9825099999",
      email: "ramesh.new@example.com",
      city: "Gandhinagar",
      address: "456 Sector 1",
      notes: "VIP guest - updated",
    }

    const changes = diffRecord("customer", before, after)
    assert.equal(changes.length, 6)

    for (const change of changes) {
      assert.equal(change.kind, "text")
      assert.equal(change.changed, true)
      assert.equal(change.from, undefined, `Leaked 'from' on field ${change.field}`)
      assert.equal(change.to, undefined, `Leaked 'to' on field ${change.field}`)
    }
  })

  test("diffRecord: cashEntry diffing tracks amount, type, account, and partyName", () => {
    const before = {
      amount: 1000,
      type: "owner-in",
      account: "cash",
      partyName: "Owner A",
      notes: "Cap",
    }
    const after = {
      amount: 2500,
      type: "transfer-to-bank",
      account: "bank",
      partyName: "Owner B",
      notes: "Cap",
    }

    const changes = diffRecord("cashEntry", before, after)
    assert.equal(changes.length, 4)

    const amtCh = changes.find((c) => c.field === "amount")
    assert.equal(amtCh.from, 1000)
    assert.equal(amtCh.to, 2500)

    const partyCh = changes.find((c) => c.field === "partyName")
    assert.equal(partyCh.changed, true)
    assert.equal(partyCh.from, undefined)
  })

  test("summarizeChanges: formats human-readable labels in English, Hindi, and Gujarati", () => {
    const changes = [
      { field: "totalAmount", kind: "money", from: 5000, to: 6500 },
      { field: "status", kind: "status", from: "Confirmed", to: "Cancelled" },
      { field: "contactName", kind: "text", changed: true },
    ]

    const enSummary = summarizeChanges(changes, "en")
    assert.equal(enSummary.length, 3)
    assert.ok(enSummary[0].includes("Total Amount changed from ₹5,000 to ₹6,500"))
    assert.ok(enSummary[1].includes("Status changed from Confirmed to Cancelled"))
    assert.ok(enSummary[2].includes("Contact Name updated"))

    const hiSummary = summarizeChanges(changes, "hi")
    assert.equal(hiSummary.length, 3)
    assert.ok(hiSummary[0].includes("कुल राशि"))
    assert.ok(hiSummary[1].includes("स्थिति"))
    assert.ok(hiSummary[2].includes("अपडेट किया गया"))

    const guSummary = summarizeChanges(changes, "gu")
    assert.equal(guSummary.length, 3)
    assert.ok(guSummary[0].includes("કુલ રકમ"))
    assert.ok(guSummary[1].includes("સ્થિતિ"))
    assert.ok(guSummary[2].includes("અપડેટ કર્યું"))
  })

  test("classifyRestore: enforces ALREADY_ACTIVE when deletedAt is null", () => {
    const record = { _id: "b1", deletedAt: null }
    const result = classifyRestore({ entity: "booking", record, lockDate: null })
    assert.equal(result.allowed, false)
    assert.ok(result.reasons.includes("ALREADY_ACTIVE"))
  })

  test("classifyRestore: enforces BOOKS_LOCKED when booking advance date falls on closed books", () => {
    const record = {
      _id: "b1",
      deletedAt: new Date("2026-11-20"),
      date: "2026-11-05",
      advanceReceived: 2000,
    }
    // Books locked up to 2026-11-10
    const result = classifyRestore({
      entity: "booking",
      record,
      lockDate: "2026-11-10",
    })
    assert.equal(result.allowed, false)
    assert.ok(result.reasons.includes("BOOKS_LOCKED"))

    // But if advance is 0, booking touches NO money, books lock does NOT block restore!
    const freeBooking = {
      _id: "b2",
      deletedAt: new Date("2026-11-20"),
      date: "2026-11-05",
      advanceReceived: 0,
    }
    const freeResult = classifyRestore({
      entity: "booking",
      record: freeBooking,
      lockDate: "2026-11-10",
    })
    assert.equal(freeResult.allowed, true)
    assert.equal(freeResult.reasons.length, 0)
  })

  test("classifyRestore: enforces BOOKS_LOCKED on paid expenses on closed dates, allows pending", () => {
    const paidExp = {
      _id: "x1",
      deletedAt: new Date("2026-11-20"),
      paidOn: "2026-11-08",
      status: "paid",
    }
    const resPaid = classifyRestore({
      entity: "expense",
      record: paidExp,
      lockDate: "2026-11-10",
    })
    assert.equal(resPaid.allowed, false)
    assert.ok(resPaid.reasons.includes("BOOKS_LOCKED"))

    const pendingExp = {
      _id: "x2",
      deletedAt: new Date("2026-11-20"),
      date: "2026-11-08",
      status: "pending",
    }
    const resPending = classifyRestore({
      entity: "expense",
      record: pendingExp,
      lockDate: "2026-11-10",
    })
    assert.equal(resPending.allowed, true)
  })

  test("classifyRestore: detects database conflicts (NUMBER_CONFLICT, SEAT_CONFLICT, PARENT_DELETED)", () => {
    const record = { _id: "c1", deletedAt: new Date("2026-11-20") }
    const resConflict = classifyRestore({
      entity: "customer",
      record,
      lockDate: null,
      conflicts: {
        numberConflict: true,
        seatConflict: true,
        parentDeleted: true,
      },
    })
    assert.equal(resConflict.allowed, false)
    assert.ok(resConflict.reasons.includes("NUMBER_CONFLICT"))
    assert.ok(resConflict.reasons.includes("SEAT_CONFLICT"))
    assert.ok(resConflict.reasons.includes("PARENT_DELETED"))
  })

  test("classifyRestore: returns allowed=true when there are no conflicts or lock restrictions", () => {
    const record = {
      _id: "c1",
      deletedAt: new Date("2026-11-20"),
      date: "2026-11-25",
    }
    const resClean = classifyRestore({
      entity: "customer",
      record,
      lockDate: "2026-11-10",
      conflicts: {},
    })
    assert.equal(resClean.allowed, true)
    assert.deepEqual(resClean.reasons, [])
  })
})
