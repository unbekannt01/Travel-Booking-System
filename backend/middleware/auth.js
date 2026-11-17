import jwt from "jsonwebtoken"
import User from "../models/User.js"

const verifyToken = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1]

    if (!token) {
      return res.status(401).json({ message: "No token provided. Please login." })
    }

    // CSRF defense check for cookie-based authentication
    if (req.cookies?.token && !req.headers.authorization) {
      const xRequestedWith = req.headers["x-requested-with"]
      const isStateChanging = ["POST", "PUT", "DELETE", "PATCH"].includes(req.method)
      if (isStateChanging && (!xRequestedWith || xRequestedWith.toLowerCase() !== "xmlhttprequest")) {
        return res.status(403).json({ message: "Forbidden: CSRF protection header missing." })
      }
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.id)

    if (!user) {
      return res.status(401).json({ message: "User not found" })
    }

    // Token version check
    if (decoded.tokenVersion !== undefined && user.tokenVersion !== undefined) {
      if (decoded.tokenVersion !== user.tokenVersion) {
        return res.status(401).json({ message: "Session expired or revoked. Please login again." })
      }
    }

    // Active tokens check
    if (user.activeTokens && user.activeTokens.length > 0) {
      const isTokenValid = user.activeTokens.some((t) => t.token === token)
      if (!isTokenValid) {
        return res.status(401).json({ message: "Token is invalid or logged out" })
      }
    }

    req.user = { id: user._id.toString(), email: user.email, name: user.userName || user.name }
    req.userDoc = user
    next()
  } catch (error) {
    console.error("Token verification error:", error.message)
    res.status(401).json({ message: "Invalid or expired token" })
  }
}

export default verifyToken
