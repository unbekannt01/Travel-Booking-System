import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import CustomerManager from "../../src/components/customers/CustomerManager"
import ExpenseTracker from "../../src/components/ExpenseTracker"
import { renderWithProviders } from "../testUtils"
import * as customerData from "../../src/data/customers"

describe("Import CSV Button Accessible Navigation Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(customerData, "listCustomers").mockResolvedValue({
      customers: [],
      pagination: { total: 0, totalPages: 1 },
      counts: { total: 0, repeat: 0, withOutstanding: 0, unlinkedBookingsCount: 0 },
    })
  })

  it("CustomerManager: Import CSV button accessible name matches visible text exactly", async () => {
    const onNavigate = vi.fn()
    renderWithProviders(<CustomerManager onNavigate={onNavigate} />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Import CSV" })).toBeDefined()
    })

    const button = screen.getByRole("button", { name: "Import CSV" })
    // WCAG 2.5.3: accessible name matches visible text without mismatch
    expect(button.getAttribute("aria-label")).toBeNull()

    fireEvent.click(button)
    expect(onNavigate).toHaveBeenCalledWith("data", "import")
  })

  it("CustomerManager: falls back to window.location.hash when onNavigate is omitted", async () => {
    window.location.hash = ""

    renderWithProviders(<CustomerManager />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Import CSV" })).toBeDefined()
    })

    const button = screen.getByRole("button", { name: "Import CSV" })
    fireEvent.click(button)

    expect(window.location.hash).toBe("#data?tab=import")
  })

  it("ExpenseTracker: Import CSV button accessible name matches visible text and navigates", async () => {
    const onNavigate = vi.fn()
    renderWithProviders(<ExpenseTracker onNavigate={onNavigate} />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Import CSV" })).toBeDefined()
    })

    const button = screen.getByRole("button", { name: "Import CSV" })
    expect(button.getAttribute("aria-label")).toBe("Import CSV")

    fireEvent.click(button)
    expect(onNavigate).toHaveBeenCalledWith("data", "import")
  })
})
