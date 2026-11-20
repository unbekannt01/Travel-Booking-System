import { useState, useEffect, useMemo, useRef } from "react"
import QRCode from "qrcode"
import {
  Sparkles,
  Save,
  Copy,
  Trash2,
  Printer,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Palette,
  Type,
  Layout,
  FileCheck,
  Eye,
} from "lucide-react"
import { useToast } from "../common/ToastContext"
import {
  Button,
  Select,
  Input,
  Field,
  Switch,
  Badge,
  Card,
  Spinner,
  ConfirmDialog,
} from "../ui"
import {
  INVOICE_LAYOUTS,
  COLOR_PRESETS,
  TEMPLATE_PRESETS,
  DEFAULT_TEMPLATE_CONFIG,
  calculateContrastRatio,
  validateTemplateConfig,
  normalizeTemplateConfig,
  buildUpiPaymentUri,
} from "../../../shared/invoiceTemplate.js"
import { renderDocumentHtml } from "../../../shared/documentRenderer.js"
import { DOCUMENT_TYPES, DOCUMENT_TYPE_IDS, getType } from "../../../shared/documentTypes.js"
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  uploadTemplateAsset,
  setDefaultTemplateForType,
  getDocumentSettings,
} from "../../data/documents"

const SAMPLE_BOOKING_DATE = "2026-05-15T10:00:00.000Z"
const SAMPLE_JOURNEY_DATE = "2026-05-20T06:00:00.000Z"
const SAMPLE_VALID_UNTIL = "2026-06-15T00:00:00.000Z"

