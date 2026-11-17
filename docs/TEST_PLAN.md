# YatraHub (TBS) — Test Strategy & Test Plan

This document details the automated testing architecture, test runner configuration, coverage map across all 14 test suites (84 tests), and identified testing gaps.

---

## 1. Test Architecture & Runner Configuration
YatraHub uses the native Node.js test runner (`node:test`) and Node's strict assertion library (`node:assert/strict`). This eliminates heavy third-party test runners (Jest, Mocha, Vitest) for pure logic testing and provides blazing fast sub-second test execution.

### Test Execution Command:
```bash
npm test
```
*Executes `node --test tests/*.test.js`.*

All tests run in ESM mode with zero transpilation overhead.

---

## 2. Test Suites & Coverage Map (115 Tests / 17 Suites)

| Suite File | Subtests | Core Scenarios Covered |
| :--- | :---: | :--- |
| **`tests/xss-escaping.test.js`** | 6 | **XSS Neutralization & CSP (SEC-001)**: Escapes HTML chars (`&`, `<`, `>`, `"`, `'`); handles null/undefined/primitives; sanitizes hex colors and image URLs; strictly neutralizes hostile scripts across all 6 ticket templates; verifies CSP meta tag embedding. |
| **`tests/server-pricing.test.js`** | 10 | **Server Authority Over Pricing & Seats (SEC-002, SEC-013)**: Recalculates fixed & berth pricing; computes 5% GST; detects client price tampering; validates 2x2 coach row bounds; rejects duplicate seat IDs; verifies double-booking conflict detection. |
| **`tests/auth-security.test.js`** | 15 | **Auth & Data Security Hardening (SEC-004 to SEC-012)**: Enforces password complexity policy (>=10 chars, upper, lower, digit, symbol); verifies AES-256-GCM TOTP secret encryption at rest; validates 12-digit Indian Aadhaar Verhoeff checksum algorithm; verifies AES-256-GCM Aadhaar at-rest encryption; validates session revocation (`tokenVersion`); verifies 15-minute account lockout after 5 failed attempts. |
| **`tests/double-booking.test.js`** | 4 | **Seat Collision & Conflict Engine**: Rejects duplicate seat assignment in same booking (`400`); rejects double-booking same seat on same tour and date (`409`); allows same seat on different date or tour; verifies cancelled bookings release seats. |
| **`tests/invoice-generation.test.js`** | 7 | **Single-Source Invoice Numbers**: Generates tour code acronyms (`DSX`, `CDX`); generates 3-letter month codes (`OCT`); builds prefix; increments zero-collision sequential counters; handles existing numeric sequence gaps. |
| **`tests/payment-calculations.test.js`** | 6 | **Payment Ledger & Balance Engine**: Advance + balance = total; validates partial installment additions; prevents overpayment exceeding remaining balance; calculates refund ledger subtractions; verifies ledger voiding logic. |
| **`tests/pricing-calculations.test.js`** | 6 | **Pricing & GST Engine**: Calculates fixed rupee discount; calculates percentage discount; computes exclusive 5% GST; computes inclusive 5% GST; verifies tax-exempt packages; verifies 2-decimal rupee rounding (`round2`). |
| **`tests/cancellation-ledger.test.js`** | 5 | **Cancellation & Refund Logic**: Full refund when fee is ₹0; partial refund with retained fee; full retention for non-refundable advance; rejects fee exceeding collected amount; rejects negative fee input. |
| **`tests/i18n-documents.test.js`** | 6 | **Customer Documents i18n Dictionary**: Available languages list (`en`, `hi`, `gu`); retrieves English default; retrieves Hindi dictionary; retrieves Gujarati dictionary; fallback for unsupported languages; enforces strict key parity across all dictionaries. |
| **`tests/manifest-boarding.test.js`** | 6 | **Conductor Boarding Manifest**: Generates boarding roster grouped by tour & date; calculates occupancy and boarded percentages; verifies passenger contact and seat details; verifies boarding status toggles. |
| **`tests/passenger-checkin.test.js`** | 5 | **Passenger Check-in State**: Toggles individual passenger check-in; batch check-in ("Board All" / "Unboard All"); verifies seat occupancy during boarding; ensures cancelled passengers cannot be checked in. |
| **`tests/ticket-templates.test.js`** | 5 | **Ticket Template Registry**: Validates registration of all 6 modular templates (`classic`, `modern`, `heritage`, `corporate`, `thermal`, `transit`); fallback resolution for unknown IDs; verifies essential passenger info rendered; renders multi-lingual translations (hi, gu); batch printing page breaks. |
| **`tests/seat-layout.test.js`** | 5 | **Coach Seat Layout & Manifest**: 2x1 coach layout (36 berths); 2x2 coach layout (40 berths); mapped passenger names and invoice numbers against berths; unbooked berths marked Available; cancelled berths released; Upper and Lower deck separation with page breaks. |
| **`tests/csv-export.test.js`** | 6 | **RFC4180 CSV Utility**: Quotes simple values; handles null/undefined safely; escapes internal double quotes (`""`); escapes commas and newlines; neutralizes spreadsheet formula injection (`=`, `+`, `-`, `@`); prepends UTF-8 BOM (`\uFEFF`) and CRLF. |
| **`tests/customer-history.test.js`** | 4 | **Customer Phone Normalization & History**: Normalizes diverse Indian phone formats (`+91`, `0`, spaces, dashes); matches past bookings by customer phone; excludes soft-deleted bookings; handles short/invalid queries safely. |
| **`tests/ui-improvements.test.js`** | 12 | **UI Helpers & State Reducers**: Auto-assign seats (lower deck preference, upper deck preference, skips occupied seats, preserves existing assigned seats, reports unassigned count); soft delete and restore logic (seat release, restores `deletedAt`); search filter chips logic (status chips, multi-field search). |
| **`tests/validators.test.js`** | 7 | **Validation & Formatters**: Indian mobile numbers (valid formats, rejects invalid prefixes/lengths); 12-digit Aadhaar validation (valid formats, rejects alphabetic/short strings); Aadhaar masking (`XXXX XXXX 1234`) and input formatting (`1234 5678 9012`). |

---

## 3. Test Execution Verification

```
TAP version 13
1..41
# tests 115
# suites 25
# pass 115
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

---

## 4. Current Testing Gaps & Roadmap

While the pure business logic and utility coverage is extensive (84 tests passing), the following gaps are scheduled for future phases:

1. **Backend Integration / API Route Tests**:
   - Currently, API endpoints (`/api/bookings`, `/api/payments`, `/api/auth`) are tested manually.
   - *Phase 7 Plan*: Introduce integration tests using an in-memory MongoDB runner (`mongodb-memory-server`) or local test database to test Express route handlers, auth cookies, and Mongoose schema validations.
2. **React Component & UI Unit Tests**:
   - Ticket templates are tested at the HTML generation level, but React DOM rendering is not automated.
   - *Phase 3 Plan*: Add component test fixtures for critical counter components (BookingForm, Seat Map, JourneyManager).
3. **End-to-End (E2E) Browser Workflows**:
   - Multi-step customer reservation, seat lock verification, payment collection, and print preview flow.
   - *Phase 7 Plan*: Smoke test scripts simulating full operator reservation workflows before go-live.
