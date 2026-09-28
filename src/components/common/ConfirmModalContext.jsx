import { createContext, useContext, useState, useRef, useCallback } from "react"
import { AlertTriangle } from "lucide-react"

const ConfirmModalContext = createContext(null)

export function ConfirmModalProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    isDestructive: false,
  })

  const resolverRef = useRef(null)

  const confirm = useCallback(
    ({
      title = "Are you sure?",
      message = "This action cannot be undone.",
      confirmText = "Confirm",
      cancelText = "Cancel",
      isDestructive = true,
    } = {}) => {
      return new Promise((resolve) => {
        resolverRef.current = resolve
        setModalState({
          isOpen: true,
          title,
          message,
          confirmText,
          cancelText,
          isDestructive,
        })
      })
    },
    [],
  )

  const handleConfirm = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }))
    if (resolverRef.current) {
      resolverRef.current(true)
      resolverRef.current = null
    }
  }

  const handleCancel = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }))
    if (resolverRef.current) {
      resolverRef.current(false)
      resolverRef.current = null
    }
  }

  return (
    <ConfirmModalContext.Provider value={{ confirm }}>
      {children}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div
                className={`inline-flex items-center justify-center p-4 rounded-2xl text-white shadow-xl mb-4 ${
                  modalState.isDestructive
                    ? "bg-rose-500 shadow-rose-500/20"
                    : "bg-primary shadow-primary/20"
                }`}
              >
                <AlertTriangle size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {modalState.title}
              </h3>
              <p className="text-slate-500 font-bold mt-2 text-sm leading-relaxed">
                {modalState.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="py-3.5 px-4 rounded-2xl font-black text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all border border-slate-200"
              >
                {modalState.cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`py-3.5 px-4 rounded-2xl font-black text-sm text-white shadow-xl transition-all ${
                  modalState.isDestructive
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20"
                    : "bg-primary hover:bg-primary/90 shadow-primary/20"
                }`}
              >
                {modalState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmModalContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmModalContext)
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmModalProvider")
  }
  return context.confirm
}
