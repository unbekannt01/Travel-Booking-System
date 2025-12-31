import express from "express"
import Tour from "../models/Tour.js"

const router = express.Router()

// Get all tours
router.get("/", async (req, res) => {
  try {
    const tours = await Tour.find().sort({ createdAt: -1 })
    res.json(tours)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// Create a new tour
router.post("/", async (req, res) => {
  try {
    const tour = new Tour(req.body)
    await tour.save()
    res.status(201).json(tour)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

// Update a tour
router.put("/:id", async (req, res) => {
  try {
    const tour = await Tour.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!tour) {
      return res.status(404).json({ message: "Tour not found" })
    }
    res.json(tour)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

// Delete a tour
router.delete("/:id", async (req, res) => {
  try {
    const tour = await Tour.findByIdAndDelete(req.params.id)
    if (!tour) {
      return res.status(404).json({ message: "Tour not found" })
    }
    res.json({ message: "Tour deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

export default router
