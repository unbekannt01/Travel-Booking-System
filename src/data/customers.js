import adapter from "./adapters"

export * from "../../shared/customers.js"

export const listCustomers = (...args) => adapter.listCustomers(...args)
export const lookupCustomerByPhone = (...args) => adapter.lookupCustomerByPhone(...args)
export const getCustomer = (...args) => adapter.getCustomer(...args)
export const getCustomerStatement = (...args) => adapter.getCustomerStatement(...args)
export const createCustomer = (...args) => adapter.createCustomer(...args)
export const updateCustomer = (...args) => adapter.updateCustomer(...args)
export const deleteCustomer = (...args) => adapter.deleteCustomer(...args)
export const linkCustomerBookings = (...args) => adapter.linkCustomerBookings(...args)
