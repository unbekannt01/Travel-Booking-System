import adapter from "./adapters"

export const getTrash = (...args) => adapter.getTrash(...args)
export const restoreTrashItem = (...args) => adapter.restoreTrashItem(...args)
