import adapter from "./adapters"

export const getCompanySettings = (...args) => adapter.getCompanySettings(...args)
export const updateCompanySettings = (...args) => adapter.updateCompanySettings(...args)
export const getBackupStats = (...args) => adapter.getBackupStats(...args)
export const exportDatabaseBackup = (...args) => adapter.exportDatabaseBackup(...args)
export const restoreDatabaseBackup = (...args) => adapter.restoreDatabaseBackup(...args)

