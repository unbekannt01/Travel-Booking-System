/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import express from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import speakeasy from "speakeasy"
import QRCode from "qrcode"
import User from "../models/User.js"

const router = express.Router()

router.post("/register", async (req, res) => {
  try {
    const { userName, email, password } = req.body

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: "This email is already registered. Please login instead." })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const tokenId = "token_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)

    const newUser = new User({ userName, email, password: hashedPassword })
    await newUser.save()

    const token = jwt.sign({ id: newUser._id, tokenId }, process.env.JWT_SECRET || "secret", {
      expiresIn: "7d",
    })

    newUser.activeTokens.push({
      token,
      tokenId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    await newUser.save()

    res.status(201).json({
      token,
      tokenId,
      user: { 
        id: newUser._id, 
        userName, 
        email,
        companyName: newUser.companyName,
        companyTagline: newUser.companyTagline,
        companyHeadquarters: newUser.companyHeadquarters,
        companyPhone: newUser.companyPhone,
        companyLogo: newUser.companyLogo,
        organizers: newUser.organizers,
        twoFactorEnabled: newUser.twoFactorEnabled
      },
      message: "Registration successful",
    })
  } catch (error) {
    console.error("[v0] Registration error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.post("/setup-2fa", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]
    if (!token) {
      return res.status(401).json({ message: "Unauthorized. Please login." })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret")
    const user = await User.findById(decoded.id)

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Generate secret for TOTP
    const secret = speakeasy.generateSecret({
      name: `YatraHub (${user.email})`,
      issuer: "YatraHub",
    })

    // Save the secret temporarily (not enabled yet)
    user.twoFactorSecret = secret.base32
    await user.save()

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url)

    res.json({
      message: "2FA setup initiated",
      secret: secret.base32,
      qrCode: qrCodeUrl,
    })
  } catch (error) {
    console.error("[v0] Setup 2FA error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.post("/verify-2fa-setup", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]
    const { code } = req.body

    if (!token) {
      return res.status(401).json({ message: "Unauthorized. Please login." })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret")
    const user = await User.findById(decoded.id)

    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ message: "2FA setup not initiated" })
    }

    // Verify the code
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 2,
    })

    if (!verified) {
      return res.status(400).json({ message: "Invalid verification code" })
    }

    // Enable 2FA
    user.twoFactorEnabled = true
    await user.save()

    res.json({
      message: "2FA enabled successfully",
      twoFactorEnabled: true,
    })
  } catch (error) {
    console.error("[v0] Verify 2FA setup error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.post("/login", async (req, res) => {
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

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect password. Please try again." })
    }

    const now = new Date()
    user.activeTokens = user.activeTokens.filter((t) => t.expiresAt > now)

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Create a temporary token for 2FA verification
      const tempToken = jwt.sign(
        { id: user._id, temp: true, purpose: "2fa-verification" },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "10m" },
      )

      return res.json({
        requires2FA: true,
        tempToken,
        message: "Please enter your 2FA code",
      })
    }

    // No 2FA required, proceed with normal login
    const tokenId = "token_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
    const token = jwt.sign({ id: user._id, tokenId }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" })

    user.activeTokens.push({
      token,
      tokenId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    if (user.activeTokens.length > 5) {
      user.activeTokens = user.activeTokens.slice(-5)
    }

    await user.save()

    res.json({
      token,
      tokenId,
      user: { 
        id: user._id, 
        userName: user.userName, 
        email: user.email,
        companyName: user.companyName,
        companyTagline: user.companyTagline,
        companyHeadquarters: user.companyHeadquarters,
        companyPhone: user.companyPhone,
        companyLogo: user.companyLogo,
        organizers: user.organizers,
        twoFactorEnabled: user.twoFactorEnabled
      },
      message: "Login successful",
    })
  } catch (error) {
    console.error("[v0] Login error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.post("/verify-2fa-login", async (req, res) => {
  try {
    const { tempToken, code } = req.body

    if (!tempToken || !code) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET || "secret")

    if (!decoded.temp || decoded.purpose !== "2fa-verification") {
      return res.status(400).json({ message: "Invalid token" })
    }

    const user = await User.findById(decoded.id)

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ message: "2FA not enabled for this user" })
    }

    // Verify the 2FA code
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 2,
    })

    if (!verified) {
      return res.status(400).json({ message: "Invalid 2FA code" })
    }

    const now = new Date()
    user.activeTokens = user.activeTokens.filter((t) => t.expiresAt > now)

    // Create the actual session token
    const tokenId = "token_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
    const token = jwt.sign({ id: user._id, tokenId }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" })

    user.activeTokens.push({
      token,
      tokenId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    if (user.activeTokens.length > 5) {
      user.activeTokens = user.activeTokens.slice(-5)
    }

    await user.save()

    res.json({
      token,
      tokenId,
      user: { 
        id: user._id, 
        userName: user.userName, 
        email: user.email,
        companyName: user.companyName,
        companyTagline: user.companyTagline,
        companyHeadquarters: user.companyHeadquarters,
        companyPhone: user.companyPhone,
        companyLogo: user.companyLogo,
        organizers: user.organizers,
        twoFactorEnabled: user.twoFactorEnabled
      },
      message: "Login successful",
    })
  } catch (error) {
    console.error("[v0] Verify 2FA login error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.post("/logout", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]
    if (!token) {
      return res.status(400).json({ message: "No token provided" })
    }

    // ensuring we can still clean up the database even if the token is old.
    let userId
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret")
      userId = decoded.id
    } catch (err) {
      const decoded = jwt.decode(token)
      if (decoded) userId = decoded.id
    }

    if (userId) {
      const user = await User.findById(userId)
      if (user) {
        // Remove current token and any expired ones
        const now = new Date()
        user.activeTokens = user.activeTokens.filter((t) => t.token !== token && t.expiresAt > now)
        await user.save()
      }
    }

    res.json({ message: "Logout successful" })
  } catch (error) {
    console.error("[v0] Logout error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.put("/update-profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]
    if (!token) {
      return res.status(401).json({ message: "Unauthorized. Please login." })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret")
    const { userName } = req.body

    const user = await User.findByIdAndUpdate(decoded.id, { userName }, { new: true })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({
      message: "Profile updated successfully",
      user: { 
        id: user._id, 
        userName: user.userName, 
        email: user.email,
        companyName: user.companyName,
        companyTagline: user.companyTagline,
        companyHeadquarters: user.companyHeadquarters,
        companyPhone: user.companyPhone,
        companyLogo: user.companyLogo,
        organizers: user.organizers,
        twoFactorEnabled: user.twoFactorEnabled
      },
    })
  } catch (error) {
    console.error("[v0] Update profile error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.put("/update-company", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]
    if (!token) {
      return res.status(401).json({ message: "Unauthorized. Please login." })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret")
    const { companyName, companyTagline, companyHeadquarters, companyPhone, companyLogo, organizers } = req.body

    const updateData = {}
    if (companyName !== undefined) updateData.companyName = companyName
    if (companyTagline !== undefined) updateData.companyTagline = companyTagline
    if (companyHeadquarters !== undefined) updateData.companyHeadquarters = companyHeadquarters
    if (companyPhone !== undefined) updateData.companyPhone = companyPhone
    if (companyLogo !== undefined) updateData.companyLogo = companyLogo
    if (organizers !== undefined) updateData.organizers = organizers

    const user = await User.findByIdAndUpdate(decoded.id, updateData, { new: true })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({
      message: "Company settings updated successfully",
      user: { 
        id: user._id, 
        userName: user.userName, 
        email: user.email,
        companyName: user.companyName,
        companyTagline: user.companyTagline,
        companyHeadquarters: user.companyHeadquarters,
        companyPhone: user.companyPhone,
        companyLogo: user.companyLogo,
        organizers: user.organizers,
        twoFactorEnabled: user.twoFactorEnabled
      },
    })
  } catch (error) {
    console.error("[v0] Update company error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.post("/disable-2fa", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]
    if (!token) {
      return res.status(401).json({ message: "Unauthorized. Please login." })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret")
    const { code } = req.body

    const user = await User.findById(decoded.id)

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: "2FA is not enabled" })
    }

    // Verify the code before disabling
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 2,
    })

    if (!verified) {
      return res.status(400).json({ message: "Invalid verification code" })
    }

    user.twoFactorEnabled = false
    user.twoFactorSecret = null
    await user.save()

    res.json({
      message: "2FA disabled successfully",
      twoFactorEnabled: false,
    })
  } catch (error) {
    console.error("[v0] Disable 2FA error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

export default router
