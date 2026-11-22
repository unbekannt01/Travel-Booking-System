import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import ExpenseTracker from "../../src/components/ExpenseTracker"
import { mockUser, mockTours, mockBookings } from "../fixtures/mockData"
import { renderWithProviders } from "../testUtils"
import * as expenseData from "../../src/data/expenses"

const mockExpensesList = [
  {
    _id: "exp-001",
    id: "exp-001",
    date: "2026-04-10",
    category: "fuel",
    amount: 6500,
    tourRef: "Chardham Special Yatra 2026",
    tourLabel: "Chardham Special Yatra 2026",
    vendor: "HPCL Fuel Station",
    paymentMode: "card",
    status: "paid",
    note: "Diesel 75L for coach #1",
  },
  {
    _id: "exp-002",
    id: "exp-002",
    date: "2026-04-12",
    category: "toll",
    amount: 800,
    tourRef: "Chardham Special Yatra 2026",
    tourLabel: "Chardham Special Yatra 2026",
    vendor: "NHAI Toll",
    paymentMode: "upi",
    status: "paid",
    note: "Fastag recharge",
  },
  {
    _id: "exp-003",
    id: "exp-003",
    date: "2026-04-15",
    category: "maintenance",
    amount: 4200,
    tourRef: null,
    tourLabel: "General",
    vendor: "Veraval Bus Garage",
    paymentMode: "bank",
    status: "pending",
    note: "Front brake lining replacement",
  },
]

describe("Expenses Screen (ExpenseTracker Component)", () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders ExpenseTracker with data, StatCards, and table rows", async () => {
    vi.spyOn(expenseData, "listExpenses").mockResolvedValue({
      expenses: mockExpensesList,
      total: 3,
    })
    vi.spyOn(expenseData, "getExpenseSummary").mockResolvedValue({
      totalExpenses: 11500,
      totalPaid: 7300,
      totalPending: 4200,
      count: 3,
      pendingCount: 1,
      byCategory: [],
      monthly: [],
    })

    const { container } = renderWithProviders(
      <ExpenseTracker
        bookings={mockBookings}
        tours={mockTours}
        user={mockUser}
      />
    )

    // Wait for screen title to appear
    await waitFor(() => {
      expect(screen.getAllByText("Expense Management").length).toBeGreaterThan(0)
    })

    // Verify primary StatCard labels
    expect(screen.getByText("Total Expenses")).toBeDefined()
    expect(screen.getByText("Paid Expenses")).toBeDefined()
    expect(screen.getByText("Pending Payments")).toBeDefined()
    expect(screen.getByText("Top Category")).toBeDefined()

    // Verify expenses in list
    expect(screen.getAllByText("HPCL Fuel Station").length).toBeGreaterThan(0)
    expect(screen.getAllByText("NHAI Toll").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Veraval Bus Garage").length).toBeGreaterThan(0)

    // Verify categories
    expect(screen.getAllByText("Fuel & Diesel").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Toll & Fastag").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Vehicle Maintenance & Repairs").length).toBeGreaterThan(0)

    // Verify Action buttons (Export CSV, Add Expense)
    expect(screen.getByLabelText("Export filtered expenses to CSV")).toBeDefined()
    expect(screen.getByLabelText("Add new expense")).toBeDefined()

    expect(container).toBeDefined()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("renders EmptyState cleanly when no expenses exist", async () => {
    vi.spyOn(expenseData, "listExpenses").mockResolvedValue({
      expenses: [],
      total: 0,
    })
    vi.spyOn(expenseData, "getExpenseSummary").mockResolvedValue({
      totalExpenses: 0,
      totalPaid: 0,
      totalPending: 0,
      count: 0,
      pendingCount: 0,
    })

    renderWithProviders(
      <ExpenseTracker
        bookings={mockBookings}
        tours={mockTours}
        user={mockUser}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("No expenses recorded")).toBeDefined()
    })

    expect(screen.getByText("Add First Expense")).toBeDefined()
  })

  it("renders calm inline error card with Retry button when loading fails", async () => {
    vi.spyOn(expenseData, "listExpenses").mockRejectedValue(new Error("Network connection lost"))
    vi.spyOn(expenseData, "getExpenseSummary").mockRejectedValue(new Error("Offline"))

    renderWithProviders(
      <ExpenseTracker
        bookings={mockBookings}
        tours={mockTours}
        user={mockUser}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("Failed to load live expenses")).toBeDefined()
      expect(screen.getByText("Network connection lost")).toBeDefined()
      expect(screen.getByText("Retry")).toBeDefined()
    })
  })

  it("opens Add Expense modal and validates required fields", async () => {
    vi.spyOn(expenseData, "listExpenses").mockResolvedValue({
      expenses: mockExpensesList,
      total: 3,
    })
    vi.spyOn(expenseData, "getExpenseSummary").mockResolvedValue({
      totalExpenses: 11500,
      totalPaid: 7300,
      totalPending: 4200,
      count: 3,
      pendingCount: 1,
    })

    renderWithProviders(
      <ExpenseTracker
        bookings={mockBookings}
        tours={mockTours}
        user={mockUser}
      />
    )

    await waitFor(() => {
      expect(screen.getByLabelText("Add new expense")).toBeDefined()
    })

    // Click Add Expense button
    fireEvent.click(screen.getByLabelText("Add new expense"))

    // Modal opens
    expect(screen.getByText("Record a coach operation cost, fuel refill, bhatta, or supplier payment.")).toBeDefined()

    // Try submitting without amount
    const form = screen.getByRole("form", { name: "Expense form" })
    fireEvent.submit(form)

    // Form shows error
    await waitFor(() => {
      expect(screen.getByText("Enter a valid amount greater than ₹0")).toBeDefined()
    })
  })

  it("allows interacting with filter chips and search input", async () => {
    vi.spyOn(expenseData, "listExpenses").mockResolvedValue({
      expenses: mockExpensesList,
      total: 3,
    })
    vi.spyOn(expenseData, "getExpenseSummary").mockResolvedValue({
      totalExpenses: 11500,
      totalPaid: 7300,
      totalPending: 4200,
      count: 3,
      pendingCount: 1,
    })

    renderWithProviders(
      <ExpenseTracker
        bookings={mockBookings}
        tours={mockTours}
        user={mockUser}
      />
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search vendor, note, tour, category...")).toBeDefined()
    })

    // Click date range chips
    const lastMonthBtn = screen.getByText("Last Month")
    fireEvent.click(lastMonthBtn)

    const thisFyBtn = screen.getByText("This FY")
    fireEvent.click(thisFyBtn)

    // Type in search input
    const searchInput = screen.getByPlaceholderText("Search vendor, note, tour, category...")
    fireEvent.change(searchInput, { target: { value: "Brake" } })

    expect(searchInput.value).toBe("Brake")
  })
})
