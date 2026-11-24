import { describe, it } from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { generatePreviewToken, verifyPreviewToken } from "../backend/routes/import.js"

describe("Import Preview HMAC Token Unit Tests (Part 6c-fix)", () => {
  const userId = "674000000000000000000001"
  const type = "customers"
  const mapping = { "Customer Name": "name", "Mobile": "phone", "City": "city" }
  const contentHash = crypto.createHash("sha256").update("Customer Name,Mobile\nTest,9825012345").digest("hex")
  const expiry = Date.now() + 15 * 60 * 1000

  it("generates valid HMAC token and verifies successfully with matching parameters", () => {
    const token = generatePreviewToken(userId, type, mapping, contentHash, expiry)
    assert.ok(token && typeof token === "string")
    assert.ok(token.includes("."))

    const isValid = verifyPreviewToken(token, userId, type, mapping, contentHash)
    assert.equal(isValid, true, "Valid token must verify to true")
  })

  it("is resilient to mapping key order permutations (deterministic mapping hash)", () => {
    const permutedMapping = { "City": "city", "Customer Name": "name", "Mobile": "phone" }
    const token = generatePreviewToken(userId, type, mapping, contentHash, expiry)

    const isValid = verifyPreviewToken(token, userId, type, permutedMapping, contentHash)
    assert.equal(isValid, true, "Permuted mapping keys with identical pairs must verify to true")
  })

  it("fails verification if userId does not match", () => {
    const token = generatePreviewToken(userId, type, mapping, contentHash, expiry)
    const otherUserId = "674000000000000000000002"

    const isValid = verifyPreviewToken(token, otherUserId, type, mapping, contentHash)
    assert.equal(isValid, false, "Altered userId must fail verification")
  })

  it("fails verification if type does not match", () => {
    const token = generatePreviewToken(userId, type, mapping, contentHash, expiry)

    const isValid = verifyPreviewToken(token, userId, "expenses", mapping, contentHash)
    assert.equal(isValid, false, "Altered import type must fail verification")
  })

  it("fails verification if column mapping is tampered", () => {
    const token = generatePreviewToken(userId, type, mapping, contentHash, expiry)
    const alteredMapping = { ...mapping, "Notes": "notes" }

    const isValid = verifyPreviewToken(token, userId, type, alteredMapping, contentHash)
    assert.equal(isValid, false, "Tampered column mapping must fail verification")
  })

  it("fails verification if CSV content hash does not match", () => {
    const token = generatePreviewToken(userId, type, mapping, contentHash, expiry)
    const alteredHash = crypto.createHash("sha256").update("DIFFERENT CONTENT").digest("hex")

    const isValid = verifyPreviewToken(token, userId, type, mapping, alteredHash)
    assert.equal(isValid, false, "Altered content hash must fail verification")
  })

  it("fails verification if token timestamp is expired", () => {
    const pastExpiry = Date.now() - 1000 // 1 second in the past
    const expiredToken = generatePreviewToken(userId, type, mapping, contentHash, pastExpiry)

    const isValid = verifyPreviewToken(expiredToken, userId, type, mapping, contentHash)
    assert.equal(isValid, false, "Expired token must fail verification")
  })

  it("fails verification if signature is malformed or forged", () => {
    const token = generatePreviewToken(userId, type, mapping, contentHash, expiry)
    const [sig, exp] = token.split(".")
    const forgedSig = sig.slice(0, -2) + "ff"
    const forgedToken = `${forgedSig}.${exp}`

    const isValid = verifyPreviewToken(forgedToken, userId, type, mapping, contentHash)
    assert.equal(isValid, false, "Forged signature must fail verification")

    assert.equal(verifyPreviewToken("invalid-string", userId, type, mapping, contentHash), false)
    assert.equal(verifyPreviewToken(null, userId, type, mapping, contentHash), false)
  })
})
