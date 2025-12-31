import express from "express"
import Booking from "../models/Booking.js"

const router = express.Router()

// Get all bookings
router.get("/", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 })
    res.json(bookings)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// Create booking
router.post("/", async (req, res) => {
  try {
    const newBooking = new Booking(req.body)
    await newBooking.save()
    console.log("[v0] Booking saved to MongoDB:", newBooking)
    res.status(201).json(newBooking)
  } catch (error) {
    console.error("[v0] Error saving booking:", error)
    res.status(400).json({ message: error.message })
  }
})

// Update booking
router.put("/:id", async (req, res) => {
  try {
    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    )
    console.log("[v0] Booking updated in MongoDB:", updatedBooking)
    res.json(updatedBooking)
  } catch (error) {
    console.error("[v0] Error updating booking:", error)
    res.status(400).json({ message: error.message })
  }
})

// Delete booking
router.delete("/:id", async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id)
    console.log("[v0] Booking deleted from MongoDB")
    res.json({ message: "Booking deleted" })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

export default router
