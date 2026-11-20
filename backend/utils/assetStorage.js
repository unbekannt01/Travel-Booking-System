import crypto from "node:crypto"
import DocumentAsset from "../models/DocumentAsset.js"

/**
 * Computes standard SHA-256 hex hash of an asset data URI or string.
 * @param {string} dataUri
 * @returns {string} 64-character hex hash
 */
export function computeAssetSha256(dataUri) {
  return crypto.createHash("sha256").update(dataUri).digest("hex")
}

/**
 * Deduplicates image assets by storing data URIs in DocumentAsset collection and
 * returning compact hash references for the snapshot.
 * Preserves existing compact references or empty strings.
 *
 * @param {string} userId - Mongoose ObjectId string
 * @param {Record<string, any>} [assets] - Template assets map (logo, signature, stamp)
 * @returns {Promise<Record<string, { sha256: string, mime: string, size: number } | string>>}
 */
export async function deduplicateTemplateAssets(userId, assets = {}) {
  if (!assets || typeof assets !== "object") return {}
  const deduplicated = {}

  for (const [key, val] of Object.entries(assets)) {
    if (!val) {
      deduplicated[key] = ""
      continue
    }

    if (typeof val === "string" && val.startsWith("data:")) {
      const sha256 = computeAssetSha256(val)
      const match = val.match(/^data:([^;]+);base64,/)
      const mime = match ? match[1] : "image/png"
      const size = Math.round((val.length * 3) / 4)

      try {
        await DocumentAsset.findOneAndUpdate(
          { userId, sha256 },
          { userId, sha256, mime, dataUri: val, size },
          { upsert: true, new: true }
        )
      } catch (err) {
        console.error(`Error saving document asset ${key}:`, err.message)
      }

      deduplicated[key] = { sha256, mime, size }
    } else if (typeof val === "object" && val.sha256) {
      deduplicated[key] = val
    } else {
      deduplicated[key] = val
    }
  }

  return deduplicated
}

/**
 * Hydrates asset references back to full data URIs for rendering/display.
 * Fully backward-compatible: returns existing embedded data URIs unchanged.
 *
 * @param {string} userId - Mongoose ObjectId string
 * @param {Record<string, any>} [assets] - Template assets map
 * @returns {Promise<Record<string, string>>}
 */
export async function hydrateTemplateAssets(userId, assets = {}) {
  if (!assets || typeof assets !== "object") return {}
  const hydrated = {}

  for (const [key, val] of Object.entries(assets)) {
    if (!val) {
      hydrated[key] = ""
      continue
    }

    if (typeof val === "string") {
      if (val.startsWith("data:") || val.startsWith("http")) {
        // Older backward-compatible embedded URI
        hydrated[key] = val
      } else if (val.length === 64) {
        // Plain sha256 hash string
        const record = await DocumentAsset.findOne({ userId, sha256: val }).lean()
        hydrated[key] = record ? record.dataUri : val
      } else {
        hydrated[key] = val
      }
    } else if (typeof val === "object" && val.sha256) {
      // Compact { sha256, mime, size } object
      const record = await DocumentAsset.findOne({ userId, sha256: val.sha256 }).lean()
      hydrated[key] = record ? record.dataUri : ""
    } else {
      hydrated[key] = val
    }
  }

  return hydrated
}
