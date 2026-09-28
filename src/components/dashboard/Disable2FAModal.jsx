import { Shield } from "lucide-react"

export default function Disable2FAModal({
  isOpen,
  onClose,
  disable2FACode,
  setDisable2FACode,
  handleDisable2FA,
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-slate-100 animate-in zoom-in-95 duration-200">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-red-500 p-4 rounded-2xl text-white shadow-xl shadow-red-500/20 mb-6">
            <Shield size={32} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Disable 2FA?
          </h2>
          <p className="text-slate-500 font-bold mt-2 text-sm">
            Enter your current 6-digit code to confirm
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <input
            type="text"
            maxLength={6}
            value={disable2FACode}
            onChange={(e) =>
              setDisable2FACode(e.target.value.replace(/\D/g, ""))
            }
            placeholder="000000"
            className="w-full px-4 py-3.5 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-black text-2xl text-center tracking-[0.5em]"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={onClose}
            className="py-4 rounded-2xl font-black text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDisable2FA}
            disabled={disable2FACode.length !== 6}
            className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-red-100 transition-all"
          >
            Disable 2FA
          </button>
        </div>
      </div>
    </div>
  )
}
