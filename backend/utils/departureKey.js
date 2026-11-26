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
  if (is2x1Default) {
    return {
      $or: [
        { busType: "2x1 Sleeper Luxury (38 berths)" },
        { busType: "2x1 Sleeper Luxury" },
        { busType: "2x1" },
        { busType: { $exists: false } },
        { busType: null },
        { busType: "" },
      ],
    }
  }

  const is2x2_48 =
    normalizedBus === "2x2 Sleeper Luxury (48 berths)" ||
    normalizedBus === "2x2 Sleeper Luxury" ||
    normalizedBus === "2x2" ||
    normalizedBus === "2x2 Sleeper"
  if (is2x2_48) {
    return {
      $or: [
        { busType: "2x2 Sleeper Luxury (48 berths)" },
        { busType: "2x2 Sleeper Luxury" },
        { busType: "2x2" },
        { busType: "2x2 Sleeper" },
      ],
    }
  }

  const is2x2_40 =
    normalizedBus === "2x2 Sleeper Standard (40 berths)" ||
    normalizedBus === "2x2 Sleeper (40 berths)" ||
    normalizedBus === "2x2 Sleeper 40"
  if (is2x2_40) {
    return {
      $or: [
        { busType: "2x2 Sleeper Standard (40 berths)" },
        { busType: "2x2 Sleeper (40 berths)" },
        { busType: "2x2 Sleeper 40" },
      ],
    }
  }

  const is2x3_60 =
    normalizedBus === "2x3 Seater Express (60 seats)" ||
    normalizedBus === "2x3 Seater" ||
    normalizedBus === "2x3"
  if (is2x3_60) {
    return {
      $or: [
        { busType: "2x3 Seater Express (60 seats)" },
        { busType: "2x3 Seater" },
        { busType: "2x3" },
      ],
    }
  }

  return { busType: normalizedBus }
}
