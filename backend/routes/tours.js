import express from "express"
import Tour from "../models/Tour.js"
import verifyToken from "../middleware/auth.js"

const router = express.Router()

router.get("/", verifyToken, async (req, res) => {
  try {
    const tours = await Tour.find({ userId: req.user.id }).sort({
      createdAt: -1,
    })
    res.json(tours)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

router.post("/", verifyToken, async (req, res) => {
  try {
    const { name, duration, busType, journeyDate, pricingType, fixedPrice, lowerPrice, upperPrice } = req.body

    if (!name || !duration || !busType) {
      return res.status(400).json({ message: "Name, duration, and bus type are required." })
    }

    const tour = new Tour({
      name,
      duration,
      busType,
      journeyDate: journeyDate || "",
      pricingType: pricingType || "berth",
      fixedPrice: Math.max(0, Number(fixedPrice) || 0),
      lowerPrice: Math.max(0, Number(lowerPrice) || 0),
      upperPrice: Math.max(0, Number(upperPrice) || 0),
      userId: req.user.id,
    })

    await tour.save()
    res.status(201).json(tour)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

router.put("/:id", verifyToken, async (req, res) => {
  try {
    const tour = await Tour.findById(req.params.id)

    if (!tour) {
      return res.status(404).json({ message: "Tour not found" })
    }

    if (tour.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to update this tour" })
    }

    // Whitelist allowed fields
    const allowedFields = ["name", "duration", "busType", "journeyDate", "pricingType", "fixedPrice", "lowerPrice", "upperPrice"]
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (["fixedPrice", "lowerPrice", "upperPrice"].includes(field)) {
          tour[field] = Math.max(0, Number(req.body[field]) || 0)
        } else {
          tour[field] = req.body[field]
        }
      }
    }

    await tour.save()
    res.json(tour)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const tour = await Tour.findById(req.params.id)

    if (!tour) {
      return res.status(404).json({ message: "Tour not found" })
    }

    if (tour.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to delete this tour" })
    }

    await Tour.findByIdAndDelete(req.params.id)
    res.json({ message: "Tour deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

export default router
