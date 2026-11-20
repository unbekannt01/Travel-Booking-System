import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import TourAnalytics from "../../src/components/TourAnalytics"
import { mockBookings } from "../fixtures/mockData"
import { renderWithProviders } from "../testUtils"

describe("Analytics Screen (TourAnalytics Component)", () => {
  it("renders analytics metrics and charts with mock bookings", () => {
    const { container } = renderWithProviders(
      <TourAnalytics bookings={mockBookings} />
    )

    expect(screen.getByText(/Showing analytics for/)).toBeDefined()
    expect(screen.getAllByText("Total Revenue").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Total Bookings").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Pending Payments").length).toBeGreaterThan(0)
    expect(container).toBeDefined()
  })

  it("renders cleanly with empty bookings array", () => {
    const { container } = renderWithProviders(
      <TourAnalytics bookings={[]} />
    )

    expect(screen.getByText("No analytics data available")).toBeDefined()
    expect(container).toBeDefined()
  })
})
