import adapter from "./adapters"

export * from "../../shared/expenses.js"

export const listExpenses = (...args) => adapter.listExpenses(...args)
export const getExpenseSummary = (...args) => adapter.getExpenseSummary(...args)
export const getExpense = (...args) => adapter.getExpense(...args)
export const createExpense = (...args) => adapter.createExpense(...args)
export const updateExpense = (...args) => adapter.updateExpense(...args)
export const deleteExpense = (...args) => adapter.deleteExpense(...args)
