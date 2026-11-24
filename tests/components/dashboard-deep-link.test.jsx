import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import Dashboard from "../../src/components/Dashboard"
import "../../src/components/data/DataManagement"
import { renderWithProviders } from "../testUtils"

vi.mock("../../src/data/bookings", () => ({
  listBookings: vi.fn().mockResolvedValue([]),
  createBooking: vi.fn().mockResolvedValue({}),
  updateBooking: vi.fn().mockResolvedValue({}),
  deleteBooking: vi.fn().mockResolvedValue({}),
  restoreBooking: vi.fn().mockResolvedValue({}),
  cancelBooking: vi.fn().mockResolvedValue({}),
}))

vi.mock("../../src/data/tours", () => ({
  listTours: vi.fn().mockResolvedValue([]),
  createTour: vi.fn().mockResolvedValue({}),
  updateTour: vi.fn().mockResolvedValue({}),
  deleteTour: vi.fn().mockResolvedValue({}),
}))

vi.mock("../../src/data/client", () => ({
  getAuthToken: vi.fn().mockReturnValue("mock-token"),
  subscribeApiStatus: vi.fn().mockReturnValue(() => {}),
  isApiReachable: vi.fn().mockReturnValue(true),
}))

vi.mock("../../src/data/importExport", () => ({
  getImportBatches: vi.fn().mockResolvedValue({ batches: [] }),
  downloadExportCsv: vi.fn().mockResolvedValue({ success: true }),
  previewImportCsv: vi.fn().mockResolvedValue({}),
  commitImportCsv: vi.fn().mockResolvedValue({}),
  undoImportBatch: vi.fn().mockResolvedValue({}),
}))

describe("Dashboard Deep-link Routing (#data?tab=import)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("navigates to data tab and passes initialTab='import' when hash is #data?tab=import", async () => {
    window.location.hash = "#data?tab=import"

    renderWithProviders(
      <Dashboard
        user={{ id: "u-1", name: "Test User", role: "admin" }}
        onLogout={vi.fn()}
        onUserUpdate={vi.fn()}
      />
    )

    await waitFor(
      () => {
        expect(screen.getByText(/Step 1: Choose Data Type/i)).toBeDefined()
      },
      { timeout: 3000 }
    )
  })
})
