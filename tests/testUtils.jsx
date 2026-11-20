import React from "react"
import { render } from "@testing-library/react"
import { ToastProvider } from "../src/components/common/ToastProvider"
import { ConfirmModalProvider } from "../src/components/common/ConfirmModalProvider"

/**
 * Custom render helper that wraps components with global Toast and ConfirmModal providers.
 */
export function renderWithProviders(ui, options = {}) {
  function Wrapper({ children }) {
    return (
      <ToastProvider>
        <ConfirmModalProvider>
          {children}
        </ConfirmModalProvider>
      </ToastProvider>
    )
  }
  return render(ui, { wrapper: Wrapper, ...options })
}
