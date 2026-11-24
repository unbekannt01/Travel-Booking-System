import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { Input, Select, Textarea } from "../../src/components/ui"

describe("UI Primitives (Input, Select, Textarea) Label Prop DOM Sanitization", () => {
  it("Input does not leak 'label' attribute to DOM and sets accessible name", () => {
    const { container } = render(<Input label="From Date" name="from" />)
    const input = container.querySelector("input")
    expect(Boolean(input)).toBe(true)
    expect(input.hasAttribute("label")).toBe(false)
    expect(input.getAttribute("aria-label")).toBe("From Date")
  })

  it("Input preserves explicit aria-label when provided alongside label prop", () => {
    const { container } = render(<Input label="Internal Label" aria-label="Explicit Aria Label" />)
    const input = container.querySelector("input")
    expect(input.hasAttribute("label")).toBe(false)
    expect(input.getAttribute("aria-label")).toBe("Explicit Aria Label")
  })

  it("Select does not leak 'label' attribute to DOM and sets accessible name", () => {
    const { container } = render(
      <Select label="Tour Filter" name="tour">
        <option value="all">All Tours</option>
      </Select>
    )
    const select = container.querySelector("select")
    expect(Boolean(select)).toBe(true)
    expect(select.hasAttribute("label")).toBe(false)
    expect(select.getAttribute("aria-label")).toBe("Tour Filter")
  })

  it("Textarea does not leak 'label' attribute to DOM and sets accessible name", () => {
    const { container } = render(<Textarea label="Notes" name="notes" />)
    const textarea = container.querySelector("textarea")
    expect(Boolean(textarea)).toBe(true)
    expect(textarea.hasAttribute("label")).toBe(false)
    expect(textarea.getAttribute("aria-label")).toBe("Notes")
  })
})
