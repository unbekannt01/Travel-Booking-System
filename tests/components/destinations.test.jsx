import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import TourInventory from "../../src/components/TourInventory"
import { mockTours } from "../fixtures/mockData"
import { renderWithProviders } from "../testUtils"

describe("Destinations Screen (TourInventory Component)", () => {
  it("renders tour catalog with destinations and bus configurations", () => {
    const { container } = renderWithProviders(
      <TourInventory
        tours={mockTours}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByText("Add Destination")).toBeDefined()
    expect(screen.getAllByText("Chardham Special Yatra 2026").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Saurashtra Darshan").length).toBeGreaterThan(0)
    expect(container).toBeDefined()
  })

  it("renders empty state cleanly when tours list is empty", () => {
    const { container } = renderWithProviders(
      <TourInventory
        tours={[]}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByText("No destinations yet")).toBeDefined()
    expect(container).toBeDefined()
  })
})
