/**
 * YatraHub (TBS) — Document Renderer re-export for frontend components
 */
export { renderDocumentHtml } from "../../shared/documentRenderer.js"
export {
  INVOICE_LAYOUTS,
  PAPER_SIZES,
  COPIES_OPTIONS,
  COLOR_PRESETS,
  TEMPLATE_PRESETS,
  DEFAULT_TEMPLATE_CONFIG,
  calculateContrastRatio,
  isWcagAccessible,
  validateTemplateConfig,
  normalizeTemplateConfig,
  buildUpiPaymentUri,
} from "../../shared/invoiceTemplate.js"
