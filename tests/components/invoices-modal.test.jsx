import { describe, it, expect, vi } from "vitest"
import { screen, fireEvent, act, waitFor } from "@testing-library/react"
import InvoicesModal from "../../src/components/dashboard/InvoicesModal"
import { mockBookings, mockIssuedDocuments, mockUser } from "../fixtures/mockData"
import { renderWithProviders } from "../testUtils"
import * as docData from "../../src/data/documents"

describe("Invoices & Documents Modal (InvoicesModal Component)", () => {
  it("renders InvoicesModal with bookings and document issuance controls without crashing", async () => {
    vi.spyOn(docData, "listDocuments").mockResolvedValue(mockIssuedDocuments)
    vi.spyOn(docData, "getDocumentSettings").mockResolvedValue(mockUser.companySettings.documentSettings)

    renderWithProviders(
      <InvoicesModal
        isOpen={true}
        onClose={vi.fn()}
        filteredInvoices={mockBookings}
        user={mockUser}
        onViewInvoice={vi.fn()}
        onViewDocument={vi.fn()}
      />
    )

    // Modal title & search
    expect(screen.getByText("All Booking Invoices")).toBeDefined()

    // Expand document management panel for the first booking
    const manageDocsBtn = screen.getByLabelText("Manage documents for #INV-2026-27-001")
    expect(manageDocsBtn).toBeDefined()
    await act(async () => {
      fireEvent.click(manageDocsBtn)
    })

    // Verify document type selection dropdown renders non-credit-note types
    await waitFor(() => {
      const selects = screen.getAllByLabelText("Select document type")
      expect(selects.length).toBeGreaterThan(0)
    })

    // Expect Tax Invoice and Bill of Supply options to be present
    expect(screen.getAllByText("Tax Invoice").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Bill of Supply").length).toBeGreaterThan(0)
  })
})
