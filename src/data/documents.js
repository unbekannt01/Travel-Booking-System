import adapter from "./adapters"

export * from "../../shared/documentTypes.js"

export const listDocuments = (...args) => adapter.listDocuments(...args)
export const getDocument = (...args) => adapter.getDocument(...args)
export const issueDocument = (...args) => adapter.issueDocument(...args)
export const voidDocument = (...args) => adapter.voidDocument(...args)
export const getDocumentSettings = (...args) => adapter.getDocumentSettings(...args)
export const updateDocumentSettings = (...args) => adapter.updateDocumentSettings(...args)
export const listTemplates = (...args) => adapter.listTemplates(...args)
export const getTemplate = (...args) => adapter.getTemplate(...args)
export const createTemplate = (...args) => adapter.createTemplate(...args)
export const updateTemplate = (...args) => adapter.updateTemplate(...args)
export const deleteTemplate = (...args) => adapter.deleteTemplate(...args)
export const duplicateTemplate = (...args) => adapter.duplicateTemplate(...args)
export const uploadTemplateAsset = (...args) => adapter.uploadTemplateAsset(...args)
export const setDefaultTemplateForType = (...args) => adapter.setDefaultTemplateForType(...args)

