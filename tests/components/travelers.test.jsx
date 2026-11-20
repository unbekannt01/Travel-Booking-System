import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import PassengerManagement from "../../src/components/PassengerManagement"
import { mockBookings, mockUser } from "../fixtures/mockData"
import { renderWithProviders } from "../testUtils"

describe("Travelers Screen (PassengerManagement Component)", () => {
  it("renders passenger list, search bar, and filter chips with mock bookings", () => {
    const { container } = renderWithProviders(
      <PassengerManagement
        bookings={mockBookings}
        user={mockUser}
        onEditBooking={vi.fn()}
      />
    )

    // Passengers search bar and filter controls
    expect(screen.getByLabelText("Search travelers")).toBeDefined()
    expect(screen.getByLabelText("Filter by destination")).toBeDefined()

    // Passenger names rendered
    expect(screen.getAllByText("Ramesh Patel").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Sita Patel").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Amit Shah").length).toBeGreaterThan(0)

    // Masked Aadhaar check
    expect(screen.getAllByText("XXXX-XXXX-1234").length).toBeGreaterThan(0)

    expect(container).toBeDefined()
  })

  it("renders empty state cleanly when no bookings exist", () => {
    const { container } = renderWithProviders(
      <PassengerManagement
        bookings={[]}
        user={mockUser}
        onEditBooking={vi.fn()}
      />
    )

    expect(screen.getByText("No travelers found")).toBeDefined()
    expect(container).toBeDefined()
  })
})
