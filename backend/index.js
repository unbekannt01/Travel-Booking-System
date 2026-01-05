/* eslint-disable no-undef */
import express from "express"
import mongoose from "mongoose"
import cors from "cors"
import dotenv from "dotenv"
import authRoutes from "./routes/auth.js"
import bookingRoutes from "./routes/bookings.js"
import tourRoutes from "./routes/tours.js"

dotenv.config()

const app = express()

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5500", "http://127.0.0.1:5500"],
    credentials: true,
  }),
)
app.use(express.json())

app.use("/api/auth", authRoutes)
app.use("/api/bookings", bookingRoutes)
app.use("/api/tours", tourRoutes)

const PORT = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/sb_tourism"

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("[v0] Connected to MongoDB")
    app.listen(PORT, () => console.log(`[v0] Server running on port ${PORT}`))
  })
  .catch((err) => console.error("[v0] MongoDB connection error:", err))
