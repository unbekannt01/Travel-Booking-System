import { Shield, Building2, Check, Edit3, X, Landmark, FileText, Palette, Sparkles, Languages, LayoutTemplate } from "lucide-react"
import { useToast } from "../common/ToastContext"
import { DOCUMENT_LANGUAGES, getDocumentTranslation } from "../../i18n/documents"
import { TICKET_TEMPLATES } from "../tickets/ticketRegistry"

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
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">
          Settings
        </h2>
        <p className="text-slate-500 font-bold text-sm">
          Manage your account security and company branding
        </p>
      </div>

      {/* Security Settings */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-7 border-b border-slate-50 flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
            <Shield size={20} />
          </div>
          <h3 className="text-lg font-black text-slate-900">
            Security Settings
          </h3>
        </div>
        <div className="p-7 space-y-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h4 className="font-black text-slate-900 mb-1">
                Two-Factor Authentication (2FA)
              </h4>
              <p className="text-sm text-slate-500 font-medium">
                Add an extra layer of security by requiring a 6-digit
                code from Google Authenticator when logging in.
              </p>
              {user?.twoFactorEnabled && (
                <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                  <Check size={14} strokeWidth={3} /> Currently Enabled
                </span>
              )}
            </div>
            {user?.twoFactorEnabled ? (
              <button
                onClick={() => setShow2FADisable(true)}
                className="px-5 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-all"
              >
                Disable 2FA
              </button>
            ) : (
              <button
                onClick={() => setShow2FASetup(true)}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
              >
                Enable 2FA
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Company Settings */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-7 border-b border-slate-50 flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
            <Building2 size={20} />
          </div>
          <h3 className="text-lg font-black text-slate-900">
            Company Branding
          </h3>
        </div>
        <div className="p-7 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider">
                Company Name
              </label>
              <input
                type="text"
                value={companySettings.companyName}
                onChange={(e) =>
                  setCompanySettings({
                    ...companySettings,
                    companyName: e.target.value,
                  })
                }
                disabled={!isEditingCompany}
                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider">
                Tagline
              </label>
              <input
                type="text"
                value={companySettings.companyTagline}
                onChange={(e) =>
                  setCompanySettings({
                    ...companySettings,
                    companyTagline: e.target.value,
                  })
                }
                disabled={!isEditingCompany}
                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider">
                Headquarters
              </label>
              <input
                type="text"
                value={companySettings.companyHeadquarters}
                onChange={(e) =>
                  setCompanySettings({
                    ...companySettings,
                    companyHeadquarters: e.target.value,
                  })
                }
                disabled={!isEditingCompany}
                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider">
                Phone Number
              </label>
              <input
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
                  const value = formatIndianPhone(e.target.value)
                  setCompanySettings({
                    ...companySettings,
                    companyPhone: value,
                  })
                }}
                disabled={!isEditingCompany}
                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider">
                GST Number (Optional)
              </label>
              <input
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
                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm disabled:opacity-50 uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  Invoice Prefix
                </label>
                <input
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
                  className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm disabled:opacity-50 uppercase"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  Receipt Prefix
                </label>
                <input
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
                  className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm disabled:opacity-50 uppercase"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black text-slate-400 uppercase tracking-wider">
              Company Logo
            </label>
            <div className="flex items-center gap-4">
              {companySettings.companyLogo ? (
                <div className="relative group/logo">
                  <img
                    src={companySettings.companyLogo}
                    alt="Company Logo"
                    className="w-20 h-20 rounded-2xl object-contain border-2 border-slate-200 bg-white p-1"
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
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-black opacity-0 group-hover/logo:opacity-100 transition-all"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
              )}

              <div className="space-y-2">
                <label
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                    isEditingCompany
                      ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 cursor-pointer"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload Logo
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
                <p className="text-[10px] text-slate-400 font-bold">
                  PNG, JPG, SVG · Max 2 MB
                </p>
                {!isEditingCompany && (
                  <p className="text-[10px] text-slate-400 font-bold italic">
                    Click "Edit Company Info" to change logo
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider">
                Tour Organizers
              </label>
              {isEditingCompany && (
                <button
                  type="button"
                  onClick={() => {
                    const newOrganizers = [
                      ...(companySettings.organizers || []),
                    ]
                    newOrganizers.push({ name: "", phone: "" })
                    setCompanySettings({
                      ...companySettings,
                      organizers: newOrganizers,
                    })
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <span>+ Add Organizer</span>
                </button>
              )}
            </div>
            <div className="space-y-3">
              {(companySettings.organizers || []).map(
                (organizer, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <input
                      type="text"
                      placeholder="Organizer Name"
                      value={organizer.name}
                      onChange={(e) => {
                        const newOrganizers = [
                          ...(companySettings.organizers || []),
                        ]
                        newOrganizers[index].name = e.target.value
                        setCompanySettings({
                          ...companySettings,
                          organizers: newOrganizers,
                        })
                      }}
                      disabled={!isEditingCompany}
                      className="flex-1 px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm disabled:opacity-50"
                    />
                    <input
                      type="tel"
                      placeholder="+91 XXXXX XXXXX"
                      value={
                        organizer.phone ? `${organizer.phone}` : ""
                      }
                      onChange={(e) => {
                        const value = formatIndianPhone(e.target.value)
                        const newOrganizers = [
                          ...(companySettings.organizers || []),
                        ]
                        newOrganizers[index].phone = value
                        setCompanySettings({
                          ...companySettings,
                          organizers: newOrganizers,
                        })
                      }}
                      disabled={!isEditingCompany}
                      className="flex-1 px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm disabled:opacity-50"
                    />

                    {isEditingCompany && (
                      <button
                        type="button"
                        onClick={() => {
                          const newOrganizers = [
                            ...(companySettings.organizers || []),
                          ]
                          newOrganizers.splice(index, 1)
                          setCompanySettings({
                            ...companySettings,
                            organizers: newOrganizers,
                          })
                        }}
                        className="px-3 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                ),
              )}
              {(!companySettings.organizers ||
                companySettings.organizers.length === 0) && (
                <p className="text-sm text-slate-400 italic">
                  No organizers added yet
                </p>
              )}
            </div>
          </div>

          {/* Bank & UPI Payment Details */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <Landmark size={18} className="text-indigo-600" />
              <label className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Bank & UPI Payment Details (Printed on Invoices)
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  UPI ID (VPA)
                </label>
                <input
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
                  className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Account Holder Name
                </label>
                <input
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
                  className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Bank Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank, SBI"
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
                  className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Account Number
                </label>
                <input
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
                  className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  IFSC Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. HDFC0001234"
                  value={companySettings.bankDetails?.ifscCode || ""}
                  onChange={(e) =>
                    setCompanySettings({
                      ...companySettings,
                      bankDetails: {
                        ...companySettings.bankDetails,
                        ifscCode: e.target.value.toUpperCase(),
                      },
                    })
                  }
                  disabled={!isEditingCompany}
                  className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm disabled:opacity-50 uppercase"
                />
              </div>
            </div>
          </div>

          {/* Invoice & Receipt Theme & Accent Color */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <Palette size={18} className="text-indigo-600" />
              <label className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Invoice & Receipt Theme & Styling
              </label>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-5">
                {/* Theme selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Layout Theme
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "classic", label: "Classic", desc: "Formal boxed layout with clean borders" },
                      { id: "modern", label: "Modern", desc: "Vibrant header cards & pill badges" },
                      { id: "minimal", label: "Minimal", desc: "Refined monochrome with airy spacing" },
                    ].map((theme) => {
                      const isSelected = (companySettings.invoiceTheme || "classic") === theme.id
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          disabled={!isEditingCompany}
                          onClick={() => setCompanySettings({ ...companySettings, invoiceTheme: theme.id })}
                          className={`p-3.5 rounded-2xl border text-left transition-all ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-xs"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          } ${!isEditingCompany ? "opacity-70 cursor-default" : "cursor-pointer"}`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-black text-slate-900 capitalize">{theme.label}</span>
                            {isSelected && <Check size={14} className="text-indigo-600 font-bold" />}
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight font-medium">{theme.desc}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Accent Color picker */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Brand Accent Color
                  </label>
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
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                            isSelected
                              ? "border-slate-900 bg-slate-900 text-white shadow-xs"
                              : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                          } ${!isEditingCompany ? "opacity-70 cursor-default" : "cursor-pointer"}`}
                        >
                          <span className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: col.hex }} />
                          <span>{col.name}</span>
                        </button>
                      )
                    })}

                    {/* Custom color input */}
                    <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                      <input
                        type="color"
                        disabled={!isEditingCompany}
                        value={companySettings.invoiceColor || "#4f46e5"}
                        onChange={(e) => setCompanySettings({ ...companySettings, invoiceColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 p-0.5 bg-white disabled:opacity-50"
                        title="Pick custom color"
                      />
                      <span className="text-[11px] font-mono font-bold text-slate-500 uppercase">
                        {companySettings.invoiceColor || "#4f46e5"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Default Document Language */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Languages size={14} className="text-indigo-600" />
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                      Default Customer Document Language
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {DOCUMENT_LANGUAGES.map((lang) => {
                      const isSelected = (companySettings.documentLanguage || "en") === lang.code
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          disabled={!isEditingCompany}
                          onClick={() => setCompanySettings({ ...companySettings, documentLanguage: lang.code })}
                          className={`px-3 py-2 rounded-xl border text-left transition-all ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          } ${!isEditingCompany ? "opacity-70 cursor-default" : "cursor-pointer"}`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-black text-slate-900">{lang.native}</span>
                            {isSelected && <Check size={12} className="text-indigo-600 font-bold" />}
                          </div>
                          <span className="text-[10px] font-semibold text-slate-500">{lang.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Default language for customer invoices, payment receipts, and QR boarding passes.
                  </p>
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="lg:col-span-5 bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Live Template Preview
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                      {DOCUMENT_LANGUAGES.find((l) => l.code === (companySettings.documentLanguage || "en"))?.native || "English"}
                    </span>
                    <span
                      className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: companySettings.invoiceColor || "#4f46e5" }}
                    >
                      {companySettings.invoiceTheme || "classic"}
                    </span>
                  </div>
                </div>

                {/* Mini Mock Invoice */}
                {(() => {
                  const previewT = getDocumentTranslation(companySettings.documentLanguage || "en")
                  return (
                    <div
                      className={`bg-white rounded-xl shadow-xs overflow-hidden border ${
                        (companySettings.invoiceTheme || "classic") === "classic"
                          ? "border-slate-300"
                          : (companySettings.invoiceTheme || "classic") === "modern"
                            ? "border-indigo-100 shadow-md"
                            : "border-slate-100"
                      }`}
                    >
                      {/* Mock Header */}
                      <div
                        className={`p-3 text-white ${
                          (companySettings.invoiceTheme || "classic") === "minimal"
                            ? "!bg-white !text-slate-900 border-b border-slate-200"
                            : ""
                        }`}
                        style={{
                          backgroundColor:
                            (companySettings.invoiceTheme || "classic") === "minimal"
                              ? undefined
                              : companySettings.invoiceColor || "#4f46e5",
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-xs font-black tracking-tight">
                              {companySettings.companyName || "Yatra Tours"}
                            </p>
                            <p className={`text-[9px] font-medium opacity-80 ${(companySettings.invoiceTheme || "classic") === "minimal" ? "!text-slate-400" : ""}`}>
                              {companySettings.companyTagline || "Tourism & Travels"}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                              (companySettings.invoiceTheme || "classic") === "minimal"
                                ? "bg-slate-100 text-slate-700"
                                : "bg-white/20 text-white"
                            }`}>
                              #{companySettings.invoicePrefix || "YHB"}-SAMPLE
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Mock Content */}
                      <div className="p-3 space-y-2 text-[10px]">
                        <div className="flex justify-between text-slate-500 font-bold border-b border-slate-100 pb-1">
                          <span>{previewT.tourName}: Kedarnath Yatra</span>
                          <span>{previewT.journeyDate}: 25 Oct 2026</span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between font-medium text-slate-700">
                            <span>1. Ramesh Patel ({previewT.seat} L-1)</span>
                            <span>₹4,500</span>
                          </div>
                          <div className="flex justify-between font-medium text-slate-700">
                            <span>2. Sarita Patel ({previewT.seat} L-2)</span>
                            <span>₹4,500</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                          <span className="font-bold text-slate-500">{previewT.balancePayable}</span>
                          <span
                            className="font-black text-xs px-2 py-0.5 rounded-lg text-white"
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
          </div>

          {/* Ticket & Boarding Pass Design Template */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutTemplate size={18} className="text-indigo-600" />
                <label className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Ticket & Boarding Pass Design Template
                </label>
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                Applied automatically to all customer boarding passes
              </span>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {TICKET_TEMPLATES.map((tmpl) => {
                  const isSelected = (companySettings.ticketTemplate || "classic") === tmpl.id
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      disabled={!isEditingCompany}
                      onClick={() => setCompanySettings({ ...companySettings, ticketTemplate: tmpl.id })}
                      className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      } ${!isEditingCompany ? "opacity-75 cursor-default" : "cursor-pointer"}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: tmpl.accentDefault }}
                          />
                          <span className="text-xs font-black text-slate-900">{tmpl.name}</span>
                        </div>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                          {tmpl.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed mb-3">
                        {tmpl.description}
                      </p>
                      <div className="flex items-center justify-between text-[10px] pt-2 border-t border-slate-100">
                        <span className="text-slate-400 font-bold">{tmpl.previewStyle}</span>
                        {isSelected && (
                          <span className="flex items-center gap-1 font-black text-indigo-600">
                            <Check size={12} strokeWidth={3} /> Selected
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" />
                <label className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Terms & Conditions (Printed on Invoices)
                </label>
              </div>
              {isEditingCompany && (
                <button
                  type="button"
                  onClick={() => {
                    const newTC = [...(companySettings.termsAndConditions || [])]
                    newTC.push("")
                    setCompanySettings({
                      ...companySettings,
                      termsAndConditions: newTC,
                    })
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <span>+ Add Policy Line</span>
                </button>
              )}
            </div>
            <div className="space-y-2">
              {(companySettings.termsAndConditions || []).map((term, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <span className="text-xs font-black text-slate-400 w-5 text-right">{index + 1}.</span>
                  <input
                    type="text"
                    placeholder="Enter policy statement"
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
                    className="flex-1 px-4 py-2.5 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-medium text-xs disabled:opacity-50"
                  />
                  {isEditingCompany && (
                    <button
                      type="button"
                      onClick={() => {
                        const newTC = [...(companySettings.termsAndConditions || [])]
                        newTC.splice(index, 1)
                        setCompanySettings({
                          ...companySettings,
                          termsAndConditions: newTC,
                        })
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              {(!companySettings.termsAndConditions || companySettings.termsAndConditions.length === 0) && (
                <p className="text-xs text-slate-400 italic">No terms configured</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
            {isEditingCompany ? (
              <>
                <button
                  type="button"
                  onClick={() => {
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
                  }}
                  className="px-5 py-2.5 text-slate-500 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateCompany}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
                >
                  <Check size={18} strokeWidth={3} />
                  Save Changes
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingCompany(true)}
                className="px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-all flex items-center gap-2"
              >
                <Edit3 size={18} />
                Edit Company Info
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
