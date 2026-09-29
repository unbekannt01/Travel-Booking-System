import test from "node:test"
import assert from "node:assert/strict"
import { isValidIndianPhone, isValidAadhaar } from "../src/utils/validators.js"
import { maskAadhaar, formatAadhaarInput } from "../src/utils/formatters.js"
import { validateIndianPhone, validateAadhaar } from "../shared/businessLogic.js"

test("Phone validation - valid Indian mobile numbers", () => {
  const validPhones = [
    "9876543210",
    "8123456789",
    "7000000000",
    "6999999999",
    "+91 9876543210",
    "+919876543210",
    "919876543210",
    "09876543210",
    "98765 43210",
    "9876-543-210",
  ]

  for (const phone of validPhones) {
    assert.equal(
      isValidIndianPhone(phone),
      true,
      `Expected ${phone} to be valid on frontend validator`
    )
    assert.equal(
      validateIndianPhone(phone),
      true,
      `Expected ${phone} to be valid on backend validator`
    )
  }
})

test("Phone validation - invalid numbers rejected", () => {
  const invalidPhones = [
    "",
    null,
    undefined,
    "1234567890", // Starts with 1
    "5876543210", // Starts with 5
    "987654321", // 9 digits
    "98765432101", // 11 digits without 0/91 prefix
    "abcdefghij", // Non-digits
    "98765abcde",
  ]

  for (const phone of invalidPhones) {
    assert.equal(
      isValidIndianPhone(phone),
      false,
      `Expected ${phone} to be invalid on frontend validator`
    )
    assert.equal(
      validateIndianPhone(phone),
      false,
      `Expected ${phone} to be invalid on backend validator`
    )
  }
})

test("Aadhaar validation - valid 12-digit format", () => {
  assert.equal(isValidAadhaar("123456789012"), true)
  assert.equal(isValidAadhaar("1234 5678 9012"), true)
  assert.equal(isValidAadhaar(""), true, "Empty Aadhaar should be allowed as optional")
  assert.equal(isValidAadhaar(null), true, "Null Aadhaar should be allowed as optional")

  assert.equal(validateAadhaar("123456789012"), true)
  assert.equal(validateAadhaar("1234 5678 9012"), true)
  assert.equal(validateAadhaar(""), true)
})

test("Aadhaar validation - invalid formats rejected", () => {
  const invalidAadhaars = [
    "12345678901", // 11 digits
    "1234567890123", // 13 digits
    "12345678901A", // non-digit
    "abcd efgh ijkl",
  ]

  for (const aadhar of invalidAadhaars) {
    assert.equal(isValidAadhaar(aadhar), false, `Expected ${aadhar} to be invalid`)
    assert.equal(validateAadhaar(aadhar), false, `Expected ${aadhar} to be invalid on backend`)
  }
})

test("Aadhaar masking and formatting", () => {
  // Masking
  assert.equal(maskAadhaar("123456789012"), "XXXX XXXX 9012")
  assert.equal(maskAadhaar("1234 5678 9012"), "XXXX XXXX 9012")
  assert.equal(maskAadhaar(""), "—")
  assert.equal(maskAadhaar(null), "—")

  // Formatting input
  assert.equal(formatAadhaarInput("123456789012"), "1234 5678 9012")
  assert.equal(formatAadhaarInput("12345"), "1234 5")
  assert.equal(formatAadhaarInput(""), "")
})
