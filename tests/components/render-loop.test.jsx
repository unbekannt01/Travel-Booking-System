import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Profiler } from "react"
import { screen, act } from "@testing-library/react"
import { renderWithProviders } from "../testUtils"
import { mockUser, mockBookings, mockTours, mockTemplates, mockExpenses } from "../fixtures/mockData"

// Components to test
import { Tabs } from "../../src/components/ui/Tabs"
import OutstandingManager, { OutstandingManagerContent } from "../../src/components/analytics/OutstandingManager"
import StatementModal from "../../src/components/customers/StatementModal"
import CustomerDrawer from "../../src/components/customers/CustomerDrawer"
import CustomerManager from "../../src/components/customers/CustomerManager"
import ProfitLossTab from "../../src/components/analytics/ProfitLossTab"
import ExpenseTracker from "../../src/components/ExpenseTracker"
import InvoiceStudio from "../../src/components/dashboard/InvoiceStudio"
import SettingsPanel from "../../src/components/dashboard/SettingsPanel"
import { RateLimitNotice } from "../../src/components/common/RateLimitNotice"
import { PanelErrorBoundary } from "../../src/components/common/PanelErrorBoundary"
import { ToastProvider } from "../../src/components/common/ToastProvider"
import { ThemeProvider } from "../../src/theme/ThemeProvider"
import Dashboard from "../../src/components/Dashboard"

// Data APIs to mock
import * as reportData from "../../src/data/reports"
import * as customerData from "../../src/data/customers"
import * as expenseData from "../../src/data/expenses"
import * as documentData from "../../src/data/documents"
import * as bookingData from "../../src/data/bookings"
import * as tourData from "../../src/data/tours"

