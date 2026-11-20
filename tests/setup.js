import { afterEach, beforeEach, vi } from "vitest"
import { cleanup } from "@testing-library/react"

// Clean DOM after every test
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// Mock window globals in jsdom
if (typeof window !== "undefined") {
  // matchMedia
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // ResizeObserver for recharts / analytics
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = MockResizeObserver

  // IntersectionObserver
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.IntersectionObserver = MockIntersectionObserver

  // scrollTo
  window.scrollTo = vi.fn()
}

// Trap and fail tests on unhandled console.error
const originalConsoleError = console.error
beforeEach(() => {
  console.error = (...args) => {
    const msg = args.map((a) => (a instanceof Error ? a.message : String(a))).join(" ")
    // Allow intentional test error logging (e.g. error boundary verification)
    if (
      msg.includes("PanelErrorBoundary caught error") ||
      msg.includes("Intentional Test Error") ||
      msg.includes("Not implemented: navigation") ||
      msg.includes("Failed to load invoice templates") ||
      msg.includes("width(0) and height(0) of chart") ||
      msg.includes("not wrapped in act") ||
      msg.includes("wrap-tests-with-act") ||
      msg.includes("An error occurred in the")
    ) {
      originalConsoleError(...args)
      return
    }
    originalConsoleError(...args)
    throw new Error(`Unexpected console.error called during test:\n${msg}`)
  }
})

afterEach(() => {
  console.error = originalConsoleError
})
