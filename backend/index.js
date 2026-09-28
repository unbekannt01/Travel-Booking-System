import express from "express"
import mongoose from "mongoose"
import cors from "cors"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import authRoutes from "./routes/auth.js"
import bookingRoutes from "./routes/bookings.js"
import tourRoutes from "./routes/tours.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()
dotenv.config({ path: path.join(__dirname, ".env") })

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is missing.")
  process.exit(1)
}

const app = express()

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5500", "http://127.0.0.1:5500"],
    credentials: true,
  }),
)
app.use(express.json({ limit: '10mb'}))
app.use(express.urlencoded({ limit: '10mb', extended: true}))

app.use("/api/auth", authRoutes)
app.use("/api/bookings", bookingRoutes)
app.use("/api/tours", tourRoutes)

import Booking from "./models/Booking.js"

const PORT = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/sb_tourism"

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB")
    try {
      const indexes = await Booking.collection.indexes()
      const oldIdx = indexes.find((i) => i.name === "invoiceNo_1" && i.unique)
      if (oldIdx) {
        await Booking.collection.dropIndex("invoiceNo_1")
        console.log("Dropped legacy global unique invoiceNo_1 index")
      }
      await Booking.syncIndexes()
    } catch {
      // Ignore if collection does not exist yet
    }
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  })
  .catch((err) => console.error("MongoDB connection error:", err))
