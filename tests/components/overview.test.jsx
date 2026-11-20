import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import DashboardHome from "../../src/components/dashboard/DashboardHome"
import { mockBookings, mockTours, mockUser } from "../fixtures/mockData"
import { renderWithProviders } from "../testUtils"

describe("Overview Screen (DashboardHome Component)", () => {
  it("renders overview metrics and recent bookings with full mock data", () => {
    const { container } = renderWithProviders(
      <DashboardHome
        bookings={mockBookings}
        tours={mockTours}
        filteredBookings={mockBookings}
        user={mockUser}
        setActiveTab={vi.fn()}
        setShowAllInvoices={vi.fn()}
        setSelectedBooking={vi.fn()}
        setEditingBooking={vi.fn()}
        handleDeleteBooking={vi.fn()}
        handleCancelBooking={vi.fn()}
        handleMarkPaymentPaid={vi.fn()}
        handleVoidPayment={vi.fn()}
      />
    )

    // Verify key metric labels
    expect(screen.getAllByText("Total Revenue").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Active Bookings").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Total Travelers").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Pending Dues").length).toBeGreaterThan(0)

    // Verify passenger and tour items in recent bookings list
    expect(screen.getAllByText("Ramesh Patel").length).toBeGreaterThan(0)
    expect(screen.getAllByText(/INV-2026-27-001/).length).toBeGreaterThan(0)

    // Ensure DOM tree rendered without crashing
    expect(container).toBeDefined()
  })

  it("renders cleanly without errors when bookings and tours are empty", () => {
    const { container } = renderWithProviders(
      <DashboardHome
        bookings={[]}
        tours={[]}
        filteredBookings={[]}
        user={mockUser}
        setActiveTab={vi.fn()}
        setShowAllInvoices={vi.fn()}
        setSelectedBooking={vi.fn()}
        setEditingBooking={vi.fn()}
        handleDeleteBooking={vi.fn()}
        handleCancelBooking={vi.fn()}
        handleMarkPaymentPaid={vi.fn()}
        handleVoidPayment={vi.fn()}
      />
    )

    expect(screen.getByText("Total Revenue")).toBeDefined()
    expect(screen.getByText("Active Bookings")).toBeDefined()
    expect(container).toBeDefined()
  })
})
