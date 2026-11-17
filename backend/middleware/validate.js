import { z } from "zod"

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId")

export const loginSchema = z.object({
  loginIdentifier: z.string().min(1, "Email or username is required").max(100),
  password: z.string().min(1, "Password is required"),
})

export const registerSchema = z.object({
  userName: z.string().min(2, "Username must be at least 2 characters").max(50),
  email: z.string().email("Invalid email address"),
  password: z.string().min(10, "Password must be at least 10 characters"),
})

export const passengerSchema = z.object({
  name: z.string().min(1, "Passenger name is required").max(100),
  age: z.union([z.number().int().min(0).max(120), z.string()]).optional(),
  gender: z.enum(["Male", "Female", "Other", "M", "F", "O", ""]).optional(),
  seatNumber: z.string().min(1, "Seat number is required").max(10),
  phone: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  aadhar: z.string().max(20).optional(),
  checkedIn: z.boolean().optional(),
})

export const createBookingSchema = z.object({
  tourName: z.string().min(1, "Tour name is required").max(100),
  journeyDate: z.string().min(1, "Journey date is required"),
  customerName: z.string().min(1, "Customer name is required").max(100),
  customerPhone: z.string().min(10, "Customer phone must be at least 10 digits").max(20),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  customerCity: z.string().max(100).optional(),
  customerAadhar: z.string().max(20).optional(),
  busType: z.string().optional(),
  passengers: z.array(passengerSchema).min(1, "At least one passenger is required"),
  discount: z.number().min(0).optional(),
  advanceReceived: z.number().min(0).optional(),
  paymentMode: z.string().optional(),
  boardingPoint: z.string().optional(),
  notes: z.string().max(1000).optional(),
  customTotalAmount: z.number().optional(),
  subtotal: z.number().optional(),
  taxAmount: z.number().optional(),
  totalAmount: z.number().optional(),
  farePerSeat: z.number().optional(),
  totalSeats: z.number().optional(),
})

export const createTourSchema = z.object({
  name: z.string().min(1, "Tour name is required").max(100),
  source: z.string().max(100).optional(),
  destination: z.string().max(100).optional(),
  durationDays: z.number().int().min(1).optional(),
  busType: z.string().optional(),
  capacity: z.number().int().min(1).max(100).optional(),
  pricingType: z.enum(["fixed", "berth"]).optional(),
  fixedPrice: z.number().min(0).optional(),
  berthPricing: z
    .object({
      lowerSingle: z.number().min(0).optional(),
      lowerDouble: z.number().min(0).optional(),
      upperSingle: z.number().min(0).optional(),
      upperDouble: z.number().min(0).optional(),
    })
    .optional(),
  boardingPoints: z.array(z.string()).optional(),
  droppingPoints: z.array(z.string()).optional(),
  itinerary: z.array(z.any()).optional(),
  status: z.enum(["Active", "Inactive", "Completed"]).optional(),
})

export const createPaymentSchema = z.object({
  bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid booking ID"),
  amount: z.number().positive("Payment amount must be greater than zero"),
  mode: z.string().optional(),
  notes: z.string().max(500).optional(),
  referenceNo: z.string().max(100).optional(),
})

export const validateRequest = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    const errorDetails = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
    return res.status(400).json({ message: `Validation error: ${errorDetails}` })
  }
  req.body = result.data
  next()
}
