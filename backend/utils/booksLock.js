import bcrypt from "bcryptjs"
import speakeasy from "speakeasy"
import BooksClose from "../models/BooksClose.js"
import User from "../models/User.js"
import { decryptTotp } from "./crypto.js"
import { toDateString } from "../../shared/cashbook.js"

/**
 * Returns the effective lock date (YYYY-MM-DD) for a tenant if books are closed, or null.
 * The effective lock date is the latest active BooksClose closedUpTo.
 *
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @returns {Promise<string|null>}
 */
export async function getEffectiveLockDate(userId) {
  if (!userId) return null
  const latestClose = await BooksClose.findOne({
    userId,
    status: "active",
  })
    .sort({ closedUpTo: -1 })
    .select("closedUpTo")
    .lean()

  return latestClose ? latestClose.closedUpTo : null
}

/**
 * Custom error class for HTTP 423 Locked.
 */
export class BooksLockedError extends Error {
  constructor(lockDate, transactionDate) {
    super(`Books are closed up to ${lockDate}. Transactions on or before this date cannot be created, modified, or deleted.`)
    this.name = "BooksLockedError"
    this.statusCode = 423
    this.lockDate = lockDate
    this.transactionDate = transactionDate
  }
}

/**
 * Asserts that the books are open for the given transaction date.
 * Throws BooksLockedError (statusCode: 423) if transaction date <= effectiveLockDate.
 *
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @param {string|Date} transactionDate
 * @returns {Promise<void>}
 */
export async function assertBooksOpen(userId, transactionDate) {
  if (!transactionDate) return
  const txDateStr = toDateString(transactionDate)
  if (!txDateStr) return

  const lockDate = await getEffectiveLockDate(userId)
  if (lockDate && txDateStr <= lockDate) {
    throw new BooksLockedError(lockDate, txDateStr)
  }
}

/**
 * Verifies operator credentials for step-up actions (Closing books, Reopening closes).
 * Validates password, and if 2FA is active, validates TOTP token as well.
 *
 * @param {object} params
 * @param {string|import("mongoose").Types.ObjectId} params.userId
 * @param {string} params.password
 * @param {string} [params.totpToken]
 * @returns {Promise<{ verified: boolean, reason?: string }>}
 */
export async function verifyStepUpAuth({ userId, password, totpToken }) {
  if (!password || typeof password !== "string") {
    return { verified: false, reason: "Password is required for step-up confirmation." }
  }

  const user = await User.findById(userId)
  if (!user) {
    return { verified: false, reason: "User account not found." }
  }

  // Verify password
  const isMatch = await bcrypt.compare(password, user.password)
  if (!isMatch) {
    return { verified: false, reason: "Incorrect operator password." }
  }

  // If 2FA enabled, verify TOTP token
  if (user.twoFactorEnabled) {
    if (!totpToken || typeof totpToken !== "string" || !totpToken.trim()) {
      return { verified: false, reason: "Two-factor authentication code (TOTP) is required." }
    }
    const cleanToken = totpToken.replace(/\s+/g, "").trim()
    try {
      const secret = decryptTotp(user.twoFactorSecret)
      const isTotpValid = speakeasy.totp.verify({
        secret,
        encoding: "base32",
        token: cleanToken,
        window: 1,
      })
      if (!isTotpValid) {
        return { verified: false, reason: "Invalid or expired two-factor authentication code." }
      }
    } catch (err) {
      console.error("Step-up TOTP verification error:", err.message)
      return { verified: false, reason: "Failed to verify 2FA token. Please try again." }
    }
  }

  return { verified: true }
}
