import adapter from "./adapters"

export * from "../../shared/cashbook.js"

export const getCashBook = (...args) => adapter.getCashBook(...args)
export const getCashBookSetup = (...args) => adapter.getCashBookSetup(...args)
export const saveCashBookSetup = (...args) => adapter.saveCashBookSetup(...args)
export const createCashEntry = (...args) => adapter.createCashEntry(...args)
export const updateCashEntry = (...args) => adapter.updateCashEntry(...args)
export const deleteCashEntry = (...args) => adapter.deleteCashEntry(...args)
export const getClosePreview = (...args) => adapter.getClosePreview(...args)
export const closeDay = (...args) => adapter.closeDay(...args)
export const reopenDay = (...args) => adapter.reopenDay(...args)
