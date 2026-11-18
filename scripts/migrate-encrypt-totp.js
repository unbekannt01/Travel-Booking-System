/**
 * Migration Script: Encrypt Plaintext TOTP (2FA) Secrets in MongoDB (SEC-005)
 *
 * Usage (from the project root, D:\Travel-Booking-System):
 *   node scripts/migrate-encrypt-totp.js --dry-run
 *   node scripts/migrate-encrypt-totp.js
 *
 * NOTE: mongoose is imported from backend/node_modules on purpose, so the script
 * and the backend models share ONE mongoose instance (two instances caused
 * "Operation `users.find()` buffering timed out").
 */

import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import mongoose from "../backend/node_modules/mongoose/index.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load env BEFORE importing backend code (it may read keys at import time)
dotenv.config({ path: path.join(__dirname, "../backend/.env") })
dotenv.config({ path: path.join(__dirname, "../.env") })

const { default: User } = await import("../backend/models/User.js")
const { encryptTotp } = await import("../backend/utils/crypto.js")

const isDryRun = process.argv.includes("--dry-run")
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub"

async function run() {
  console.log(`Starting TOTP migration (Dry Run: ${isDryRun})...`)
  await mongoose.connect(mongoUri)
  console.log("Connected to MongoDB.")

  const users = await User.find({
    twoFactorSecret: { $ne: null },
    twoFactorEncrypted: { $ne: true },
  })

  console.log(`Found ${users.length} user(s) with unencrypted TOTP secrets.`)

  let migratedCount = 0
  for (const user of users) {
    // If it's already in iv:tag:ciphertext format, just mark encrypted
    const isAlreadyEncrypted = user.twoFactorSecret.split(":").length === 3
    const encryptedSecret = isAlreadyEncrypted
      ? user.twoFactorSecret
      : encryptTotp(user.twoFactorSecret)

    console.log(`User ${user.email}: ${isAlreadyEncrypted ? "already encrypted" : "encrypting secret"}`)

    if (!isDryRun) {
      user.twoFactorSecret = encryptedSecret
      user.twoFactorEncrypted = true
      await user.save()
    }
    migratedCount++
  }

  console.log(`Migration finished. ${migratedCount} user record(s) processed.`)
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})