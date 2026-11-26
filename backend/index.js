import "./config/env.js"
import express from "express"
import helmet from "helmet"
import cookieParser from "cookie-parser"
import mongoose from "mongoose"
import cors from "cors"
import { mongoSanitize } from "./middleware/sanitize.js"
import authRoutes from "./routes/auth.js"
import bookingRoutes from "./routes/bookings.js"
import tourRoutes from "./routes/tours.js"
import paymentRoutes from "./routes/payments.js"
import documentRoutes from "./routes/documents.js"
import documentTemplateRoutes from "./routes/documentTemplates.js"
import expenseRoutes from "./routes/expenses.js"
import reportRoutes from "./routes/reports.js"
import customerRoutes from "./routes/customers.js"
import reminderTemplateRoutes from "./routes/reminderTemplates.js"
import reminderRoutes from "./routes/reminders.js"
import cashbookRoutes from "./routes/cashbook.js"
import trashRoutes from "./routes/trash.js"
import historyRoutes from "./routes/history.js"
import exportRoutes from "./routes/export.js"
import importRoutes from "./routes/import.js"
import departureRoutes from "./routes/departures.js"
import seatHoldRoutes from "./routes/seatHolds.js"
import groupRoutes from "./routes/groups.js"
import exchangeRoutes from "./routes/exchange.js"

const app = express()

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
)

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
].filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      return callback(new Error("CORS policy violation: origin not allowed"), false)
    },
    credentials: true,
  }),
)
app.use(cookieParser())

// Route-specific 5MB payload limit for company logo/profile update (SEC-015)
app.use("/api/auth/update-company", express.json({ limit: "5mb" }))
app.use("/api/auth/update-company", express.urlencoded({ limit: "5mb", extended: true }))

// Route-specific 5MB payload limit for import and exchange endpoints (Part 6X)
app.use("/api/import", express.json({ limit: "5mb" }))
app.use("/api/import", express.urlencoded({ limit: "5mb", extended: true }))
app.use("/api/exchange", express.json({ limit: "5mb" }))
app.use("/api/exchange", express.urlencoded({ limit: "5mb", extended: true }))

// Route-specific 500KB payload limit for document template assets (SEC-015)
app.use("/api/document-templates/assets", express.json({ limit: "500kb" }))
app.use("/api/document-templates/assets", express.urlencoded({ limit: "500kb", extended: true }))

// Global strict 100KB payload limit for all other API endpoints (SEC-015)
app.use(express.json({ limit: "100kb" }))
app.use(express.urlencoded({ limit: "100kb", extended: true }))

// NoSQL injection sanitizer (SEC-011)
app.use(mongoSanitize)

app.use("/api/auth", authRoutes)
app.use("/api/bookings", bookingRoutes)
app.use("/api/tours", tourRoutes)
app.use("/api/payments", paymentRoutes)
app.use("/api/documents", documentRoutes)
app.use("/api/document-templates", documentTemplateRoutes)
app.use("/api/expenses", expenseRoutes)
app.use("/api/reports", reportRoutes)
app.use("/api/customers", customerRoutes)
app.use("/api/reminder-templates", reminderTemplateRoutes)
app.use("/api/reminders", reminderRoutes)
app.use("/api/cashbook", cashbookRoutes)
app.use("/api/trash", trashRoutes)
app.use("/api/history", historyRoutes)
app.use("/api/export", exportRoutes)
app.use("/api/import", importRoutes)
app.use("/api/departures", departureRoutes)
app.use("/api/seat-holds", seatHoldRoutes)
app.use("/api/groups", groupRoutes)
app.use("/api/exchange", exchangeRoutes)

// Minimal health check endpoint
const serverStartedAt = new Date().toISOString()
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    startedAt: serverStartedAt,
    version: "1.0.0",
  })
})

// 404 handler for unknown API endpoints
app.use("/api", (req, res) => {
  res.status(404).json({ message: "API endpoint not found" })
})

// Centralized error handling middleware (SEC-014)
app.use((err, req, res, _next) => {
  void _next
  console.error("Internal Server Error:", err.message)
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Payload size exceeds maximum allowed limit" })
  }
  if (err.statusCode === 423 || err.name === "BooksLockedError") {
    return res.status(423).json({
      message: err.message,
      lockDate: err.lockDate,
      transactionDate: err.transactionDate,
    })
  }
  const isProduction = process.env.NODE_ENV === "production"
  const statusCode = err.statusCode || err.status || 500
  res.status(statusCode).json({
    message: isProduction ? "An unexpected server error occurred." : (err.message || "An unexpected server error occurred."),
  })
})

import Booking from "./models/Booking.js"
import Payment from "./models/Payment.js"
import { computeLedgerTotals } from "../shared/businessLogic.js"

// Reconcile booking advance received on startup idempotently
async function reconcileBookingsOnStartup() {
  try {
    const bookings = await Booking.find({ deletedAt: null })
    for (const b of bookings) {
      if (b.advanceReceived === undefined || b.advanceReceived === null || b.advanceReceived === 0) {
        const payments = await Payment.find({ bookingId: b._id, userId: b.userId, isVoid: false })
        if (payments.length > 0) {
          const { advanceReceived } = computeLedgerTotals(payments, b.totalAmount || 0)
          if (advanceReceived > 0) {
            const isPaid = (b.totalAmount || 0) > 0 && advanceReceived >= (b.totalAmount || 0)
            await Booking.updateOne({ _id: b._id }, { $set: { advanceReceived, isPaid } })
          }
        } else if (Array.isArray(b.payments) && b.payments.length > 0) {
          const nonVoid = b.payments.filter((p) => !p.isVoid)
          const sum = nonVoid.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
          if (sum > 0) {
            const isPaid = (b.totalAmount || 0) > 0 && sum >= (b.totalAmount || 0)
            await Booking.updateOne({ _id: b._id }, { $set: { advanceReceived: sum, isPaid } })
          }
        }
      }
    }
  } catch (err) {
    console.warn("[Startup] Booking payment reconciliation notice:", err.message)
  }
}

const PORT = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub"

if (process.env.NODE_ENV !== "test") {
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
      await reconcileBookingsOnStartup()
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
    })
    .catch((err) => console.error("MongoDB connection error:", err))
}

export { app }
export default app
