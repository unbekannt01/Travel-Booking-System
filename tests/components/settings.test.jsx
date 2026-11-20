import { describe, it, expect, vi } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import SettingsPanel from "../../src/components/dashboard/SettingsPanel"
import InvoiceStudio from "../../src/components/dashboard/InvoiceStudio"
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_IDS,
  DOCUMENT_TYPE_LIST,
} from "../../shared/documentTypes.js"
import { mockUser, mockTemplates } from "../fixtures/mockData"
import { renderWithProviders } from "../testUtils"
import * as docData from "../../src/data/documents"

describe("Settings Screen & Invoice Studio (SettingsPanel & InvoiceStudio)", () => {
  it("REGRESSION: DOCUMENT_TYPES is an object, DOCUMENT_TYPE_LIST is an array of 6 items", () => {
    expect(typeof DOCUMENT_TYPES).toBe("object")
    expect(Array.isArray(DOCUMENT_TYPES)).toBe(false)
    expect(Array.isArray(DOCUMENT_TYPE_LIST)).toBe(true)
    expect(DOCUMENT_TYPE_LIST.length).toBe(6)
    expect(DOCUMENT_TYPE_IDS.length).toBe(6)
    expect(DOCUMENT_TYPE_LIST.map((d) => d.id)).toEqual([
      "tax-invoice",
      "bill-of-supply",
      "quotation",
      "proforma",
      "booking-confirmation",
      "credit-note",
    ])
  })

  it("renders SettingsPanel tabs and allows switching without error", () => {
    const { container } = renderWithProviders(
      <SettingsPanel
        user={mockUser}
        companySettings={mockUser.companySettings}
        setCompanySettings={vi.fn()}
        isEditingCompany={false}
        setIsEditingCompany={vi.fn()}
        handleUpdateCompany={vi.fn()}
        setShow2FASetup={vi.fn()}
        setShow2FADisable={vi.fn()}
        formatIndianPhone={(p) => p}
      />
    )

    expect(screen.getByText("Company Profile & Identifiers")).toBeDefined()

    // Click Documents tab
    const docsTab = screen.getByText("Documents")
    fireEvent.click(docsTab)
    expect(screen.getByText("Customer Document Language & Live Preview")).toBeDefined()

    // Click Branding tab
    const brandingTab = screen.getByText("Branding")
    fireEvent.click(brandingTab)
    expect(screen.getByText("Visual Identity & Document Styling")).toBeDefined()

    expect(container).toBeDefined()
  })

  it("renders InvoiceStudio loaded state with all 6 document types in preview dropdown", async () => {
    vi.spyOn(docData, "listTemplates").mockResolvedValue(mockTemplates)
    vi.spyOn(docData, "getDocumentSettings").mockResolvedValue(mockUser.companySettings.documentSettings)

    renderWithProviders(<InvoiceStudio user={mockUser} />)

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getAllByText("Invoice Studio").length).toBeGreaterThan(0)
    })

    // Verify all 6 document types are present in preview select
    const previewSelect = screen.getByLabelText("Preview document type")
    expect(previewSelect).toBeDefined()
    expect(screen.getAllByText("Tax Invoice").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Bill of Supply").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Quotation").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Proforma Invoice").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Booking Confirmation").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Credit Note").length).toBeGreaterThan(0)
  })

  it("renders InvoiceStudio calm inline error card with Retry button when loading fails", async () => {
    vi.spyOn(docData, "listTemplates").mockRejectedValue(new Error("Request failed with status 401"))
    vi.spyOn(docData, "getDocumentSettings").mockRejectedValue(new Error("401"))

    renderWithProviders(<InvoiceStudio user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText("Unable to Load Invoice Templates")).toBeDefined()
      expect(screen.getByText("Retry")).toBeDefined()
    })
  })
})
