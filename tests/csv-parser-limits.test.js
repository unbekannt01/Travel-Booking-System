import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseCsv, CSV_PARSER_LIMITS } from "../shared/csv.js"

describe("CSV Parser Limits Unit Tests (Part 6c-fix)", () => {
  it("exports canonical CSV_PARSER_LIMITS matching system policy", () => {
    assert.equal(CSV_PARSER_LIMITS.MAX_BYTES, 1000000, "1,000,000 bytes max file size")
    assert.equal(CSV_PARSER_LIMITS.MAX_ROWS, 2000, "2,000 max data rows")
    assert.equal(CSV_PARSER_LIMITS.MAX_COLS, 30, "30 max columns per row")
    assert.equal(CSV_PARSER_LIMITS.MAX_CELL, 500, "500 max characters per cell")
    assert.equal(CSV_PARSER_LIMITS.MAX_CELL_CHARS, 500, "500 max characters per cell alias")
  })

  it("enforces max file byte size limit (1 MB)", () => {
    // Construct a string exceeding 1,000,000 bytes
    const largeHeader = "col1,col2\n"
    const largeData = "a,".repeat(500001) // > 1,000,000 bytes
    const text = largeHeader + largeData

    assert.throws(
      () => parseCsv(text),
      (err) => err.code === "TOO_LARGE"
    )
  })

  it("enforces max row count limit (2,000 rows)", () => {
    const header = "col1,col2\n"
    const rows = Array.from({ length: 2001 }, (_, i) => `val1_${i},val2_${i}`).join("\n")
    const text = header + rows

    assert.throws(
      () => parseCsv(text),
      (err) => err.code === "TOO_MANY_ROWS"
    )
  })

  it("enforces max column limit (30 columns)", () => {
    // 31 columns header
    const headers = Array.from({ length: 31 }, (_, i) => `Col_${i + 1}`).join(",")
    const row = Array.from({ length: 31 }, (_, i) => `val_${i + 1}`).join(",")
    const text = `${headers}\n${row}`

    assert.throws(
      () => parseCsv(text),
      (err) => err.code === "TOO_MANY_COLUMNS"
    )
  })

  it("enforces max cell character length limit (500 characters)", () => {
    const longCell = "A".repeat(501)
    const text = `Name,Notes\nTest Customer,"${longCell}"`

    assert.throws(
      () => parseCsv(text),
      (err) => err.code === "CELL_TOO_LONG"
    )
  })

  it("parses valid CSV within limits accurately", () => {
    const text = `Name,Phone,City,Amount\nRajesh Patel,9825012345,Surat,"1,500.50"\nSita Ben,9825054321,Ahmedabad,250`
    const parsed = parseCsv(text)

    assert.equal(parsed.rowCount, 2)
    assert.deepEqual(parsed.headers, ["Name", "Phone", "City", "Amount"])
    assert.equal(parsed.rows.length, 2)
    assert.equal(parsed.rows[0]["Name"], "Rajesh Patel")
    assert.equal(parsed.rows[0]["Amount"], "1,500.50")
  })
})
