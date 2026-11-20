import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import BookingForm from "../../src/components/BookingForm"
import { mockTours, mockBookings } from "../fixtures/mockData"
import { renderWithProviders } from "../testUtils"

describe("Booking Form Steps (BookingForm Component)", () => {
  it("renders Step 1 (Tour & Departure Selection) cleanly", () => {
    const { container } = renderWithProviders(
      <BookingForm
        tours={mockTours}
        bookings={mockBookings}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    // Back to overview
    expect(screen.getByText("Back to Overview")).toBeDefined()

    // Step navigation
    expect(screen.getAllByText(/Tour/i).length).toBeGreaterThan(0)

    // Destination options
    expect(screen.getAllByText("Chardham Special Yatra 2026").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Saurashtra Darshan").length).toBeGreaterThan(0)

    expect(container).toBeDefined()
  })

  it("renders edit booking mode with pre-populated passengers and seats without crashing", () => {
    const { container } = renderWithProviders(
      <BookingForm
        tours={mockTours}
        bookings={mockBookings}
        editData={mockBookings[0]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText(/Editing Invoice/)).toBeDefined()
    expect(screen.getByDisplayValue("Ramesh Patel")).toBeDefined()
    expect(container).toBeDefined()
  })
})
