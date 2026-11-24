import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  sanitizeCell,
  unsanitizeCell,
  toCsv,
  parseCsv,
  parseMoney,
  parseDate,
  parseBool,
  mapHeaders,
  CUSTOMER_IMPORT_SPEC,
  EXPENSE_IMPORT_SPEC,
  matchExpenseCategory,
  matchExpensePaymentMode,
  CSV_LABELS,
} from "../shared/csv.js"

describe("Pure Shared CSV Engine (Task A)", () => {
  describe("Formula Injection Protection (sanitizeCell / unsanitizeCell)", () => {
    it("prefixes dangerous formula trigger characters with a single quote", () => {
      assert.equal(sanitizeCell("=SUM(A1:A10)"), "'=SUM(A1:A10)")
      assert.equal(sanitizeCell("+12345"), "'+12345")
      assert.equal(sanitizeCell("-CMD"), "'-CMD")
      assert.equal(sanitizeCell("@EXEC"), "'@EXEC")
      assert.equal(sanitizeCell("\tTABBED"), "'\tTABBED")
      assert.equal(sanitizeCell("\rRETURN"), "'\rRETURN")
    })

    it("does not prefix numbers, booleans, or safe strings", () => {
      assert.equal(sanitizeCell(12345), "12345")
      assert.equal(sanitizeCell(0), "0")
      assert.equal(sanitizeCell(true), "true")
      assert.equal(sanitizeCell(false), "false")
      assert.equal(sanitizeCell("Ramesh Patel"), "Ramesh Patel")
      assert.equal(sanitizeCell(""), "")
      assert.equal(sanitizeCell(null), "")
      assert.equal(sanitizeCell(undefined), "")
    })

    it("unsanitizeCell removes leading quote only if preceding a formula trigger", () => {
      assert.equal(unsanitizeCell("'=SUM(A1:A10)"), "=SUM(A1:A10)")
      assert.equal(unsanitizeCell("'+100"), "+100")
      assert.equal(unsanitizeCell("'-100"), "-100")
      assert.equal(unsanitizeCell("'@calc"), "@calc")
      // Legitimate apostrophes in names are preserved
      assert.equal(unsanitizeCell("O'Connor"), "O'Connor")
      assert.equal(unsanitizeCell("'Single"), "'Single")
    })
  })

  describe("CSV Generation (toCsv)", () => {
    it("produces RFC 4180 compliant CSV with UTF-8 BOM by default", () => {
      const columns = [
        { key: "name", label: "Name" },
        { key: "phone", label: "Phone" },
      ]
      const rows = [
        { name: "Suresh Shah", phone: "9825012345" },
        { name: "Patel, Amit", phone: "9825099999" },
      ]

      const csv = toCsv({ columns, rows })
      assert.ok(csv.startsWith("\uFEFF"), "Must start with UTF-8 BOM")
      assert.ok(csv.includes("Name,Phone\r\n"))
      assert.ok(csv.includes('"Patel, Amit",9825099999'))
    })

    it("escapes fields with quotes, commas and formulas safely", () => {
      const columns = ["title", "payload"]
      const rows = [{ title: 'Quote "Test"', payload: "=cmd, /C calc!A0" }]

      const csv = toCsv({ columns, rows, bom: false, eol: "\n" })
      assert.equal(csv, 'title,payload\n"Quote ""Test""","\'=cmd, /C calc!A0"')
    })
  })

  describe("CSV Parser (parseCsv)", () => {
    it("parses valid RFC 4180 CSV with quotes, commas, and multiline cells", () => {
      const input = `\uFEFFName,City,Notes\r\n"Ketan, Jr.",Surat,"Line 1\r\nLine 2"\r\nDeepak,Ahmedabad,Normal note`
      const result = parseCsv(input)

      assert.equal(result.rowCount, 2)
      assert.deepEqual(result.headers, ["Name", "City", "Notes"])
      assert.equal(result.rows[0].Name, "Ketan, Jr.")
      assert.equal(result.rows[0].City, "Surat")
      assert.equal(result.rows[0].Notes, "Line 1\r\nLine 2")
      assert.equal(result.rows[1].Name, "Deepak")
    })

    it("throws stable error codes for bad format and limits", () => {
      // Empty input
      assert.throws(() => parseCsv("   \r\n  "), (err) => err.code === "EMPTY")

      // File too large
      assert.throws(
        () => parseCsv("A,B\r\n1,2", { maxBytes: 5 }),
        (err) => err.code === "TOO_LARGE"
      )

      // Unclosed quote
      assert.throws(
        () => parseCsv('Name,City\r\n"Unclosed text,Surat'),
        (err) => err.code === "BAD_QUOTE"
      )

      // Cell too long
      assert.throws(
        () => parseCsv("Name\r\n" + "X".repeat(100), { maxCell: 50 }),
        (err) => err.code === "CELL_TOO_LONG"
      )

      // Too many columns
      assert.throws(
        () => parseCsv("A,B,C,D\r\n1,2,3,4", { maxCols: 3 }),
        (err) => err.code === "TOO_MANY_COLUMNS"
      )

      // Too many rows
      assert.throws(
        () => parseCsv("A\r\n1\r\n2\r\n3", { maxRows: 2 }),
        (err) => err.code === "TOO_MANY_ROWS"
      )
    })
  })

  describe("Field Parsers & Normalizers", () => {
    it("parseMoney correctly converts rupees to paise and rejects invalid values", () => {
      assert.deepEqual(parseMoney("1500"), { valid: true, paise: 150000 })
      assert.deepEqual(parseMoney("₹1,500.50"), { valid: true, paise: 150050 })
      assert.deepEqual(parseMoney("0"), { valid: true, paise: 0 })
      assert.equal(parseMoney("-500").valid, false)
      assert.equal(parseMoney("invalid").valid, false)
      assert.equal(parseMoney("").valid, false)
    })

    it("parseDate normalizes multiple date formats and rejects impossible dates", () => {
      assert.equal(parseDate("2026-11-24"), "2026-11-24")
      assert.equal(parseDate("24-11-2026"), "2026-11-24")
      assert.equal(parseDate("24/11/2026"), "2026-11-24")
      assert.equal(parseDate("2026/11/24"), "2026-11-24")

      // Leap year check
      assert.equal(parseDate("29-02-2024"), "2024-02-29") // 2024 was leap year
      assert.equal(parseDate("29-02-2026"), null) // 2026 is NOT leap year
      assert.equal(parseDate("31-04-2026"), null) // April has 30 days
      assert.equal(parseDate("invalid"), null)
    })

    it("parseBool supports multilingual affirmation and negation", () => {
      assert.equal(parseBool("true"), true)
      assert.equal(parseBool("yes"), true)
      assert.equal(parseBool("1"), true)
      assert.equal(parseBool("હા"), true) // Gujarati
      assert.equal(parseBool("हाँ"), true) // Hindi

      assert.equal(parseBool("false"), false)
      assert.equal(parseBool("no"), false)
      assert.equal(parseBool("0"), false)
      assert.equal(parseBool("ના"), false) // Gujarati
      assert.equal(parseBool("नहीं"), false) // Hindi

      assert.equal(parseBool("", true), true) // default
    })
  })

  describe("Header Mapping (mapHeaders)", () => {
    it("maps customer CSV headers using English, Hindi, and Gujarati aliases", () => {
      const headers = ["Customer Name", "મોબાઈલ નંબર", "City", "Notes"]
      const mapped = mapHeaders(headers, CUSTOMER_IMPORT_SPEC)

      assert.equal(mapped.mapping["Customer Name"], "name")
      assert.equal(mapped.mapping["મોબાઈલ નંબર"], "phone")
      assert.equal(mapped.mapping["City"], "city")
      assert.equal(mapped.mapping["Notes"], "notes")
      assert.equal(mapped.missingRequired.length, 0)
      assert.equal(mapped.hasUnsafeAadhaarHeader, false)
    })

    it("flags missing required fields and unmapped headers", () => {
      const headers = ["Phone Number", "Random Unrelated Header"]
      const mapped = mapHeaders(headers, CUSTOMER_IMPORT_SPEC)

      assert.equal(mapped.mapping["Phone Number"], "phone")
      assert.ok(mapped.missingRequired.includes("name"))
      assert.deepEqual(mapped.unmapped, ["Random Unrelated Header"])
    })

    it("security guard: identifies Aadhaar headers as unsafe", () => {
      const headers = ["Name", "Phone", "Aadhaar Card", "UID"]
      const mapped = mapHeaders(headers, CUSTOMER_IMPORT_SPEC)

      assert.equal(mapped.hasUnsafeAadhaarHeader, true)
    })
  })

  describe("Category and Payment Mode Matchers", () => {
    it("matches expense category keywords across languages", () => {
      assert.equal(matchExpenseCategory("fuel"), "fuel")
      assert.equal(matchExpenseCategory("Diesel for coach"), "fuel")
      assert.equal(matchExpenseCategory("ટોલ ટેક્સ"), "toll")
      assert.equal(matchExpenseCategory("Driver Bhatta"), "driver-allowance")
      assert.equal(matchExpenseCategory("भोजन"), "food")
      assert.equal(matchExpenseCategory("Dharamshala stay"), "accommodation")
      assert.equal(matchExpenseCategory("something unknown"), "other")
    })

    it("matches expense payment modes", () => {
      assert.equal(matchExpensePaymentMode("GooglePay UPI"), "upi")
      assert.equal(matchExpensePaymentMode("NEFT transfer"), "bank")
      assert.equal(matchExpensePaymentMode("Cheque"), "cheque")
      assert.equal(matchExpensePaymentMode("Cash payment"), "cash")
    })
  })

  describe("Localized UI Labels", () => {
    it("provides complete dictionaries for English, Hindi, and Gujarati", () => {
      for (const lang of ["en", "hi", "gu"]) {
        const dict = CSV_LABELS[lang]
        assert.ok(dict, `Must provide dict for ${lang}`)
        assert.ok(dict.importTitle)
        assert.ok(dict.exportTitle)
        assert.ok(dict.downloadTemplate)
        assert.ok(dict.unsafeAadhaarWarning)
      }
    })
  })
})
