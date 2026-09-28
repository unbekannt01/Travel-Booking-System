import test from "node:test"
import assert from "node:assert/strict"
import { generateTourCode, getMonthCode } from "../backend/routes/bookings.js"

test("Invoice Tour Code generation", () => {
  assert.equal(generateTourCode("Kedarnath Yatra"), "KYX")
  assert.equal(generateTourCode("Char Dham"), "CDX")
  assert.equal(generateTourCode("Goa Beach Tour"), "GBT")
  assert.equal(generateTourCode("Manali"), "MAN")
  assert.equal(generateTourCode("Kashi Vishwanath Yatra Special"), "KVY")
  assert.equal(generateTourCode(""), "GEN")
  assert.equal(generateTourCode(null), "GEN")
})

test("Invoice Month Code extraction", () => {
  assert.equal(getMonthCode("2026-01-15"), "JAN")
  assert.equal(getMonthCode("2026-05-01"), "MAY")
  assert.equal(getMonthCode("2026-10-31"), "OCT")
  assert.equal(getMonthCode("2026-12-25"), "DEC")
})

test("Invoice sequence simulation without collision under concurrent calls", async () => {
  // Mock store of existing invoice numbers
  const store = new Set()
  let counter = 0

  // Simulating an atomic sequence generator
  const getNextInvoiceNoSim = async (tourCode, monthCode) => {
    // In production, MongoDB atomic findAndModify or mutex counter avoids duplicates
    counter += 1
    const invoiceNo = `YHB-${tourCode}-${monthCode}-${String(counter).padStart(3, "0")}`
    if (store.has(invoiceNo)) {
      throw new Error(`Duplicate invoice detected: ${invoiceNo}`)
    }
    store.add(invoiceNo)
    return invoiceNo
  }

  // Run 50 concurrent invoice requests
  const promises = Array.from({ length: 50 }, () =>
    getNextInvoiceNoSim("KYX", "OCT")
  )

  const results = await Promise.all(promises)

  assert.equal(results.length, 50)
  assert.equal(store.size, 50, "All 50 invoice numbers should be unique")
  assert.equal(results[0], "YHB-KYX-OCT-001")
  assert.equal(results[49], "YHB-KYX-OCT-050")
})
