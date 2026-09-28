import { Shield, Building2, Check, Edit3, X } from "lucide-react"
import { useToast } from "../common/ToastContext"

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

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
            {isEditingCompany ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingCompany(false)
                    setCompanySettings({
                      companyName: user?.companyName || "XYZ Tourism",
                      companyTagline:
                        user?.companyTagline || "Tourism & Travels",
                      companyHeadquarters:
                        user?.companyHeadquarters ||
                        "City, State, 123456",
                      companyPhone:
                        user?.companyPhone || "+91 98765 43210",
                      companyLogo: user?.companyLogo || "",
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
