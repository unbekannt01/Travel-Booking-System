import mongoose from "mongoose"

const invoiceTemplateSchema = new mongoose.Schema(
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
      maxlength: 100,
    },
    presetId: {
      type: String,
      default: "classic-bus",
    },
    isBuiltIn: {
      type: Boolean,
      default: false,
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    assets: {
      logo: { type: String, default: "" },
      signature: { type: String, default: "" },
      stamp: { type: String, default: "" },
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
)

// Ensure template name is unique per user
invoiceTemplateSchema.index({ userId: 1, name: 1 }, { unique: true })

export default mongoose.model("InvoiceTemplate", invoiceTemplateSchema)
