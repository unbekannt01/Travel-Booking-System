/* eslint-disable no-unused-vars */
import express from "express"
import bcrypt from "bcryptjs"
import rateLimit from "express-rate-limit"
import crypto from "crypto"
import { encryptTotp, decryptTotp } from "../utils/crypto.js"
import jwt from "jsonwebtoken"
import speakeasy from "speakeasy"
import QRCode from "qrcode"
import nodemailer from "nodemailer"
import User from "../models/User.js"
import EmailToken from "../models/EmailToken.js"
import verifyToken from "../middleware/auth.js"

const router = express.Router()

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number.parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true", // Use TLS for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

transporter.verify((error) => {
  if (error) {
    console.error("Transporter verification failed:", error.message)
  } else {
    console.log("Transporter server is ready to take messages")
  }
})

/*
const checkRateLimit = async (user) => {
  const today = new Date().setHours(0, 0, 0, 0)
  const lastAttempt = user.lastResetAttemptDate ? new Date(user.lastResetAttemptDate).setHours(0, 0, 0, 0) : null

  if (lastAttempt === today) {
    if (user.dailyResetAttempts >= 3) return false
    user.dailyResetAttempts += 1
  } else {
    user.dailyResetAttempts = 1
    user.lastResetAttemptDate = new Date()
  }
  await user.save()
  return true
}
*/


export const validatePasswordComplexity = (password) => {
  if (!password || typeof password !== "string") return false
  if (password.length < 10) return false
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  return hasUpper && hasLower && hasDigit && hasSpecial
}

export const setSessionCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === "production"
  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

export const clearSessionCookie = (res) => {
  const isProduction = process.env.NODE_ENV === "production"
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
  })
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many authentication requests from this IP. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
})

const formatUserResponse = (user) => ({
  id: user._id,
  userName: user.userName,
  email: user.email,
  companyName: user.companyName,
  companyTagline: user.companyTagline,
  companyHeadquarters: user.companyHeadquarters,
  companyPhone: user.companyPhone,
  companyLogo: user.companyLogo,
  gstNumber: user.gstNumber || "",
  invoicePrefix: user.invoicePrefix || "YHB",
  receiptPrefix: user.receiptPrefix || "REC",
  invoiceTheme: user.invoiceTheme || "classic",
  invoiceColor: user.invoiceColor || "#4f46e5",
  documentLanguage: user.documentLanguage || "en",
  ticketTemplate: user.ticketTemplate || "classic",
  termsAndConditions: user.termsAndConditions || [],
  bankDetails: user.bankDetails,
  organizers: user.organizers,
  twoFactorEnabled: user.twoFactorEnabled,
})

