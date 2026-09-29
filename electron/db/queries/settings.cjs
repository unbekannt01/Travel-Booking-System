function getAllSettings(db) {
  const rows = db.prepare("SELECT key, value FROM settings").all()
  const map = {}
  for (const r of rows) {
    map[r.key] = r.value
  }

  let organizers = []
  if (map.organizers) {
    try {
      organizers = JSON.parse(map.organizers)
    } catch {
      organizers = []
    }
  }

  return {
    companyName: map.companyName || "XYZ Tourism",
    companyTagline: map.companyTagline || "Tourism & Travels",
    companyHeadquarters: map.companyHeadquarters || "City, State, 123456",
    companyPhone: map.companyPhone || "+91 98765 43210",
    companyLogo: map.companyLogo || "",
    organizers,
    invoicePrefix: map.invoicePrefix || "YHB",
    receiptPrefix: map.receiptPrefix || "REC",
    gstin: map.gstin || "",
    ticketTemplate: map.ticketTemplate || "classic",
    operatorName: map.operatorName || "Admin Operator",
    operatorEmail: map.operatorEmail || "operator@yatrahub.local",
  }
}

function updateSettings(db, settingsData) {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `)

  const executeTx = db.transaction(() => {
    for (const [key, value] of Object.entries(settingsData)) {
      if (value === undefined) continue
      const strVal = typeof value === "object" ? JSON.stringify(value) : String(value)
      stmt.run(key, strVal)
    }
  })

  executeTx()
  return getAllSettings(db)
}

module.exports = {
  getAllSettings,
  updateSettings,
}
