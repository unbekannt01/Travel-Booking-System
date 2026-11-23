import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import CashBook from "../../src/components/cashbook/CashBook"
import DayBookTable from "../../src/components/cashbook/DayBookTable"
import PrintDayBookModal from "../../src/components/cashbook/PrintDayBookModal"
import { renderWithProviders } from "../testUtils"
import * as cashbookData from "../../src/data/cashbook"
import * as csvUtils from "../../src/utils/csv"

const mockDayBook = {
  startDate: "2026-11-23",
  endDate: "2026-11-23",
  opening: { cash: 10000, bank: 50000, total: 60000 },
  closing: { cash: 12000, bank: 54500, total: 66500 },
  totals: {
    receipts: { cash: 2000, bank: 500, total: 2500 },
    expenses: { cash: 0, bank: 500, total: 500 },
    refunds: { cash: 0, bank: 0, total: 0 },
    transfers: { cashToBank: 5000, bankToCash: 0 },
    owner: { ownerIn: 0, ownerOut: 0 },
    adjustments: { cash: 0, bank: 0, total: 0 },
  },
  entries: [
    {
      id: "line-receipt-1",
      date: "2026-11-23",
      sourceType: "receipt",
      account: "cash",
      direction: "in",
      amount: 2000,
      description: "Booking INV-001 Ramesh",
      reference: "INV-001",
      cashBalance: 12000,
      bankBalance: 50000,
      totalBalance: 62000,
      isLocked: false,
      isManual: false,
    },
    {
      id: "line-expense-1",
      date: "2026-11-23",
      sourceType: "expense",
      account: "bank",
      direction: "out",
      amount: 500,
      description: "Diesel fuel payment",
      reference: "EXP-2026-001",
      cashBalance: 12000,
      bankBalance: 49500,
      totalBalance: 61500,
      isLocked: false,
      isManual: false,
    },
    {
      id: "line-manual-1",
      date: "2026-11-23",
      sourceType: "transfer-to-bank",
      account: "bank",
      direction: "in",
      amount: 5000,
      description: "Deposited cash to bank",
      reference: "TRF-001",
      cashBalance: 7000,
      bankBalance: 54500,
      totalBalance: 61500,
      isLocked: false,
      isManual: true,
      raw: {
        _id: "entry-001",
        date: "2026-11-23",
        type: "transfer-to-bank",
        amount: 5000,
        notes: "Deposited cash to bank",
      },
    },
  ],
  entriesCount: 3,
}

const mockResponse = {
  startDate: "2026-11-23",
  endDate: "2026-11-23",
  account: "all",
  dayBook: mockDayBook,
  lockDate: "2026-11-20",
  lastClose: {
    closedUpTo: "2026-11-20",
    closedAt: "2026-11-20T18:00:00.000Z",
    countedCash: 10000,
    systemCash: 10000,
    difference: 0,
    status: "active",
  },
  setup: {
    openingCash: 10000,
    openingBank: 50000,
    asOfDate: "2026-11-01",
  },
}

