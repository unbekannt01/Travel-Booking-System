/* eslint-disable no-undef */
import express from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import User from "../models/User.js"

const router = express.Router()

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: "This email is already registered. Please login instead." })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const newUser = new User({ name, email, password: hashedPassword })
    await newUser.save()

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET || "secret", { expiresIn: "1h" })
    res.status(201).json({ token, user: { id: newUser._id, name, email } })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// Login
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

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "secret", { expiresIn: "1h" })
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

router.put("/update-name", async (req, res) => {
  try {
    const { userId, newName } = req.body

    const user = await User.findByIdAndUpdate(userId, { name: newName }, { new: true })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ message: "Name updated successfully", user: { id: user._id, name: user.name, email: user.email } })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

export default router
