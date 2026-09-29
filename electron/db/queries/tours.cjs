const crypto = require("crypto")

function formatTour(row) {
  if (!row) return null
  let pricing = { baseFare: 0, sleeperRate: 0, gstRate: 5 }
  if (row.pricing) {
    try {
      pricing = typeof row.pricing === "string" ? JSON.parse(row.pricing) : row.pricing
    } catch {
      // fallback
    }
  }

  return {
    ...row,
    id: row.id,
    _id: row.id,
    pricing,
  }
}

function listTours(db) {
  const stmt = db.prepare("SELECT * FROM tours ORDER BY createdAt DESC")
  const rows = stmt.all()
  return rows.map(formatTour)
}

function getTour(db, id) {
  const stmt = db.prepare("SELECT * FROM tours WHERE id = ?")
  const row = stmt.get(id)
  return formatTour(row)
}

function createTour(db, tourData) {
  const id = tourData.id || tourData._id || crypto.randomUUID()
  const now = new Date().toISOString()
  const pricingStr = JSON.stringify(tourData.pricing || {})

  const stmt = db.prepare(`
    INSERT INTO tours (id, name, destination, duration, busType, totalSeats, pricing, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    tourData.name || "",
    tourData.destination || "",
    tourData.duration || "",
    tourData.busType || "2x1 Sleeper",
    tourData.totalSeats || 36,
    pricingStr,
    now,
    now
  )

  return getTour(db, id)
}

function updateTour(db, id, tourData) {
  const now = new Date().toISOString()
  const existing = getTour(db, id)
  if (!existing) {
    throw new Error(`Tour with id ${id} not found`)
  }

  const name = tourData.name !== undefined ? tourData.name : existing.name
  const destination = tourData.destination !== undefined ? tourData.destination : existing.destination
  const duration = tourData.duration !== undefined ? tourData.duration : existing.duration
  const busType = tourData.busType !== undefined ? tourData.busType : existing.busType
  const totalSeats = tourData.totalSeats !== undefined ? tourData.totalSeats : existing.totalSeats
  const pricingStr = tourData.pricing !== undefined ? JSON.stringify(tourData.pricing) : JSON.stringify(existing.pricing)

  const stmt = db.prepare(`
    UPDATE tours
    SET name = ?, destination = ?, duration = ?, busType = ?, totalSeats = ?, pricing = ?, updatedAt = ?
    WHERE id = ?
  `)

  stmt.run(name, destination, duration, busType, totalSeats, pricingStr, now, id)
  return getTour(db, id)
}

function deleteTour(db, id) {
  const stmt = db.prepare("DELETE FROM tours WHERE id = ?")
  stmt.run(id)
  return { success: true, id }
}

module.exports = {
  listTours,
  getTour,
  createTour,
  updateTour,
  deleteTour,
}
