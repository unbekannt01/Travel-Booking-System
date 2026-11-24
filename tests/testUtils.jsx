import React from "react"
import { render } from "@testing-library/react"
import { ToastProvider } from "../src/components/common/ToastProvider"
import { ConfirmModalProvider } from "../src/components/common/ConfirmModalProvider"
import { ThemeProvider } from "../src/theme/ThemeProvider"

/**
 * Custom render helper that wraps components with global Toast, ConfirmModal, and Theme providers.
 */
export function renderWithProviders(ui, options = {}) {
  function Wrapper({ children }) {
    return (
      <ThemeProvider>
        <ToastProvider>
          <ConfirmModalProvider>
            {children}
          </ConfirmModalProvider>
        </ToastProvider>
      </ThemeProvider>
    )
  }
  return render(ui, { wrapper: Wrapper, ...options })
}
