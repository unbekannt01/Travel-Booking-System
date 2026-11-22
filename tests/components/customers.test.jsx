import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import CustomerManager from "../../src/components/customers/CustomerManager"
import { renderWithProviders } from "../testUtils"
import * as customerData from "../../src/data/customers"

const mockCustomersList = [
  {
    _id: "c-101",
    id: "c-101",
    name: "Ramesh Patel",
    phone: "9876543210",
    email: "ramesh@example.com",
    city: "Ahmedabad",
    language: "gu",
    tags: ["vip", "group-leader"],
    notes: "Senior group leader for Chardham yatra",
    whatsappOptOut: false,
    aliases: ["Ramesh Bhai"],
    summary: {
      totalBookings: 3,
      totalPassengers: 12,
      totalBookedRevenue: 45000,
      totalCollected: 35000,
      totalOutstanding: 10000,
      totalCancelledBookings: 0,
      totalCancellationFees: 0,
      firstBookingDate: "2025-05-10",
      lastBookingDate: "2026-04-12",
      isRepeat: true,
      destinations: ["Chardham Special", "Dwarka Somnath"],
    },
  },
  {
    _id: "c-102",
    id: "c-102",
    name: "Suresh Shah",
    phone: "9825098765",
    email: "suresh@example.com",
    city: "Surat",
    language: "en",
    tags: ["agent"],
    notes: "",
    whatsappOptOut: true,
    aliases: [],
    summary: {
      totalBookings: 1,
      totalPassengers: 2,
      totalBookedRevenue: 15000,
      totalCollected: 15000,
      totalOutstanding: 0,
      totalCancelledBookings: 0,
      totalCancellationFees: 0,
      firstBookingDate: "2026-03-01",
      lastBookingDate: "2026-03-01",
      isRepeat: false,
      destinations: ["Kashi Yatra"],
    },
  },
]

describe("Customer Directory Screen (CustomerManager Component)", () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(customerData, "listCustomers").mockResolvedValue({
      customers: mockCustomersList,
      pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
      counts: { total: 2, repeat: 1, withOutstanding: 1, unlinkedBookingsCount: 3 },
    })
    vi.spyOn(customerData, "getCustomer").mockImplementation((id) => {
      const cust = mockCustomersList.find((c) => c.id === id || c._id === id) || mockCustomersList[0]
      return Promise.resolve({
        customer: cust,
        summary: cust.summary,
        bookings: [
          {
            _id: "b-cust-1",
            id: "b-cust-1",
            invoiceNo: "YHB-2026-001",
            tourName: "Chardham Special",
            journeyDate: "2026-04-12",
            totalAmount: 30000,
            advanceReceived: 20000,
            isPaid: false,
            status: "Confirmed",
          },
        ],
      })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders Customer Directory with StatCards, filters, and customer rows", async () => {
    const { container } = renderWithProviders(<CustomerManager />)

    expect(screen.getByText("Customer Directory")).toBeDefined()
    expect(screen.getByText("Add Customer")).toBeDefined()
    expect(screen.getByText("Export CSV")).toBeDefined()

    // Wait for customer rows to appear
    await waitFor(() => {
      expect(screen.getAllByText("Ramesh Patel").length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText("Suresh Shah").length).toBeGreaterThanOrEqual(1)
    })

    // StatCard KPIs
    expect(screen.getByText("Total Customers")).toBeDefined()
    expect(screen.getByText("Repeat Travelers")).toBeDefined()
    expect(screen.getByText("With Outstanding")).toBeDefined()

    // Unlinked bookings attention banner
    expect(screen.getByText(/3 bookings need attention/i)).toBeDefined()

    expect(container).toBeDefined()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("opens Add Customer modal when Add Customer button is clicked", async () => {
    renderWithProviders(<CustomerManager />)

    await waitFor(() => {
      expect(screen.getByText("Add Customer")).toBeDefined()
    })

    fireEvent.click(screen.getByText("Add Customer"))

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText("Customer Name")).toBeDefined()
      expect(screen.getByText("Mobile Number")).toBeDefined()
      expect(screen.getByText("Preferred Language")).toBeDefined()
    })
  })

  it("opens CustomerDrawer when a customer row is clicked", async () => {
    renderWithProviders(<CustomerManager />)

    await waitFor(() => {
      expect(screen.getAllByText("Ramesh Patel").length).toBeGreaterThanOrEqual(1)
    })

    // Click on customer row
    fireEvent.click(screen.getAllByText("Ramesh Patel")[0])

    // Drawer should open and load customer details
    await waitFor(() => {
      expect(screen.getByText("Contact & Profile Information")).toBeDefined()
      expect(screen.getByText("Booking History (1)")).toBeDefined()
      expect(screen.getByText(/YHB-2026-001/)).toBeDefined()
    })
  })

  it("renders calm inline RateLimitNotice when listCustomers encounters HTTP 429", async () => {
    vi.spyOn(customerData, "listCustomers").mockRejectedValue({
      status: 429,
      message: "Too many requests, please wait 60 seconds",
    })

    renderWithProviders(<CustomerManager />)

    await waitFor(() => {
      expect(screen.getByText("Customer Directory Rate Limited")).toBeDefined()
    })
  })
})
