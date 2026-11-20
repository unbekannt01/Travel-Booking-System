import { useState, useCallback, useMemo, useRef } from "react"
import { Toast, ToastContainer } from "../ui"
import { ToastContext } from "./useToast"

/**
 * Global toast notification provider rendering alerts with the Design System v2 Toast primitive.
 * @param {{ children: import("react").ReactNode }} props
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const recentToastsRef = useRef(new Map())

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message, type = "info", options = {}) => {
      // 3-second de-duplication: suppress identical (type, message) within 3000ms
      const dedupeKey = `${type}::${typeof message === "string" ? message : String(message)}`
      const now = Date.now()
      const lastShown = recentToastsRef.current.get(dedupeKey) || 0
      if (now - lastShown < 3000) {
        return null
      }
      recentToastsRef.current.set(dedupeKey, now)

      // Prune old entries to prevent memory leak
      if (recentToastsRef.current.size > 50) {
        for (const [key, timestamp] of recentToastsRef.current.entries()) {
          if (now - timestamp > 10000) {
            recentToastsRef.current.delete(key)
          }
        }
      }

      const id = Date.now() + Math.random().toString(36).slice(2, 11)
      const duration =
        options.duration !== undefined ? options.duration : options.action ? 8000 : 4000
      setToasts((prev) => [...prev, { id, message, type, action: options.action }])
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id)
        }, duration)
      }
      return id
    },
    [removeToast],
  )

  const toast = useMemo(
    () => ({
      success: (msg, opts) => showToast(msg, "success", opts),
      error: (msg, opts) => showToast(msg, "error", opts),
      warning: (msg, opts) => showToast(msg, "warning", opts),
      info: (msg, opts) => showToast(msg, "info", opts),
      action: (msg, actionObj, duration = 8000) =>
        showToast(msg, "info", { action: actionObj, duration }),
      undo: (msg, onUndo, duration = 8000) =>
        showToast(msg, "info", { action: { label: "Undo", onClick: onUndo }, duration }),
    }),
    [showToast],
  )

  const value = useMemo(() => ({ showToast, toast }), [showToast, toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer>
        {toasts.map((t) => (
          <Toast
            key={t.id}
            type={t.type}
            message={t.message}
            action={t.action}
            onDismiss={() => removeToast(t.id)}
          />
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  )
}
