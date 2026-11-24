import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import CustomerManager from "../../src/components/customers/CustomerManager"
import { renderWithProviders } from "../testUtils"
import * as customerData from "../../src/data/customers"

describe("Customer Linker Banner Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders singular grammar '1 booking needs attention' when count is 1", async () => {
    vi.spyOn(customerData, "listCustomers").mockResolvedValue({
      customers: [],
      pagination: { total: 0, totalPages: 1 },
      counts: {
        total: 0,
        repeat: 0,
        withOutstanding: 0,
        unlinkedBookingsCount: 1,
        unresolvedBookings: [
          {
            bookingId: "b-01",
            invoiceNo: "YHB-001",
            reasonCode: "MISSING_PHONE",
            reasonDescription: "Booking has no contact mobile number.",
          },
        ],
      },
    })

    renderWithProviders(<CustomerManager />)

    await waitFor(() => {
      expect(screen.getByText("1 booking needs attention")).toBeDefined()
    })
    expect(screen.getByText("Some older bookings are not linked to customer profiles.")).toBeDefined()
    expect(screen.getByRole("button", { name: /link now/i })).toBeDefined()
  })

  it("renders plural grammar '2 bookings need attention' when count is 2", async () => {
    vi.spyOn(customerData, "listCustomers").mockResolvedValue({
      customers: [],
      pagination: { total: 0, totalPages: 1 },
      counts: {
        total: 0,
        repeat: 0,
        withOutstanding: 0,
        unlinkedBookingsCount: 2,
        unresolvedBookings: [],
      },
    })

    renderWithProviders(<CustomerManager />)

    await waitFor(() => {
      expect(screen.getByText("2 bookings need attention")).toBeDefined()
    })
  })

  it("clicking 'Link now' calls linkCustomerBookings and reloads customers", async () => {
    const linkSpy = vi.spyOn(customerData, "linkCustomerBookings").mockResolvedValue({
      success: true,
      message: "Successfully linked 1 booking(s).",
      summary: { scanned: 1, linked: 1, skipped: 0 },
    })

    const listSpy = vi.spyOn(customerData, "listCustomers")
      .mockResolvedValueOnce({
        customers: [],
        pagination: { total: 0, totalPages: 1 },
        counts: {
          total: 0,
          repeat: 0,
          withOutstanding: 0,
          unlinkedBookingsCount: 1,
          unresolvedBookings: [],
        },
      })
      .mockResolvedValueOnce({
        customers: [],
        pagination: { total: 0, totalPages: 1 },
        counts: {
          total: 1,
          repeat: 0,
          withOutstanding: 0,
          unlinkedBookingsCount: 0,
          unresolvedBookings: [],
        },
      })

    renderWithProviders(<CustomerManager />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /link now/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole("button", { name: /link now/i }))

    await waitFor(() => {
      expect(linkSpy).toHaveBeenCalledTimes(1)
      expect(listSpy).toHaveBeenCalledTimes(2)
    })
  })

  it("shows unresolved bookings list and calls onEditBooking when clicked", async () => {
    const editBookingSpy = vi.fn()

    vi.spyOn(customerData, "listCustomers").mockResolvedValue({
      customers: [],
      pagination: { total: 0, totalPages: 1 },
      counts: {
        total: 0,
        repeat: 0,
        withOutstanding: 0,
        unlinkedBookingsCount: 1,
        unresolvedBookings: [
          {
            bookingId: "b-unresolved-123",
            invoiceNo: "YHB-UNR-001",
            reasonCode: "MISSING_PHONE",
            reasonDescription: "Booking has no contact mobile number.",
          },
        ],
      },
    })

    renderWithProviders(<CustomerManager onEditBooking={editBookingSpy} />)

    await waitFor(() => {
      expect(screen.getByText("1 booking needs attention")).toBeDefined()
    })

    // Click toggle to view list
    const toggleBtn = screen.getByRole("button", { name: /view 1 unlinked booking/i })
    fireEvent.click(toggleBtn)

    expect(screen.getByText("YHB-UNR-001")).toBeDefined()
    expect(screen.getByText("Booking has no contact mobile number.")).toBeDefined()

    // Click Open booking
    const openBtn = screen.getByRole("button", { name: /open booking/i })
    fireEvent.click(openBtn)

    expect(editBookingSpy).toHaveBeenCalledWith("b-unresolved-123")
  })

  it("does not render banner when unlinkedBookingsCount is 0", async () => {
    vi.spyOn(customerData, "listCustomers").mockResolvedValue({
      customers: [],
      pagination: { total: 0, totalPages: 1 },
      counts: {
        total: 0,
        repeat: 0,
        withOutstanding: 0,
        unlinkedBookingsCount: 0,
        unresolvedBookings: [],
      },
    })

    renderWithProviders(<CustomerManager />)

    await waitFor(() => {
      expect(screen.queryByText(/needs attention/i)).toBeNull()
      expect(screen.queryByText(/need attention/i)).toBeNull()
    })
  })
})
