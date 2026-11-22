import { z } from "zod"
import { EXPENSE_CATEGORY_IDS, EXPENSE_PAYMENT_MODE_IDS, round2 } from "../../shared/expenses.js"

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const TEN_YEARS_MS = 10 * 365.25 * ONE_DAY_MS

/**
 * Validates that date is not more than 1 day in the future and not older than 10 years.
 */
function isValidExpenseDate(dateVal) {
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal)
  if (isNaN(d.getTime())) return false
  const now = Date.now()
  const time = d.getTime()
  if (time > now + ONE_DAY_MS) return false
  if (time < now - TEN_YEARS_MS) return false
  return true
}

export const createExpenseSchema = z
  .object({
    date: z
      .union([z.string(), z.date()])
      .refine(isValidExpenseDate, {
        message: "Expense date cannot be far in the future or older than 10 years",
      })
      .transform((val) => (val instanceof Date ? val : new Date(val))),
    amount: z
      .number({ invalid_type_error: "Amount must be a number" })
      .gt(0, "Amount must be greater than zero")
      .lte(10000000, "Amount cannot exceed ₹10,000,000")
      .transform(round2),
    category: z.enum(EXPENSE_CATEGORY_IDS, {
      errorMap: () => ({ message: "Invalid expense category" }),
    }),
    tourRef: z
      .string()
      .max(120, "Tour reference cannot exceed 120 characters")
      .nullable()
      .optional()
      .default(null)
      .transform((val) => (val ? val.trim() : null)),
    tourLabel: z
      .string()
      .max(100, "Tour label cannot exceed 100 characters")
      .optional()
      .default("")
      .transform((val) => (val ? val.trim() : "")),
    vendor: z
      .string()
      .max(80, "Vendor name cannot exceed 80 characters")
      .optional()
      .default("")
      .transform((val) => (val ? val.trim() : "")),
    paymentMode: z
      .enum(EXPENSE_PAYMENT_MODE_IDS, {
        errorMap: () => ({ message: "Invalid payment mode" }),
      })
      .default("cash"),
    status: z.enum(["paid", "pending"]).default("paid"),
    paidOn: z
      .union([z.string(), z.date()])
      .nullable()
      .optional()
      .default(null)
      .transform((val) => {
        if (!val) return null
        const d = val instanceof Date ? val : new Date(val)
        return isNaN(d.getTime()) ? null : d
      }),
    note: z
      .string()
      .max(300, "Note cannot exceed 300 characters")
      .optional()
      .default("")
      .transform((val) => (val ? val.trim() : "")),
  })
  .strict({ message: "Unknown fields are not allowed in expense payload" })

export const updateExpenseSchema = z
  .object({
    date: z
      .union([z.string(), z.date()])
      .refine(isValidExpenseDate, {
        message: "Expense date cannot be far in the future or older than 10 years",
      })
      .transform((val) => (val instanceof Date ? val : new Date(val)))
      .optional(),
    amount: z
      .number({ invalid_type_error: "Amount must be a number" })
      .gt(0, "Amount must be greater than zero")
      .lte(10000000, "Amount cannot exceed ₹10,000,000")
      .transform(round2)
      .optional(),
    category: z
      .enum(EXPENSE_CATEGORY_IDS, {
        errorMap: () => ({ message: "Invalid expense category" }),
      })
      .optional(),
    tourRef: z
      .string()
      .max(120, "Tour reference cannot exceed 120 characters")
      .nullable()
      .optional()
      .transform((val) => (val !== undefined ? (val ? val.trim() : null) : undefined)),
    tourLabel: z
      .string()
      .max(100, "Tour label cannot exceed 100 characters")
      .optional()
      .transform((val) => (val !== undefined ? val.trim() : undefined)),
    vendor: z
      .string()
      .max(80, "Vendor name cannot exceed 80 characters")
      .optional()
      .transform((val) => (val !== undefined ? val.trim() : undefined)),
    paymentMode: z
      .enum(EXPENSE_PAYMENT_MODE_IDS, {
        errorMap: () => ({ message: "Invalid payment mode" }),
      })
      .optional(),
    status: z.enum(["paid", "pending"]).optional(),
    paidOn: z
      .union([z.string(), z.date()])
      .nullable()
      .optional()
      .transform((val) => {
        if (val === undefined) return undefined
        if (!val) return null
        const d = val instanceof Date ? val : new Date(val)
        return isNaN(d.getTime()) ? null : d
      }),
    note: z
      .string()
      .max(300, "Note cannot exceed 300 characters")
      .optional()
      .transform((val) => (val !== undefined ? val.trim() : undefined)),
  })
  .strict({ message: "Unknown fields are not allowed in expense update payload" })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  })

export const listExpenseQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .default(50)
      .transform((val) => Math.min(val, 100)),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid from date format (YYYY-MM-DD)").optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid to date format (YYYY-MM-DD)").optional(),
    category: z.string().max(40).optional(),
    tourRef: z.string().max(120).optional(),
    paymentMode: z.string().max(30).optional(),
    status: z.enum(["paid", "pending", "all"]).optional().default("all"),
    q: z.string().max(100).optional().default(""),
    sortBy: z.enum(["date", "amount", "createdAt"]).optional().default("date"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .passthrough()
