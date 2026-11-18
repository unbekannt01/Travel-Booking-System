import { createContext, useContext } from "react"

export const ConfirmModalContext = createContext(null)

/**
 * Access the promise-based confirmation dialog function `confirm(options)`.
 */
export function useConfirm() {
  const context = useContext(ConfirmModalContext)
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmModalProvider")
  }
  return context.confirm
}
