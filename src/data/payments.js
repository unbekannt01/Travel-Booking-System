import adapter from "./adapters"

export const listPayments = (...args) => adapter.listPayments(...args)
export const recordPayment = (...args) => adapter.recordPayment(...args)
export const voidPayment = (...args) => adapter.voidPayment(...args)
