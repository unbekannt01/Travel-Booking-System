import adapter from "./adapters"

export const listBookings = (...args) => adapter.listBookings(...args)
export const getBooking = (...args) => adapter.getBooking(...args)
export const createBooking = (...args) => adapter.createBooking(...args)
export const updateBooking = (...args) => adapter.updateBooking(...args)
export const deleteBooking = (...args) => adapter.deleteBooking(...args)
export const restoreBooking = (...args) => adapter.restoreBooking(...args)
export const updatePassenger = (...args) => adapter.updatePassenger(...args)
export const togglePassengerCheckin = (...args) => adapter.togglePassengerCheckin(...args)
export const togglePayment = (...args) => adapter.togglePayment(...args)
export const cancelBooking = (...args) => adapter.cancelBooking(...args)
export const batchCheckin = (...args) => adapter.batchCheckin(...args)
export const swapSeat = (...args) => adapter.swapSeat(...args)
