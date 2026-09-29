import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { escapeCsvValue, toCsvString } from "../src/utils/csv.js"

describe("CSV Export Utility", () => {
  it("quotes simple values", () => {
    assert.equal(escapeCsvValue("Hello"), '"Hello"')
    assert.equal(escapeCsvValue(1234), '"1234"')
  })

  it("safely handles null and undefined", () => {
    assert.equal(escapeCsvValue(null), '""')
    assert.equal(escapeCsvValue(undefined), '""')
  })

  it("escapes internal double quotes by doubling them", () => {
    const input = 'Bus "Volvo AC" 36S'
    const output = escapeCsvValue(input)
    assert.equal(output, '"Bus ""Volvo AC"" 36S"')
  })

  it("escapes fields containing commas and newlines", () => {
    const withComma = "Sharma, Ramesh"
    assert.equal(escapeCsvValue(withComma), '"Sharma, Ramesh"')

    const withNewline = "Line 1\nLine 2"
    assert.equal(escapeCsvValue(withNewline), '"Line 1\nLine 2"')
  })

  it("neutralizes spreadsheet formula injection (=, +, -, @)", () => {
    assert.equal(escapeCsvValue("=SUM(A1:A10)"), `"'=SUM(A1:A10)"`)
    assert.equal(escapeCsvValue("+123456789"), `"'+123456789"`)
    assert.equal(escapeCsvValue("-CMD|' /C calc'!A0"), `"'-CMD|' /C calc'!A0"`)
    assert.equal(escapeCsvValue("@admin"), `"'@admin"`)
  })

  it("prepends UTF-8 BOM (\uFEFF) for Excel compatibility and joins with CRLF", () => {
    const rows = [
      ["Seat", "Passenger", "City"],
      ["L1", "રાહુલ પટેલ", "અમદાવાદ"],
      ["U1", "अमित शाह", "मुंबई"],
    ]

    const csv = toCsvString(rows)

    // Checks UTF-8 Byte Order Mark
    assert.ok(csv.startsWith("\uFEFF"), "CSV output must start with UTF-8 BOM")

    // Checks CRLF row endings
    assert.ok(csv.includes("\r\n"))

    // Checks multilingual non-ASCII preservation
    assert.ok(csv.includes("રાહુલ પટેલ"))
    assert.ok(csv.includes("अमित शाह"))
  })
})
