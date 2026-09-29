import adapter from "./adapters"

export const listTours = (...args) => adapter.listTours(...args)
export const createTour = (...args) => adapter.createTour(...args)
export const updateTour = (...args) => adapter.updateTour(...args)
export const deleteTour = (...args) => adapter.deleteTour(...args)