router.post("/register", authLimiter, async (req, res) => {
  try {
    const { userName, email, password } = req.body

    if (!validatePasswordComplexity(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 10 characters long and include uppercase, lowercase, a number, and a special character.",
      })
    }

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: "This email is already registered. Please login instead." })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const tokenId = "token_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)

    const newUser = new User({
      userName,
      email,
      password: hashedPassword,
      tokenVersion: 0,
      failedLoginAttempts: 0,
    })
    await newUser.save()

    const token = jwt.sign({ id: newUser._id, tokenId, tokenVersion: 0 }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    })

    newUser.activeTokens.push({
      token,
      tokenId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    await newUser.save()

    setSessionCookie(res, token)

    res.status(201).json({
      token,
      tokenId,
      user: formatUserResponse(newUser),
      message: "Registration successful",
    })
  } catch (error) {
    console.error("Registration error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.post("/setup-2fa", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Generate secret for TOTP
    const secret = speakeasy.generateSecret({
      name: `YatraHub (${user.email})`,
      issuer: "YatraHub",
    })

    // Save the secret encrypted at rest with AES-256-GCM
    user.twoFactorSecret = encryptTotp(secret.base32)
    user.twoFactorEncrypted = true
    await user.save()

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url)

    res.json({
      message: "2FA setup initiated",
      secret: secret.base32,
      qrCode: qrCodeUrl,
    })
  } catch (error) {
    console.error("Setup 2FA error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.post("/verify-2fa-setup", verifyToken, async (req, res) => {
  try {
    const { code } = req.body
    const user = await User.findById(req.user.id)

    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ message: "2FA setup not initiated" })
    }

    const rawSecret = decryptTotp(user.twoFactorSecret)
    if (!rawSecret) {
      return res.status(500).json({ message: "Failed to decrypt 2FA secret" })
    }

    // Verify the code
    const verified = speakeasy.totp.verify({
      secret: rawSecret,
      encoding: "base32",
      token: code,
      window: 1,
    })

    if (!verified) {
      return res.status(400).json({ message: "Invalid verification code" })
    }

    // Enable 2FA
    user.twoFactorEnabled = true
    user.failed2FAAttempts = 0
    await user.save()

    res.json({
      message: "2FA enabled successfully",
      twoFactorEnabled: true,
    })
  } catch (error) {
    console.error("Verify 2FA setup error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { loginIdentifier, password } = req.body

    if (!loginIdentifier || !password) {
      return res.status(400).json({ message: "Email/Username and password are required" })
    }

    // Try to find user by email or username
    const user = await User.findOne({
      $or: [{ email: loginIdentifier }, { userName: loginIdentifier }],
    })

    if (!user) {
      return res.status(404).json({ message: "No account found with this email or username. Please register first." })
    }

    // Check account lockout (15 minutes after 5 failed attempts)
    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMins = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000)
      return res.status(403).json({
        message: `Account is temporarily locked due to multiple failed attempts. Please try again in ${remainingMins} minute(s).`,
      })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000)
        user.failedLoginAttempts = 0
      }
      await user.save()
      return res.status(400).json({ message: "Incorrect password. Please try again." })
    }

    // Reset lockout counters on success
    user.failedLoginAttempts = 0
    user.lockUntil = null

    const now = new Date()
    user.activeTokens = user.activeTokens.filter((t) => t.expiresAt > now)

    if (user.activeTokens.length >= 2) {
      user.activeTokens = user.activeTokens.slice(-1)
    }

    if (user.twoFactorEnabled) {
      const tempToken = jwt.sign(
        { id: user._id, temp: true, purpose: "2fa-verification" },
        process.env.JWT_SECRET,
        { expiresIn: "10m" },
      )

      await user.save()
      return res.json({
        requires2FA: true,
        tempToken,
        message: "Please enter your 2FA code",
      })
    }

    const tokenId = "token_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
    const token = jwt.sign(
      { id: user._id, tokenId, tokenVersion: user.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    )

    user.activeTokens.push({
      token,
      tokenId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    await user.save()
    setSessionCookie(res, token)

    res.json({
      token,
      tokenId,
      user: formatUserResponse(user),
      message: "Login successful",
    })
  } catch (error) {
    console.error("Login error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.post("/verify-2fa-login", authLimiter, async (req, res) => {
  try {
    const { tempToken, code } = req.body

    if (!tempToken || !code) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET)

    if (!decoded.temp || decoded.purpose !== "2fa-verification") {
      return res.status(400).json({ message: "Invalid token" })
    }

    const user = await User.findById(decoded.id)

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ message: "2FA not enabled for this user" })
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMins = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000)
      return res.status(403).json({
        message: `Account is temporarily locked due to multiple failed attempts. Please try again in ${remainingMins} minute(s).`,
      })
    }

    const rawSecret = decryptTotp(user.twoFactorSecret)
    if (!rawSecret) {
      return res.status(500).json({ message: "Failed to decrypt 2FA credentials" })
    }

    // Verify the 2FA code
    const verified = speakeasy.totp.verify({
      secret: rawSecret,
      encoding: "base32",
      token: code,
      window: 1,
    })

    if (!verified) {
      user.failed2FAAttempts = (user.failed2FAAttempts || 0) + 1
      if (user.failed2FAAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000)
        user.failed2FAAttempts = 0
      }
      await user.save()
      return res.status(400).json({ message: "Invalid 2FA code" })
    }

    user.failed2FAAttempts = 0
    user.lockUntil = null

    const now = new Date()
    user.activeTokens = user.activeTokens.filter((t) => t.expiresAt > now)

    if (user.activeTokens.length >= 2) {
      user.activeTokens = user.activeTokens.slice(-1)
    }

    const tokenId = "token_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
    const token = jwt.sign(
      { id: user._id, tokenId, tokenVersion: user.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    )

    user.activeTokens.push({
      token,
      tokenId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    await user.save()
    setSessionCookie(res, token)

    res.json({
      token,
      tokenId,
      user: formatUserResponse(user),
      message: "Login successful",
    })
  } catch (error) {
    console.error("Verify 2FA login error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.post("/logout", async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1]
    clearSessionCookie(res)

    let userId
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        userId = decoded.id
      } catch (err) {
        const decoded = jwt.decode(token)
        if (decoded) userId = decoded.id
      }
    }

    if (userId) {
      const user = await User.findById(userId)
      if (user) {
        const now = new Date()
        user.activeTokens = user.activeTokens.filter((t) => t.token !== token && t.expiresAt > now)
        user.tokenVersion = (user.tokenVersion || 0) + 1
        await user.save()
      }
    }

    res.json({ message: "Logout successful" })
  } catch (error) {
    console.error("Logout error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.put("/update-profile", verifyToken, async (req, res) => {
  try {
    const { userName } = req.body
    const user = await User.findByIdAndUpdate(req.user.id, { userName }, { new: true })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({
      message: "Profile updated successfully",
      user: formatUserResponse(user),
    })
  } catch (error) {
    console.error("Update profile error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.put("/update-company", verifyToken, async (req, res) => {
  try {
    const {
      companyName,
      companyTagline,
      companyHeadquarters,
      companyPhone,
      companyLogo,
      gstNumber,
      invoicePrefix,
      receiptPrefix,
      invoiceTheme,
      invoiceColor,
      documentLanguage,
      ticketTemplate,
      termsAndConditions,
      organizers,
      bankDetails,
    } = req.body

    const updateData = {}
    if (companyName !== undefined) updateData.companyName = companyName
    if (companyTagline !== undefined) updateData.companyTagline = companyTagline
    if (companyHeadquarters !== undefined) updateData.companyHeadquarters = companyHeadquarters
    if (companyPhone !== undefined) updateData.companyPhone = companyPhone
    if (companyLogo !== undefined) updateData.companyLogo = companyLogo
    if (gstNumber !== undefined) updateData.gstNumber = gstNumber
    if (invoicePrefix !== undefined) updateData.invoicePrefix = (invoicePrefix || "YHB").toUpperCase().trim()
    if (receiptPrefix !== undefined) updateData.receiptPrefix = (receiptPrefix || "REC").toUpperCase().trim()
    if (invoiceTheme !== undefined && ["classic", "modern", "minimal"].includes(invoiceTheme)) {
      updateData.invoiceTheme = invoiceTheme
    }
    if (invoiceColor !== undefined && typeof invoiceColor === "string") {
      updateData.invoiceColor = invoiceColor.trim()
    }
    if (documentLanguage !== undefined && ["en", "hi", "gu"].includes(documentLanguage)) {
      updateData.documentLanguage = documentLanguage
    }
    if (ticketTemplate !== undefined && ["classic", "modern", "heritage", "corporate", "thermal", "transit"].includes(ticketTemplate)) {
      updateData.ticketTemplate = ticketTemplate
    }
    if (termsAndConditions !== undefined && Array.isArray(termsAndConditions)) {
      updateData.termsAndConditions = termsAndConditions
    }
    if (organizers !== undefined) updateData.organizers = organizers
    if (bankDetails !== undefined) updateData.bankDetails = bankDetails

    const user = await User.findByIdAndUpdate(req.user.id, updateData, { new: true })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({
      message: "Company settings updated successfully",
      user: formatUserResponse(user),
    })
  } catch (error) {
    console.error("Update company error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.post("/disable-2fa", verifyToken, async (req, res) => {
  try {
    const { code } = req.body
    const user = await User.findById(req.user.id)

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: "2FA is not enabled" })
    }

    const rawSecret = decryptTotp(user.twoFactorSecret)
    if (!rawSecret) {
      return res.status(500).json({ message: "Failed to decrypt 2FA credentials" })
    }

    // Verify the code before disabling
    const verified = speakeasy.totp.verify({
      secret: rawSecret,
      encoding: "base32",
      token: code,
      window: 1,
    })

    if (!verified) {
      return res.status(400).json({ message: "Invalid verification code" })
    }

    user.twoFactorEnabled = false
    user.twoFactorSecret = null
    user.twoFactorEncrypted = false
    await user.save()

    res.json({
      message: "2FA disabled successfully",
      twoFactorEnabled: false,
    })
  } catch (error) {
    console.error("Disable 2FA error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

// New endpoint to get active sessions
router.get("/active-sessions", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const now = new Date()
    const activeSessions = user.activeTokens.filter((t) => t.expiresAt > now)

    res.json({
      activeSessions: activeSessions.map((session, index) => ({
        index,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        tokenId: session.tokenId,
      })),
    })
  } catch (error) {
    console.error("Error fetching active sessions:", error.message)
    res.status(500).json({ message: error.message })
  }
})

// New endpoint to logout from a specific device
router.post("/logout-device/:tokenId", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const sessionIndex = user.activeTokens.findIndex((t) => t.tokenId === req.params.tokenId)

    if (sessionIndex === -1) {
      return res.status(404).json({ message: "Session not found" })
    }

    user.activeTokens.splice(sessionIndex, 1)
    await user.save()

    res.json({ message: "Session logged out successfully" })
  } catch (error) {
    console.error("Error logging out device:", error.message)
    res.status(500).json({ message: error.message })
  }
})

// New endpoint to validate password reset token without consuming it
router.get("/validate-reset-token/:token", async (req, res) => {
  try {
    const { token } = req.params

    const emailToken = await EmailToken.findOne({ token, purpose: "password-reset" })
    if (!emailToken) {
      return res.status(400).json({ valid: false, message: "Invalid or expired reset token" })
    }

    const user = await User.findById(emailToken.userId)
    if (!user) {
      return res.status(404).json({ valid: false, message: "User no longer exists" })
    }

    res.json({ valid: true, message: "Token is valid", email: user.email })
  } catch (error) {
    console.error("Validate Reset Token Error:", error.message)
    res.status(500).json({ valid: false, message: "Failed to validate token" })
  }
})

// New endpoint to validate 2FA recovery token without consuming it
router.get("/validate-2fa-token/:token", async (req, res) => {
  try {
    const { token } = req.params
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

    const emailToken = await EmailToken.findOne({
      $or: [{ token: hashedToken }, { token }],
      purpose: "2fa-recovery",
    })
    if (!emailToken) {
      return res.status(400).json({ valid: false, message: "Invalid or expired recovery token" })
    }

    const user = await User.findById(emailToken.userId)
    if (!user) {
      return res.status(404).json({ valid: false, message: "User no longer exists" })
    }

    res.json({ valid: true, message: "Token is valid", email: user.email })
  } catch (error) {
    console.error("Validate 2FA Token Error:", error.message)
    res.status(500).json({ valid: false, message: "Failed to validate token" })
  }
})

router.post("/forgot-password", authLimiter, async (req, res) => {
  try {
    const { email } = req.body
    const user = await User.findOne({ email })
    if (!user) return res.status(404).json({ message: "No account found with this email" })

    // const allowed = await checkRateLimit(user)
    // if (!allowed)
    //   return res.status(429).json({ message: "Daily limit of 3 reset attempts reached. Try again tomorrow." })

    const resetToken = jwt.sign({ id: user._id, purpose: "password-reset" }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    })
    await EmailToken.deleteMany({ userId: user._id, purpose: "password-reset" })
    const newToken = new EmailToken({
      userId: user._id,
      token: resetToken,
      purpose: "password-reset",
    })
    await newToken.save()

    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${resetToken}`

    await transporter.sendMail({
      from: `"YatraHub Security" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset Request - YatraHub",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; background-color: #f9fafb;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #0ea5e9; margin: 0;">YatraHub</h1>
          </div>
          <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h2 style="color: #111827; margin-top: 0;">Reset Your Password</h2>
            <p style="color: #374151;">Hello <b>${user.userName}</b>,</p>
            <p style="color: #374151;">We received a request to reset your YatraHub account password. Click the button below to secure your account. This link will expire in 1 hour.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Reset Password</a>
            </div>
            <p style="font-size: 13px; color: #6b7280;">If you didn't request this, you can safely ignore this email. No changes will be made to your account.</p>
          </div>
          <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 20px;">&copy; 2026 YatraHub. All rights reserved.</p>
        </div>
      `,
    })

    res.json({ message: "Reset link has been sent to your email" })
  } catch (error) {
    console.error("Forgot Password Error:", error.message)
    res
      .status(500)
      .json({ message: "Failed to send email. Ensure EMAIL_USER and EMAIL_PASS are set in environment variables." })
  }
})

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body

    const emailToken = await EmailToken.findOne({ token, purpose: "password-reset" })
    if (!emailToken) return res.status(400).json({ message: "Invalid or expired reset token" })

    const user = await User.findById(emailToken.userId)
    if (!user) return res.status(404).json({ message: "User no longer exists" })

    if (!validatePasswordComplexity(newPassword)) {
      return res.status(400).json({
        message:
          "Password must be at least 10 characters long and include uppercase, lowercase, a number, and a special character.",
      })
    }

    user.password = await bcrypt.hash(newPassword, 12)
    user.tokenVersion = (user.tokenVersion || 0) + 1
    await user.save()

    await EmailToken.deleteOne({ _id: emailToken._id })

    res.json({ message: "Password updated successfully" })
  } catch (error) {
    console.error("Reset Password Error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.post("/request-2fa-recovery", authLimiter, async (req, res) => {
  try {
    const { email } = req.body
    const user = await User.findOne({ email })
    if (!user) return res.status(404).json({ message: "No account found with this email" })

    // 15-minute single-use token
    const recoveryToken = jwt.sign({ id: user._id, purpose: "2fa-recovery" }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    })

    const hashedToken = crypto.createHash("sha256").update(recoveryToken).digest("hex")

    await EmailToken.deleteMany({ userId: user._id, purpose: "2fa-recovery" })
    const newToken = new EmailToken({
      userId: user._id,
      token: hashedToken,
      purpose: "2fa-recovery",
    })
    await newToken.save()

    const recoveryUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/recover-2fa/${recoveryToken}`

    await transporter.sendMail({
      from: `"YatraHub Security" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "2FA Recovery Access - YatraHub",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; background-color: #fff1f2;">
          <div style="text-align: center; margin-bottom: 20px;">
             <h1 style="color: #f43f5e; margin: 0;">YatraHub Security</h1>
          </div>
          <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h2 style="color: #111827; margin-top: 0;">Recover Account Access</h2>
            <p style="color: #374151;">Hello <b>${user.userName}</b>,</p>
            <p style="color: #374151;">You've requested to recover your account because you've lost access to your 2FA device. Clicking the button below will allow you to bypass 2FA once and disable it. Link valid for 1 hour.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${recoveryUrl}" style="display: inline-block; padding: 14px 28px; background-color: #f43f5e; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Recover & Setup 2FA</a>
            </div>
            <p style="font-size: 13px; color: #6b7280;">If you didn't request this, please change your password immediately as your account security might be at risk.</p>
          </div>
        </div>
      `,
    })

    res.json({ message: "Recovery link has been sent to your email" })
  } catch (error) {
    console.error("2FA Recovery Error:", error.message)
    res.status(500).json({ message: "Failed to send recovery email." })
  }
})

router.post("/finalize-2fa-recovery", async (req, res) => {
  try {
    const { token, password } = req.body
    if (!token) return res.status(400).json({ message: "Recovery token is required" })

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex")
    const emailToken = await EmailToken.findOne({
      $or: [{ token: hashedToken }, { token }],
      purpose: "2fa-recovery",
    })
    if (!emailToken) return res.status(400).json({ message: "Invalid or expired recovery token" })

    const user = await User.findById(emailToken.userId)
    if (!user) return res.status(404).json({ message: "User not found" })

    // If password provided, verify it
    if (password) {
      const isMatch = await bcrypt.compare(password, user.password)
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid account password." })
      }
    }

    // Disable 2FA & revoke past sessions
    user.twoFactorEnabled = false
    user.twoFactorSecret = null
    user.twoFactorEncrypted = false
    user.tokenVersion = (user.tokenVersion || 0) + 1
    await user.save()

    // Delete single-use token immediately
    await EmailToken.deleteOne({ _id: emailToken._id })

    // Create a temp token for 2FA setup
    const tempToken = jwt.sign(
      { id: user._id, temp: true, purpose: "2fa-recovery-setup" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    )

    res.json({
      message: "2FA disabled successfully. Please set up 2FA again.",
      tempToken,
      requiresSetup: true,
      user: {
        id: user._id,
        userName: user.userName,
        email: user.email,
      },
    })
  } catch (error) {
    console.error("Finalize 2FA Recovery Error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

export default router
