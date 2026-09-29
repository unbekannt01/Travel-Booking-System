const { MIGRATIONS } = require("./schema.cjs")

function runMigrations(db) {
  const currentVersionRow = db.pragma("user_version", { simple: true })
  let currentVersion = Number(currentVersionRow) || 0

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      const applyMigration = db.transaction(() => {
        migration.up(db)
        db.pragma(`user_version = ${migration.version}`)
      })

      applyMigration()
      currentVersion = migration.version
    }
  }

  return currentVersion
}

module.exports = {
  runMigrations,
}