export default function InvoiceStudio({ user }) {
  const { toast } = useToast()

  // Template collection state
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState("builtin-classic-bus")
  const [templateName, setTemplateName] = useState("Classic Yatra Bus")
  const [currentConfig, setCurrentConfig] = useState(DEFAULT_TEMPLATE_CONFIG)
  const [currentAssets, setCurrentAssets] = useState({})
  const [isBuiltIn, setIsBuiltIn] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // Document settings per type (defaultTemplateId)
  const [docSettings, setDocSettings] = useState({})

  // Preview & simulation controls
  const [previewDocType, setPreviewDocType] = useState("tax-invoice")
  const [activeTab, setActiveTab] = useState("layout")
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [zoomLevel, setZoomLevel] = useState(100)

  // Asset upload state
  const [uploadingAsset, setUploadingAsset] = useState(false)
  const logoInputRef = useRef(null)
  const signatureInputRef = useRef(null)
  const stampInputRef = useRef(null)

  const selectTemplate = (tpl) => {
    if (!tpl) return
    setSelectedId(tpl._id || tpl.id)
    setTemplateName(tpl.name)
    setCurrentConfig(normalizeTemplateConfig(tpl.config))
    setCurrentAssets(tpl.assets || {})
    setIsBuiltIn(Boolean(tpl.isBuiltIn))
    setIsDirty(false)
  }

  const loadTemplatesAndSettings = async () => {
    try {
      setLoading(true)
      const [tplList, settings] = await Promise.all([
        listTemplates(),
        getDocumentSettings().catch(() => ({})),
      ])
      setTemplates(tplList || [])
      setDocSettings(settings || {})

      if (tplList && tplList.length > 0) {
        selectTemplate(tplList[0])
      }
    } catch (err) {
      console.error("Failed to load invoice templates:", err)
      toast.error("Failed to load templates: " + (err.message || "Unknown error"))
    } finally {
      setLoading(false)
    }
  }

  // Load templates & document settings on mount
  useEffect(() => {
    loadTemplatesAndSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelectChange = (id) => {
    const found = templates.find((t) => (t._id || t.id) === id)
    if (found) {
      selectTemplate(found)
    }
  }

  // Update a nested configuration property
  const updateConfig = (updater) => {
    setCurrentConfig((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater }
      return normalizeTemplateConfig(next)
    })
    setIsDirty(true)
  }

  // Apply a color preset
  const applyColorPreset = (presetKey) => {
    const preset = COLOR_PRESETS[presetKey]
    if (!preset) return
    updateConfig((prev) => ({
      ...prev,
      colorPreset: presetKey,
      colors: {
        primary: preset.primary,
        accent: preset.accent,
        text: preset.text,
        border: preset.border,
        bg: preset.bg,
        surface: preset.surface,
      },
    }))
  }

  // Apply a full preset template
  const applyFullPreset = (presetId) => {
    const preset = TEMPLATE_PRESETS[presetId]
    if (!preset) return
    updateConfig(preset.config)
    toast.success(`Applied '${preset.name}' configuration`)
  }

  // Save current template
  const handleSave = async () => {
    if (isBuiltIn) {
      toast.error("Built-in templates cannot be modified directly. Please click 'Duplicate' to customize.")
      return
    }

    const validation = validateTemplateConfig(currentConfig)
    if (!validation.valid) {
      toast.error(validation.errors.join(", "))
      return
    }

    try {
      setIsSaving(true)
      const updated = await updateTemplate(selectedId, {
        name: templateName.trim(),
        config: currentConfig,
        assets: currentAssets,
      })
      toast.success("Template saved successfully")
      setIsDirty(false)
      setTemplates((prev) =>
        prev.map((t) => ((t._id || t.id) === selectedId ? updated : t))
      )
    } catch (err) {
      toast.error(err.message || "Failed to save template")
    } finally {
      setIsSaving(false)
    }
  }

  // Create new template from current
  const handleCreateNew = async () => {
    const newName = `My Custom Template ${templates.filter((t) => !t.isBuiltIn).length + 1}`
    try {
      setIsSaving(true)
      const created = await createTemplate({
        name: newName,
        presetId: currentConfig.layout || "classic-bus",
        config: currentConfig,
        assets: currentAssets,
      })
      toast.success("New template created")
      setTemplates((prev) => [created, ...prev])
      selectTemplate(created)
    } catch (err) {
      toast.error(err.message || "Failed to create template")
    } finally {
      setIsSaving(false)
    }
  }

  // Duplicate template
  const handleDuplicate = async () => {
    try {
      setIsSaving(true)
      const cloned = await duplicateTemplate(selectedId)
      toast.success(`Duplicated as '${cloned.name}'`)
      setTemplates((prev) => [cloned, ...prev])
      selectTemplate(cloned)
    } catch (err) {
      toast.error(err.message || "Failed to duplicate template")
    } finally {
      setIsSaving(false)
    }
  }

  // Delete template
  const handleDelete = async () => {
    if (isBuiltIn) return
    try {
      setIsSaving(true)
      await deleteTemplate(selectedId)
      toast.success("Template deleted")
      const remaining = templates.filter((t) => (t._id || t.id) !== selectedId)
      setTemplates(remaining)
      if (remaining.length > 0) {
        selectTemplate(remaining[0])
      }
      setDeleteConfirmOpen(false)
    } catch (err) {
      toast.error(err.message || "Failed to delete template")
    } finally {
      setIsSaving(false)
    }
  }

  // Asset upload with magic bytes check
  const handleAssetUpload = async (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type === "image/svg+xml" || file.name.endsWith(".svg")) {
      toast.error("SVG files are rejected for security. Please upload PNG, JPEG, or WebP.")
      e.target.value = ""
      return
    }

    if (file.size > 200 * 1024) {
      toast.error(`File size (${Math.round(file.size / 1024)} KB) exceeds 200 KB limit.`)
      e.target.value = ""
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      try {
        setUploadingAsset(true)
        const base64 = reader.result
        const res = await uploadTemplateAsset(base64, type)
        setCurrentAssets((prev) => ({
          ...prev,
          [type]: res.url,
        }))
        setIsDirty(true)
        toast.success(`${type.toUpperCase()} uploaded successfully`)
      } catch (err) {
        toast.error(err.message || "Upload failed")
      } finally {
        setUploadingAsset(false)
        e.target.value = ""
      }
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAsset = (type) => {
    setCurrentAssets((prev) => ({
      ...prev,
      [type]: "",
    }))
    setIsDirty(true)
  }

  // Set default template for a document type
  const handleSetDefaultType = async (typeId) => {
    try {
      await setDefaultTemplateForType(typeId, selectedId)
      setDocSettings((prev) => ({
        ...prev,
        [typeId]: {
          ...(prev[typeId] || {}),
          defaultTemplateId: selectedId,
        },
      }))
      toast.success(`Set as default template for ${getType(typeId)?.label || typeId}`)
    } catch (err) {
      toast.error(err.message || "Failed to update default template")
    }
  }

  // UPI QR Code generation
  useEffect(() => {
    let active = true
    const upiId = user?.bankDetails?.upiId
    if (currentConfig.sections.showUpiQr && upiId) {
      const uri = buildUpiPaymentUri({
        upiId,
        payeeName: user?.companyName || "Yatra Tours",
        amount: 14150,
        note: "Sample Booking INV-0108",
      })
      QRCode.toDataURL(uri, {
        width: 140,
        margin: 1,
        color: {
          dark: currentConfig.colors.primary || "#0f172a",
          light: "#ffffff",
        },
      })
        .then((url) => {
          if (active) setQrDataUrl(url)
        })
        .catch(() => {
          if (active) setQrDataUrl("")
        })
    } else {
      setQrDataUrl("")
    }
    return () => {
      active = false
    }
  }, [currentConfig.sections.showUpiQr, currentConfig.colors.primary, user?.bankDetails?.upiId, user?.companyName])

  // Realistic sample data for Indian pilgrimage / bus operator
  const sampleBooking = useMemo(
    () => ({
      invoiceNo: "YHB/2026-27/0108",
      status: previewDocType === "credit-note" ? "Cancelled" : "Confirmed",
      cancellationReason: previewDocType === "credit-note" ? "Traveler family emergency" : "",
      date: SAMPLE_BOOKING_DATE,
      journeyDate: SAMPLE_JOURNEY_DATE,
      tourName: "Somnath - Dwarka - Girnar 5D Pilgrimage",
      busType: "BharatBenz 2+1 AC Sleeper Coach (GJ-03-BX-9988)",
      contactName: "Rameshbhai Patel",
      contactPhone: "+91 98250 12345",
      contactEmail: "ramesh.patel@example.com",
      paymentMode: "UPI / Net Banking",
      totalAmount: 24150,
      baseAmount: 24000,
      advanceReceived: 10000,
      discount: 1000,
      gstRate: 5,
      taxAmount: 1150,
      isTaxInclusive: false,
      cancellationCharge: previewDocType === "credit-note" ? 3000 : 0,
      refundAmount: previewDocType === "credit-note" ? 7000 : 0,
      passengers: [
        { name: "Rameshbhai Patel", age: 52, gender: "Male", seatId: "U1", city: "Ahmedabad" },
        { name: "Gitaben Patel", age: 48, gender: "Female", seatId: "U2", city: "Ahmedabad" },
        { name: "Aarav Patel", age: 21, gender: "Male", seatId: "L3", city: "Ahmedabad" },
        { name: "Pooja Patel", age: 18, gender: "Female", seatId: "L4", city: "Ahmedabad" },
      ],
      notes: "Vegetarian meals requested at all yatra halt points.",
    }),
    [previewDocType]
  )

  const sampleDoc = useMemo(
    () => ({
      type: previewDocType,
      number: previewDocType === "credit-note" ? "CN/2026-27/0004" : "INV/2026-27/0108",
      status: previewDocType === "credit-note" ? "issued" : "issued",
      amounts: {
        totalAmount: 24150,
        advanceReceived: 10000,
        balance: 14150,
        discount: 1000,
        gstRate: 5,
        taxAmount: 1150,
        isTaxInclusive: false,
        refundAmount: previewDocType === "credit-note" ? 7000 : 0,
        cancellationCharge: previewDocType === "credit-note" ? 3000 : 0,
      },
      settings: {
        title: getType(previewDocType)?.defaultTitle || "TAX INVOICE",
        showGstBreakup: getType(previewDocType)?.showGstBreakup ?? true,
        notes: "Vegetarian meals requested at all yatra halt points.",
      },
      validUntil:
        previewDocType === "quotation"
          ? SAMPLE_VALID_UNTIL
          : null,
    }),
    [previewDocType]
  )

  // Merge template config with current assets for live preview
  const liveTemplateConfig = useMemo(
    () => ({
      ...currentConfig,
      assets: currentAssets,
    }),
    [currentConfig, currentAssets]
  )

  // Render HTML for sandboxed iframe
  const previewHtml = useMemo(() => {
    return renderDocumentHtml({
      document: sampleDoc,
      booking: sampleBooking,
      template: liveTemplateConfig,
      user,
      qrDataUrl,
      previewMode: true,
    })
  }, [sampleDoc, sampleBooking, liveTemplateConfig, user, qrDataUrl])

  // Test Print trigger
  const handlePrintTest = () => {
    const printHtml = renderDocumentHtml({
      document: sampleDoc,
      booking: sampleBooking,
      template: liveTemplateConfig,
      user,
      qrDataUrl,
      previewMode: false,
    })
    const win = window.open("", "_blank", "width=900,height=700")
    if (!win) {
      alert("Please allow popups to print invoices.")
      return
    }
    win.document.write(printHtml)
    win.document.close()
    win.focus()
    setTimeout(() => {
      win.print()
    }, 600)
  }

  // WCAG contrast calculation for primary color against background
  const primaryContrast = useMemo(
    () => calculateContrastRatio(currentConfig.colors.primary, "#ffffff"),
    [currentConfig.colors.primary]
  )
  const isPrimaryAccessible = primaryContrast >= 4.5

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Studio Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-elevated p-4 rounded-[var(--yh-radius-xl)] border border-border-subtle shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--yh-radius-md)] bg-brand-primary text-white shadow-xs">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink">Invoice Studio</h2>
              {isBuiltIn ? (
                <Badge variant="neutral" size="sm">Built-in Preset</Badge>
              ) : (
                <Badge variant="primary" size="sm">Custom Template</Badge>
              )}
            </div>
            <p className="text-xs text-ink-muted">
              Design and preview custom invoice layouts, color palettes, copies and paper formats.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Template Selector Dropdown */}
          <div className="w-56">
            <Select
              size="sm"
              value={selectedId}
              onChange={(e) => handleSelectChange(e.target.value)}
              aria-label="Select invoice template"
            >
              <optgroup label="Custom User Templates">
                {templates
                  .filter((t) => !t.isBuiltIn)
                  .map((t) => (
                    <option key={t._id || t.id} value={t._id || t.id}>
                      {t.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Built-in Presets">
                {templates
                  .filter((t) => t.isBuiltIn)
                  .map((t) => (
                    <option key={t._id || t.id} value={t._id || t.id}>
                      {t.name}
                    </option>
                  ))}
              </optgroup>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={<Copy size={14} />}
            onClick={handleDuplicate}
            disabled={isSaving}
          >
            Duplicate
          </Button>

          {!isBuiltIn && (
            <Button
              variant="outline"
              size="sm"
              className="text-status-danger-text hover:bg-status-danger-bg"
              icon={<Trash2 size={14} />}
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={isSaving}
            >
              Delete
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            icon={<Save size={14} />}
            onClick={isBuiltIn ? handleCreateNew : handleSave}
            isLoading={isSaving}
          >
            {isBuiltIn ? "Save as Custom" : isDirty ? "Save Changes" : "Saved"}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={<Printer size={14} />}
            onClick={handlePrintTest}
          >
            Print Test Page
          </Button>
        </div>
      </div>

      {/* Main Studio Grid: Left Controls (40%) | Right Live Preview (60%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Designer Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Template Details Card */}
          <Card className="p-4 space-y-3">
            <Field label="Template Name" required>
              <Input
                size="sm"
                value={templateName}
                onChange={(e) => {
                  setTemplateName(e.target.value)
                  setIsDirty(true)
                }}
                disabled={isBuiltIn}
                placeholder="e.g. My Agency Standard Invoice"
              />
            </Field>

            {/* Set as Default Template Pills */}
            <div>
              <span className="block text-xs font-semibold text-ink-muted mb-1.5">
                Set as Default for Document Types:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DOCUMENT_TYPE_IDS.map((tId) => {
                  const meta = getType(tId)
                  const isCurrentDefault = docSettings[tId]?.defaultTemplateId === selectedId
                  return (
                    <button
                      key={tId}
                      type="button"
                      onClick={() => handleSetDefaultType(tId)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-[var(--yh-radius-full)] border transition-all ${
                        isCurrentDefault
                          ? "bg-brand-primary text-white border-brand-primary shadow-xs"
                          : "bg-surface-subtle text-ink-muted border-border-subtle hover:bg-surface-hover hover:text-ink"
                      }`}
                    >
                      {meta?.label || tId} {isCurrentDefault && "✓"}
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>

          {/* Designer Controls Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border-subtle text-xs font-bold text-ink-muted">
            {[
              { id: "layout", label: "Layout & Preset", icon: <Layout size={14} /> },
              { id: "colors", label: "Colors & Brand", icon: <Palette size={14} /> },
              { id: "assets", label: "Logo & Signatures", icon: <Upload size={14} /> },
              { id: "sections", label: "Sections", icon: <Layers size={14} /> },
              { id: "paper", label: "Paper & Copies", icon: <FileCheck size={14} /> },
              { id: "typography", label: "Typography & Text", icon: <Type size={14} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-[var(--yh-radius-md)] whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "bg-surface-elevated text-brand-primary border-b-2 border-brand-primary shadow-xs"
                    : "hover:text-ink"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab 1: Layout & Presets */}
          {activeTab === "layout" && (
            <Card className="p-4 space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
                  Apply Preset Configuration
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(TEMPLATE_PRESETS).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyFullPreset(p.id)}
                      className="text-left p-2.5 rounded-[var(--yh-radius-md)] border border-border-subtle hover:border-brand-primary hover:bg-surface-hover transition-all"
                    >
                      <span className="block font-bold text-xs text-ink">{p.name}</span>
                      <span className="block text-[10px] text-ink-muted truncate">{p.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
                  Layout Architecture
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {INVOICE_LAYOUTS.map((lay) => {
                    const isSelected = currentConfig.layout === lay
                    return (
                      <button
                        key={lay}
                        type="button"
                        onClick={() => updateConfig({ layout: lay })}
                        className={`p-3 rounded-[var(--yh-radius-md)] border text-center transition-all ${
                          isSelected
                            ? "border-brand-primary bg-brand-primary/10 text-brand-primary font-bold shadow-xs"
                            : "border-border-subtle hover:bg-surface-hover text-ink"
                        }`}
                      >
                        <span className="block text-xs uppercase tracking-wider">{lay}</span>
                        {lay === "legacy" && <span className="text-[9px] text-ink-muted block mt-0.5">Classic YH</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </Card>
          )}

          {/* Tab 2: Colors & Contrast */}
          {activeTab === "colors" && (
            <Card className="p-4 space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
                  Color Presets
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(COLOR_PRESETS).map(([k, p]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => applyColorPreset(k)}
                      className="flex items-center gap-2 p-2 rounded-[var(--yh-radius-md)] border border-border-subtle hover:bg-surface-hover transition-all text-left"
                    >
                      <span
                        className="h-4 w-4 rounded-full shrink-0 border border-black/10"
                        style={{ backgroundColor: p.primary }}
                      />
                      <span className="text-xs font-semibold text-ink truncate">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* WCAG 2.1 Contrast Badge */}
              <div
                className={`p-3 rounded-[var(--yh-radius-md)] border flex items-center justify-between gap-2 text-xs ${
                  isPrimaryAccessible
                    ? "bg-status-success-bg border-status-success-border text-status-success-text"
                    : "bg-status-warning-bg border-status-warning-border text-status-warning-text"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isPrimaryAccessible ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <div>
                    <span className="font-bold">WCAG 2.1 AA Contrast: {primaryContrast}:1</span>
                    <span className="block text-[10px]">
                      {isPrimaryAccessible
                        ? "Meets the 4.5:1 minimum contrast requirement for document readability."
                        : "Warning: Low contrast may make text hard to read on printed paper."}
                    </span>
                  </div>
                </div>
              </div>

              {/* Custom Hex Pickers */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Primary Color">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentConfig.colors.primary}
                      onChange={(e) =>
                        updateConfig((prev) => ({
                          ...prev,
                          colors: { ...prev.colors, primary: e.target.value },
                        }))
                      }
                      className="h-8 w-10 cursor-pointer rounded border border-border-subtle"
                    />
                    <Input
                      size="sm"
                      value={currentConfig.colors.primary}
                      onChange={(e) =>
                        updateConfig((prev) => ({
                          ...prev,
                          colors: { ...prev.colors, primary: e.target.value },
                        }))
                      }
                    />
                  </div>
                </Field>

                <Field label="Accent Color">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentConfig.colors.accent}
                      onChange={(e) =>
                        updateConfig((prev) => ({
                          ...prev,
                          colors: { ...prev.colors, accent: e.target.value },
                        }))
                      }
                      className="h-8 w-10 cursor-pointer rounded border border-border-subtle"
                    />
                    <Input
                      size="sm"
                      value={currentConfig.colors.accent}
                      onChange={(e) =>
                        updateConfig((prev) => ({
                          ...prev,
                          colors: { ...prev.colors, accent: e.target.value },
                        }))
                      }
                    />
                  </div>
                </Field>
              </div>
            </Card>
          )}

          {/* Tab 3: Logo & Signatures */}
          {activeTab === "assets" && (
            <Card className="p-4 space-y-4">
              <div className="space-y-3">
                {/* Logo Uploader */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-ink">Company Logo (PNG, JPEG, WebP max 200KB)</span>
                    {currentAssets.logo && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAsset("logo")}
                        className="text-xs text-status-danger-text hover:underline"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {currentAssets.logo ? (
                      <img
                        src={currentAssets.logo}
                        alt="Logo Preview"
                        className="h-12 w-16 object-contain rounded border border-border-subtle p-1 bg-white"
                      />
                    ) : (
                      <div className="h-12 w-16 rounded border border-dashed border-border-subtle flex items-center justify-center text-ink-muted text-xs">
                        No Logo
                      </div>
                    )}
                    <input
                      type="file"
                      ref={logoInputRef}
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleAssetUpload(e, "logo")}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingAsset}
                    >
                      {currentAssets.logo ? "Change Logo" : "Upload Logo"}
                    </Button>
                  </div>
                </div>

                {/* Logo Height Slider */}
                <div>
                  <label className="text-xs font-semibold text-ink-muted block mb-1">
                    Logo Height: {currentConfig.header.logoHeight}px
                  </label>
                  <input
                    type="range"
                    min="24"
                    max="100"
                    step="4"
                    value={currentConfig.header.logoHeight}
                    onChange={(e) =>
                      updateConfig((prev) => ({
                        ...prev,
                        header: { ...prev.header, logoHeight: Number(e.target.value) },
                      }))
                    }
                    className="w-full accent-brand-primary cursor-pointer"
                  />
                </div>

                <hr className="border-border-subtle" />

                {/* Authorized Signature Uploader */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-ink">Authorized Signature (Digital)</span>
                    {currentAssets.signature && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAsset("signature")}
                        className="text-xs text-status-danger-text hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {currentAssets.signature ? (
                      <img
                        src={currentAssets.signature}
                        alt="Signature Preview"
                        className="h-10 w-24 object-contain rounded border border-border-subtle p-1 bg-white"
                      />
                    ) : (
                      <div className="h-10 w-24 rounded border border-dashed border-border-subtle flex items-center justify-center text-ink-muted text-[10px]">
                        No Signature
                      </div>
                    )}
                    <input
                      type="file"
                      ref={signatureInputRef}
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleAssetUpload(e, "signature")}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => signatureInputRef.current?.click()}
                      disabled={uploadingAsset}
                    >
                      {currentAssets.signature ? "Change" : "Upload Signature"}
                    </Button>
                  </div>
                </div>

                <hr className="border-border-subtle" />

                {/* Official Stamp Uploader */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-ink">Official Stamp (Optional)</span>
                    {currentAssets.stamp && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAsset("stamp")}
                        className="text-xs text-status-danger-text hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {currentAssets.stamp ? (
                      <img
                        src={currentAssets.stamp}
                        alt="Stamp Preview"
                        className="h-12 w-12 object-contain rounded border border-border-subtle p-1 bg-white"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded border border-dashed border-border-subtle flex items-center justify-center text-ink-muted text-[10px]">
                        No Stamp
                      </div>
                    )}
                    <input
                      type="file"
                      ref={stampInputRef}
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleAssetUpload(e, "stamp")}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => stampInputRef.current?.click()}
                      disabled={uploadingAsset}
                    >
                      {currentAssets.stamp ? "Change" : "Upload Stamp"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Tab 4: Sections Visibility */}
          {activeTab === "sections" && (
            <Card className="p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
                Document Sections Visibility
              </h4>
              {[
                { key: "showCustomer", label: "Customer Details" },
                { key: "showTourDetails", label: "Tour & Coach Cards" },
                { key: "showPassengerManifest", label: "Passenger Manifest Table" },
                { key: "showFinancialBreakup", label: "Financial Breakup & Balance" },
                { key: "showBankDetails", label: "Bank Account Settlement Box" },
                { key: "showUpiQr", label: "UPI Payment QR Code" },
                { key: "showTerms", label: "Terms & Conditions List" },
                { key: "showNotes", label: "Custom Notes / Instructions" },
                { key: "showAuthorizedSignature", label: "Authorized Signatory Box" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <span className="text-xs font-medium text-ink">{label}</span>
                  <Switch
                    checked={Boolean(currentConfig.sections[key])}
                    onChange={(checked) =>
                      updateConfig((prev) => ({
                        ...prev,
                        sections: { ...prev.sections, [key]: checked },
                      }))
                    }
                  />
                </div>
              ))}
            </Card>
          )}

          {/* Tab 5: Paper & Copies */}
          {activeTab === "paper" && (
            <Card className="p-4 space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
                  Paper Format & Size
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "a4", label: "A4 Standard", desc: "Full page portrait" },
                    { id: "a5", label: "A5 Compact", desc: "Half page format" },
                    { id: "thermal80", label: "Thermal 80mm", desc: "POS Roll receipt" },
                    { id: "thermal58", label: "Thermal 58mm", desc: "Compact roll" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        updateConfig((prev) => ({
                          ...prev,
                          paper: { ...prev.paper, size: p.id },
                        }))
                      }
                      className={`p-2.5 rounded-[var(--yh-radius-md)] border text-left transition-all ${
                        currentConfig.paper.size === p.id
                          ? "border-brand-primary bg-brand-primary/10 text-brand-primary font-bold shadow-xs"
                          : "border-border-subtle hover:bg-surface-hover text-ink"
                      }`}
                    >
                      <span className="block text-xs font-bold">{p.label}</span>
                      <span className="block text-[10px] text-ink-muted">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
                  Number of Copies per Document
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "single", label: "1 Copy", sub: "Single" },
                    { id: "original-duplicate", label: "2 Copies", sub: "Original + Dup" },
                    { id: "original-duplicate-triplicate", label: "3 Copies", sub: "Triplicate" },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => updateConfig({ copies: c.id })}
                      className={`p-2 rounded-[var(--yh-radius-md)] border text-center transition-all ${
                        currentConfig.copies === c.id
                          ? "border-brand-primary bg-brand-primary/10 text-brand-primary font-bold shadow-xs"
                          : "border-border-subtle hover:bg-surface-hover text-ink"
                      }`}
                    >
                      <span className="block text-xs font-bold">{c.label}</span>
                      <span className="block text-[10px] text-ink-muted">{c.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Tab 6: Typography & Language */}
          {activeTab === "typography" && (
            <Card className="p-4 space-y-4">
              <Field label="Document Language">
                <Select
                  size="sm"
                  value={currentConfig.language || "en"}
                  onChange={(e) => updateConfig({ language: e.target.value })}
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="gu">ગુજરાતી (Gujarati)</option>
                </Select>
              </Field>

              <Field label="Font Family">
                <Select
                  size="sm"
                  value={currentConfig.typography?.fontFamily || "system"}
                  onChange={(e) =>
                    updateConfig((prev) => ({
                      ...prev,
                      typography: { ...prev.typography, fontFamily: e.target.value },
                    }))
                  }
                >
                  <option value="system">System Default (Segoe UI / Arial)</option>
                  <option value="inter">Inter (Clean Modern Sans)</option>
                  <option value="serif">Serif (Traditional Formal)</option>
                </Select>
              </Field>

              <Field label="Footer Disclaimer / Blessing">
                <Input
                  size="sm"
                  value={currentConfig.footer.customText}
                  onChange={(e) =>
                    updateConfig((prev) => ({
                      ...prev,
                      footer: { ...prev.footer, customText: e.target.value },
                    }))
                  }
                  placeholder="e.g. Subh Yatra! Safe travels with us."
                />
              </Field>
            </Card>
          )}
        </div>

        {/* Right Side: Live Sandboxed Iframe Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Preview Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-elevated p-3 rounded-[var(--yh-radius-lg)] border border-border-subtle shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink-muted flex items-center gap-1">
                <Eye size={14} /> Preview Type:
              </span>
              <div className="w-44">
                <Select
                  size="sm"
                  value={previewDocType}
                  onChange={(e) => setPreviewDocType(e.target.value)}
                  aria-label="Preview document type"
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink-muted">Zoom:</span>
              <div className="flex items-center gap-1">
                {[75, 100, 125].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoomLevel(z)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                      zoomLevel === z
                        ? "bg-brand-primary text-white border-brand-primary"
                        : "bg-surface-subtle text-ink-muted border-border-subtle hover:bg-surface-hover"
                    }`}
                  >
                    {z}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sandboxed Iframe with transform scaling */}
          <div className="relative w-full h-[760px] bg-slate-100 dark:bg-slate-900 rounded-[var(--yh-radius-xl)] border border-border-strong overflow-hidden flex items-center justify-center p-4">
            <iframe
              sandbox=""
              srcDoc={previewHtml}
              title="Invoice Studio Live Preview"
              className="w-full h-full bg-white rounded shadow-md border-0 transition-transform origin-top"
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: "top center",
              }}
            />
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Custom Template"
        description={`Are you sure you want to permanently delete '${templateName}'? This action cannot be undone.`}
        confirmText="Delete Template"
        confirmVariant="danger"
        isLoading={isSaving}
      />
    </div>
  )
}
