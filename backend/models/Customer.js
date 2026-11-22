import mongoose from "mongoose"
import { CUSTOMER_TAGS, CUSTOMER_LANGUAGES } from "../../shared/customers.js"

const customerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxLength: 120,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: /^[6-9]\d{9}$/,
    },
    email: {
      type: String,
      trim: true,
      default: "",
      maxLength: 254,
    },
    city: {
      type: String,
      trim: true,
      default: "",
      maxLength: 100,
    },
    address: {
      type: String,
      trim: true,
      default: "",
      maxLength: 300,
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      maxLength: 15,
    },
    language: {
      type: String,
      enum: CUSTOMER_LANGUAGES,
      default: "en",
    },
    tags: {
      type: [
        {
          type: String,
          enum: CUSTOMER_TAGS,
        },
      ],
      default: [],
      validate: [
        (val) => Array.isArray(val) && val.length <= 5,
        "Cannot exceed 5 customer tags",
      ],
    },
    notes: {
      type: String,
      trim: true,
      default: "",
      maxLength: 2000,
    },
    whatsappOptOut: {
      type: Boolean,
      default: false,
    },
    aliases: {
      type: [{ type: String, trim: true, maxLength: 120 }],
      default: [],
      validate: [
        (val) => Array.isArray(val) && val.length <= 5,
        "Cannot exceed 5 aliases",
      ],
    },
    source: {
      type: String,
      enum: ["booking", "manual", "backfill"],
      default: "manual",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
)

// Compound unique partial index:
// Ensure (userId, phone) is unique ONLY among active (non-soft-deleted) customers
customerSchema.index(
  { userId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
)

customerSchema.index({ userId: 1, name: 1 })
customerSchema.index({ userId: 1, deletedAt: 1 })
customerSchema.index({ userId: 1, tags: 1 })

export default mongoose.model("Customer", customerSchema)
