import express from "express";
import Tour from "../models/Tour.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  try {
    const tours = await Tour.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(tours);
  } catch (error) {
    console.error("[v0] Error fetching tours:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    const tour = new Tour({ ...req.body, userId: req.user.id });
    await tour.save();
    res.status(201).json(tour);
  } catch (error) {
    console.error("[v0] Error creating tour:", error.message);
    res.status(400).json({ message: error.message });
  }
});

router.put("/:id", verifyToken, async (req, res) => {
  try {
    const tour = await Tour.findById(req.params.id);

    if (!tour) {
      return res.status(404).json({ message: "Tour not found" });
    }

    if (tour.userId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this tour" });
    }

    const updatedTour = await Tour.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(updatedTour);
  } catch (error) {
    console.error("[v0] Error updating tour:", error.message);
    res.status(400).json({ message: error.message });
  }
});

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const tour = await Tour.findById(req.params.id);

    if (!tour) {
      return res.status(404).json({ message: "Tour not found" });
    }

    if (tour.userId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this tour" });
    }

    await Tour.findByIdAndDelete(req.params.id);
    res.json({ message: "Tour deleted successfully" });
  } catch (error) {
    console.error("[v0] Error deleting tour:", error.message);
    res.status(500).json({ message: error.message });
  }
});

export default router;
