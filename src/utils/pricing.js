/**
 * Indian Tour Operator Pricing & GST Calculation Utilities
 * Handles GST (inclusive & exclusive), CGST/SGST splitting, and fixed or percentage discounts.
 * Guaranteed 2 decimal places rounding for Indian Rupee accounting.
 */

export function round2(num) {
  const n = Number(num)
  if (isNaN(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Calculates pricing breakdown with discount and GST.
 *
 * @param {Object} options
 * @param {number} options.baseAmount - Gross package amount before discount or tax
 * @param {"fixed"|"percentage"} [options.discountType="fixed"]
 * @param {number} [options.discountValue=0] - Discount in rupees or percent (0-100)
 * @param {number} [options.gstRate=0] - GST rate in percent (e.g. 5 for bus tour packages, 12, 18)
 * @param {boolean} [options.isTaxInclusive=false] - Whether the agreed price already includes GST
 * @returns {Object} Full breakdown of amounts
 */
export function calculatePricing({
  baseAmount = 0,
  discountType = "fixed",
  discountValue = 0,
  gstRate = 0,
  isTaxInclusive = false,
}) {
  const base = Math.max(0, round2(baseAmount))
  const dVal = Math.max(0, Number(discountValue) || 0)
  const gRate = Math.max(0, Number(gstRate) || 0)

  // 1. Calculate Discount
  let discountAmount = 0
  if (discountType === "percentage") {
    const clampedPct = Math.min(100, dVal)
    discountAmount = round2((base * clampedPct) / 100)
  } else {
    discountAmount = Math.min(base, round2(dVal))
  }

  const netDiscounted = Math.max(0, round2(base - discountAmount))

  // 2. Calculate GST
  let netBeforeTax = 0
  let taxAmount = 0
  let finalTotal = 0

  if (isTaxInclusive) {
    if (gRate > 0) {
      netBeforeTax = round2(netDiscounted / (1 + gRate / 100))
      taxAmount = round2(netDiscounted - netBeforeTax)
    } else {
      netBeforeTax = netDiscounted
      taxAmount = 0
    }
    finalTotal = netDiscounted
  } else {
    netBeforeTax = netDiscounted
    if (gRate > 0) {
      taxAmount = round2((netBeforeTax * gRate) / 100)
    } else {
      taxAmount = 0
    }
    finalTotal = round2(netBeforeTax + taxAmount)
  }

  // 3. Split tax into CGST + SGST (intra-state standard for tour operators)
  const cgstAmount = round2(taxAmount / 2)
  const sgstAmount = round2(taxAmount - cgstAmount)

  return {
    baseAmount: base,
    discountType,
    discountValue: dVal,
    discountAmount,
    netBeforeTax,
    gstRate: gRate,
    taxAmount,
    cgstAmount,
    sgstAmount,
    isTaxInclusive: Boolean(isTaxInclusive),
    finalTotal,
  }
}
