import mongoose from "mongoose"
import { DOCUMENT_TYPE_IDS } from "../../shared/documentTypes.js"

const issuedDocumentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: DOCUMENT_TYPE_IDS,
    },
    number: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["issued", "void"],
      default: "issued",
      index: true,
    },
    voidReason: { type: String, default: "" },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    linkedDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IssuedDocument",
      default: null,
      validate: {
        validator: function (val) {
          if (this.type === "credit-note") {
            return val !== null && val !== undefined
          }
          return true
        },
        message: "Credit note requires a linked issued document",
      },
    },
    validUntil: { type: Date, default: null },

    // Immutable pricing & financials snapshot at issue time
    amounts: {
      totalAmount: { type: Number, required: true, min: 0 },
      advanceReceived: { type: Number, default: 0, min: 0 },
      balance: { type: Number, default: 0, min: 0 },
      discount: { type: Number, default: 0, min: 0 },
      discountType: { type: String, default: "fixed", enum: ["fixed", "percentage"] },
      gstRate: { type: Number, default: 0, min: 0 },
      taxAmount: { type: Number, default: 0, min: 0 },
      isTaxInclusive: { type: Boolean, default: false },
      refundAmount: { type: Number, default: 0, min: 0 },
      cancellationCharge: { type: Number, default: 0, min: 0 },
    },

    // Immutable company branding & legal details snapshot at issue time
    company: {
      name: { type: String, default: "" },
      tagline: { type: String, default: "" },
      address: { type: String, default: "" },
      phone: { type: String, default: "" },
      gstin: { type: String, default: "" },
      logoUrl: { type: String, default: "" },
      bankDetails: {
        accountName: { type: String, default: "" },
        accountNumber: { type: String, default: "" },
        ifscCode: { type: String, default: "" },
        bankName: { type: String, default: "" },
        upiId: { type: String, default: "" },
      },
    },

    // Immutable primary customer snapshot (Strictly NO Aadhaar stored)
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, default: "" },
      gstin: { type: String, default: "" },
      city: { type: String, default: "" },
    },

    // Immutable passenger and berth line items snapshot (Strictly NO Aadhaar stored)
    lineItems: [
      {
        description: { type: String, required: true },
        passengerName: { type: String, default: "" },
        seatId: { type: String, default: "" },
        age: { type: Number },
        gender: { type: String, default: "" },
        amount: { type: Number, default: 0 },
      },
    ],

    // Settings snapshot at issue time
    settings: {
      title: { type: String, default: "" },
      prefix: { type: String, default: "" },
      terms: { type: String, default: "", maxlength: 1000 },
      notes: { type: String, default: "", maxlength: 500 },
      showGstBreakup: { type: Boolean, default: false },
      requiresPayment: { type: Boolean, default: true },
    },

    // Part 3.7b Invoice Studio template configuration & snapshot
    templateRef: { type: mongoose.Schema.Types.Mixed, default: null },
    templateSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
)

// Compound index: Document numbers must be strictly unique per user and document type
issuedDocumentSchema.index({ userId: 1, type: 1, number: 1 }, { unique: true })

// Unique index enforcing Credit Note idempotency per booking: at most one active credit note per booking
issuedDocumentSchema.index(
  { bookingId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "credit-note", status: "issued" },
  }
)

export default mongoose.model("IssuedDocument", issuedDocumentSchema)
