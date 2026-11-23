import adapter from "./adapters"

export * from "../../shared/reminders.js"

export const listReminderTemplates = (...args) => adapter.listReminderTemplates(...args)
export const saveReminderTemplate = (...args) => adapter.saveReminderTemplate(...args)
export const resetReminderTemplate = (...args) => adapter.resetReminderTemplate(...args)
export const listReminders = (...args) => adapter.listReminders(...args)
export const createReminderLog = (...args) => adapter.createReminderLog(...args)
export const markReminderSent = (...args) => adapter.markReminderSent(...args)
