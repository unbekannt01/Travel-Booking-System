import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import OutstandingManager from "../../src/components/analytics/OutstandingManager"
import { renderWithProviders } from "../testUtils"
import * as reportsData from "../../src/data/reports"
import * as customerData from "../../src/data/customers"

const mockReportData = {
  success: true,
  meta: {
    asOf: "2026-05-15",
    basis: "journey",
    tourName: "all",
    bucket: "all",
    groupBy: "customer",
  },
  summary: {
    totalOutstanding: 25000,
    totalOverdue: 15000,
    notDueAmount: 10000,
    oldestOverdueDays: 45,
    customersOwingCount: 2,
    totalBookingsOwing: 2,
    bucketTotals: {
      "not-due": 10000,
      "0-30": 0,
      "31-60": 15000,
      "61-90": 0,
      "90-plus": 0,
    },
    bucketCounts: {
      "not-due": 1,
      "0-30": 0,
      "31-60": 1,
      "61-90": 0,
      "90-plus": 0,
    },
  },
  customers: [
    {
      customerId: "cust-1",
      customerName: "Ramesh Patel",
      customerPhone: "9876543210",
      customerCity: "Surat",
      totalOutstanding: 15000,
      overdueAmount: 15000,
      notDueAmount: 0,
      oldestOverdueDays: 45,
      bookingsCount: 1,
      bucketBreakdown: {
        "not-due": 0,
        "0-30": 0,
        "31-60": 15000,
        "61-90": 0,
        "90-plus": 0,
      },
      bookings: [
        {
          bookingId: "b-1",
          invoiceNo: "INV-2026-001",
          tourName: "Chardham Special",
          journeyDate: "2026-03-31",
          bookingDate: "2026-03-01",
          totalAmount: 25000,
          collected: 10000,
          outstanding: 15000,
          daysOverdue: 45,
          bucket: "31-60",
          isOverdue: true,
        },
      ],
    },
    {
      customerId: "cust-2",
      customerName: "Suresh Shah",
      customerPhone: "9825098765",
      customerCity: "Ahmedabad",
      totalOutstanding: 10000,
      overdueAmount: 0,
      notDueAmount: 10000,
      oldestOverdueDays: 0,
      bookingsCount: 1,
      bucketBreakdown: {
        "not-due": 10000,
        "0-30": 0,
        "31-60": 0,
        "61-90": 0,
        "90-plus": 0,
      },
      bookings: [
        {
          bookingId: "b-2",
          invoiceNo: "INV-2026-002",
          tourName: "Dwarka Somnath",
          journeyDate: "2026-06-15",
          bookingDate: "2026-05-01",
          totalAmount: 20000,
          collected: 10000,
          outstanding: 10000,
          daysOverdue: 0,
          bucket: "not-due",
          isOverdue: false,
        },
      ],
    },
  ],
  rows: [],
}

