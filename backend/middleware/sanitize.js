// NoSQL Injection sanitizer middleware (SEC-011)
// Fully compatible with Express 5 (where req.query is a read-only getter)

export function containsMongoOperators(obj) {
  if (!obj || typeof obj !== "object") return false
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      return true
    }
    if (typeof obj[key] === "object" && obj[key] !== null) {
      if (containsMongoOperators(obj[key])) return true
    }
  }
  return false
}

export function stripMongoOperators(obj) {
  if (!obj || typeof obj !== "object") return
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key]
      continue
    }
    if (typeof obj[key] === "object" && obj[key] !== null) {
      stripMongoOperators(obj[key])
    }
  }
}

export const mongoSanitize = (req, res, next) => {
  // Validate req.query without mutating it (read-only getter in Express 5)
  if (req.query && typeof req.query === "object") {
    if (containsMongoOperators(req.query)) {
      return res.status(400).json({
        message: "Invalid query parameters: potential NoSQL injection detected.",
      })
    }
  }

  // Strip hostile keys from body and params in-place
  if (req.body && typeof req.body === "object") {
    stripMongoOperators(req.body)
  }
  if (req.params && typeof req.params === "object") {
    stripMongoOperators(req.params)
  }

  next()
}
