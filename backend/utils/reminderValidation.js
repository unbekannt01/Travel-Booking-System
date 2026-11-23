import { z } from "zod"
import { REMINDER_LANGUAGES, REMINDER_TONES, validateTemplate } from "../../shared/reminders.js"

export const templateParamsSchema = z.object({
  language: z.enum(REMINDER_LANGUAGES, {
    errorMap: () => ({ message: "Invalid language. Allowed: en, hi, gu" }),
  }),
  tone: z.enum(REMINDER_TONES, {
    errorMap: () => ({ message: "Invalid tone. Allowed: friendly, due-soon, overdue" }),
  }),
})

export const saveTemplateBodySchema = z.object({
  body: z
    .string({ required_error: "Template body is required" })
    .trim()
    .min(1, "Template body cannot be empty")
    .max(600, "Template body cannot exceed 600 characters")
    .refine((val) => validateTemplate(val).valid, {
      message: "Template contains invalid placeholders or unbalanced braces",
    }),
})

export const createReminderSchema = z.object({
  customerId: z
    .string({ required_error: "Customer ID is required" })
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid customer ID"),
  bookingIds: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid booking ID"))
    .max(20, "Cannot exceed 20 booking IDs")
    .optional()
    .default([]),
  tone: z.enum(REMINDER_TONES, {
    errorMap: () => ({ message: "Invalid tone. Allowed: friendly, due-soon, overdue" }),
  }),
  language: z.enum(REMINDER_LANGUAGES, {
    errorMap: () => ({ message: "Invalid language. Allowed: en, hi, gu" }),
  }),
  templateSource: z.enum(["default", "custom"], {
    errorMap: () => ({ message: "Invalid template source. Allowed: default, custom" }),
  }),
})

export const listRemindersQuerySchema = z.object({
  customerId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid customer ID")
    .optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
})
