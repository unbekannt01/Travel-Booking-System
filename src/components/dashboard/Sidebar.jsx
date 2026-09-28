import {
  Bus,
  Users,
  LayoutDashboard,
  TrendingUp,
  MapPin,
  X,
  LogOut,
  Edit2,
  Check,
  SettingsIcon,
} from "lucide-react"

export default function Sidebar({
  user,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  isEditingName,
  setIsEditingName,
  newUserName,
  setNewUserName,
  handleUpdateName,
  activeTab,
  setActiveTab,
  onLogout,
  bookings = [],
}) {
  const totalRevenue = bookings.reduce((acc, b) => acc + (b.totalAmount || 0), 0)

  const navItems = [
    {
      id: "dashboard",
      icon: <LayoutDashboard size={18} />,
      label: "Overview",
    },
    { id: "passengers", icon: <Users size={18} />, label: "Travelers" },
    {
      id: "journey",
      icon: <MapPin size={18} />,
      label: "Journeys",
    },
    { id: "tours", icon: <Bus size={18} />, label: "Destinations" },
    {
      id: "analytics",
      icon: <TrendingUp size={18} />,
      label: "Analytics",
    },
    {
      id: "settings",
      icon: <SettingsIcon size={18} />,
      label: "Settings",
    },
  ]

  return (
    <aside
      className={`
      fixed inset-y-0 left-0 z-40 w-72 bg-white transform transition-all duration-300 lg:relative lg:translate-x-0 flex flex-col border-r border-slate-200/60
      ${
        isMobileMenuOpen
          ? "translate-x-0 shadow-2xl"
          : "-translate-x-full lg:translate-x-0"
      }
    `}
    >
      <div className="p-8 hidden lg:block">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2.5 rounded-2xl text-white shadow-xl shadow-primary/20 rotate-3 group-hover:rotate-0 transition-transform">
            <Bus size={24} strokeWidth={2.5} />
          </div>
          <div className="group/name relative">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="font-black text-xl tracking-tight leading-none text-slate-900 bg-slate-50 border-none rounded p-1 outline-none w-40 focus:ring-2 focus:ring-primary/20"
                  autoFocus
                  onBlur={() => !newUserName.trim() && setIsEditingName(false)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateName()}
                />
                <button
                  onClick={handleUpdateName}
                  className="text-green-500 hover:text-green-600 transition-colors"
                >
                  <Check size={18} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div>
                  <h1 className="font-black text-xl tracking-tight leading-none text-slate-900">
                    {user?.userName || "SB TOURISM"}
                  </h1>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary/60 block mt-1">
                    Luxury Travels
                  </span>
                </div>
                <button
                  onClick={() => {
                    setNewUserName(user?.userName || "")
                    setIsEditingName(true)
                  }}
                  className="opacity-0 group-hover/name:opacity-100 p-1 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-primary"
                >
                  <Edit2 size={12} strokeWidth={3} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="lg:hidden p-6 border-b border-slate-100 flex items-center justify-between">
        <span className="font-black text-primary/60 uppercase tracking-widest text-xs">
          Navigation Menu
        </span>
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="text-slate-400"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 p-6 space-y-1.5">
        {navItems.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setIsMobileMenuOpen(false)
            }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm ${
              activeTab === tab.id
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm text-red-400 hover:bg-red-50"
        >
          <LogOut size={18} /> Sign Out
        </button>
      </nav>

      <div className="p-6">
        <div className="bg-primary rounded-2xl p-5 text-white relative overflow-hidden group shadow-xl shadow-primary/20">
          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">
              Total Revenue
            </p>
            <h3 className="text-2xl font-black">
              ₹{totalRevenue.toLocaleString()}
            </h3>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-primary/10">
              <TrendingUp size={14} /> +12% from last month
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-10 transform group-hover:scale-110 transition-transform duration-500">
            <Bus size={120} />
          </div>
        </div>
      </div>
    </aside>
  )
}
