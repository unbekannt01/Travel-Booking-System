/* eslint-disable no-undef */
import express from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import User from "../models/User.js"

const router = express.Router()

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: "This email is already registered. Please login instead." })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const tokenId = "token_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)

    const newUser = new User({ name, email, password: hashedPassword })
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
      user: { id: newUser._id, name, email },
      message: "Registration successful",
    })
  } catch (error) {
    console.error("[v0] Registration error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({ message: "No account found with this email. Please register first." })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect password. Please try again." })
    }

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
      user: { id: user._id, name: user.name, email: user.email },
      message: "Login successful",
    })
  } catch (error) {
    console.error("[v0] Login error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.post("/logout", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]
    if (!token) {
      return res.status(400).json({ message: "No token provided" })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret")
    const user = await User.findById(decoded.id)

    if (user) {
      user.activeTokens = user.activeTokens.filter((t) => t.token !== token)
      await user.save()
    }

    res.json({ message: "Logout successful" })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

router.put("/update-name", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]
    if (!token) {
      return res.status(401).json({ message: "Unauthorized. Please login." })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret")
    const { newName } = req.body

    const user = await User.findByIdAndUpdate(decoded.id, { name: newName }, { new: true })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({
      message: "Name updated successfully",
      user: { id: user._id, name: user.name, email: user.email },
    })
  } catch (error) {
    console.error("[v0] Update name error:", error.message)
    res.status(500).json({ message: error.message })
  }
})

export default router
