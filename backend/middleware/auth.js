/* eslint-disable no-undef */
import jwt from "jsonwebtoken"
import User from "../models/User.js"

const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]

    if (!token) {
      return res.status(401).json({ message: "No token provided. Please login." })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret")
    const user = await User.findById(decoded.id)

    if (!user) {
      return res.status(401).json({ message: "User not found" })
    }

    const isTokenValid = user.activeTokens.some((t) => t.token === token)
    if (!isTokenValid) {
      return res.status(401).json({ message: "Token is invalid or expired" })
    }

    req.user = { id: decoded.id, email: user.email, name: user.name }
    next()
  } catch (error) {
    console.error("[v0] Token verification error:", error.message)
    res.status(401).json({ message: "Invalid or expired token" })
  }
}

export default verifyToken
