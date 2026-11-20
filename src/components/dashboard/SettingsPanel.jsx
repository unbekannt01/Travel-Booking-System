import { useState, lazy, Suspense } from "react"
import {
  Building2,
  Palette,
  Landmark,
  Languages,
  LayoutTemplate,
  FileText,
  Shield,
  Check,
  Edit3,
  X,
  Plus,
  Trash2,
  Upload,
  Sparkles,
} from "lucide-react"
import { useToast } from "../common/ToastContext"
import { DOCUMENT_LANGUAGES, getDocumentTranslation } from "../../i18n/documents"
import { TICKET_TEMPLATES } from "../tickets/ticketRegistry"
import {
  Tabs,
  Button,
  IconButton,
  Input,
  Field,
  Card,
  Badge,
  Spinner,
} from "../ui/index"
import { cn } from "../../utils/cn"

const InvoiceStudio = lazy(() => import("./InvoiceStudio"))

export default function SettingsPanel({
  user,
  companySettings,
  setCompanySettings,
  isEditingCompany,
  setIsEditingCompany,
  handleUpdateCompany,
  setShow2FASetup,
  setShow2FADisable,
  formatIndianPhone,
}) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("company")

  const handleDiscard = () => {
    setIsEditingCompany(false)
    setCompanySettings({
      companyName: user?.companyName || "Yatra Tours",
      companyTagline: user?.companyTagline || "Tourism & Travels",
      companyHeadquarters: user?.companyHeadquarters || "",
      companyPhone: user?.companyPhone || "",
      companyLogo: user?.companyLogo || "",
      gstNumber: user?.gstNumber || "",
      invoicePrefix: user?.invoicePrefix || "YHB",
      receiptPrefix: user?.receiptPrefix || "REC",
      invoiceTheme: user?.invoiceTheme || "classic",
      invoiceColor: user?.invoiceColor || "#4f46e5",
      documentLanguage: user?.documentLanguage || "en",
      ticketTemplate: user?.ticketTemplate || "classic",
      termsAndConditions: user?.termsAndConditions || [
        "Valid Aadhar card is strictly required for all travelers.",
        "Advance payment is non-refundable upon confirmation.",
        "Final balance must be settled 24 hours prior to departure.",
        "Company is not liable for itinerary changes due to weather.",
      ],
      bankDetails: user?.bankDetails || {
        accountName: "",
        accountNumber: "",
        ifscCode: "",
        bankName: "",
        upiId: "",
      },
      organizers: user?.organizers || [],
    })
  }

  // Define tab items with accessible content
  const tabItems = [
    {
      id: "company",
      label: "Company",
      icon: <Building2 size={16} />,
      content: (
        <Card elevation="sm" className="p-6 space-y-6 rounded-2xl">
          <div className="flex items-center justify-between border-b border-(--yh-border-subtle) pb-4">
            <div>
              <h3 className="font-bold text-base text-(--yh-text-primary)">
                Company Profile & Identifiers
              </h3>
              <p className="text-xs text-(--yh-text-muted) mt-0.5">
                Legal business name, contact info, GST, and invoice number sequences
              </p>
            </div>
            {!isEditingCompany && (
              <Button
                variant="outline"
                size="sm"
                icon={<Edit3 size={15} />}
                onClick={() => setIsEditingCompany(true)}
              >
                Edit Info
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Company / Agency Name" required>
              <Input
                type="text"
                value={companySettings.companyName || ""}
                onChange={(e) =>
                  setCompanySettings({
                    ...companySettings,
                    companyName: e.target.value,
                  })
                }
                disabled={!isEditingCompany}
                placeholder="e.g. Shree Ram Travels"
              />
            </Field>

            <Field label="Tagline / Subtitle">
              <Input
                type="text"
                value={companySettings.companyTagline || ""}
                onChange={(e) =>
                  setCompanySettings({
                    ...companySettings,
                    companyTagline: e.target.value,
                  })
                }
                disabled={!isEditingCompany}
                placeholder="e.g. Tourism & Pilgrim Yatra Services"
              />
            </Field>

            <Field label="Headquarters / City">
              <Input
                type="text"
                value={companySettings.companyHeadquarters || ""}
                onChange={(e) =>
                  setCompanySettings({
                    ...companySettings,
                    companyHeadquarters: e.target.value,
                  })
                }
                disabled={!isEditingCompany}
                placeholder="e.g. Surat, Gujarat"
              />
            </Field>

            <Field label="Primary Contact Phone">
              <Input
                type="tel"
                placeholder="+91 XXXXX XXXXX"
                value={
                  companySettings.companyPhone
                    ? companySettings.companyPhone.startsWith("+91")
                      ? companySettings.companyPhone
                      : `+91 ${companySettings.companyPhone}`
                    : ""
                }
                onChange={(e) => {
                  const value = formatIndianPhone ? formatIndianPhone(e.target.value) : e.target.value
                  setCompanySettings({
                    ...companySettings,
                    companyPhone: value,
                  })
                }}
                disabled={!isEditingCompany}
              />
            </Field>

            <Field label="GST Number (Optional)">
              <Input
                type="text"
                placeholder="e.g. 24AAAAA0000A1Z5"
                value={companySettings.gstNumber || ""}
                onChange={(e) =>
                  setCompanySettings({
                    ...companySettings,
                    gstNumber: e.target.value.toUpperCase().trim(),
                  })
                }
                disabled={!isEditingCompany}
                className="uppercase font-mono"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Invoice Prefix">
                <Input
                  type="text"
                  placeholder="YHB"
                  value={companySettings.invoicePrefix || "YHB"}
                  onChange={(e) =>
                    setCompanySettings({
                      ...companySettings,
                      invoicePrefix: e.target.value.toUpperCase().trim(),
                    })
                  }
                  disabled={!isEditingCompany}
                  className="uppercase font-mono"
                />
              </Field>
              <Field label="Receipt Prefix">
                <Input
                  type="text"
                  placeholder="REC"
                  value={companySettings.receiptPrefix || "REC"}
                  onChange={(e) =>
                    setCompanySettings({
                      ...companySettings,
                      receiptPrefix: e.target.value.toUpperCase().trim(),
                    })
                  }
                  disabled={!isEditingCompany}
                  className="uppercase font-mono"
                />
              </Field>
            </div>
          </div>

          {/* Tour Organizers Section */}
          <div className="pt-5 border-t border-(--yh-border-subtle) space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm text-(--yh-text-primary)">
                  Tour Coordinators & Organizers
                </h4>
                <p className="text-xs text-(--yh-text-muted)">
                  Staff contacts printed on tickets and invoices for passenger support
                </p>
              </div>
              {isEditingCompany && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => {
                    const newOrganizers = [...(companySettings.organizers || [])]
                    newOrganizers.push({ name: "", phone: "" })
                    setCompanySettings({
                      ...companySettings,
                      organizers: newOrganizers,
                    })
                  }}
                >
                  Add Coordinator
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {(companySettings.organizers || []).map((organizer, index) => (
                <div key={index} className="flex gap-3 items-center">
                  <Input
                    type="text"
                    placeholder="Organizer / Coordinator Name"
                    value={organizer.name}
                    onChange={(e) => {
                      const newOrganizers = [...(companySettings.organizers || [])]
                      newOrganizers[index].name = e.target.value
                      setCompanySettings({
                        ...companySettings,
                        organizers: newOrganizers,
                      })
                    }}
                    disabled={!isEditingCompany}
                    className="flex-1"
                  />
                  <Input
                    type="tel"
                    placeholder="+91 XXXXX XXXXX"
                    value={organizer.phone || ""}
                    onChange={(e) => {
                      const value = formatIndianPhone ? formatIndianPhone(e.target.value) : e.target.value
                      const newOrganizers = [...(companySettings.organizers || [])]
                      newOrganizers[index].phone = value
                      setCompanySettings({
                        ...companySettings,
                        organizers: newOrganizers,
                      })
                    }}
                    disabled={!isEditingCompany}
                    className="flex-1"
                  />
                  {isEditingCompany && (
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={16} className="text-(--yh-danger)" />}
                      label="Remove coordinator"
                      onClick={() => {
                        const newOrganizers = [...(companySettings.organizers || [])]
                        newOrganizers.splice(index, 1)
                        setCompanySettings({
                          ...companySettings,
                          organizers: newOrganizers,
                        })
                      }}
                    />
                  )}
                </div>
              ))}
              {(!companySettings.organizers || companySettings.organizers.length === 0) && (
                <p className="text-xs text-(--yh-text-muted) italic py-2">
                  No organizers added yet. Click &quot;Add Coordinator&quot; to add tour staff.
                </p>
              )}
            </div>
          </div>
        </Card>
      ),
    },
    {
      id: "branding",
      label: "Branding",
      icon: <Palette size={16} />,
      content: (
        <Card elevation="sm" className="p-6 space-y-6 rounded-2xl">
          <div className="border-b border-(--yh-border-subtle) pb-4">
            <h3 className="font-bold text-base text-(--yh-text-primary)">
              Visual Identity & Document Styling
            </h3>
            <p className="text-xs text-(--yh-text-muted) mt-0.5">
              Company logo and primary accent colors for printed vouchers and documents
            </p>
          </div>

          {/* Logo Upload & Preview */}
          <div className="space-y-3">
            <span className="block text-xs font-semibold text-(--yh-text-primary)">
              Company Logo
            </span>
            <div className="flex items-center gap-5">
              {companySettings.companyLogo ? (
                <div className="relative group/logo">
                  <img
                    src={companySettings.companyLogo}
                    alt="Company Logo"
                    className="w-20 h-20 rounded-2xl object-contain border border-(--yh-border-subtle) bg-(--yh-surface) p-1"
                  />
                  {isEditingCompany && (
                    <button
                      type="button"
                      onClick={() =>
                        setCompanySettings({
                          ...companySettings,
                          companyLogo: "",
                        })
                      }
                      className="absolute -top-2 -right-2 bg-(--yh-danger) text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-xs hover:opacity-90"
                      title="Remove Logo"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-(--yh-border-subtle) bg-(--yh-surface-muted) flex items-center justify-center text-(--yh-text-muted)">
                  <Upload size={24} />
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
                    isEditingCompany
                      ? "bg-(--yh-brand) text-white hover:opacity-90 cursor-pointer shadow-xs"
                      : "bg-(--yh-surface-muted) text-(--yh-text-muted) cursor-not-allowed",
                  )}
                >
                  <Upload size={14} />
                  <span>Choose Image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                    disabled={!isEditingCompany}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 2 * 1024 * 1024) {
                        toast.error("Logo file must be under 2 MB")
                        return
                      }
                      const reader = new FileReader()
                      reader.onloadend = () => {
                        setCompanySettings({
                          ...companySettings,
                          companyLogo: reader.result,
                        })
                      }
                      reader.readAsDataURL(file)
                    }}
                  />
                </label>
                <p className="text-[11px] text-(--yh-text-muted)">
                  PNG, JPG, SVG, WebP · Max 2 MB
                </p>
              </div>
            </div>
          </div>

          {/* Document Layout Theme */}
          <div className="space-y-3 pt-5 border-t border-(--yh-border-subtle)">
            <span className="block text-xs font-semibold text-(--yh-text-primary)">
              Invoice Layout Structure
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: "classic", label: "Classic", desc: "Formal boxed layout with clean borders" },
                { id: "modern", label: "Modern", desc: "Header banner with pill status tags" },
                { id: "minimal", label: "Minimal", desc: "Monochrome layout with airy typography" },
              ].map((theme) => {
                const isSelected = (companySettings.invoiceTheme || "classic") === theme.id
                return (
                  <button
                    key={theme.id}
                    type="button"
                    disabled={!isEditingCompany}
                    onClick={() => setCompanySettings({ ...companySettings, invoiceTheme: theme.id })}
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all",
                      isSelected
                        ? "border-(--yh-brand) bg-(--yh-brand)/5 ring-1 ring-(--yh-brand)"
                        : "border-(--yh-border-subtle) bg-(--yh-surface) hover:border-(--yh-border-strong)",
                      !isEditingCompany ? "cursor-default opacity-80" : "cursor-pointer",
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-(--yh-text-primary)">{theme.label}</span>
                      {isSelected && <Check size={14} className="text-(--yh-brand)" />}
                    </div>
                    <p className="text-[11px] text-(--yh-text-muted) leading-snug">{theme.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Accent Color Picker */}
          <div className="space-y-3 pt-5 border-t border-(--yh-border-subtle)">
            <span className="block text-xs font-semibold text-(--yh-text-primary)">
              Document Brand Accent Color
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              {[
                { name: "Indigo", hex: "#4f46e5" },
                { name: "Sky", hex: "#0284c7" },
                { name: "Emerald", hex: "#059669" },
                { name: "Amber", hex: "#d97706" },
                { name: "Rose", hex: "#e11d48" },
                { name: "Slate", hex: "#334155" },
              ].map((col) => {
                const isSelected = (companySettings.invoiceColor || "#4f46e5").toLowerCase() === col.hex.toLowerCase()
                return (
                  <button
                    key={col.hex}
                    type="button"
                    disabled={!isEditingCompany}
                    onClick={() => setCompanySettings({ ...companySettings, invoiceColor: col.hex })}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all",
                      isSelected
                        ? "border-(--yh-text-primary) bg-(--yh-surface-muted) text-(--yh-text-primary) shadow-xs"
                        : "border-(--yh-border-subtle) bg-(--yh-surface) text-(--yh-text-muted) hover:border-(--yh-border-strong)",
                      !isEditingCompany ? "cursor-default opacity-70" : "cursor-pointer",
                    )}
                  >
                    <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: col.hex }} />
                    <span>{col.name}</span>
                  </button>
                )
              })}

              <div className="flex items-center gap-2 pl-3 border-l border-(--yh-border-subtle)">
                <input
                  type="color"
                  disabled={!isEditingCompany}
                  value={companySettings.invoiceColor || "#4f46e5"}
                  onChange={(e) => setCompanySettings({ ...companySettings, invoiceColor: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-(--yh-border-subtle) p-0.5 bg-(--yh-surface) disabled:opacity-50"
                  title="Pick custom hex color"
                />
                <span className="text-xs font-mono font-semibold text-(--yh-text-muted) uppercase">
                  {companySettings.invoiceColor || "#4f46e5"}
                </span>
              </div>
            </div>
          </div>
        </Card>
      ),
    },
    {
      id: "bank",
      label: "Bank & UPI",
      icon: <Landmark size={16} />,
      content: (
        <Card elevation="sm" className="p-6 space-y-6 rounded-2xl">
          <div className="border-b border-(--yh-border-subtle) pb-4">
            <h3 className="font-bold text-base text-(--yh-text-primary)">
              Settlement & UPI Account Information
            </h3>
            <p className="text-xs text-(--yh-text-muted) mt-0.5">
              These details are printed on invoices so customers can pay via NEFT/IMPS or UPI QR code
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="UPI ID (VPA)" hint="Printed for quick QR scan / UPI app transfers">
              <Input
                type="text"
                placeholder="e.g. operator@okhdfcbank"
                value={companySettings.bankDetails?.upiId || ""}
                onChange={(e) =>
                  setCompanySettings({
                    ...companySettings,
                    bankDetails: {
                      ...companySettings.bankDetails,
                      upiId: e.target.value,
                    },
                  })
                }
                disabled={!isEditingCompany}
              />
            </Field>

            <Field label="Account Holder / Beneficiary Name">
              <Input
                type="text"
                placeholder="Business / Proprietor Name"
                value={companySettings.bankDetails?.accountName || ""}
                onChange={(e) =>
                  setCompanySettings({
                    ...companySettings,
                    bankDetails: {
                      ...companySettings.bankDetails,
                      accountName: e.target.value,
                    },
                  })
                }
                disabled={!isEditingCompany}
              />
            </Field>

            <Field label="Bank Name">
              <Input
                type="text"
                placeholder="e.g. HDFC Bank, SBI, ICICI"
                value={companySettings.bankDetails?.bankName || ""}
                onChange={(e) =>
                  setCompanySettings({
                    ...companySettings,
                    bankDetails: {
                      ...companySettings.bankDetails,
                      bankName: e.target.value,
                    },
                  })
                }
                disabled={!isEditingCompany}
              />
            </Field>

            <Field label="Account Number">
              <Input
                type="text"
                placeholder="Bank Account Number"
                value={companySettings.bankDetails?.accountNumber || ""}
                onChange={(e) =>
                  setCompanySettings({
                    ...companySettings,
                    bankDetails: {
                      ...companySettings.bankDetails,
                      accountNumber: e.target.value,
                    },
                  })
                }
                disabled={!isEditingCompany}
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="IFSC Code">
                <Input
                  type="text"
                  placeholder="e.g. HDFC0001234"
                  value={companySettings.bankDetails?.ifscCode || ""}
                  onChange={(e) =>
                    setCompanySettings({
                      ...companySettings,
                      bankDetails: {
                        ...companySettings.bankDetails,
                        ifscCode: e.target.value.toUpperCase().trim(),
                      },
                    })
                  }
                  disabled={!isEditingCompany}
                  className="uppercase font-mono"
                />
              </Field>
            </div>
          </div>
        </Card>
      ),
    },
    {
      id: "documents",
      label: "Documents",
      icon: <Languages size={16} />,
      content: (
        <Card elevation="sm" className="p-6 space-y-6 rounded-2xl">
          <div className="border-b border-(--yh-border-subtle) pb-4">
            <h3 className="font-bold text-base text-(--yh-text-primary)">
              Customer Document Language & Live Preview
            </h3>
            <p className="text-xs text-(--yh-text-muted) mt-0.5">
              Configure multilingual translations and preview printed invoices
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 space-y-4">
              <span className="block text-xs font-semibold text-(--yh-text-primary)">
                Default Document Language
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {DOCUMENT_LANGUAGES.map((lang) => {
                  const isSelected = (companySettings.documentLanguage || "en") === lang.code
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      disabled={!isEditingCompany}
                      onClick={() => setCompanySettings({ ...companySettings, documentLanguage: lang.code })}
                      className={cn(
                        "px-4 py-3 rounded-xl border text-left transition-all",
                        isSelected
                          ? "border-(--yh-brand) bg-(--yh-brand)/5 ring-1 ring-(--yh-brand)"
                          : "border-(--yh-border-subtle) bg-(--yh-surface) hover:border-(--yh-border-strong)",
                        !isEditingCompany ? "cursor-default opacity-80" : "cursor-pointer",
                      )}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-(--yh-text-primary)">{lang.native}</span>
                        {isSelected && <Check size={14} className="text-(--yh-brand)" />}
                      </div>
                      <span className="text-[11px] text-(--yh-text-muted)">{lang.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-(--yh-text-muted) leading-relaxed">
                Applied as the primary document language across customer invoices, payment receipts, and QR boarding passes.
              </p>
            </div>

            {/* Live Mock Invoice Preview */}
            <div className="lg:col-span-6 p-4 rounded-xl bg-(--yh-surface-muted) border border-(--yh-border-subtle) space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-(--yh-text-muted) uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={13} className="text-(--yh-brand)" />
                  Mini Mock Invoice Preview
                </span>
                <Badge variant="neutral" size="sm">
                  {DOCUMENT_LANGUAGES.find((l) => l.code === (companySettings.documentLanguage || "en"))?.native || "English"}
                </Badge>
              </div>

              {(() => {
                const previewT = getDocumentTranslation(companySettings.documentLanguage || "en")
                const isMinimal = (companySettings.invoiceTheme || "classic") === "minimal"
                return (
                  <div
                    className={cn(
                      "bg-white text-slate-900 rounded-xl overflow-hidden border shadow-xs text-xs",
                      (companySettings.invoiceTheme || "classic") === "classic"
                        ? "border-slate-300"
                        : (companySettings.invoiceTheme || "classic") === "modern"
                          ? "border-indigo-100 shadow-md"
                          : "border-slate-200",
                    )}
                  >
                    <div
                      className={cn("p-3", isMinimal ? "bg-white text-slate-900 border-b border-slate-200" : "text-white")}
                      style={{
                        backgroundColor: isMinimal ? undefined : companySettings.invoiceColor || "#4f46e5",
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-xs">{companySettings.companyName || "Yatra Tours"}</p>
                          <p className="text-[10px] opacity-80">{companySettings.companyTagline || "Tourism & Travels"}</p>
                        </div>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-black/15 font-bold uppercase">
                          #{companySettings.invoicePrefix || "YHB"}-PREVIEW
                        </span>
                      </div>
                    </div>

                    <div className="p-3 space-y-2 text-[11px]">
                      <div className="flex justify-between text-slate-500 font-medium border-b border-slate-100 pb-1">
                        <span>{previewT.tourName}: Char Dham Yatra</span>
                        <span>{previewT.journeyDate}: 15 May 2026</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-slate-700 font-medium">
                          <span>1. Ramesh Patel ({previewT.seat} L-1)</span>
                          <span>₹4,500</span>
                        </div>
                        <div className="flex justify-between text-slate-700 font-medium">
                          <span>2. Sarita Patel ({previewT.seat} L-2)</span>
                          <span>₹4,500</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex justify-between items-center font-bold">
                        <span className="text-slate-500">{previewT.balancePayable}</span>
                        <span
                          className="px-2 py-0.5 rounded text-white text-xs font-bold"
                          style={{ backgroundColor: companySettings.invoiceColor || "#4f46e5" }}
                        >
                          ₹3,000
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </Card>
      ),
    },
    {
      id: "studio",
      label: "Invoice Studio",
      icon: <Sparkles size={16} />,
      content: (
        <Suspense
          fallback={
            <div className="flex h-96 items-center justify-center">
              <Spinner size="lg" />
            </div>
          }
        >
          <InvoiceStudio user={user} />
        </Suspense>
      ),
    },
    {
      id: "tickets",
      label: "Ticket Templates",
      icon: <LayoutTemplate size={16} />,
      content: (
        <Card elevation="sm" className="p-6 space-y-6 rounded-2xl">
          <div className="border-b border-(--yh-border-subtle) pb-4">
            <h3 className="font-bold text-base text-(--yh-text-primary)">
              Ticket & Boarding Pass Design
            </h3>
            <p className="text-xs text-(--yh-text-muted) mt-0.5">
              Select the layout style used for customer boarding passes and tickets
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TICKET_TEMPLATES.map((tmpl) => {
              const isSelected = (companySettings.ticketTemplate || "classic") === tmpl.id
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  disabled={!isEditingCompany}
                  onClick={() => setCompanySettings({ ...companySettings, ticketTemplate: tmpl.id })}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between",
                    isSelected
                      ? "border-(--yh-brand) bg-(--yh-brand)/5 ring-1 ring-(--yh-brand)"
                      : "border-(--yh-border-subtle) bg-(--yh-surface) hover:border-(--yh-border-strong)",
                    !isEditingCompany ? "cursor-default opacity-80" : "cursor-pointer",
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tmpl.accentDefault }}
                        />
                        <span className="text-xs font-bold text-(--yh-text-primary)">{tmpl.name}</span>
                      </div>
                      <Badge variant="neutral" size="sm">{tmpl.badge}</Badge>
                    </div>
                    <p className="text-[11px] text-(--yh-text-muted) leading-relaxed">
                      {tmpl.description}
                    </p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-(--yh-border-subtle) flex items-center justify-between text-[11px]">
                    <span className="text-(--yh-text-muted) font-medium">{tmpl.previewStyle}</span>
                    {isSelected && (
                      <span className="flex items-center gap-1 font-bold text-(--yh-brand)">
                        <Check size={13} /> Selected
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </Card>
      ),
    },
    {
      id: "terms",
      label: "Terms & Conditions",
      icon: <FileText size={16} />,
      content: (
        <Card elevation="sm" className="p-6 space-y-6 rounded-2xl">
          <div className="flex items-center justify-between border-b border-(--yh-border-subtle) pb-4">
            <div>
              <h3 className="font-bold text-base text-(--yh-text-primary)">
                Booking Terms & Conditions
              </h3>
              <p className="text-xs text-(--yh-text-muted) mt-0.5">
                Printed policy statements appearing at the bottom of customer invoices and vouchers
              </p>
            </div>
            {isEditingCompany && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => {
                  const newTC = [...(companySettings.termsAndConditions || [])]
                  newTC.push("")
                  setCompanySettings({
                    ...companySettings,
                    termsAndConditions: newTC,
                  })
                }}
              >
                Add Policy Line
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {(companySettings.termsAndConditions || []).map((term, index) => (
              <div key={index} className="flex gap-2 items-center">
                <span className="text-xs font-bold text-(--yh-text-muted) w-6 text-right shrink-0">
                  {index + 1}.
                </span>
                <Input
                  type="text"
                  placeholder="Enter policy rule or requirement"
                  value={term}
                  onChange={(e) => {
                    const newTC = [...(companySettings.termsAndConditions || [])]
                    newTC[index] = e.target.value
                    setCompanySettings({
                      ...companySettings,
                      termsAndConditions: newTC,
                    })
                  }}
                  disabled={!isEditingCompany}
                  className="flex-1 text-xs"
                />
                {isEditingCompany && (
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<X size={15} />}
                    label="Remove policy"
                    onClick={() => {
                      const newTC = [...(companySettings.termsAndConditions || [])]
                      newTC.splice(index, 1)
                      setCompanySettings({
                        ...companySettings,
                        termsAndConditions: newTC,
                      })
                    }}
                  />
                )}
              </div>
            ))}
            {(!companySettings.termsAndConditions || companySettings.termsAndConditions.length === 0) && (
              <p className="text-xs text-(--yh-text-muted) italic py-2">
                No terms configured yet. Click &quot;Add Policy Line&quot; to define booking conditions.
              </p>
            )}
          </div>
        </Card>
      ),
    },
    {
      id: "security",
      label: "Security",
      icon: <Shield size={16} />,
      content: (
        <Card elevation="sm" className="p-6 space-y-6 rounded-2xl">
          <div className="border-b border-(--yh-border-subtle) pb-4">
            <h3 className="font-bold text-base text-(--yh-text-primary)">
              Account Security & Two-Factor Authentication
            </h3>
            <p className="text-xs text-(--yh-text-muted) mt-0.5">
              Protect your operator account with authenticator-based 2FA login verification
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-(--yh-surface-muted) border border-(--yh-border-subtle)">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-(--yh-text-primary)">
                  Two-Factor Authentication (TOTP)
                </h4>
                {user?.twoFactorEnabled ? (
                  <Badge variant="success" size="sm">Enabled</Badge>
                ) : (
                  <Badge variant="warning" size="sm">Disabled</Badge>
                )}
              </div>
              <p className="text-xs text-(--yh-text-muted) max-w-lg leading-relaxed">
                Requires a time-based 6-digit one-time code from Google Authenticator, Authy, or compatible TOTP app on sign in.
              </p>
            </div>

            <div className="shrink-0">
              {user?.twoFactorEnabled ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShow2FADisable && setShow2FADisable(true)}
                  className="text-(--yh-danger) hover:border-(--yh-danger)"
                >
                  Disable 2FA
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShow2FASetup && setShow2FASetup(true)}
                >
                  Enable 2FA
                </Button>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-(--yh-border-subtle) text-xs text-(--yh-text-muted) flex items-center justify-between">
            <span>Signed in as: <strong className="text-(--yh-text-primary)">{user?.username || user?.email || "Operator"}</strong></span>
            <span>Role: <strong className="text-(--yh-text-primary)">{user?.role || "Administrator"}</strong></span>
          </div>
        </Card>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Top Header / Mode Bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-(--yh-text-muted)">
          Configure company branding, settlement bank accounts, templates, and 2FA.
        </p>
        {!isEditingCompany && (
          <Button
            variant="outline"
            size="sm"
            icon={<Edit3 size={15} />}
            onClick={() => setIsEditingCompany(true)}
          >
            Edit Settings
          </Button>
        )}
      </div>

      {/* Tabs Layout */}
      <Tabs
        items={tabItems}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="Settings Navigation"
      />

      {/* Sticky Save / Discard Bar when Editing */}
      {isEditingCompany && (
        <div className="sticky bottom-4 z-20 flex items-center justify-between p-4 bg-(--yh-surface) border border-(--yh-border-strong) rounded-2xl shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-(--yh-warning) animate-pulse" />
            <span className="text-xs font-semibold text-(--yh-text-primary)">
              You have unsaved changes
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Check size={16} />}
              onClick={handleUpdateCompany}
            >
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