describe("Outstanding Receivables & Aging Screen (OutstandingManager Component)", () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(reportsData, "getOutstandingReport").mockResolvedValue(mockReportData)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders OutstandingManager with StatCards, aging cards, and customer rows", async () => {
    renderWithProviders(<OutstandingManager />)

    // Verify StatCards
    await waitFor(() => {
      expect(screen.getAllByText("Total Outstanding").length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText("Overdue Receivables")).toBeDefined()
      expect(screen.getByText("Customers Owing")).toBeDefined()
      expect(screen.getByText("Oldest Overdue")).toBeDefined()
    })

    // Verify 5 Aging Buckets
    expect(screen.getByText("Not Due")).toBeDefined()
    expect(screen.getByText("0–30 Days")).toBeDefined()
    expect(screen.getByText("31–60 Days")).toBeDefined()
    expect(screen.getByText("61–90 Days")).toBeDefined()
    expect(screen.getByText("90+ Days")).toBeDefined()

    // Verify Customer rows rendered
    expect(screen.getByText("Ramesh Patel")).toBeDefined()
    expect(screen.getByText("Suresh Shah")).toBeDefined()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("toggles between Chart Bar and Accessible Table View", async () => {
    renderWithProviders(<OutstandingManager />)

    await waitFor(() => {
      expect(screen.getByText("Accessible Table View")).toBeDefined()
    })

    // Click toggle to show accessible table view
    fireEvent.click(screen.getByText("Accessible Table View"))
    expect(screen.getByText("Aging Bucket")).toBeDefined()
    expect(screen.getByText("Show Chart Bar")).toBeDefined()

    // Click again to return to bar view
    fireEvent.click(screen.getByText("Show Chart Bar"))
    expect(screen.queryByText("Aging Bucket")).toBeNull()
  })

  it("expands customer row to reveal individual booking details", async () => {
    renderWithProviders(<OutstandingManager />)

    await waitFor(() => {
      expect(screen.getByText("Ramesh Patel")).toBeDefined()
    })

    // Click expand button on first customer row
    const expandButtons = screen.getAllByRole("button", { name: /expand bookings/i })
    expect(expandButtons.length).toBeGreaterThan(0)
    fireEvent.click(expandButtons[0])

    // Nested booking details should now be visible
    await waitFor(() => {
      expect(screen.getByText("#INV-2026-001")).toBeDefined()
      expect(screen.getByText("Chardham Special")).toBeDefined()
    })
  })

  it("opens StatementModal when Statement action button is clicked", async () => {
    renderWithProviders(<OutstandingManager />)

    await waitFor(() => {
      expect(screen.getByText("Ramesh Patel")).toBeDefined()
    })

    const statementButtons = screen.getAllByRole("button", { name: /statement/i })
    expect(statementButtons.length).toBeGreaterThan(0)
    fireEvent.click(statementButtons[0])

    // Verify modal appears
    await waitFor(() => {
      expect(screen.getByText(/Customer Statement — Ramesh Patel/i)).toBeDefined()
    })
  })

  it("renders calm RateLimitNotice when getOutstandingReport encounters HTTP 429", async () => {
    const rateLimitErr = new Error("Too many requests")
    rateLimitErr.status = 429
    rateLimitErr.retryAfter = 60
    vi.spyOn(reportsData, "getOutstandingReport").mockRejectedValue(rateLimitErr)

    renderWithProviders(<OutstandingManager />)

    await waitFor(() => {
      expect(screen.getByText(/rate limit reached/i)).toBeDefined()
    })
  })

  it("renders all form controls with accessible labels (with data and empty)", async () => {
    // 1. With data
    const { unmount } = renderWithProviders(<OutstandingManager />)

    await waitFor(() => {
      expect(screen.getByText("Ramesh Patel")).toBeDefined()
    })

    const asOfInput = screen.getByLabelText("As of date")
    expect(asOfInput).toBeDefined()
    expect(asOfInput.tagName).toBe("INPUT")

    const tourSelect = screen.getByLabelText("Tour")
    expect(tourSelect).toBeDefined()
    expect(tourSelect.tagName).toBe("SELECT")

    const agingRadiogroup = screen.getByRole("radiogroup", { name: /aging basis/i })
    expect(agingRadiogroup).toBeDefined()

    const groupByRadiogroup = screen.getByRole("radiogroup", { name: /group by/i })
    expect(groupByRadiogroup).toBeDefined()

    const searchInput = screen.getByLabelText("Search receivables")
    expect(searchInput).toBeDefined()
    expect(searchInput.tagName).toBe("INPUT")

    unmount()

    // 2. Empty state
    vi.spyOn(reportsData, "getOutstandingReport").mockResolvedValueOnce({
      success: true,
      summary: {
        totalOutstanding: 0,
        totalOverdue: 0,
        notDueAmount: 0,
        oldestOverdueDays: 0,
        customersOwingCount: 0,
        totalBookingsOwing: 0,
        bucketTotals: { "not-due": 0, "0-30": 0, "31-60": 0, "61-90": 0, "90-plus": 0 },
        bucketCounts: { "not-due": 0, "0-30": 0, "31-60": 0, "61-90": 0, "90-plus": 0 },
      },
      customers: [],
    })

    renderWithProviders(<OutstandingManager />)

    await waitFor(() => {
      expect(screen.getByLabelText("As of date")).toBeDefined()
    })
    expect(screen.getByLabelText("Tour")).toBeDefined()
    expect(screen.getByRole("radiogroup", { name: /aging basis/i })).toBeDefined()
    expect(screen.getByRole("radiogroup", { name: /group by/i })).toBeDefined()
    expect(screen.getByLabelText("Search receivables")).toBeDefined()
  })

  it("renders StatementModal preview iframe with restrictive sandbox without scripts/popups/top-navigation/forms", async () => {
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

    renderWithProviders(<OutstandingManager />)

    await waitFor(() => {
      expect(screen.getByText("Ramesh Patel")).toBeDefined()
    })

    const statementButtons = screen.getAllByRole("button", { name: /statement/i })
    fireEvent.click(statementButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/Customer Statement — Ramesh Patel/i)).toBeDefined()
    })

    // Find the preview iframe once statement HTML has rendered
    await waitFor(() => {
      const iframe = document.querySelector("iframe")
      expect(iframe).not.toBeNull()
    })

    const iframe = document.querySelector("iframe")
    const sandboxAttr = iframe.getAttribute("sandbox") || ""
    expect(sandboxAttr).toContain("allow-same-origin")
    expect(sandboxAttr).toContain("allow-modals")
    expect(sandboxAttr).not.toContain("allow-scripts")
    expect(sandboxAttr).not.toContain("allow-popups")
    expect(sandboxAttr).not.toContain("allow-top-navigation")
    expect(sandboxAttr).not.toContain("allow-forms")
  })
})
