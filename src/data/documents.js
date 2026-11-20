import adapter from "./adapters"

export * from "../../shared/documentTypes.js"

export const listDocuments = (...args) => adapter.listDocuments(...args)
export const getDocument = (...args) => adapter.getDocument(...args)
export const issueDocument = (...args) => adapter.issueDocument(...args)
export const voidDocument = (...args) => adapter.voidDocument(...args)
export const getDocumentSettings = (...args) => adapter.getDocumentSettings(...args)
export const updateDocumentSettings = (...args) => adapter.updateDocumentSettings(...args)

