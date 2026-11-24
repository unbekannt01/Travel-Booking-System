import { getDayBounds } from "../../shared/businessLogic.js"

/**
 * Parses and validates departure keys in format <tourName>___<dateKey>___<busType>
 * Reused across departures, seat holds, and manifests.
 *
 * @param {string} rawKey
 * @returns {{ tourName: string, dateStr: string, busType: string, start: Date, end: Date } | null}
 */
export function parseDepartureKey(rawKey) {
  if (!rawKey || typeof rawKey !== "string") return null
  const decoded = decodeURIComponent(rawKey)
  const parts = decoded.split("___")
  if (parts.length < 3) return null

  const busType = parts[parts.length - 1]
  const dateStr = parts[parts.length - 2]
  const tourName = parts.slice(0, parts.length - 2).join("___")
  const { start, end } = getDayBounds(dateStr)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return null
  }
  return { tourName, dateStr, busType, start, end }
}

/**
 * Derives scoped busCondition query for Mongoose, ensuring default 2x1 queries
 * scope 38-berth, legacy, null, and empty strings.
 *
 * @param {string} busType
 * @returns {object}
 */
export function getBusCondition(busType) {
  const normalizedBus = (busType || "").trim()
  const is2x1Default =
    !normalizedBus ||
    normalizedBus === "2x1 Sleeper Luxury (38 berths)" ||
    normalizedBus === "2x1 Sleeper Luxury" ||
    normalizedBus === "2x1"
  return is2x1Default
    ? {
        $or: [
          { busType: "2x1 Sleeper Luxury (38 berths)" },
          { busType: "2x1 Sleeper Luxury" },
          { busType: "2x1" },
          { busType: { $exists: false } },
          { busType: null },
          { busType: "" },
        ],
      }
    : { busType: normalizedBus }
}
