import adapter from "./adapters"

export * from "../../shared/history.js"

export const getRecordHistory = (...args) => adapter.getRecordHistory(...args)
