import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Tabs } from "../../src/components/ui/Tabs"

describe("Tabs Component (WAI-ARIA & Accessibility)", () => {
  const sampleItems = [
    { id: "tab-1", label: "First Tab", content: <div>Panel One Content</div> },
    { id: "tab-2", label: "Second Tab", content: <div>Panel Two Content</div> },
    { id: "tab-3", label: "Third Tab (Disabled)", disabled: true, content: <div>Panel Three</div> },
  ]

  it("renders tablist with accessible attributes and valid aria-controls targeting mounted panels", () => {
    const { container } = render(<Tabs items={sampleItems} defaultValue="tab-1" />)

    const tablist = screen.getByRole("tablist", { name: "Tabs" })
    expect(tablist).toBeDefined()

    const tabs = screen.getAllByRole("tab")
    expect(tabs.length).toBe(3)

    // First tab is active
    const firstTab = tabs[0]
    expect(firstTab.getAttribute("aria-selected")).toBe("true")
    expect(firstTab.getAttribute("tabindex")).toBe("0")

    const activeControlsId = firstTab.getAttribute("aria-controls")
    expect(activeControlsId).toBeTruthy()

    // Panel exists in DOM with matching ID, role, and aria-labelledby
    const activePanel = container.querySelector(`#${activeControlsId}`)
    expect(activePanel).not.toBeNull()
    expect(activePanel.getAttribute("role")).toBe("tabpanel")
    expect(activePanel.getAttribute("aria-labelledby")).toBe(firstTab.id)

    // Inactive tab must NOT have aria-controls pointing to non-existent DOM element
    const secondTab = tabs[1]
    expect(secondTab.getAttribute("aria-selected")).toBe("false")
    expect(secondTab.getAttribute("tabindex")).toBe("-1")
    expect(secondTab.getAttribute("aria-controls")).toBeNull()

    // Disabled tab
    const thirdTab = tabs[2]
    expect(thirdTab.hasAttribute("disabled")).toBe(true)
  })

  it("switches tab and updates aria-selected and aria-controls on click", () => {
    const handleChange = vi.fn()
    const { container } = render(<Tabs items={sampleItems} defaultValue="tab-1" onChange={handleChange} />)

    const tabs = screen.getAllByRole("tab")
    const secondTab = tabs[1]

    fireEvent.click(secondTab)
    expect(handleChange).toHaveBeenCalledWith("tab-2")

    // Second tab is now active
    expect(secondTab.getAttribute("aria-selected")).toBe("true")
    const secondControlsId = secondTab.getAttribute("aria-controls")
    expect(secondControlsId).toBeTruthy()

    const secondPanel = container.querySelector(`#${secondControlsId}`)
    expect(secondPanel).not.toBeNull()
    expect(screen.getByText("Panel Two Content")).toBeDefined()

    // First tab now has no aria-controls
    expect(tabs[0].getAttribute("aria-controls")).toBeNull()
  })

  it("supports keyboard arrow navigation and skips disabled tabs", () => {
    render(<Tabs items={sampleItems} defaultValue="tab-1" />)

    const tabs = screen.getAllByRole("tab")
    const firstTab = tabs[0]

    // ArrowRight to next enabled tab (tab-2)
    fireEvent.keyDown(firstTab, { key: "ArrowRight" })
    expect(tabs[1].getAttribute("aria-selected")).toBe("true")

    // ArrowRight from tab-2 skips disabled tab-3 and wraps to tab-1
    fireEvent.keyDown(tabs[1], { key: "ArrowRight" })
    expect(tabs[0].getAttribute("aria-selected")).toBe("true")
  })

  it("leaves aria-controls undefined when items do not provide content or panelId", () => {
    const noContentItems = [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
    ]
    render(<Tabs items={noContentItems} defaultValue="a" />)

    const tabs = screen.getAllByRole("tab")
    expect(tabs[0].getAttribute("aria-controls")).toBeNull()
    expect(tabs[1].getAttribute("aria-controls")).toBeNull()
  })
})
