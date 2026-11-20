import mongoose from "mongoose"

const documentAssetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sha256: {
      type: String,
      required: true,
      index: true,
    },
    mime: {
      type: String,
      required: true,
    },
    dataUri: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
)

// Compound unique index ensuring deduplication per user and asset hash
documentAssetSchema.index({ userId: 1, sha256: 1 }, { unique: true })

export default mongoose.model("DocumentAsset", documentAssetSchema)
