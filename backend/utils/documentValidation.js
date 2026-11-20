import { z } from "zod"
import { DOCUMENT_TYPE_IDS } from "../../shared/documentTypes.js"

const objectIdRegex = /^[0-9a-fA-F]{24}$/
const prefixRegex = /^[A-Z0-9]{1,6}$/

export const singleDocumentSettingSchema = z
  .object({
    enabled: z.boolean().default(true),
    prefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(prefixRegex, "Prefix must be 1 to 6 alphanumeric characters (A-Z, 0-9)"),
    title: z.string().trim().min(1, "Title cannot be empty").max(100, "Title cannot exceed 100 characters"),
    includeFy: z.boolean().default(false),
    padding: z.number().int().min(3).max(6).default(3),
    resetPolicy: z.enum(["never", "yearly"]).default("never"),
    terms: z.string().max(1000, "Terms cannot exceed 1000 characters").default(""),
    notes: z.string().max(500, "Notes cannot exceed 500 characters").default(""),
    validityDays: z.number().int().min(1).max(365).nullable().optional(),
    showGstBreakup: z.boolean().optional(),
  })
  .strict("Unknown keys in document setting are rejected")

export const documentSettingsUpdateSchema = z.record(
  z.string().refine((val) => DOCUMENT_TYPE_IDS.includes(val), {
    message: "Unknown document type keys are rejected",
  }),
  singleDocumentSettingSchema
)

export const issueDocumentInputSchema = z
  .object({
    bookingId: z.string().regex(objectIdRegex, "Invalid booking ID format"),
    type: z.enum(DOCUMENT_TYPE_IDS, {
      errorMap: () => ({ message: "Invalid document type" }),
    }),
    validUntil: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
    linkedDocumentId: z.string().regex(objectIdRegex, "Invalid linked document ID format").optional().nullable(),
    notes: z.string().max(500).optional(),
    terms: z.string().max(1000).optional(),
  })
  .strict("Unknown fields in issue document request are rejected")

export const voidDocumentInputSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(3, "Void reason must be at least 3 characters")
      .max(500, "Void reason cannot exceed 500 characters"),
  })
  .strict("Unknown fields in void document request are rejected")
