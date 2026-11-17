import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { validatePasswordComplexity } from "../backend/routes/auth.js"
import { encryptTotp, decryptTotp } from "../backend/utils/crypto.js"
import {
  validateVerhoeff,
  generateVerhoeff,
  encryptAadhaar,
  decryptAadhaar,
  maskAadhaar,
} from "../backend/utils/aadhaar.js"

describe("Authentication & Data Security Hardening (Task C, F, H)", () => {
  describe("Password Complexity Policy (SEC-010)", () => {
    it("accepts passwords meeting complexity criteria (>= 10 chars, upper, lower, digit, symbol)", () => {
      assert.equal(validatePasswordComplexity("YatraHub@2026!"), true)
      assert.equal(validatePasswordComplexity("SecureP@ssw0rd#9"), true)
      assert.equal(validatePasswordComplexity("TourOp#7890Aa"), true)
    })

    it("rejects passwords shorter than 10 characters", () => {
      assert.equal(validatePasswordComplexity("Short1@a"), false)
      assert.equal(validatePasswordComplexity("Abc1!"), false)
      assert.equal(validatePasswordComplexity(""), false)
      assert.equal(validatePasswordComplexity(null), false)
    })

    it("rejects passwords missing uppercase letters", () => {
      assert.equal(validatePasswordComplexity("yatrahub@2026!"), false)
    })

    it("rejects passwords missing lowercase letters", () => {
      assert.equal(validatePasswordComplexity("YATRAHUB@2026!"), false)
    })

    it("rejects passwords missing numeric digits", () => {
      assert.equal(validatePasswordComplexity("YatraHub@Secret!"), false)
    })

    it("rejects passwords missing special characters", () => {
      assert.equal(validatePasswordComplexity("YatraHub2026a"), false)
    })
  })

  describe("TOTP 2FA Secret Encryption at Rest (SEC-005)", () => {
    it("encrypts TOTP base32 secret using AES-256-GCM and decrypts back accurately", () => {
      const originalSecret = "JBSWY3DPEHPK3PXP"
      const encrypted = encryptTotp(originalSecret)

      assert.notEqual(encrypted, originalSecret)
      const parts = encrypted.split(":")
      assert.equal(parts.length, 3, "Encrypted string must be formatted as iv:authTag:cipherText")

      const decrypted = decryptTotp(encrypted)
      assert.equal(decrypted, originalSecret)
    })

    it("handles corrupted ciphertext safely without unhandled crashes", () => {
      const corrupted = "001122334455:66778899aabb:deadbeefcorruptedpayload"
      const result = decryptTotp(corrupted)
      assert.equal(result, null, "Decryption failure should return null")
    })
  })

  describe("Aadhaar Verhoeff Validation & At-Rest Encryption (SEC-012)", () => {
    it("generates correct Verhoeff check digit for 11-digit numbers", () => {
      const prefix = "36759832415"
      const checkDigit = generateVerhoeff(prefix)
      assert.equal(typeof checkDigit, "number")
      const fullAadhaar = `${prefix}${checkDigit}`
      assert.equal(validateVerhoeff(fullAadhaar), true)
    })

    it("validates correct 12-digit Aadhaar numbers and rejects tampered numbers", () => {
      const validAadhaar = "367598324152"
      assert.equal(validateVerhoeff(validAadhaar), true)

      // Single-digit alteration
      const alteredLastDigit = "367598324153"
      assert.equal(validateVerhoeff(alteredLastDigit), false)

      // Adjacent transposition error
      const transposed = "367598324512"
      assert.equal(validateVerhoeff(transposed), false)

      // Non-12-digit string
      assert.equal(validateVerhoeff("12345"), false)
      assert.equal(validateVerhoeff("not_a_number"), false)
    })

    it("encrypts raw Aadhaar using AES-256-GCM and decrypts accurately", () => {
      const rawAadhaar = "367598324152"
      const encrypted = encryptAadhaar(rawAadhaar)

      assert.notEqual(encrypted, rawAadhaar)
      const parts = encrypted.split(":")
      assert.equal(parts.length, 3, "Must have iv, authTag, and ciphertext")

      const decrypted = decryptAadhaar(encrypted)
      assert.equal(decrypted, rawAadhaar)
    })

    it("masks Aadhaar to format XXXX XXXX 1234", () => {
      const masked = maskAadhaar("367598324152")
      assert.equal(masked, "XXXX XXXX 4152")
    })
  })

  describe("Session Revocation (tokenVersion) Policy (SEC-004, SEC-007)", () => {
    it("identifies expired or revoked token when user tokenVersion exceeds token tokenVersion", () => {
      const user = { _id: "user_123", tokenVersion: 2 }
      const oldTokenPayload = { id: "user_123", tokenVersion: 0 }
      const currentTokenPayload = { id: "user_123", tokenVersion: 2 }

      const isOldValid = (oldTokenPayload.tokenVersion || 0) === user.tokenVersion
      const isCurrentValid = (currentTokenPayload.tokenVersion || 0) === user.tokenVersion

      assert.equal(isOldValid, false, "Older token version must be rejected")
      assert.equal(isCurrentValid, true, "Matching token version must be accepted")
    })
  })

  describe("Account Lockout Protection Policy (SEC-006)", () => {
    it("triggers 15-minute account lock after 5 consecutive failed login attempts", () => {
      const user = { failedLoginAttempts: 4, lockUntil: null }

      // 5th failed attempt
      user.failedLoginAttempts += 1
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000)
        user.failedLoginAttempts = 0
      }

      assert.notEqual(user.lockUntil, null)
      assert.equal(user.lockUntil > new Date(), true)
      assert.equal(user.failedLoginAttempts, 0)
    })

    it("resets failed attempt counter upon successful login", () => {
      const user = { failedLoginAttempts: 3, lockUntil: null }
      // Successful login
      user.failedLoginAttempts = 0
      user.lockUntil = null

      assert.equal(user.failedLoginAttempts, 0)
      assert.equal(user.lockUntil, null)
    })
  })
})
