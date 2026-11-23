import { z } from "zod"
import {
  CUSTOMER_TAGS,
  CUSTOMER_LANGUAGES,
  normalizeIndianMobile,
  isValidEmail,
} from "../../shared/customers.js"

// GSTIN format: 2 digits (state) + 10 char PAN + 1 entity num + 'Z' + 1 checksum char
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

export const createCustomerSchema = z.object({
  name: z
    .string({ required_error: "Customer name is required" })
    .trim()
    .min(1, "Customer name cannot be empty")
    .max(120, "Customer name cannot exceed 120 characters"),
  phone: z
    .string({ required_error: "Phone number is required" })
    .trim()
    .refine((val) => normalizeIndianMobile(val).valid, {
      message: "Please provide a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9",
    })
    .transform((val) => normalizeIndianMobile(val).normalized),
  email: z
    .string()
    .trim()
    .max(254, "Email cannot exceed 254 characters")
    .optional()
    .nullable()
    .transform((val) => val || "")
    .refine((val) => !val || isValidEmail(val), {
      message: "Please enter a valid email address",
    }),
  city: z
    .string()
    .trim()
    .max(100, "City cannot exceed 100 characters")
    .optional()
    .nullable()
    .transform((val) => val || ""),
  address: z
    .string()
    .trim()
    .max(300, "Address cannot exceed 300 characters")
    .optional()
    .nullable()
    .transform((val) => val || ""),
  gstin: z
    .string()
    .trim()
    .max(15, "GSTIN cannot exceed 15 characters")
    .optional()
    .nullable()
    .transform((val) => (val ? val.toUpperCase() : ""))
    .refine((val) => !val || GSTIN_REGEX.test(val), {
      message: "Please enter a valid 15-character Indian GSTIN (e.g. 24AAAAA0000A1Z5)",
    }),
  language: z
    .enum(CUSTOMER_LANGUAGES, {
      errorMap: () => ({ message: "Invalid preferred language (must be en, hi, or gu)" }),
    })
    .default("en"),
  tags: z
    .array(z.string())
    .default([])
    .transform((list) => (list || []).filter((t) => CUSTOMER_TAGS.includes(t)).slice(0, 5)),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes cannot exceed 2000 characters")
    .optional()
    .nullable()
    .transform((val) => val || ""),
  whatsappOptOut: z.boolean().default(false),
  aliases: z
    .array(z.string().trim().min(1).max(120))
    .max(5, "Cannot exceed 5 aliases")
    .default([]),
})

export const updateCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Customer name cannot be empty")
    .max(120, "Customer name cannot exceed 120 characters")
    .optional(),
  phone: z
    .string()
    .trim()
    .refine((val) => normalizeIndianMobile(val).valid, {
      message: "Please provide a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9",
    })
    .transform((val) => normalizeIndianMobile(val).normalized)
    .optional(),
  email: z
    .string()
    .trim()
    .max(254, "Email cannot exceed 254 characters")
    .optional()
    .nullable()
    .transform((val) => val || "")
    .refine((val) => !val || isValidEmail(val), {
      message: "Please enter a valid email address",
    }),
  city: z
    .string()
    .trim()
    .max(100, "City cannot exceed 100 characters")
    .optional()
    .nullable()
    .transform((val) => val || ""),
  address: z
    .string()
    .trim()
    .max(300, "Address cannot exceed 300 characters")
    .optional()
    .nullable()
    .transform((val) => val || ""),
  gstin: z
    .string()
    .trim()
    .max(15, "GSTIN cannot exceed 15 characters")
    .optional()
    .nullable()
    .transform((val) => (val ? val.toUpperCase() : ""))
    .refine((val) => !val || GSTIN_REGEX.test(val), {
      message: "Please enter a valid 15-character Indian GSTIN",
    }),
  language: z
    .enum(CUSTOMER_LANGUAGES)
    .optional(),
  tags: z
    .array(z.string())
    .optional()
    .transform((list) => (list ? list.filter((t) => CUSTOMER_TAGS.includes(t)).slice(0, 5) : undefined)),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes cannot exceed 2000 characters")
    .optional()
    .nullable()
    .transform((val) => val || ""),
  whatsappOptOut: z.boolean().optional(),
  aliases: z
    .array(z.string().trim().min(1).max(120))
    .max(5, "Cannot exceed 5 aliases")
    .optional(),
})

export const customerQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  tag: z.string().trim().optional().default(""),
  hasOutstanding: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((val) => val === true || val === "true"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z
    .enum(["name_asc", "name_desc", "recent_booking", "outstanding_desc", "revenue_desc"])
    .default("recent_booking"),
})
