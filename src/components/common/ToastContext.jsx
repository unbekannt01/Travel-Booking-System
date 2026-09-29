import { createContext, useContext, useState, useCallback } from "react"
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react"

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message, type = "info", options = {}) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9)
    const duration = options.duration !== undefined ? options.duration : (options.action ? 8000 : 4000)
    setToasts((prev) => [...prev, { id, message, type, action: options.action }])
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
    return id
  }, [removeToast])

  const toast = {
    success: (msg, opts) => showToast(msg, "success", opts),
    error: (msg, opts) => showToast(msg, "error", opts),
    info: (msg, opts) => showToast(msg, "info", opts),
    action: (msg, actionObj, duration = 8000) => showToast(msg, "info", { action: actionObj, duration }),
    undo: (msg, onUndo, duration = 8000) => showToast(msg, "info", { action: { label: "Undo", onClick: onUndo }, duration }),
  }

  return (
    <ToastContext.Provider value={{ showToast, toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5 ${
              t.type === "success"
                ? "bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20"
                : t.type === "error"
                  ? "bg-rose-500 text-white border-rose-400 shadow-rose-500/20"
                  : "bg-slate-900 text-white border-slate-700 shadow-slate-900/30"
            }`}
          >
            <div className="shrink-0">
              {t.type === "success" && <CheckCircle2 size={20} strokeWidth={2.5} />}
              {t.type === "error" && <AlertCircle size={20} strokeWidth={2.5} />}
              {t.type === "info" && <Info size={20} strokeWidth={2.5} />}
            </div>
            <p className="text-sm font-bold flex-1 leading-snug">{t.message}</p>
            {t.action && (
              <button
                onClick={() => {
                  if (t.action.onClick) t.action.onClick()
                  removeToast(t.id)
                }}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 shadow-sm"
              >
                {t.action.label || "Undo"}
              </button>
            )}
            <button
              onClick={() => removeToast(t.id)}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}
