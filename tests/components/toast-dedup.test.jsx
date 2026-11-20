import { describe, it, expect } from "vitest"
import { screen, act } from "@testing-library/react"
import { useToast } from "../../src/components/common/ToastContext"
import { renderWithProviders } from "../testUtils"

function TestToastTrigger() {
  const { toast } = useToast()
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          // Fire 3 identical toasts rapidly in the same tick
          toast.error("Network connection timed out")
          toast.error("Network connection timed out")
          toast.error("Network connection timed out")
        }}
      >
        Trigger Duplicate Toasts
      </button>
      <button
        type="button"
        onClick={() => {
          toast.success("Unique success message")
        }}
      >
        Trigger Unique Toast
      </button>
    </div>
  )
}

describe("Toast De-duplication (ToastProvider)", () => {
  it("suppresses duplicate toasts with identical type and message within 3 seconds", async () => {
    renderWithProviders(<TestToastTrigger />)

    const triggerBtn = screen.getByText("Trigger Duplicate Toasts")

    await act(async () => {
      triggerBtn.click()
    })

    // Assert that only ONE toast element with the message exists in the DOM
    const toastElements = screen.getAllByText("Network connection timed out")
    expect(toastElements.length).toBe(1)
  })

  it("renders distinct toasts when messages differ", async () => {
    renderWithProviders(<TestToastTrigger />)

    const uniqueBtn = screen.getByText("Trigger Unique Toast")

    await act(async () => {
      uniqueBtn.click()
    })

    expect(screen.getByText("Unique success message")).toBeDefined()
  })
})
