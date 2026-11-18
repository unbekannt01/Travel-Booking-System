import { useState, useRef, useCallback, useMemo } from "react"
import { ConfirmDialog } from "../ui"
import { ConfirmModalContext } from "./useConfirm"

/**
 * Global promise-based confirmation dialog provider backed by the Design System v2 ConfirmDialog primitive.
 * @param {{ children: import("react").ReactNode }} props
 */
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

  const handleConfirm = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }))
    if (resolverRef.current) {
      resolverRef.current(true)
      resolverRef.current = null
    }
  }, [])

  const handleCancel = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }))
    if (resolverRef.current) {
      resolverRef.current(false)
      resolverRef.current = null
    }
  }, [])

  const value = useMemo(() => ({ confirm }), [confirm])

  return (
    <ConfirmModalContext.Provider value={value}>
      {children}
      <ConfirmDialog
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        isDestructive={modalState.isDestructive}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmModalContext.Provider>
  )
}
