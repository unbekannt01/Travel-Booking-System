import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import Trash from "../../src/components/trash/Trash"
import HistoryDrawer from "../../src/components/history/HistoryDrawer"
import { renderWithProviders } from "../testUtils"
import * as trashData from "../../src/data/trash"
import * as historyData from "../../src/data/history"

const mockTrashResponse = {
  items: [
    {
      _id: "trash-item-1",
      type: "booking",
      title: "Booking #INV-2026-101 (Somnath Yatra)",
      subtitle: "Ramesh Patel • 9825012345",
      amount: 5000,
      deletedAt: "2026-11-22T10:00:00.000Z",
      restore: { allowed: true, reasons: [] },
      raw: { _id: "trash-item-1", invoiceNo: "INV-2026-101" },
    },
    {
      _id: "trash-item-2",
      type: "expense",
      title: "Expense: fuel — IOCL Petrol",
      subtitle: "Status: paid | Mode: Cash",
      amount: 1500,
      deletedAt: "2026-11-21T15:30:00.000Z",
      restore: {
        allowed: false,
        reasons: ["BOOKS_LOCKED"],
      },
      raw: { _id: "trash-item-2" },
    },
    {
      _id: "trash-item-3",
      type: "customer",
      title: "Customer: Jayesh Shah",
      subtitle: "9825099999 • Surat",
      amount: null,
      deletedAt: "2026-11-20T12:00:00.000Z",
      restore: {
        allowed: false,
        reasons: ["NUMBER_CONFLICT"],
      },
      raw: { _id: "trash-item-3" },
    },
  ],
  total: 3,
  page: 1,
  totalPages: 1,
  counts: { all: 3, booking: 1, expense: 1, customer: 1, cashEntry: 0 },
  lockDate: "2026-11-21",
}

const mockHistoryResponse = {
  history: [
    {
      _id: "hist-1",
      action: "created",
      at: "2026-11-01T10:00:00.000Z",
      by: { name: "Operator Admin", role: "operator" },
      changes: [],
    },
    {
      _id: "hist-2",
      action: "updated",
      at: "2026-11-05T14:30:00.000Z",
      by: { name: "Operator Admin", role: "operator" },
      changes: [
        { field: "totalAmount", kind: "money", from: 5000, to: 6000 },
        { field: "contactName", kind: "text", changed: true },
      ],
    },
    {
      _id: "hist-3",
      action: "deleted",
      at: "2026-11-22T10:00:00.000Z",
      by: { name: "Operator Admin", role: "operator" },
      changes: [],
    },
  ],
}

describe("Trash & History UI Components (Part 6b)", () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((msg) => {
      if (typeof msg === "string" && msg.includes("not wrapped in act")) return
    })

    vi.spyOn(trashData, "getTrash").mockResolvedValue(mockTrashResponse)
    vi.spyOn(trashData, "restoreTrashItem").mockResolvedValue({ success: true })
    vi.spyOn(historyData, "getRecordHistory").mockResolvedValue(mockHistoryResponse)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it("renders Trash screen with header, count badges, and table rows", async () => {
    renderWithProviders(<Trash />)

    await waitFor(() => {
      expect(screen.getByText("Trash & Recycle Bin")).toBeDefined()
      expect(screen.getAllByText("Booking #INV-2026-101 (Somnath Yatra)").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Expense: fuel — IOCL Petrol").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Customer: Jayesh Shah").length).toBeGreaterThan(0)
    })

    // Tabs have badges with counts
    expect(screen.getByRole("tab", { name: /all items/i })).toBeDefined()
    expect(screen.getByRole("tab", { name: /bookings/i })).toBeDefined()
  })

  it("scrollable desktop wrapper has role='region', tabIndex={0}, and aria-label='Trash table, scrollable'", async () => {
    const { container } = renderWithProviders(<Trash />)

    await waitFor(() => {
      expect(screen.getAllByText("Booking #INV-2026-101 (Somnath Yatra)").length).toBeGreaterThan(0)
    })

    const region = container.querySelector('[role="region"][aria-label="Trash table, scrollable"]')
    expect(region).toBeDefined()
    expect(region.getAttribute("tabindex")).toBe("0")
  })

  it("disables Restore button with clear reason text when restore.allowed is false", async () => {
    renderWithProviders(<Trash />)

    await waitFor(() => {
      expect(screen.getAllByText("Expense: fuel — IOCL Petrol").length).toBeGreaterThan(0)
    })

    // Item 2 has BOOKS_LOCKED
    const lockedElements = screen.getAllByText(/Books are closed for this date/i)
    expect(lockedElements.length).toBeGreaterThan(0)

    // Item 3 has NUMBER_CONFLICT
    const conflictElements = screen.getAllByText(/An active record already exists with the same number or phone/i)
    expect(conflictElements.length).toBeGreaterThan(0)
  })

  it("renders empty state when trash contains no records", async () => {
    vi.spyOn(trashData, "getTrash").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      totalPages: 1,
      counts: { all: 0, booking: 0, expense: 0, customer: 0, cashEntry: 0 },
      lockDate: null,
    })

    renderWithProviders(<Trash />)

    await waitFor(() => {
      expect(screen.getByText("Trash is Empty")).toBeDefined()
    })
  })

  it("renders RateLimitNotice on HTTP 429", async () => {
    const rateLimitError = new Error("Too many requests")
    rateLimitError.status = 429
    vi.spyOn(trashData, "getTrash").mockRejectedValue(rateLimitError)

    renderWithProviders(<Trash />)

    await waitFor(() => {
      expect(screen.getByText(/Rate limit reached/i)).toBeDefined()
    })
  })
})

describe("HistoryDrawer Component (Part 6b)", () => {
  it("renders timeline events and summaries in English, Hindi, and Gujarati", async () => {
    vi.spyOn(historyData, "getRecordHistory").mockResolvedValue(mockHistoryResponse)

    renderWithProviders(
      <HistoryDrawer
        isOpen={true}
        onClose={() => {}}
        entityType="booking"
        entityId="booking-123"
        title="Booking Change History"
      />
    )

    await waitFor(() => {
      expect(screen.getByText("Booking Change History")).toBeDefined()
      expect(screen.getAllByText("Operator Admin").length).toBeGreaterThan(0)
      // English summary
      expect(screen.getByText(/Total Amount changed from ₹5,000 to ₹6,000/i)).toBeDefined()
      expect(screen.getByText(/Contact Name updated/i)).toBeDefined()
    })

    // Switch to Hindi
    const hiBtn = screen.getByRole("button", { name: "हिन्दी" })
    fireEvent.click(hiBtn)

    await waitFor(() => {
      expect(screen.getAllByText(/कुल राशि/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/अपडेट किया गया/i).length).toBeGreaterThan(0)
    })

    // Switch to Gujarati
    const guBtn = screen.getByRole("button", { name: "ગુજરાતી" })
    fireEvent.click(guBtn)

    await waitFor(() => {
      expect(screen.getAllByText(/કુલ રકમ/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/અપડેટ કર્યું/i).length).toBeGreaterThan(0)
    })
  })
})
