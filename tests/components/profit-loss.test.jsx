import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import TourAnalytics from "../../src/components/TourAnalytics"
import JourneyManager from "../../src/components/JourneyManager"
import { mockUser, mockTours, mockBookings } from "../fixtures/mockData"
import { renderWithProviders } from "../testUtils"
import * as reportData from "../../src/data/reports"
import * as expenseData from "../../src/data/expenses"

const mockExpenses = [
  {
    _id: "exp-pnl-1",
    id: "exp-pnl-1",
    date: "2026-04-10",
    category: "fuel",
    amount: 5000,
    tourRef: "Chardham Special Yatra 2026",
    tourName: "Chardham Special Yatra 2026",
    vendor: "IOCL Station",
    paymentMode: "cash",
    status: "paid",
  },
  {
    _id: "exp-pnl-2",
    id: "exp-pnl-2",
    date: "2026-04-12",
    category: "toll",
    amount: 1200,
    tourRef: "Chardham Special Yatra 2026",
    tourName: "Chardham Special Yatra 2026",
    vendor: "Fastag NH8",
    paymentMode: "upi",
    status: "pending",
  },
]

describe("Tour Analytics & Profit & Loss Screen", () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(reportData, "getTourPnl").mockResolvedValue({
      success: true,
      summary: {
        bookedRevenue: 50000,
        collected: 40000,
        outstanding: 10000,
        cancellationFeesRetained: 2000,
        allExpensesTotal: 6200,
        allExpensesPaid: 5000,
        allExpensesPending: 1200,
        overallBusinessProfitBooked: 45800,
        overallBusinessProfitCash: 35000,
        overallBusinessMarginPercent: 91.6,
        passengers: 10,
        capacity: 40,
        occupancyPercent: 25,
      },
      tours: [
        {
          tourName: "Chardham Special Yatra 2026",
          departuresCount: 1,
          passengers: 10,
          capacity: 40,
          occupancyPercent: 25,
          bookedRevenue: 50000,
          collected: 40000,
          outstanding: 10000,
          expensesTotal: 6200,
          expensesPaid: 5000,
          expensesPending: 1200,
          profitBooked: 45800,
          profitCash: 35000,
          marginPercent: 91.6,
          avgTicketPrice: 5000,
          costPerPassenger: 620,
          breakEvenSeats: 2,
          seatsToBreakEvenRemaining: 0,
          departures: [],
          unallocatedExpenses: [],
          bookings: [
            { invoiceNo: "YHB-001", totalAmount: 25000, advanceReceived: 20000, paxCount: 5 },
            { invoiceNo: "YHB-002", totalAmount: 25000, advanceReceived: 20000, paxCount: 5 },
          ],
          expenses: [
            { id: "e1", category: "fuel", vendor: "IOCL", amount: 5000, status: "paid" },
            { id: "e2", category: "toll", vendor: "NHAI", amount: 1200, status: "pending" },
          ],
        },
      ],
      departures: [],
      generalExpenses: [],
    })
    vi.spyOn(expenseData, "listExpenses").mockResolvedValue({
      expenses: mockExpenses,
      total: 2,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders TourAnalytics tabs and switches to Profit & Loss tab", async () => {
    renderWithProviders(
      <TourAnalytics bookings={mockBookings} tours={mockTours} user={mockUser} />,
    )

    // Verify tabs are present
    const pnlTab = screen.getByRole("tab", { name: /profit & loss/i })
    expect(pnlTab).toBeDefined()

    // Switch to Profit & Loss tab
    fireEvent.click(pnlTab)

    // Verify P&L heading and StatCards
    await waitFor(() => {
      expect(screen.getByText(/tour & departure profit \/ loss/i)).toBeDefined()
      expect(screen.getAllByText("Booked Revenue")[0]).toBeDefined()
      expect(screen.getAllByText("Cash Collected")[0]).toBeDefined()
      expect(screen.getAllByText("Total Expenses")[0]).toBeDefined()
    })

    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("toggles between chart view and accessible table view", async () => {
    renderWithProviders(
      <TourAnalytics bookings={mockBookings} tours={mockTours} user={mockUser} />,
    )

    fireEvent.click(screen.getByRole("tab", { name: /profit & loss/i }))

    await waitFor(() => {
      expect(screen.getByLabelText("View as table")).toBeDefined()
    })

    // Click Table view toggle
    fireEvent.click(screen.getByLabelText("View as table"))

    // Verify accessible table caption appears
    expect(screen.getByText(/revenue, expenses and net profit per/i)).toBeDefined()

    // Switch back to Chart view
    fireEvent.click(screen.getByLabelText("View as chart"))
    expect(screen.getByRole("region", { name: /revenue and expenses comparison chart/i })).toBeDefined()

    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("opens Detail Drawer on clicking a row and verifies income/expense ledger without PII", async () => {
    renderWithProviders(
      <TourAnalytics bookings={mockBookings} tours={mockTours} user={mockUser} />,
    )

    fireEvent.click(screen.getByRole("tab", { name: /profit & loss/i }))

    await waitFor(() => {
      expect(screen.getAllByText("Chardham Special Yatra 2026").length).toBeGreaterThan(0)
    })

    // Click Details button
    const detailsButtons = screen.getAllByRole("button", { name: /details/i })
    fireEvent.click(detailsButtons[0])

    // Verify Drawer opens
    await waitFor(() => {
      expect(screen.getByText(/financial ledger/i)).toBeDefined()
      expect(screen.getByText(/unit economics/i)).toBeDefined()
      expect(screen.getByText("YHB-001")).toBeDefined()
      expect(screen.getByText("IOCL")).toBeDefined()
    })

    // Assert strictly no PII in drawer
    expect(screen.queryByText("Secret Customer")).toBeNull()
    expect(screen.queryByText("9876543210")).toBeNull()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("renders calm inline RateLimitNotice when getTourPnl encounters HTTP 429", async () => {
    const error429 = new Error("Too many requests from this IP, please try again after 15 minutes")
    error429.status = 429
    error429.retryAfter = 45
    vi.spyOn(reportData, "getTourPnl").mockRejectedValue(error429)

    renderWithProviders(<TourAnalytics bookings={mockBookings} tours={mockTours} />)

    const pnlTab = screen.getByRole("tab", { name: /profit & loss/i })
    fireEvent.click(pnlTab)

    await waitFor(() => {
      expect(screen.getByText("Reports Rate Limit Active")).toBeDefined()
      expect(screen.getByRole("button", { name: /retry in/i })).toBeDefined()
    })
  })
})

describe("JourneyManager Trip Financials & Add Expense", () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(expenseData, "listExpenses").mockResolvedValue({
      expenses: mockExpenses,
      total: 2,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders departure card with compact Trip Financials and opens Add Trip Expense modal", async () => {
    renderWithProviders(
      <JourneyManager
        bookings={mockBookings}
        onUpdateBooking={vi.fn()}
        user={mockUser}
        expenses={mockExpenses}
      />,
    )

    // Verify Trip Financials section rendered on departure card
    await waitFor(() => {
      expect(screen.getAllByText("Trip Financials").length).toBeGreaterThan(0)
    })

    // Click "Add trip expense" button
    const addExpenseButtons = screen.getAllByRole("button", { name: /add trip expense/i })
    fireEvent.click(addExpenseButtons[0])

    // Verify Add Trip Expense modal opens with prefilled context
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /add trip expense/i })).toBeDefined()
      expect(screen.getByLabelText(/amount/i)).toBeDefined()
      expect(screen.getByLabelText(/category/i)).toBeDefined()
    })

    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })
})
