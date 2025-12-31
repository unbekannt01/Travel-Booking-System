/* eslint-disable no-undef */
import express from "express"
import mongoose from "mongoose"
import cors from "cors"
import dotenv from "dotenv"
import authRoutes from "./routes/auth.js"
import bookingRoutes from "./routes/bookings.js"
// importing tours routes
import tourRoutes from "./routes/tours.js"

dotenv.config()

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/bookings", bookingRoutes)
// adding tours route
app.use("/api/tours", tourRoutes)

// MongoDB Connection
const PORT = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/sb_tourism"

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("[v0] Connected to MongoDB")
    app.listen(PORT, () => console.log(`[v0] Server running on port ${PORT}`))
  })
  .catch((err) => console.error("[v0] MongoDB connection error:", err))
