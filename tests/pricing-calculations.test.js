import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { calculatePricing, round2 } from "../src/utils/pricing.js"

describe("Pricing and GST Calculations", () => {
  it("calculates simple exclusive 5% GST correctly", () => {
    const result = calculatePricing({
      baseAmount: 10000,
      gstRate: 5,
      isTaxInclusive: false,
    })

    assert.equal(result.baseAmount, 10000)
    assert.equal(result.discountAmount, 0)
    assert.equal(result.netBeforeTax, 10000)
    assert.equal(result.taxAmount, 500)
    assert.equal(result.cgstAmount, 250)
    assert.equal(result.sgstAmount, 250)
    assert.equal(result.finalTotal, 10500)
  })

  it("calculates inclusive 5% GST correctly (extracting base and tax)", () => {
    const result = calculatePricing({
      baseAmount: 10500,
      gstRate: 5,
      isTaxInclusive: true,
    })

    assert.equal(result.baseAmount, 10500)
    assert.equal(result.finalTotal, 10500)
    assert.equal(result.netBeforeTax, 10000)
    assert.equal(result.taxAmount, 500)
    assert.equal(result.cgstAmount, 250)
    assert.equal(result.sgstAmount, 250)
  })

  it("handles fixed rupee discount before tax", () => {
    const result = calculatePricing({
      baseAmount: 10000,
      discountType: "fixed",
      discountValue: 1000,
      gstRate: 5,
      isTaxInclusive: false,
    })

    assert.equal(result.discountAmount, 1000)
    assert.equal(result.netBeforeTax, 9000)
    assert.equal(result.taxAmount, 450)
    assert.equal(result.finalTotal, 9450)
  })

  it("handles percentage discount before tax", () => {
    const result = calculatePricing({
      baseAmount: 10000,
      discountType: "percentage",
      discountValue: 10,
      gstRate: 5,
      isTaxInclusive: false,
    })

    assert.equal(result.discountAmount, 1000)
    assert.equal(result.netBeforeTax, 9000)
    assert.equal(result.taxAmount, 450)
    assert.equal(result.finalTotal, 9450)
  })

  it("handles 0% GST (tax exempt tours)", () => {
    const result = calculatePricing({
      baseAmount: 8500,
      discountType: "fixed",
      discountValue: 500,
      gstRate: 0,
    })

    assert.equal(result.discountAmount, 500)
    assert.equal(result.netBeforeTax, 8000)
    assert.equal(result.taxAmount, 0)
    assert.equal(result.finalTotal, 8000)
  })

  it("rounds cents and paisa properly to 2 decimals", () => {
    assert.equal(round2(10.555), 10.56)
    assert.equal(round2(10.554), 10.55)
    assert.equal(round2(0), 0)
  })
})
