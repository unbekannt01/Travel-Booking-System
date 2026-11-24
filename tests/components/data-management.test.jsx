import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import DataManagement from "../../src/components/data/DataManagement"
import { renderWithProviders } from "../testUtils"
import * as importExportData from "../../src/data/importExport"

const mockBatches = [
  {
    _id: "batch-1",
    type: "customers",
    status: "committed",
    totalRows: 50,
    successCount: 48,
    skippedCount: 2,
    fileName: "customers-nov2026.csv",
    createdAt: "2026-11-24T08:00:00.000Z",
  },
  {
    _id: "batch-2",
    type: "expenses",
    status: "reverted",
    totalRows: 10,
    successCount: 10,
    skippedCount: 0,
    fileName: "expenses-nov2026.csv",
    createdAt: "2026-11-23T14:30:00.000Z",
  },
]

describe("DataManagement Component (Task C)", () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((msg) => {
      if (typeof msg === "string" && msg.includes("not wrapped in act")) return
    })

    vi.spyOn(importExportData, "getImportBatches").mockResolvedValue({ batches: mockBatches })
    vi.spyOn(importExportData, "downloadExportCsv").mockResolvedValue({ success: true, filename: "test.csv" })
    vi.spyOn(importExportData, "previewImportCsv").mockResolvedValue({
      token: "mock-token.123456",
      type: "customers",
      counts: { total: 2, valid: 2, invalid: 0, existing: 0 },
      sampleValid: [
        { rowNumber: 2, data: { name: "Ramesh Patel", phone: "9825012345", city: "Surat" } },
      ],
      sampleInvalid: [],
    })
    vi.spyOn(importExportData, "commitImportCsv").mockResolvedValue({
      success: true,
      batchId: "new-batch-id",
      counts: { total: 2, imported: 2, skipped: 0 },
    })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it("1. Renders Data Management screen with header and primary export cards", async () => {
    renderWithProviders(<DataManagement user={{ userName: "Admin" }} />)

    expect(screen.getByText("Data Import & Export")).toBeDefined()
    expect(screen.getByRole("tab", { name: /Export System Data/i })).toBeDefined()
    expect(screen.getByRole("tab", { name: /Import CSV Data/i })).toBeDefined()

    // Export cards
    expect(screen.getByText("Customers Master")).toBeDefined()
    expect(screen.getByText("Expense Records")).toBeDefined()
    expect(screen.getByText("Bookings & Invoices")).toBeDefined()
    expect(screen.getByText("Cash Book Day Book")).toBeDefined()
    expect(screen.getByText("Receivables & Aging")).toBeDefined()

    // Triggers export on click
    const exportCustBtn = screen.getByRole("button", { name: /Export Customers CSV/i })
    fireEvent.click(exportCustBtn)
    expect(importExportData.downloadExportCsv).toHaveBeenCalledWith("customers", expect.any(Object))
  })

  it("2. Wizard Step 1: Navigates to Import tab and allows choosing data type and template download", async () => {
    renderWithProviders(<DataManagement user={{ userName: "Admin" }} />)

    // Switch to Import tab
    const importTab = screen.getByRole("tab", { name: /Import CSV Data/i })
    fireEvent.click(importTab)

    expect(screen.getByText("Step 1: Choose Data Type & Download Template")).toBeDefined()
    expect(screen.getByText("Customers")).toBeDefined()
    expect(screen.getByText("Expenses")).toBeDefined()
    expect(screen.getByText(/Download Customer Template/i)).toBeDefined()

    // Switch to Expenses type
    const expenseTypeBtn = screen.getByRole("button", { name: /Expenses/i })
    fireEvent.click(expenseTypeBtn)
    expect(screen.getByText(/Download Expense Template/i)).toBeDefined()

    // Next step
    const nextBtn = screen.getByRole("button", { name: /Next: Upload File/i })
    fireEvent.click(nextBtn)
    expect(screen.getByText("Step 2: Upload CSV File")).toBeDefined()
  })

  it("3. Recent Batches: Switches to batches tab, renders list and handles undo dialog", async () => {
    renderWithProviders(<DataManagement user={{ userName: "Admin" }} />)

    const batchesTab = screen.getByRole("tab", { name: /Recent Batches/i })
    fireEvent.click(batchesTab)

    await waitFor(() => {
      expect(screen.getByText("customers-nov2026.csv")).toBeDefined()
      expect(screen.getByText("expenses-nov2026.csv")).toBeDefined()
    })

    // Undo button on active batch
    const undoBtns = screen.getAllByRole("button", { name: /Undo/i })
    fireEvent.click(undoBtns[0])

    expect(screen.getByText(/Undo Import Batch\?/i)).toBeDefined()
    expect(screen.getByText(/Are you sure you want to revert the import batch/i)).toBeDefined()
  })

  it("4. RateLimitNotice renders calmly when export fails with HTTP 429", async () => {
    const error429 = new Error("Too many requests")
    error429.status = 429
    importExportData.downloadExportCsv.mockRejectedValueOnce(error429)

    renderWithProviders(<DataManagement user={{ userName: "Admin" }} />)

    const exportCustBtn = screen.getByRole("button", { name: /Export Customers CSV/i })
    fireEvent.click(exportCustBtn)

    await waitFor(() => {
      expect(screen.getByText(/Export rate limit reached/i)).toBeDefined()
    })
  })
})
