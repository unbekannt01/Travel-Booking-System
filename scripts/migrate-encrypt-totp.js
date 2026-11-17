import mongoose from "mongoose"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import User from "../backend/models/User.js"
import { encryptTotp } from "../backend/utils/crypto.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, "../backend/.env") })
dotenv.config({ path: path.join(__dirname, "../.env") })

const isDryRun = process.argv.includes("--dry-run")
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/sb_tourism"

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
