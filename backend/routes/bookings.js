import express from "express"
import Booking from "../models/Booking.js"
import verifyToken from "../middleware/auth.js"

const router = express.Router()

// Helper function to generate tour code from tour name
const generateTourCode = (tourName) => {
  if (!tourName) return "GEN"

  const words = tourName.split(" ")
  let code = ""

  if (words.length === 1) {
    code = tourName.substring(0, 3).toUpperCase()
  } else {
    code = words
      .map((w) => w.charAt(0).toUpperCase())
      .join("")
      .substring(0, 3)
  }

  return code.padEnd(3, "X").substring(0, 3)
}

// Helper function to get month code
const getMonthCode = (date) => {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  const month = new Date(date).getMonth()
  return months[month]
}

router.post("/generate-invoice", verifyToken, async (req, res) => {
  try {
    const { tourName, journeyDate } = req.body

    if (!tourName) {
      return res.status(400).json({ message: "Tour name is required" })
    }

    const tourCode = generateTourCode(tourName)
    const monthCode = getMonthCode(journeyDate || new Date())

    const prefix = `YHB-${tourCode}-${monthCode}-`

    // Find ALL bookings for this user that start with this prefix
    const existingBookings = await Booking.find({
      userId: req.user.id,
      invoiceNo: { $regex: `^${prefix}` },
    }).sort({ invoiceNo: -1 })

    let nextSerial = 1
    if (existingBookings.length > 0) {
      // Extract the highest serial number from existing invoices
      const serials = existingBookings
        .map((b) => {
          const match = b.invoiceNo.match(/(\d{3})$/)
          return match ? parseInt(match[1]) : 0
        })
        .filter((n) => !isNaN(n))

      if (serials.length > 0) {
        nextSerial = Math.max(...serials) + 1
      }
    }

    const invoiceNo = `${prefix}${String(nextSerial).padStart(3, "0")}`

    res.json({ invoiceNo })
  } catch (error) {
    console.error("[v0] Error generating invoice:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.get("/invoice/:invoiceNo", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findOne({
      userId: req.user.id,
      invoiceNo: req.params.invoiceNo,
    })
    if (!booking) return res.status(404).json({ message: "Booking not found" })
    res.json(booking)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

router.get("/", verifyToken, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id }).sort({ createdAt: -1 })
    res.json(bookings)
  } catch (error) {
    console.error("[v0] Error fetching bookings:", error.message)
    res.status(500).json({ message: error.message })
  }
})

router.post("/", verifyToken, async (req, res) => {
  try {
    const newBooking = new Booking({ ...req.body, userId: req.user.id })
    await newBooking.save()
    res.status(201).json(newBooking)
  } catch (error) {
    // Handle duplicate invoice number - auto-increment and retry once
    if (error.code === 11000 && error.keyPattern?.invoiceNo) {
      try {
        const existing = req.body.invoiceNo
        const match = existing.match(/^(YHB-.+-)(\d{3})$/)
        if (match) {
          const newSerial = parseInt(match[2]) + 1
          const newInvoiceNo = `${match[1]}${String(newSerial).padStart(3, "0")}`
          const retryBooking = new Booking({
            ...req.body,
            invoiceNo: newInvoiceNo,
            userId: req.user.id,
          })
          const saved = await retryBooking.save()
          return res.status(201).json(saved)
        }
      } catch {
        return res.status(400).json({ message: "Duplicate invoice number. Please regenerate." })
      }
    }
    console.error("[v0] Error saving booking:", error.message)
    res.status(400).json({ message: error.message })
  }
})

router.put("/:id", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" })
    }

    if (booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to update this booking" })
    }

    const updatedBooking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    })
    console.log("[v0] Booking updated in MongoDB:", updatedBooking)
    res.json(updatedBooking)
  } catch (error) {
    console.error("[v0] Error updating booking:", error.message)
    res.status(400).json({ message: error.message })
  }
})

router.put("/:bookingId/passengers/:passengerIndex/checkin", verifyToken, async (req, res) => {
  try {
    const { bookingId, passengerIndex } = req.params
    const booking = await Booking.findById(bookingId)

    if (!booking) return res.status(404).json({ message: "Booking not found" })
    if (booking.userId.toString() !== req.user.id) return res.status(403).json({ message: "Unauthorized" })

    booking.passengers[passengerIndex].checkedIn = !booking.passengers[passengerIndex].checkedIn
    await booking.save()

    res.json(booking)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

router.put("/:bookingId/toggle-payment", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)

    if (!booking) return res.status(404).json({ message: "Booking not found" })
    if (booking.userId.toString() !== req.user.id) return res.status(403).json({ message: "Unauthorized" })

    booking.isPaid = !booking.isPaid
    if (booking.isPaid) {
      booking.advanceReceived = booking.totalAmount
    }

    await booking.save()
    res.json(booking)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

router.put("/:bookingId/passengers/:passengerIndex", verifyToken, async (req, res) => {
  try {
    const { bookingId, passengerIndex } = req.params
    const updatedPassengerData = req.body

    const booking = await Booking.findById(bookingId)
    if (!booking) return res.status(404).json({ message: "Booking not found" })

    if (booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to update this booking" })
    }

    booking.passengers[passengerIndex] = {
      ...booking.passengers[passengerIndex],
      ...updatedPassengerData,
    }

    await booking.save()
    console.log("[v0] Individual passenger updated in MongoDB:", updatedPassengerData)
    res.json(booking)
  } catch (error) {
    console.error("[v0] Error updating passenger:", error.message)
    res.status(400).json({ message: error.message })
  }
})

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)

    if (!booking) return res.status(404).json({ message: "Booking not found" })

    if (booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to delete this booking" })
    }

    await Booking.findByIdAndDelete(req.params.id)
    console.log("[v0] Booking deleted from MongoDB")
    res.json({ message: "Booking deleted" })
  } catch (error) {
    console.error("[v0] Error deleting booking:", error.message)
    res.status(500).json({ message: error.message })
  }
})

export default router