describe("CashBook UI Components", () => {
  let consoleErrorSpy
  let downloadCsvSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((msg) => {
      if (typeof msg === "string" && msg.includes("not wrapped in act")) return
    })

    vi.spyOn(cashbookData, "getCashBook").mockResolvedValue(mockResponse)
    vi.spyOn(cashbookData, "getCashBookSetup").mockResolvedValue({
      setup: mockResponse.setup,
      latestClose: mockResponse.lastClose,
    })
    vi.spyOn(cashbookData, "deleteCashEntry").mockResolvedValue({ success: true })
    downloadCsvSpy = vi.spyOn(csvUtils, "downloadCsv").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it("renders Cash Book with stat cards, table, and lock banner", async () => {
    renderWithProviders(<CashBook />)

    // Wait for screen title and data load
    await waitFor(() => {
      expect(screen.getByText("Opening Balance")).toBeDefined()
    })

    // Check header and StatCards exist
    expect(screen.getByText(/Daily Cash & Bank Book/i)).toBeDefined()
    expect(screen.getByText("Total Receipts / Inflow")).toBeDefined()
    expect(screen.getByText("Total Payments / Outflow")).toBeDefined()
    expect(screen.getByText("Closing Balance")).toBeDefined()

    // Check Lock banner appears since lockDate is 2026-11-20
    expect(screen.getByText(/Books are officially closed up to/i)).toBeDefined()

    // Check DayBookTable rendered lines
    expect(screen.getByText("Booking INV-001 Ramesh")).toBeDefined()
    expect(screen.getByText("Diesel fuel payment")).toBeDefined()
    expect(screen.getByText("Deposited cash to bank")).toBeDefined()
  })

  it("switches view mode between Single Day and Date Range", async () => {
    renderWithProviders(<CashBook />)

    await waitFor(() => {
      expect(screen.getByText("Single Day")).toBeDefined()
    })

    const rangeBtn = screen.getByRole("radio", { name: /date range/i })
    fireEvent.click(rangeBtn)

    await waitFor(() => {
      expect(screen.getByLabelText("Start date")).toBeDefined()
      expect(screen.getByLabelText("End date")).toBeDefined()
    })
  })

  it("filters transactions by account (all, cash, bank)", async () => {
    renderWithProviders(<CashBook />)

    await waitFor(() => {
      expect(screen.getByText("Opening Balance")).toBeDefined()
    })

    const cashFilterBtn = screen.getByRole("radio", { name: /cash only/i })
    fireEvent.click(cashFilterBtn)

    await waitFor(() => {
      expect(cashbookData.getCashBook).toHaveBeenCalledWith(
        expect.objectContaining({ account: "cash" })
      )
    })
  })

  it("opens Manual Entry modal when 'Add Entry' is clicked", async () => {
    renderWithProviders(<CashBook />)

    await waitFor(() => {
      expect(screen.getByText("Opening Balance")).toBeDefined()
    })

    const addEntryBtn = screen.getByRole("button", { name: /add entry/i })
    fireEvent.click(addEntryBtn)

    await waitFor(() => {
      expect(screen.getByText("Record Cash / Bank Entry")).toBeDefined()
    })
  })

  it("opens Close Day modal when 'Close Day' is clicked", async () => {
    renderWithProviders(<CashBook />)

    await waitFor(() => {
      expect(screen.getByText("Opening Balance")).toBeDefined()
    })

    const closeBtn = screen.getByRole("button", { name: /close day/i })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.getByText(/Close Books for/i)).toBeDefined()
    })
  })

  it("opens Setup modal when 'Setup' is clicked", async () => {
    renderWithProviders(<CashBook />)

    await waitFor(() => {
      expect(screen.getByText("Opening Balance")).toBeDefined()
    })

    const setupBtn = screen.getByRole("button", { name: /opening setup/i })
    fireEvent.click(setupBtn)

    await waitFor(() => {
      expect(screen.getByText("Cash Book Opening Setup")).toBeDefined()
    })
  })

  it("opens Print modal with sandboxed iframe when 'Print' is clicked", async () => {
    renderWithProviders(<CashBook />)

    await waitFor(() => {
      expect(screen.getByText("Opening Balance")).toBeDefined()
    })

    const printBtn = screen.getByRole("button", { name: /print day book/i })
    fireEvent.click(printBtn)

    await waitFor(() => {
      expect(screen.getByText(/Print Daily Cash & Bank Book/i)).toBeDefined()
      const iframe = screen.getByTitle("Day Book Print Document")
      expect(iframe).toBeDefined()
      expect(iframe.getAttribute("sandbox")).toBe("allow-same-origin allow-modals")
    })
  })

  it("triggers CSV export when 'Export CSV' is clicked", async () => {
    renderWithProviders(<CashBook />)

    await waitFor(() => {
      expect(screen.getByText("Opening Balance")).toBeDefined()
    })

    const exportBtn = screen.getByRole("button", { name: /export csv/i })
    fireEvent.click(exportBtn)

    expect(downloadCsvSpy).toHaveBeenCalled()
    const callArgs = downloadCsvSpy.mock.calls[0]
    expect(callArgs[0]).toMatch(/DayBook-2026-11-23\.csv/)
  })
})

describe("DayBookTable Component", () => {
  it("renders empty state when there are no lines", () => {
    renderWithProviders(
      <DayBookTable
        entries={[]}
        opening={{ cash: 0, bank: 0, total: 0 }}
        closing={{ cash: 0, bank: 0, total: 0 }}
      />
    )

    expect(screen.getByText(/no cash or bank transactions recorded for this period/i)).toBeDefined()
  })

  it("renders opening, transaction, and closing rows with running balances", () => {
    renderWithProviders(
      <DayBookTable
        entries={mockDayBook.entries}
        opening={mockDayBook.opening}
        totals={mockDayBook.totals}
        closing={mockDayBook.closing}
      />
    )

    expect(screen.getByText(/OPENING BALANCE/i)).toBeDefined()
    expect(screen.getByText(/CLOSING BALANCE/i)).toBeDefined()
    expect(screen.getByText("Booking INV-001 Ramesh")).toBeDefined()
  })
})

describe("PrintDayBookModal Component", () => {
  it("renders language selector (English, Hindi, Gujarati) and sandboxed iframe", () => {
    renderWithProviders(
      <PrintDayBookModal
        isOpen={true}
        onClose={() => {}}
        dayBook={mockDayBook}
      />
    )

    expect(screen.getByText(/Print Daily Cash & Bank Book/i)).toBeDefined()
    expect(screen.getByRole("combobox")).toBeDefined()
    expect(screen.getByRole("option", { name: "English" })).toBeDefined()
    expect(screen.getByRole("option", { name: "हिन्दी" })).toBeDefined()
    expect(screen.getByRole("option", { name: "ગુજરાતી" })).toBeDefined()

    const iframe = screen.getByTitle("Day Book Print Document")
    expect(iframe).toBeDefined()
    expect(iframe.getAttribute("sandbox")).toBe("allow-same-origin allow-modals")
  })
})
