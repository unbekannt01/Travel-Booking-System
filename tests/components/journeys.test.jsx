import { describe, it, expect, vi } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { Bus, Users } from "lucide-react"
import JourneyManager from "../../src/components/JourneyManager"
import { StatCard } from "../../src/components/ui/StatCard"
import { mockBookings, mockUser } from "../fixtures/mockData"
import { renderWithProviders } from "../testUtils"

describe("Journeys Screen (JourneyManager Component)", () => {
  it("renders Coaches & Departures tab with mock departures", () => {
    const { container } = renderWithProviders(
      <JourneyManager
        bookings={mockBookings}
        user={mockUser}
        onUpdateBooking={vi.fn()}
      />
    )

    expect(screen.getByText(/Coaches & Departures/)).toBeDefined()
    expect(screen.getByText("Boarding Manifest")).toBeDefined()

    // Tour name rendered in departures card
    expect(screen.getAllByText("Chardham Special Yatra 2026").length).toBeGreaterThan(0)
    expect(container).toBeDefined()
  })

  it("switches to Boarding Manifest tab and displays manifest statistics without crashing", () => {
    renderWithProviders(
      <JourneyManager
        bookings={mockBookings}
        user={mockUser}
        onUpdateBooking={vi.fn()}
      />
    )

    // Click Boarding Manifest tab
    const manifestTab = screen.getByText("Boarding Manifest")
    fireEvent.click(manifestTab)

    // Manifest KPI cards
    expect(screen.getByText("Bookings Count")).toBeDefined()
    expect(screen.getByText("Total Passengers")).toBeDefined()
    expect(screen.getByText("Checked In / Boarded")).toBeDefined()

    // Passenger row
    expect(screen.getAllByText("Ramesh Patel").length).toBeGreaterThan(0)
  })

  it("renders cleanly without errors when bookings array is empty", () => {
    renderWithProviders(
      <JourneyManager
        bookings={[]}
        user={mockUser}
        onUpdateBooking={vi.fn()}
      />
    )

    expect(screen.getByText("No Departures Found")).toBeDefined()

    const manifestTab = screen.getByText("Boarding Manifest")
    fireEvent.click(manifestTab)

    expect(screen.getByText("No Passengers Found")).toBeDefined()
  })

  it("REGRESSION: handles legacy bookings lacking passengers array without throwing", () => {
    const malformedBookings = [
      {
        _id: "b-malformed-1",
        id: "b-malformed-1",
        invoiceNo: "INV-2026-999",
        tourName: "Legacy Tour Without Pax",
        journeyDate: "2026-05-15",
        contactName: "Legacy User",
        totalAmount: 10000,
        advanceReceived: 10000,
        status: "Confirmed",
        passengers: undefined, // undefined passengers
      },
      {
        _id: "b-malformed-2",
        id: "b-malformed-2",
        invoiceNo: "INV-2026-998",
        tourName: "Legacy Tour With Null Pax",
        journeyDate: "2026-05-15",
        contactName: "Null Pax User",
        totalAmount: 5000,
        advanceReceived: 0,
        status: "Confirmed",
        passengers: null, // null passengers
      },
    ]

    expect(() => {
      renderWithProviders(
        <JourneyManager
          bookings={malformedBookings}
          user={mockUser}
          onUpdateBooking={vi.fn()}
        />
      )

      const manifestTab = screen.getByText("Boarding Manifest")
      fireEvent.click(manifestTab)
    }).not.toThrow()

    expect(screen.getAllByText("No passenger details recorded for this booking.").length).toBeGreaterThan(0)
  })

  it("REGRESSION: StatCard defensively accepts React element OR component function for icon", () => {
    // 1. Element icon
    const { container: c1 } = renderWithProviders(
      <StatCard label="Element Test" value="10" icon={<Bus size={18} />} tone="brand" />
    )
    expect(screen.getByText("Element Test")).toBeDefined()
    expect(c1.querySelector("svg")).toBeDefined()

    // 2. Component function icon (e.g. icon={Users})
    const { container: c2 } = renderWithProviders(
      <StatCard label="Component Test" value="20" icon={Users} tone="accent" />
    )
    expect(screen.getByText("Component Test")).toBeDefined()
    expect(c2.querySelector("svg")).toBeDefined()
  })
})
