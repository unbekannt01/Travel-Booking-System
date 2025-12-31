import express from "express"
import Booking from "../models/Booking.js"
import verifyToken from "../middleware/auth.js"

const router = express.Router()

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
    console.log("[v0] Booking saved to MongoDB:", newBooking)
    res.status(201).json(newBooking)
  } catch (error) {
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