describe("Targeted Render Loop & Commit Count Safety Net (Task B)", () => {
  let consoleErrors = []
  const originalConsoleError = console.error

  beforeEach(() => {
    consoleErrors = []
    console.error = (...args) => {
      const msg = args.map((a) => (a instanceof Error ? a.message : String(a))).join(" ")
      consoleErrors.push(msg)
      originalConsoleError(...args)
    }
  })

  afterEach(() => {
    console.error = originalConsoleError
    vi.restoreAllMocks()
  })

  function renderWithProfiler(ui, maxAllowedCommits = 15) {
    let commitCount = 0
    const onRender = () => {
      commitCount++
    }

    const result = renderWithProviders(
      <Profiler id="test-profiler" onRender={onRender}>
        {ui}
      </Profiler>
    )

    return {
      ...result,
      getCommitCount: () => commitCount,
      assertNoRenderLoop: () => {
        expect(commitCount).toBeLessThanOrEqual(maxAllowedCommits)
        const loopErrors = consoleErrors.filter((e) =>
          e.includes("Maximum update depth exceeded") || e.includes("Too many re-renders")
        )
        expect(loopErrors).toEqual([])
      },
    }
  }

  it("Tabs primitive commits bounded times and never causes update depth error", () => {
    const items = [
      { id: "tab1", label: "Tab 1", content: <div>Content 1</div> },
      { id: "tab2", label: "Tab 2", content: <div>Content 2</div> },
    ]

    const { assertNoRenderLoop } = renderWithProfiler(
      <Tabs items={items} defaultValue="tab1" />,
      5
    )
    assertNoRenderLoop()
  })

  it("RateLimitNotice commits bounded times and does not loop on countdown", async () => {
    vi.useFakeTimers()
    const { assertNoRenderLoop } = renderWithProfiler(
      <RateLimitNotice retryAfterSeconds={5} onRetry={vi.fn()} />,
      10
    )
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    assertNoRenderLoop()
    vi.useRealTimers()
  })

  it("OutstandingManagerContent commits bounded times with mock report", async () => {
    vi.spyOn(reportData, "getOutstandingReport").mockResolvedValue({
      success: true,
      summary: { totalOutstanding: 10000, totalOverdue: 5000, customersOwingCount: 2, oldestOverdueDays: 10 },
      buckets: [],
      items: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 1 },
    })

    const { assertNoRenderLoop } = renderWithProfiler(
      <OutstandingManagerContent bookings={mockBookings} tours={mockTours} />,
      10
    )
    await act(async () => {
      await Promise.resolve()
    })
    assertNoRenderLoop()
  })

  it("StatementModal commits bounded times with async statement data", async () => {
    vi.spyOn(customerData, "getCustomerStatement").mockResolvedValue({
      success: true,
      statement: {
        customer: { name: "Ramesh Patel", phone: "9876543210" },
        openingBalance: 0,
        closingBalance: 5000,
        totalDebits: 15000,
        totalCredits: 10000,
        entries: [],
      },
      operatorSettings: {},
    })

    const { assertNoRenderLoop } = renderWithProfiler(
      <StatementModal
        isOpen={true}
        onClose={vi.fn()}
        customer={{ _id: "c1", name: "Ramesh Patel" }}
      />,
      10
    )
    await act(async () => {
      await Promise.resolve()
    })
    assertNoRenderLoop()
  })

  it("CustomerDrawer commits bounded times when opened and loaded", async () => {
    vi.spyOn(customerData, "getCustomer").mockResolvedValue({
      customer: { _id: "c1", name: "Ramesh Patel", phone: "9876543210" },
      summary: { totalBookings: 2, totalBookedRevenue: 20000, totalCollected: 15000, totalOutstanding: 5000 },
      bookings: [],
    })

    const { assertNoRenderLoop } = renderWithProfiler(
      <CustomerDrawer isOpen={true} onClose={vi.fn()} customerId="c1" />,
      10
    )
    await act(async () => {
      await Promise.resolve()
    })
    assertNoRenderLoop()
  })

  it("CustomerManager commits bounded times with search debounce", async () => {
    vi.spyOn(customerData, "listCustomers").mockResolvedValue({
      customers: [],
      pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
      counts: { total: 0, repeat: 0, withOutstanding: 0, unlinkedBookingsCount: 0 },
    })

    const { assertNoRenderLoop } = renderWithProfiler(
      <CustomerManager onNewBooking={vi.fn()} />,
      10
    )
    await act(async () => {
      await Promise.resolve()
    })
    assertNoRenderLoop()
  })

  it("ProfitLossTab commits bounded times during data fetch", async () => {
    vi.spyOn(reportData, "getTourPnl").mockResolvedValue({
      success: true,
      summary: { bookedRevenue: 50000, collected: 40000, expensesTotal: 20000, netProfitBooked: 30000 },
      tours: [],
      departures: [],
      tourBreakdown: [],
      departureBreakdown: [],
      generalExpenses: [],
    })
    vi.spyOn(expenseData, "listExpenses").mockResolvedValue({ expenses: mockExpenses })

    const { assertNoRenderLoop } = renderWithProfiler(
      <ProfitLossTab bookings={mockBookings} tours={mockTours} />,
      15
    )
    await act(async () => {
      await Promise.resolve()
    })
    assertNoRenderLoop()
  })

  it("ExpenseTracker commits bounded times with filter changes", async () => {
    vi.spyOn(expenseData, "listExpenses").mockResolvedValue({ expenses: mockExpenses })

    const { assertNoRenderLoop } = renderWithProfiler(
      <ExpenseTracker tours={mockTours} bookings={mockBookings} user={mockUser} />,
      15
    )
    await act(async () => {
      await Promise.resolve()
    })
    assertNoRenderLoop()
  })

  it("REGRESSION: ExpenseTracker without expenses prop does not trigger infinite render loop", async () => {
    vi.spyOn(expenseData, "listExpenses").mockImplementation(async () => {
      return { expenses: [] }
    })
    vi.spyOn(expenseData, "getExpenseSummary").mockResolvedValue({ total: 0, byCategory: {} })

    const { assertNoRenderLoop, getCommitCount } = renderWithProfiler(
      <ExpenseTracker tours={[]} bookings={[]} />,
      10
    )
    await act(async () => {
      await Promise.resolve()
    })
    console.log("ExpenseTracker commit count:", getCommitCount())
    assertNoRenderLoop()
  })

  it("InvoiceStudio commits bounded times during template load and preview generation", async () => {
    vi.spyOn(documentData, "listTemplates").mockResolvedValue(mockTemplates)
    vi.spyOn(documentData, "getDocumentSettings").mockResolvedValue(mockUser.companySettings.documentSettings)

    const { assertNoRenderLoop } = renderWithProfiler(
      <InvoiceStudio user={mockUser} />,
      15
    )
    await act(async () => {
      await Promise.resolve()
    })
    assertNoRenderLoop()
  })

  it("SettingsPanel commits bounded times across tabs", async () => {
    vi.spyOn(documentData, "listTemplates").mockResolvedValue(mockTemplates)
    vi.spyOn(documentData, "getDocumentSettings").mockResolvedValue(mockUser.companySettings.documentSettings)

    const { assertNoRenderLoop } = renderWithProfiler(
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
      />,
      30
    )

    // Click through every tab
    const tabLabels = [
      "Branding",
      "Bank & UPI",
      "Documents",
      "Invoice Studio",
      "Ticket Templates",
      "Terms & Conditions",
      "Security",
      "Company",
    ]

    for (const label of tabLabels) {
      const tabBtn = screen.getByRole("tab", { name: new RegExp(label, "i") })
      await act(async () => {
        tabBtn.click()
        await Promise.resolve()
      })
    }

    assertNoRenderLoop()
  })

  it("Dashboard with mock data commits bounded times", async () => {
    vi.spyOn(bookingData, "listBookings").mockResolvedValue({ bookings: mockBookings })
    vi.spyOn(tourData, "listTours").mockResolvedValue({ tours: mockTours })

    const { assertNoRenderLoop } = renderWithProfiler(
      <ThemeProvider>
        <Dashboard user={mockUser} onLogout={vi.fn()} onUserUpdate={vi.fn()} />
      </ThemeProvider>,
      25
    )
    await act(async () => {
      await Promise.resolve()
    })
    assertNoRenderLoop()
  })
})
