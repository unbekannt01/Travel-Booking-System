# YatraHub (TBS) — Test Strategy & Test Plan

This document details the automated testing architecture, test runner configuration, coverage map across all 100 test files (417 tests), the Vitest component test safety net (`npm run test:ui`, 92 tests across 19 suites), automated UI smoke suite (`npm run ui:smoke`), and identified testing gaps.

---

## 1. Test Architecture & Runner Configuration

### 1.1 Pure Logic & Backend Test Runner (`node:test`)
YatraHub uses the native Node.js test runner (`node:test`) and Node's strict assertion library (`node:assert/strict`). This eliminates heavy third-party test runners for pure logic, crypto, and business logic testing and provides blazing fast sub-second test execution.

```bash
npm test
```
*Executes `node --test tests/*.test.js`.* All tests run in pure ESM mode with zero transpilation overhead.

### 1.2 Component Test Safety Net (`npm run test:ui`)
To catch runtime React crashes (e.g. invalid array methods on objects, null-pointer exceptions on passenger lists, unhandled prop types in primitives, or missing API error boundaries) before code reaches production or manual review, YatraHub includes a Vitest + `@testing-library/react` + `jsdom` component testing layer:

```bash
npm run test:ui
```
*Executes `vitest run` across `tests/components/**/*.test.jsx`.*

- **Environment**: `jsdom` v25 (ensuring full compatibility with Node 22.12 LTS and zero production vulnerabilities).
- **Setup & Interception (`tests/setup.js`)**: Configures window mocks (`matchMedia`, `ResizeObserver`, `IntersectionObserver`, `scrollTo`) and intercepts `console.error` to fail tests immediately on unhandled React warnings, uncaught boundary exceptions, or unhandled promise rejections.
- **Provider Wrapper (`tests/testUtils.jsx`)**: Renders components wrapped in `ToastProvider` and `ConfirmModalProvider`.
- **Comprehensive Mock Fixtures (`tests/fixtures/mockData.js`)**: Realistic, multi-scenario data covering tours, confirmed/cancelled bookings, legacy bookings lacking passengers array, issued documents across all 6 document types, company profile with bank/UPI settings, and custom invoice templates.

---

## 2. Test Suites & Coverage Map

### 2.1 Component Test Layer (92 Tests / 19 Suites)

| Suite File | Subtests | Core Scenarios Covered |
| :--- | :---: | :--- |
| **`tests/components/data-management.test.jsx`** | 4 | **Data Management & CSV Import/Export Screen (Part 6c)**: Renders Data Management screen with header and primary export cards (Customers, Expenses, Bookings, Cash Book, Receivables); Step 1 Wizard navigates to Import tab, toggles Customer/Expense data type, and handles starter template download; Recent Batches tab renders batch audit table and triggers ConfirmDialog on Undo action; renders calm inline `RateLimitNotice` when export API encounters HTTP 429. |
| **`tests/components/trash.test.jsx`** | 6 | **Trash & History UI Components (Part 6b)**: Renders Trash screen with header, count badges, and table rows; debounced search filtering; disables Restore button with clear reason text when `restore.allowed` is false; opens ConfirmDialog on clicking active Restore button; renders `HistoryDrawer` timeline events with localized action badges and change summaries in English, Hindi, and Gujarati. |
| **`tests/components/cashbook.test.jsx`** | 7 | **Cash Book & Books Close UI Components (Part 6a)**: Renders CashBook screen with 4 StatCards, lock alert banner, and DayBookTable; switches between Single Day and Date Range filters; opens CloseDayModal and validates counted cash discrepancy; opens ReopenCloseModal requiring step-up password and audit reason; renders DayBookTable running cash and bank balances. |
| **`tests/components/reminders.test.jsx`** | 6 | **Payment Reminders UI Components (Part 5c)**: Renders ReminderModal with customer balance, contact details, tone selector, and generated WhatsApp click-to-chat link; enforces 24-hour reminder advisory; renders ReminderTemplateEditor with live simulated preview. |
| **`tests/components/render-loop.test.jsx`** | 14 | **Targeted Render Loop & Commit Count Safety Net (Part 5b-fix, 6a, 6b)**: Bounded React commit counts measured via `<Profiler>`; verifies Tabs, RateLimitNotice, OutstandingManagerContent, StatementModal, CustomerDrawer, CustomerManager, ProfitLossTab, ExpenseTracker (with filters), InvoiceStudio, SettingsPanel, CashBook, Trash, and Dashboard do not trigger infinite re-render loops. |
| **`tests/components/outstanding.test.jsx`** | 7 | **Outstanding Receivables & Aging Screen (Part 5b & 5b-fix)**: Renders OutstandingManager with 4 StatCards, 5 aging bucket cards, and customer rows; toggles between horizontal stacked bar chart and accessible table view; expands customer row to reveal individual booking ledgers; opens StatementModal when Statement action button is clicked; renders RateLimitNotice when API returns HTTP 429; asserts all form controls have accessible names; verifies StatementModal preview iframe uses restrictive sandbox. |
| **`tests/components/profit-loss.test.jsx`** | 5 | **Tour Analytics & Profit/Loss (Part 4b)**: Switches between Analytics Overview and Profit & Loss tabs; verifies 4 KPI StatCards and P&L heading; toggles between Recharts bar chart view and accessible table alternative; opens Detail Drawer on clicking a row and verifies income/expense ledger strictly without customer PII; renders JourneyManager departure card with compact Trip Financials and opens Add Trip Expense modal with prefilled context. |
| **`tests/components/customers.test.jsx`** | 4 | **Customer Directory & Drawer (Part 5a)**: Renders Customer Directory with StatCards, filters, and customer rows; opens Add Customer modal on button click and validates fields; opens CustomerDrawer on row click and displays contact profile and booking history without Aadhaar PII; renders calm inline RateLimitNotice when listCustomers encounters HTTP 429. |
| **`tests/components/expenses.test.jsx`** | 6 | Renders ExpenseTracker with data, StatCards, and table rows; renders EmptyState cleanly when no expenses exist; renders calm inline error card with Retry button when loading fails; opens Add Expense modal and validates required fields; allows interacting with filter chips and search input; regression test for bounded re-renders. |
| **`tests/components/overview.test.jsx`** | 2 | Renders KPI metrics and recent bookings with full mock data; renders cleanly with empty state when bookings/tours array is empty. |
| **`tests/components/travelers.test.jsx`** | 2 | Renders passenger manifest, search input, filter chips, and masked Aadhaar numbers; renders empty state cleanly. |
| **`tests/components/journeys.test.jsx`** | 5 | Renders Coaches & Departures tab; switches to Boarding Manifest tab; displays manifest statistics; regression test for legacy bookings lacking `passengers` array without throwing. |
| **`tests/components/destinations.test.jsx`** | 2 | Renders destination cards, bus configurations, and "Add Destination" action; renders clean empty state when tour list is empty. |
| **`tests/components/analytics.test.jsx`** | 2 | Renders revenue/booking metrics and charts with mock bookings; renders clean empty state when bookings array is empty. |
| **`tests/components/settings.test.jsx`** | 5 | Verifies `DOCUMENT_TYPES` object shape and `DOCUMENT_TYPE_LIST` array of 6 items; renders SettingsPanel tabs with `PanelErrorBoundary`; renders InvoiceStudio loaded state with all 6 document types in preview dropdown; renders InvoiceStudio calm inline error card with Retry button on API failure; renders RateLimitNotice on HTTP 429. |
| **`tests/components/invoices-modal.test.jsx`** | 1 | Renders InvoicesModal with bookings and document issuance controls without crashing; verifies document type dropdown populated with non-credit-note types. |
| **`tests/components/booking-steps.test.jsx`** | 2 | Renders Step 1 (Tour & Departure Selection); renders edit booking mode with pre-populated passengers and seats without crashing. |
| **`tests/components/toast-dedup.test.jsx`** | 2 | Verifies 3-second toast deduplication suppresses duplicate alerts; verifies distinct messages trigger toasts independently. |
| **`tests/components/tabs.test.jsx`** | 4 | Verifies Tabs container, active state transitions, and keyboard accessibility. |

### 2.2 Pure Logic & Unit Test Suites (417 Tests / 100 Test Files / 98 TAP Suites)

| Suite File | Subtests | Core Scenarios Covered |
| :--- | :---: | :--- |
| **`tests/csv-pure.test.js`** | 16 | **CSV Pure Engine & Formula Defense (Part 6c)**: Formula injection defense (prefixes single quote `'` on `=`, `+`, `-`, `@`, `\t`, `\r` and unsanitizes on read); RFC 4180 quote wrapping and escaping; state-machine tokenizer handling CRLF/LF line endings; bounds checking (`TOO_LARGE`, `TOO_MANY_ROWS`, `TOO_MANY_COLUMNS`, `CELL_TOO_LONG`, `BAD_QUOTE`, `EMPTY`); integer paise `parseMoney` converter; `parseDate` ISO and Indian format parser; `parseBool` trilingual parser (en, hi, gu); declarative schema mapping (`mapHeaders`) with auto-aliases in English, Hindi, and Gujarati; unsafe Aadhaar column detection (`hasUnsafeAadhaarHeader`); expense category and payment mode keyword matchers. |
| **`tests/integration-csv.test.js`** | 5 | **CSV Export & Import Express Integration (Part 6c)**: `GET /api/export/:type` delivers UTF-8 BOM (`\uFEFF`), multi-tenant isolation, privacy projection (zero Aadhaar in bookings export), and audit logging; `POST /api/import/:type/preview` validates file, detects books lock violations, rejects Aadhaar headers, and returns signed HMAC-SHA256 token; `POST /api/import/:type/commit` verifies HMAC token, re-validates server-side, tags `importBatchId`, and creates `ImportBatch` document; `POST /api/import/batches/:id/undo` atomically rolls back imported batch, verifying dependencies against closed books and active bookings. |
| **`tests/history-pure.test.js`** | 11 | **History & Restore Pure Engine (Part 6b)**: Validates `HISTORY_ENTITIES` and `TRACKED_FIELDS` whitelist; asserts zero PII leakage on text fields (records `changed: true` without `from`/`to`); integer paise money diffing; date and status diffing; trilingual change summaries in English, Hindi, Gujarati (`summarizeChanges`); `classifyRestore` rejection rules for `BOOKS_LOCKED`, `NUMBER_CONFLICT`, `SEAT_CONFLICT`, `PARENT_DELETED`, `ALREADY_ACTIVE`. |
| **`tests/integration-trash.test.js`** | 4 | **Trash & Restore Express Integration (Part 6b)**: End-to-end soft delete, history logging, and restore; active customer phone collision rejected with HTTP 409 Conflict; books lock enforcement on restore (booking with advance in closed period rejected with HTTP 423 Locked); multi-tenant isolation (User B cannot view or restore User A's trash items). |
| **`tests/cashbook-pure.test.js`** | 10 | **Cash Book & Books Close Pure Engine (Part 6a)**: `modeToAccount` payment mapping; integer paise balance rolling; same-day entry ordering (`TYPE_SORT_ORDER`); `computeClosePreview` difference calculation; standalone HTML day book rendering with strict CSP. |
| **`tests/integration-cashbook.test.js`** | 7 | **Cash Book & Close Day Integration (Part 6a)**: Tenant opening setup; manual entry recording; close day preview and password step-up; books lock rule (HTTP 423 on closed dates); reopen day flow with audit log; multi-tenant isolation. |

| Suite File | Subtests | Core Scenarios Covered |
| :--- | :---: | :--- |
| **`tests/receivables-pure.test.js`** | 6 | **Receivables & Aging Pure Engine (Part 5b)**: Frozen `AGING_BUCKETS` and labels; `toDateString` utility; integer day diff via UTC midnight; bucket classification under `journey` (0-day threshold) and `booking` (30-day credit term) bases; `calculateReceivables` bucket grouping, customer aggregation, unlinked booking grouping, and exact equality with P&L `totalOutstanding`. |
| **`tests/statements-pure.test.js`** | 4 | **Customer Statements & HTML Renderer Pure Logic (Part 5b)**: Chronological transaction ledger with opening balance calculation; same-day deterministic ordering (debits before credits); cancellation flow (reversal, retained cancellation fee, refund) netting to zero; statement closing balance strictly matches receivables total outstanding; pure HTML statement rendering with CSP meta tag and trilingual translations (en, hi, gu). |
| **`tests/integration-outstanding.test.js`** | 5 | **Outstanding & Statement Express Integration Harness (Part 5b)**: Rejects unauthenticated requests with HTTP 401; `GET /api/reports/outstanding` multi-tenant isolation, query schema validation, and zero-Aadhaar PII projection; `GET /api/customers/:id/statement` statement generation and company operator details; statement closing balance parity against receivables engine. |
| **`tests/customers-pure.test.js`** | 8 | **Customer Master Pure Logic (Part 5a)**: `normalizeIndianMobile` stripping prefix/spaces/symbols and rejecting invalid inputs; `isValidEmail` format validation; `pickDisplayName` candidate selection; `CUSTOMER_TAGS` and `CUSTOMER_LANGUAGES` frozen arrays; `summarizeCustomer` accounting metrics calculation matching `shared/profitLoss.js` integer paise rules without float drift; graceful handling of cancelled/empty bookings. |
| **`tests/customers-backend.test.js`** | 7 | **Customer Master Backend Validation & Pure Accounting (Part 5a)**: Zod schemas (`createCustomerSchema`, `updateCustomerSchema`, `customerQuerySchema`) rejecting invalid mobile, tag limit (>5), invalid GSTIN, unknown keys; coerces query params with defaults; verifies customer summary financial rules against cancellation fees and refunds. |
| **`tests/integration-customers.test.js`** | 6 | **Customer Master Express + MongoDB Integration Harness (Part 5a)**: Rejects unauthenticated requests with HTTP 401; creates customer via `POST /api/customers` with CSRF defense and tenant isolation; prevents duplicate phone collision for same tenant (409 Conflict); verifies cross-tenant isolation (different users can register same phone); verifies lookup endpoint `GET /api/customers/lookup?phone=` returns profile strictly without Aadhaar; verifies soft deletion and subsequent re-registration of phone number. |
| **`tests/profit-loss-backend.test.js`** | 10 | **Pure Profit & Loss Engine & Validation (Part 4b)**: `parseTourRef` classifying departure keys, tour names, and general unallocated; `isBookingCancelled` case-insensitive verification; exact accrual vs cash P&L calculations; cancellation financial treatment (advance counted as retained fee, 0 passengers); break-even seats ceiling math and seats remaining; unallocated fleet expenses categorization; Indian FY date boundary resolution (1 Apr - 31 Mar); integer paise accounting avoiding float drift; Zod `tourPnlQuerySchema` validation (rejecting invalid dates, unknown params, non-ISO formats); null margin when revenue is zero. |
| **`tests/integration-pnl.test.js`** | 4 | **Real Express P&L Integration Harness (Part 4b)**: Rejects unauthenticated requests with HTTP 401; verifies strict multi-tenant isolation between User A and User B (no data bleed); asserts strictly zero PII fields in server report payloads; graceful skipping when MongoDB test database is offline. |
| **`tests/expenses-backend.test.js`** | 21 | **Expense Management & Backend Validation (Part 4a & 4b)**: 15 built-in categories frozen array (including `bus_rent` and `staff_salary`) and lookup map; payment modes and statuses frozen arrays; `round2` 2-decimal rupee rounding; `sumAmounts` integer paise accumulation without float drift; `groupByCategory` ranking and percentages; `groupByMonth` Indian FY calendar grouping; `filterExpenses` multi-criteria in-memory filtering; Zod schema validation (`createExpenseSchema`, `updateExpenseSchema`, `listExpenseQuerySchema`) rejecting unknown keys, non-positive amounts, invalid categories, out-of-range dates, and oversize text; CSV formula injection protection (`escapeCsvValue` prefixing with single quote) and UTF-8 BOM encoding; tenant isolation by `userId`; soft delete hiding rows while preserving DB records; summary fixture exact calculation; audit logging contract for expense create/update/delete. |
| **`tests/document-management.test.js`** | 32 | **Multiple Document Types, Snapshots & Credit Notes (Part 3.7a)**: 6 document types registry validation; `financialYearOf` Indian fiscal year boundary calculation (31 Mar vs 1 Apr); `formatNumber` pattern formatting; default settings map; Zod validation (`singleDocumentSettingSchema`, `documentSettingsUpdateSchema`, `issueDocumentInputSchema`, `voidDocumentInputSchema`); document numbering continuity from legacy invoice counters without gaps/duplicates; atomic parallel generation simulation; zero-Aadhaar PII snapshot verification; Credit Note rules (reject non-cancelled, match cancellation refund, idempotency); void flow recording reason and audit details; snapshot immutability against live user profile changes. |
| **`tests/remaining-screens-and-auth.test.js`** | 19 | **Remaining Screens, Auth & Theme Toggle (Part 3.5)**: Password complexity policy (`checkPasswordCriteria` test matrix for length, case, number, symbol); user-friendly auth error mapping (`formatAuthError` for 401, 403, 429, network, and fallback); API status event subscription and emission (`API_STATUS_EVENT`, `subscribeApiStatus`, `emitApiStatus`); `SHOW_THEME_TOGGLE` is explicitly true; all 6 navigation items (`dashboard`, `passengers`, `journey`, `tours`, `analytics`, `settings`) have `hasOwnHeading: false`; `resolvePageMeta` returns non-empty title and description for all tabs; print styles isolate dark mode. |
| **`tests/operational-modals-journey.test.js`** | 18 | **Operational Modals & Journeys Screen (Part 3.4)**: `formatSeatLabel` human parsing (lower/upper sleeper berths, case normalization, fallback handling, custom identifiers); `formatSeatList` with comma separation, overflow truncation (`+N`), and fallback safety; `shellConfig` metadata verification (`journey.hasOwnHeading === false`, `dashboard.hasOwnHeading === false`, `passengers.hasOwnHeading === false`, `tours.hasOwnHeading === false`); boarding math and progress bar values (occupancy %, boarded passenger count); `CancelBookingModal` refund calculation (`totalPaid - fee`), zero-floor bounds checking, fee presets (₹0 fee for full refund, Retain All for 0 refund); `InvoicesModal` multi-field search and payment/cancellation status chip filtering. |
| **`tests/aadhaar-edit-roundtrip.test.js`** | 8 | **Masked Aadhaar Edit Round-Trip (SEC-012 & Task 0)**: Frontend validator detection of masked Aadhaar and `[UNCHANGED]` sentinel token; `isValidAadhaar` with `{ allowMasked: true }`; backend `isMaskedOrUnchangedAadhaar` verification; `BookingForm` Step 1 validation with masked Aadhaar; backend reconciliation preserving existing AES-256-GCM ciphertext on edit; re-encryption of new 12-digit Aadhaar when replaced; explicit clearance of Aadhaar; non-inheritance of Aadhaar by new passengers; guarantees raw masked strings are never persisted; single passenger update (`PUT /:bookingId/passengers/:passengerIdentifier`) reconciliation and encryption. |
| **`tests/overview-and-booking-form.test.js`** | 10 | **Overview & Stepped Booking Form (Part 3.3)**: Bus capacity (`2x1`=36, `2x2`=40) and clamped occupancy %; `getBookingPaymentStatus` (`Cancelled`/`Paid`/`Partial`/`Pending`); KPI & Today's Operations metrics + 7-day departure grouping; recent booking status & search filtering; payment urgency classification (`Overdue`, `Due on boarding`, `Due soon`, `Scheduled`); 4-step booking validation (Steps 0–2 & cross-step `validateAllBookingSteps`, duplicate/conflicting seats, Aadhaar, advance bounds), step click navigation rules, sticky summary composition via `calculatePricing`, server 400/409 error formatting, and `hasOwnHeading: false` shell verification. |
| **`tests/app-shell.test.js`** | 8 | **App Shell & Navigation (Part 3.2)**: Verifies 6 canonical tab IDs & labels; confirms `SHOW_THEME_TOGGLE === true` once all screens migrated; validates `resolvePageMeta` (including New vs Edit Booking and unknown fallback); tests `isNavItemActive`, `isMoreDestinationActive`, `getSkeletonVariant`, and resilient sidebar collapsed-state persistence with a throwing storage mock. |
| **`tests/ui-foundation.test.js`** | 12 | **UI Foundation (Part 3.1)**: `formatINR` Indian digit grouping (lakhs/crores, 0 & 2 decimals, negatives, null/NaN safety); theme preference resolution (`system`/`light`/`dark`) and resilient `localStorage` fallback when storage throws; `applyThemeToDocument`; `STATUS_META` 6-status icon/tone coverage; `getInitials`/`getAvatarTone`; CVA variant classes (tokens, 44px mobile touch targets, focus rings); `cn()` conflict merging. |
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
1..54
# tests 223
# suites 58
# pass 223
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

---

## 3.1 Shell and Navigation Manual Verification Checklist (Part 3.2)

Verify the following manually in a desktop & mobile browser (`npm run dev` on `http://localhost:5173`):

- [ ] **Desktop Expanded & Collapsed (`1440px` & `1024px`)**: Left sidebar expands/collapses cleanly; collapsed items show tooltips on hover/focus; collapsed preference survives a full page reload.
- [ ] **Tablet (`768px`)**: Sidebar hides; top bar menu icon opens the left navigation `Drawer`; bottom bar displays Overview, Travelers, Book, Journeys, and More.
- [ ] **Small Mobile (`360px`)**: Top bar, mobile search input (on Overview), and 5-slot bottom bar fit cleanly without horizontal overflow; all interactive buttons have ≥44px touch targets.
- [ ] **Keyboard-Only Flow**:
  - Press `Tab` on load: "Skip to main content" link becomes visible and jumps focus to `#main-content`.
  - Navigate sidebar/top-bar controls with `Tab` / `Shift+Tab` and confirm visible focus rings.
  - Open mobile `Drawer`, press `Tab` repeatedly to verify focus stays trapped inside the drawer, press `Escape` to close, and verify focus returns to the menu button.
  - Open top-bar user menu, press `Escape` to dismiss.
- [ ] **Every Destination Reachable**: Navigate to Overview (`dashboard`), Travelers (`passengers`), Journeys (`journey`), Destinations (`tours`), Analytics (`analytics`), and Settings (`settings`); verify top-bar title updates and active state shows both left accent bar and bold text (`aria-current="page"`).
- [ ] **New Booking CTA From Every Screen**: Click "New Booking" in the top bar (or center "Book" button on mobile) from each screen; confirm it opens `BookingForm` in create mode (`Edit Booking` when editing an existing record).
- [ ] **Logout**: Trigger Sign Out from both sidebar footer and top-bar user menu (and mobile drawer footer); verify clean return to `Auth`.
- [ ] **Lazy-Load Fallback & Error Recovery**: Throttle network in DevTools (Slow 3G) and switch to Analytics / Journeys to observe `PageSkeleton`; go Offline before loading an unvisited tab to trigger `ChunkErrorBoundary` ("Could not load this page"), restore network, click **Retry**, and verify the screen loads cleanly without losing the shell.

---

## 3.2 Dashboard Overview & Stepped Booking Form Manual Verification Checklist (Part 3.3)

Verify the following manually in desktop & mobile viewports (`360px`, `768px`, `1024px`, `1440px`) after running `npm run dev` (frontend) and `cd backend; npm start` (backend + local MongoDB):

- [ ] **Single Page Header**: Confirm Overview shows a single `Overview` `<h1>` (via shell `PageHeader`) and Booking Form shows `New Booking` / `Edit Booking` with no duplicate `<h2>` heading below it.
- [ ] **Create a Booking End-to-End**:
  - Step 1 (Tour & Date): Select a saved tour (verify bus type, date, and pricing prefill) or choose `+ Manual Entry`; fill Primary Traveler name and 10-digit Indian mobile; click **Next**.
  - Step 2 (Passengers & Seats): Add a second passenger, open **Select seat from coach layout**, pick berths, test **Auto-assign Seats**, enter optional 12-digit Aadhaar; click **Next**.
  - Step 3 (Pricing & Payment): Test flat & `%` discount, GST (0% and 5% exclusive/inclusive), payment mode, and advance payment; confirm sticky summary updates live in `formatINR` tabular numerals; click **Next**.
  - Step 4 (Review): Confirm all entered details appear read-only, passenger Aadhaar displays masked (`XXXX XXXX 1234`), click an **Edit** link to jump back without losing any entered data, return to Review, and click **Confirm Booking**.
- [ ] **Edit Mode**: Open an existing booking from Overview → Edit icon; confirm `Edit Booking` title, invoice badge, prefilled values across all 4 steps, clickable step indicator, and **Update Booking** save behaviour.
- [ ] **Per-Step Validation & Focus Management**: Click **Next** on empty Step 1, invalid age/Aadhaar/duplicate seat on Step 2, or advance > total on Step 3; confirm inline `<Field>` errors, top error summary box, and focus moving to the first invalid field.
- [ ] **Server Validation Errors (`role="alert"`)**:
  - **Seat conflict (HTTP 409)**: Attempt to save a seat already booked in another tab for the same tour and date; verify the top `role="alert"` banner shows the server conflict message and retains all entered form data.
  - **Tampered total rejected (HTTP 400)**: Verify server total-mismatch or invalid-pricing responses render cleanly in the `role="alert"` banner without wiping entered form data.
- [ ] **Overview KPIs, Operations & Departures**: Verify Today's Operations card (no dark gradient mismatch), 4 `StatCard`s with Indian rupee formatting, Upcoming 7-Day Departure cards with accessible berth occupancy bars (`"X of Y berths booked, Z%"`), and Payment Tracking & Ledger urgency badges (`Overdue` / `Due on boarding` / `Due soon` / `Scheduled`) + WhatsApp reminder link.
- [ ] **Search Filtering & Status Chips**: Type in the shell top-bar search input AND local Recent Bookings search + click `All` / `Paid` / `Pending` / `Cancelled`; verify table/card list updates accurately.
- [ ] **Every Row Action**: Test View Invoice (`Eye`), Edit (`Edit3`), Cancel (`Ban`), and Delete + Undo (`Trash2`) from Recent Bookings, plus `View All Invoices`, `Open Manifests`, `Filter` pending dues, and `Assign Seats`.
- [ ] **Empty State**: With 0 bookings (or a non-matching filter), verify `EmptyState` renders without overflow and `"Create your first booking"` opens the form.
- [ ] **Mobile (`360px`) & Keyboard-Only Flow**: Confirm Recent Bookings switches to stacked cards with zero horizontal page scroll, filter chips wrap cleanly, sticky mobile summary expands/collapses above the Back/Next/Save footer without overlapping `MobileBottomNav`, and the entire 4-step form can be completed with keyboard alone.

---

## 3.3 Operational Modals & Journeys Screen Verification Checklist (Part 3.4)

Verify the following manually across desktop & mobile viewports (`360px`, `768px`, `1024px`, `1440px`):

- [ ] **SeatLayoutModal**:
  - Open coach seat modal from Overview recent bookings or Journeys screen; confirm `Modal` backdrop blur, focus trap, Escape key closes modal.
  - Check lower/upper deck tabs, human-readable seat labels (`Lower L1-1`, `Upper R2-2`), occupancy status indicators, print/export buttons functionality.
- [ ] **Journeys Screen (`JourneyManager`)**:
  - Confirm single `Journeys` page heading rendered by `PageHeader` (no double heading in top bar on `lg+`).
  - Verify departure cards with accessible `role="progressbar"`, departure status tags, and bus occupancy rates.
  - Verify boarding checklist on mobile (`<md`) and desktop (`md+`), check-in toggles, seat swap modal, quick collection modal, and manifest print/export untouched.
- [ ] **Record Payment & Payment Ledger (`PaymentTracker`)**:
  - Open Record Payment modal from Overview; verify `Modal` dialog, payment mode select, amount input with bounds checking, receipt generator.
  - Open Payment Ledger; verify payment history table, void transaction modal with destructive prompt confirmation.
- [ ] **Cancel Booking (`CancelBookingModal`)**:
  - Open Cancel Booking dialog; verify `Modal` overlay, preset buttons (₹0 fee for full refund, Retain All for 0 refund), real-time refund calculation (`formatINR`), seat release warning, and `role="alert"` server error presentation.
- [ ] **All Booking Invoices (`InvoicesModal`)**:
  - Open Invoices modal; confirm `Modal` (`size="xl"`), sticky search bar and status filter chips (`All`, `Paid`, `Pending`, `Cancelled`) with `aria-pressed`.
  - Desktop view (`md+`): accessible `Table` with invoice number, status pill, traveler name/phone, tour badge, journey date, passenger count, total amount, and action icon buttons.
  - Mobile view (`<md`): stacked responsive cards with large touch targets (`min-h-11`).
  - Empty state: verify `EmptyState` when search or filter matches 0 invoices.

---

## 3.4 Remaining Screens, Auth & Dark Theme Manual Verification Checklist (Part 3.5)

Verify the following manually across desktop & mobile viewports (`360px`, `768px`, `1024px`, `1440px`):

- [ ] **Dark Theme Switcher**:
  - Open the top bar on desktop or mobile; click the Theme Switcher toggle (`Sun` / `Moon` / `Monitor`).
  - Toggle between `Light`, `Dark`, and `System`; confirm every screen (Overview, Travelers, Journeys, Destinations, Analytics, Settings, Modals) renders seamlessly with dark tokens (`--yh-bg-app`, `--yh-bg-surface`, `--yh-text-primary`, `--yh-border-default`) without unreadable low-contrast text or glaring white cards.
  - Refresh the page; confirm theme preference persists across reload without flash of wrong theme (FOUC).
  - Open print preview on any ticket template, invoice, receipt, or manifest while in Dark mode; verify paper print preview is strictly white background with black text (`@media print` isolation).
- [ ] **Travelers Screen (`PassengerManagement`)**:
  - Single `Travelers` page heading rendered by `PageHeader` (no double heading in top bar on `lg+`).
  - Search toolbar: Type passenger name, phone, city, or seat in `SearchInput`; select Tour from dropdown; click `All` / `Boarded` / `Pending` filter chips.
  - PII Protection & Aadhaar Reveal: Observe masked Aadhaar (`XXXX XXXX 1234`). Click the "Reveal" eye icon; confirm accessible `Modal` dialog opens, fetches and displays full 12-digit Aadhaar, and closes with Escape or Close button.
  - Export CSV: Click "Export CSV"; verify downloaded CSV has UTF-8 BOM, sanitized fields, and spreadsheet formula injection guards.
  - Print Manifest: Click "Print Manifest"; confirm modal opens and prints clean traveler manifest.
- [ ] **Destinations Screen (`TourInventory`)**:
  - Single `Destinations & Packages` page heading rendered by `PageHeader`.
  - Package cards display bus type badge, departure date, duration, pricing breakdown, and action menu.
  - Create Tour: Click "+ New Destination"; confirm `Modal` dialog opens. Type Tour Name and custom prefix; observe real-time Invoice Prefix Preview updating live (e.g. `YHB-DSX-NOV-001`). Switch between "Fixed" and "Per-Berth" pricing modes; save tour.
  - Edit & Delete: Edit existing tour details; delete tour and confirm accessible `ConfirmDialog` prompt appears before deletion.
- [ ] **Analytics Screen (`TourAnalytics`)**:
  - Single `Analytics & Reports` page heading rendered by `PageHeader`.
  - KPI Stat Row: Confirm 4 `StatCard`s render Total Revenue (`formatINR`), Total Bookings, Passenger Count, and Occupancy %.
  - Visualizations: Confirm Area chart (Revenue Trends), Bar chart (Tour Performance), and Donut chart (Payment Status) render cleanly in both Light and Dark modes.
  - Screen Reader Access: Verify hidden data tables (`sr-only`) exist with full data for assistive technology.
  - Destination Table: Desktop `Table` and mobile stacked cards with revenue, booking count, and occupancy bars.
- [ ] **Settings Screen (`SettingsPanel`)**:
  - Single `Settings` page heading rendered by `PageHeader`.
  - 7 Tabs Navigation: Click through Company, Branding, Bank & UPI, Documents, Ticket Templates, Terms & Conditions, and Security tabs.
  - Logo Upload: In Branding tab, upload a valid company logo (< 5MB PNG/JPEG/WEBP); observe instant preview. Attempt uploading an oversized or invalid file; verify error message.
  - Unsaved Changes Bar: Edit a field in any tab; observe sticky bottom bar appear with "You have unsaved changes", "Discard", and "Save Changes" buttons. Save and verify toast notification.
- [ ] **Authentication & Security Screens**:
  - Sign out; verify Auth screen in both Light and Dark mode.
  - Registration password checklist: Switch to Register tab, type password; observe live checklist update for ≥10 characters, uppercase, lowercase, digit, and symbol.
  - Password show/hide toggle: Click eye icon on password input; confirm text toggles between masked and visible.
  - 2FA flows: Test TwoFactorVerify, TwoFactorSetup, Recover2FA, ResetPassword, and Disable2FAModal.
- [ ] **App-Wide States**:
  - 404 Page: Navigate to unknown hash/route; verify `NotFoundPage` renders with "Back to Overview" button.
  - API Unreachable Banner: Stop backend (`Ctrl+C` in backend terminal) or disconnect network; trigger an API action; observe top sticky alert banner "Backend API Unreachable". Restart backend; perform an action; observe banner dismiss automatically.

---

## 3.5 Automated UI Smoke & Accessibility Audit (`npm run ui:smoke`) (Part 3.6)

An automated Playwright and `@axe-core/playwright` smoke runner is provided in `scripts/ui-smoke.mjs`.

### What it tests:
1. **13 Application Views**: Overview (`dashboard`), Travelers (`passengers`), Customers (`customers`), Outstanding (`outstanding`), Journeys (`journey`), Destinations (`tours`), Expenses (`expenses`), Analytics (`analytics`), Profit & Loss (`profit-loss`), Settings (`settings`), Invoice Studio (`invoice-studio`), Stepped Booking Form (`new-booking`), and Dev UI Kit (`ui-kit`).
2. **4 Responsive Viewports**: Small mobile (`360x740`), Tablet (`768x1024`), Laptop/Desktop (`1024x768`), Wide Monitor (`1440x900`).
3. **2 Themes**: Light mode and Dark mode (`data-theme="dark"`).
4. **Horizontal Overflow Guard**: Asserts `document.documentElement.scrollWidth <= document.documentElement.clientWidth` across all viewports.
5. **WCAG 2.1 AA Accessibility Analysis**: Executes `new AxeBuilder({ page })` with `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']` tags to identify any remaining automated accessibility violations.
6. **Console Attribution & Uncaught Page Errors (Section 4)**: Captures console errors/warnings and `pageerror` events with full attribution (screen, tab, viewport, theme, and call site location). Arguments capped at 600 characters to prevent report bloat.
7. **Honest Tab Coverage Table (Section 6)**: Tracks `tabsFound`, `tabsClicked`, and `tabsSkipped` per (screen, viewport, theme) combo; reports failures and unvisited tabs in a structured table and exits non-zero if any non-disabled tab is missed.
8. **Dynamic Per-Screen Budget & Performance (Section 7)**: Scales budget with workload (`Math.max(baseBudgetMs, baseBudgetMs + 2500ms * tabs * viewports * themes)`), overridable via `UI_SMOKE_SCREEN_BUDGET_MS`. Breaches exit non-zero and list skipped sub-views. Also ranks top 5 slowest views, flagging visits > 5000ms.
9. **Report Generation**: Writes detailed markdown report to gitignored `docs/screenshots/report.md` with captured page screenshots.

### Execution Instructions (Windows PowerShell):
```powershell
# 1. Install Playwright browser binary (one-time setup)
npx playwright install chromium

# 2. Start Local MongoDB (if not running as a Windows service)
mongod --dbpath "C:\data\db"

# 3. Start Express Backend (in terminal 1)
cd backend
npm start

# 4. Start Vite Frontend (in terminal 2)
npm run dev

# 5. Run UI Smoke Suite (in terminal 3)
# IMPORTANT: In PowerShell, always use SINGLE QUOTES around passwords containing '$'
# (e.g. 'MyPass$123') to prevent PowerShell from expanding '$' as an empty variable.
$env:UI_SMOKE_EMAIL="operator@yatrahub.local"
$env:UI_SMOKE_PASSWORD='OperatorPassword123!'

# Full smoke run across all screens, viewports, and themes:
npm run ui:smoke

# Fast smoke run (360px & 1440px, light theme only):
npm run ui:smoke -- --quick

# Target a single screen (e.g., profit-loss, settings, invoice-studio, expenses, outstanding):
npm run ui:smoke -- --only=outstanding

# Target specific viewports and skip axe-core checks for visual inspection:
npm run ui:smoke -- --widths=360,1440 --themes=light --skip-axe

# Custom per-step timeout (default is 20,000ms / 20s):
$env:UI_SMOKE_STEP_TIMEOUT_MS="30000"

# Custom base screen budget (default is 90,000ms / 90s):
$env:UI_SMOKE_SCREEN_BUDGET_MS="120000"
npm run ui:smoke -- --quick
```

---

## 3.6 Manual Verification Checklist — Part 3.7a Document Management & Credit Notes

- [ ] **Document Types Dropdown**: Open Invoices modal from Overview; expand any booking row via the Document icon; verify dropdown lists: `Tax Invoice`, `Bill of Supply`, `Quotation`, `Proforma Invoice`, `Booking Confirmation`.
- [ ] **Issue Document**: Select `Quotation`; click `Issue Document`; verify toast notification confirms issuance and document appears in nested list with `QTN-001` (or custom format) and `Issued` pill.
- [ ] **Credit Note Dedicated Flow**: Locate a cancelled booking in Invoices modal; expand row; observe red `Issue Credit Note` button; click it; verify Credit Note is generated with amount equal to cancellation refund.
- [ ] **Credit Note Idempotency**: Click `Issue Credit Note` again on the same booking; verify existing active Credit Note is returned without duplicate record or counter increment.
- [ ] **Active Booking Credit Note Guard**: On a confirmed/active booking, observe `Issue Credit Note` button is not offered.
- [ ] **View Document**: In the issued documents list, click `View` on any document; verify `InvoiceView` preview renders the specific document title (e.g. `QUOTATION`, `CREDIT NOTE`), document number, and valid until date without layout distortion.
- [ ] **Void Document**: In the issued documents list, click `Void` on an active document; enter reason when prompted; verify status pill updates to `Void` and void reason is displayed. Click `View`; verify prominent red VOID watermark banner appears at the top.
- [ ] **Numbering Continuity**: Verify existing legacy booking invoices continue numbering seamlessly from the highest sequence without restarting at 1.

---

## 3.7 Manual Verification Checklist — Part 3.7b Invoice Studio & Document Renderer

- [ ] **Invoice Studio Navigation**: Navigate to Settings -> click the new "Invoice Studio" tab; verify template manager loads with built-in presets and designer controls.
- [ ] **Live Iframe Preview**: Observe the right-side preview updating in real-time as controls (layout, colors, typography, copies, sections) change.
- [ ] **WCAG Contrast Warning**: In the Colors tab, select a low-contrast color (e.g. pale yellow `#fef08a`); verify amber warning indicates `< 4.5:1` contrast ratio. Select Indigo (`#4f46e5`); verify green checkmark confirms WCAG AA pass.
- [ ] **Asset Upload & Magic-Byte Security**: Upload a valid PNG/JPEG logo under 200 KB; verify instant preview. Attempt to upload an `.svg` file; verify clear error rejection (`SVG format is rejected for security`).
- [ ] **Copies & Paper Formats**: Switch copies to "2 Copies (Original + Duplicate)"; verify two sheets render with respective header tags and print page breaks. Switch paper to "Thermal 80mm"; verify POS receipt styling.
- [ ] **Document Types Live Switcher**: In the preview toolbar, cycle between Tax Invoice, Quotation, and Credit Note; verify validUntil on quotation and cancellation charge/refund on credit note.
- [ ] **Print Test Page**: Click "Print Test Page"; verify print dialog opens with the exact configured styles.
- [ ] **Template Persistence & Duplication**: Click "Duplicate" on a built-in template; edit name and save; verify custom template appears in dropdown and persists across page reloads.

---

## 3.8 Smoke Fixes & Responsive Polish Verification Checklist (Part 3.7c)

- [ ] **Actionable UI Smoke Report (`scripts/ui-smoke.mjs`)**:
  - Run `npm run ui:smoke` with valid operator credentials.
  - Inspect `docs/screenshots/report.md`: verify every axe violation includes rule ID, impact, help URL, target CSS selector, trimmed HTML snippet (max 200 chars), failure summary, and occurrences grouped across viewports and themes.
  - Verify console errors and warnings list their exact messages and URLs.
- [ ] **Axe Shell Violations Resolved**:
  - `aria-prohibited-attr`: Verify `ToastContainer` has `role="region"`, dashboard metric skeleton has `role="status"`, and seat layout indicators have `role="img"`.
  - `label-content-name-mismatch`: Verify `Avatar` supports `aria-hidden="true"`, user menu button has `aria-label="${displayName} - Account menu"`, ensuring accessible name starts with visible text.
- [ ] **React Styled JSX Cleanliness**:
  - Inspect `src/components/PassengerManagement.jsx:751`; verify plain `<style>` tag is used with zero React non-boolean `jsx` or `global` console warnings.
- [ ] **Responsive Stepper & Print Manifest Polish**:
  - At `360px` and `768px`, verify BookingForm stepper labels display concise titles ("Tour", "Passengers", "Pricing", "Review") without truncation (`...`).
  - On Journeys screen at `360px`, `768px`, and `1024px`, verify "Print Manifest" button stays single-line `inline-flex` (`whitespace-nowrap`) with no awkward 3-line text wrapping.

---

## 3.9 Hotfix Pass & Safety Net Verification Checklist (Part 3.7d)

- [ ] **PowerShell Password Single-Quoting (`$env:UI_SMOKE_PASSWORD`)**:
  - Verify smoke instructions explicitly document single quotes (`'...'`) for passwords containing `$`. In double quotes, PowerShell interprets `$symbol` as an unbound variable, silently sending an invalid truncated password and causing 401 Unauthorized errors.
- [ ] **Smoke User Empty Data Rationale**:
  - The UI smoke script runs against the authenticated test user. When this user has 0 bookings and 0 tours, every screen is tested against its zero-state behavior. Overview, Travelers, Journeys, Destinations, and Analytics must render their `EmptyState` primitives gracefully without uncaught null pointer exceptions or blank screens.
- [ ] **Deep Tab Crawl & Crash Detection (`scripts/ui-smoke.mjs`)**:
  - In `scripts/ui-smoke.mjs`, every tab element (`[role="tab"]`) is clicked sequentially across viewports (1280px desktop, 768px tablet, 360px mobile) and themes (light, dark).
  - The smoke crawler inspects the DOM for crash boundary text (`Could not load this page`, `Something went wrong in this panel`, `Section Unavailable`) and reports them as fatal section failures in Section 4 of `report.md`.
- [ ] **Component Safety Net (`npm run test:ui`)**:
  - Execute `npm run test:ui`. Verify all 27 component tests across 10 suites pass cleanly.
  - Verify zero audit vulnerabilities exist for production dependencies (`npm audit --omit=dev`).

---

## 3.10 Manual Verification Checklist — Part 4a Expense Management

- [ ] **Navigation & Shell Routing**:
  - In desktop sidebar, verify "Expenses" appears with the `ReceiptText` icon; click it and verify URL updates and title displays "Expense Management".
  - In mobile viewport (<1024px), open "More" drawer; verify "Expenses" is listed and navigates smoothly.
- [ ] **StatCards & Overview Metrics**:
  - Verify 4 primary StatCards: Total Expenses, Paid Expenses, Pending Payments (with warning tone and count if pending > 0), and Top Category.
  - When bookings exist, verify Tour Operating Margin card displays Total Revenue, Net Operating Profit, Margin %, and Expense Ratio.
- [ ] **Add Expense Modal**:
  - Click "Add Expense"; verify modal opens with default today's date and cash payment mode.
  - Test validation: leave amount empty or enter 0; verify error "Enter a valid amount greater than ₹0".
  - Fill valid amount (e.g. ₹5,500), category "Fuel & Diesel", related tour "Chardham Special Yatra 2026", vendor "HPCL", and save.
  - Verify toast notification confirms "Expense added successfully", modal closes, and expense appears in the table.
- [ ] **Edit & Duplicate ("Add Similar")**:
  - Click "Edit" icon on an existing expense; change amount or note; click "Update Expense"; verify updated values appear in the list and summary updates.
  - Click "Add Similar" (copy icon) on a fuel expense; verify modal opens pre-filled with the same category, tour, vendor, and amount, with today's date; click save; verify new duplicated transaction is created.
- [ ] **Delete & Soft Delete**:
  - Click "Delete" (trash icon) on an expense; verify destructive `ConfirmDialog` asks for confirmation.
  - Click "Delete Expense"; verify toast "Expense removed", row disappears from active list, and DB record retains `deletedAt` without being permanently purged.
- [ ] **Filters & Search**:
  - Toggle date range chips: "This Month", "Last Month", "This FY", "All Time", "Custom".
  - Toggle Category dropdown (filter by "Fuel & Diesel"); verify only fuel expenses show and count/total recalculates.
  - Type in search input (e.g. vendor name "HPCL"); verify real-time search filtering.
  - Click "Reset Filters" / "Clear Filters"; verify filters reset to defaults.
- [ ] **CSV Export & Formula Protection**:
  - Click "Export CSV"; verify file `yatrahub-expenses-YYYY-MM-DD.csv` downloads.
  - Open in Excel / text editor; verify cells with special characters (=, +, -, @) are safely prefixed with `'` and Unicode text (Hindi/Gujarati) renders without corruption.
- [ ] **Responsive & Dark Mode**:
  - Resize browser to 360px width; verify zero horizontal scrollbar, table shifts to stacked cards, and touch targets are >= 44px.
  - Switch theme to Dark Mode; verify high-contrast text, card backgrounds, and category pills render with appropriate dark tokens.

### 3.8 Part 4b Manual Verification Checklist (Tour & Departure Profit/Loss)
- [ ] **Analytics Screen Tabs**:
  - Open **Analytics** from sidebar (`#analytics`).
  - Verify `<Tabs>` shows two options: "Analytics Overview" and "Profit & Loss".
  - Click "Profit & Loss" tab; verify URL hash or tab state switches to P&L view.
- [ ] **Financial KPI StatCards**:
  - Verify 4 primary KPI cards: Booked Revenue (Accrual), Cash Collected, Total Expenses (Paid/Pending), and Overall Net Profit (or Loss).
  - Verify loss styling: when expenses exceed revenue, Net Profit card automatically displays "Overall Net Loss", danger red accent tone, and `TrendingDown` icon.
- [ ] **Recharts Visual Comparison & Accessible Table**:
  - Verify Recharts comparative bar chart displays Revenue, Expenses, and Profit grouped by Tour (or Departure).
  - Click "Table" toggle icon in chart card header; verify smooth transition to accessible `<Table>` with `<caption>Revenue, Expenses and Net Profit per...</caption>`.
  - Click "Chart" toggle; verify chart restores cleanly.
- [ ] **Filter Bar & Date Presets**:
  - Test "Date Range" dropdown: "This Financial Year", "This Month", "Last Month", "All Time", and "Custom Date Range".
  - Select "Custom Date Range"; verify From and To date inputs appear and filter data.
  - Test "Group Analysis By" dropdown: switch between "By Tour (Aggregated)" and "By Coach Departure (Trip-wise)". Verify table and chart update grouping.
  - Test "Filter Tour" dropdown: select a specific tour or "General (Unlinked Expenses)".
- [ ] **Table Sorting & Detail Drawer**:
  - Click column headers (Tour Name, Booked Revenue, Expenses, Net Profit) in desktop view; verify sort order toggles between descending and ascending.
  - Click "Details" button (or any row); verify right-hand `<Drawer>` opens.
  - In Drawer, verify:
    - Unit Economics card (Average Ticket Price, Cost Per Passenger, Break-even Seats, Occupancy %).
    - Booked Revenue Ledger listing confirmed invoice numbers and Pax counts.
    - Trip Expenses Ledger listing categories, vendors, and amounts.
    - Audit: assert strictly ZERO customer PII (no passenger names, phones, email, or Aadhaar) appears in the financial ledger.
- [ ] **Journey Manager Departure Cards (Trip Financials)**:
  - Open **Journeys** from sidebar (`#journey`).
  - On departure coach cards, locate the "Trip Financials" compact badge.
  - Verify Rev, Exp, Net Profit/Loss, Margin %, and Break-Even seats are displayed.
  - Click "Add trip expense" link button on the departure card.
  - Verify modal opens titled "Add Trip Expense" with the departure's tour name and date prefilled.
  - Enter an amount (e.g. ₹2,000 for fuel) and save; verify departure card financials update immediately.
- [ ] **CSV Export & Formula Protection**:
  - On Profit & Loss tab, click "Export CSV".
  - Verify downloaded CSV has columns for Tour/Departure, Date, PAX, Capacity, Occupancy, Booked Revenue, Collected, Expenses, Net Profit, Margin %, and Break-Even seats.
  - Verify formula injection protection: any field beginning with `=`, `+`, `-`, `@` is prefixed with a single quote (`'`).

## 3.12 Manual Verification Checklist — Part 5a Customer Master
- [ ] **Customer Directory Navigation & Layout**:
  - In sidebar (and mobile More drawer), verify "Customers" appears with the `Contact` icon.
  - Navigate to `/customers`; verify page title displays "Customer Directory" and subtitle "Manage traveler contact details, repeat pilgrims, booking history, and balance tracking."
  - Verify 3 primary StatCards: Total Customers, Repeat Travelers, With Outstanding.
  - If unlinked legacy bookings exist, verify "N bookings need attention" banner renders with prompt to run backfill.
- [ ] **Add / Edit Customer Modal**:
  - Click "Add Customer" button; verify modal opens with Name, 10-digit Mobile, Email, City, Address, GSTIN, Language, Tags, Notes, and WhatsApp Opt-out.
  - Enter invalid phone (e.g., `12345`); verify inline validation error "Valid 10-digit Indian mobile number required (starts with 6-9)".
  - Enter duplicate mobile for this operator; verify 409 conflict error banner appears cleanly.
  - Save valid customer; verify success toast, modal closes, and customer appears in directory.
- [ ] **Customer Detail Drawer**:
  - Click any customer row; verify slide-over drawer opens smoothly.
  - Verify contact details: Phone (with Copy to clipboard button), Email, City, Address, GSTIN, Language badge, Tags.
  - Verify financial summary StatCards (Booked Revenue, Outstanding, Collected, Passengers) match authoritative booking calculations.
  - Verify Booking History table lists all past trips with Invoice #, Tour, Date, Amount, Paid, Balance, and Status.
  - Click "New Booking for this Customer"; verify app navigates to Booking Form with primary contact name and phone prefilled.
- [ ] **Booking Form Non-Blocking Phone Lookup**:
  - Open New Booking form; enter registered customer phone in primary contact.
  - Verify subtle suggestion card appears: "Existing customer found: <Name>. Use customer details".
  - Click "Use customer details"; verify name, email, city, and address prefill instantly.
- [ ] **Backfill CLI Script**:
  - Run `node scripts/backfill-customers.mjs` in PowerShell; verify dry-run output reports scanned bookings and proposed customer creations without modifying MongoDB.
  - Run `node scripts/backfill-customers.mjs --apply`; verify bookings link to customer profiles and console logs contain zero raw PII.
- [ ] **CSV Export**:
  - In Customer Directory, click "Export CSV".
  - Verify exported CSV contains Customer Name, Phone, Email, City, Language, Tags, Total Bookings, Booked Revenue, Collected, Outstanding, and First/Last Booking dates.
  - Verify formula injection sanitization prefixes hostile characters with a single quote (`'`).

## 3.13 Manual Verification Checklist — Part 5b & 5b-fix Receivables, Statements & Quality Polish
- [ ] **Accessible Form Controls**:
  - Navigate to Outstanding screen; inspect form controls.
  - Verify "As of date" has visible `<Field>` label and native date picker (`<Input type="date">`).
  - Verify "Tour" dropdown has visible `<Field>` label and styled `<Select>`.
  - Verify "Aging basis" and "Group by" segments are accessible radio groups with clear legends.
  - Verify "Search receivables" search input has an accessible label (`aria-label`).
- [ ] **Statement Preview Sandbox Security**:
  - Open StatementModal for any customer.
  - Inspect the statement preview `<iframe>` element in browser DevTools.
  - Verify `sandbox="allow-same-origin allow-modals"` is present, and verify `allow-scripts`, `allow-popups`, `allow-top-navigation`, and `allow-forms` are strictly absent.
- [ ] **Render Loop & Infinite Update Depth Protection**:
  - Render ExpenseTracker, OutstandingManager, SettingsPanel, and Dashboard across all tab states.
  - Verify React does not trigger "Maximum update depth exceeded" error.
  - Run `npm run test:ui` to confirm all 12 profiler commit-count assertions in `render-loop.test.jsx` pass.
- [ ] **Honest Smoke Test Execution & Preflight Checks**:
  - Run `npm run ui:smoke -- --quick`.
  - Verify preflight check tests `/api/health` and 7 read-only routes immediately after login, failing with clear restart guidance if any return 404.
  - Verify Section 4 attributes every console message with screen, tab, viewport, and theme.
  - Verify run fails if any console `error` or uncaught `pageerror` occurs; terminal never reports SUCCESS when errors exist.
  - Verify `--strict` flag makes warnings fatal.
  - Verify Settings screen crawls all tabs once under "Settings", while "Invoice Studio" and "Reminder Settings" only test their single tab.
  - Verify terminal "N tabs" label accurately displays "0 tabs" for screens without sub-tabs.
  - Verify Section 6 prints tabular tab coverage and exits non-zero if any non-disabled tab was unvisited.
  - Verify terminal output prints exactly 1 summary line per screen.

---

## 3.14 Manual Verification Checklist — Part 5c WhatsApp Payment Reminders

- [ ] **Settings Reminders Tab (`ReminderTemplateEditor`)**:
  - Navigate to Settings -> click "Reminders" tab; verify template editor loads with tone and language segmented controls.
  - Click placeholder chips (`{customerName}`, `{balance}`, `{tourName}`, `{upiId}`); verify token is inserted at cursor position.
  - Edit template body; observe character counter (`X / 600`) and live preview card updating immediately.
  - Click "Save Template"; verify custom template persists. Click "Reset to Default"; verify default template is restored.
  - Verify Communication Advisory is visible at the bottom ("Send reminders only to customers who agreed to receive messages from you and respect opt-outs. Opted-out customers are blocked in this app.").
- [ ] **Outstanding Screen Reminders & Queue Mode**:
  - On Outstanding screen, verify "Last Reminded" column displays relative time (e.g. "2d ago" or "Never").
  - Click "Not reminded in 7 days" filter chip; verify customer list filters accordingly.
  - Click "Remind" button on any customer row; verify `ReminderModal` opens with customer name, phone, and total due.
  - Click "Reminder queue (N)"; verify modal opens in queue mode showing "Queue: 1 of N", with "Skip" and "Next" buttons.
- [ ] **Customer Opt-Out Enforcement**:
  - In Customer Drawer, toggle "WhatsApp Reminders" to "Opted Out".
  - Attempt to open reminder from Customer Drawer; observe button is disabled.
  - Open ReminderModal for an opted-out customer; verify prominent red alert is shown, and "Open WhatsApp" and "Copy message" buttons are suppressed.
- [ ] **24-Hour Reminder Frequency Warning**:
  - Send a reminder or set `lastReminderAt` to within 24 hours.
  - Re-open ReminderModal; verify amber warning banner cautions operator against repeated messages within 24 hours.
- [ ] **Statement Modal Integration**:
  - Open StatementModal for a customer with outstanding balance; verify "Send Reminder" button appears in footer.
  - Click "Send Reminder"; verify ReminderModal opens with the customer's closing balance.
- [ ] **Data Privacy & TTL Verification**:
  - Verify MongoDB `ReminderLog` documents contain no customer phone and no message body.
  - Verify 400-day TTL index on `ReminderLog.createdAt`.

---

## 3.15 Manual Verification Checklist — Part 6a Cash Book & Books Close

- [ ] **Navigation & Screen Loading**:
  - Open app; click "Cash Book" in the sidebar (icon `BookOpen`, `#cashbook`).
  - Verify heading "Daily Cash & Bank Book" and subtitle render cleanly.
  - Verify 4 StatCards: "Opening Balance", "Total Receipts / Inflow", "Total Payments / Outflow", "Closing Balance".
  - If no transactions exist for the selected date, verify clean empty state: "No cash or bank transactions recorded for this period."
- [ ] **Date Navigation & Stepper**:
  - Click `<` (Previous day) and `>` (Next day); verify date updates and day book queries new date.
  - Click "Today" button; verify date resets to today's date.
  - Switch view mode to "Date Range"; verify "Start date" and "End date" pickers appear along with quick preset buttons ("Today", "Yesterday", "7 Days", "This Month").
- [ ] **Account Filters**:
  - Click "All Accounts", "Cash Only", and "Bank / Digital" radio buttons; verify running balances and displayed rows filter accordingly.
- [ ] **Manual Entry Flow**:
  - Click "Add Entry" button; verify `ManualEntryModal` opens.
  - Select entry type (e.g. "Cash to Bank Transfer", "Bank to Cash Transfer", "Capital Introduced", "Drawings", "Adjustment").
  - Enter amount (e.g. ₹5,000) and mandatory notes.
  - Submit; verify entry appears in the table with correct badge and running balance.
- [ ] **Daily Books Close Flow & Step-Up Auth**:
  - Click "Close Day" button; verify `CloseDayModal` opens displaying system calculated cash balance.
  - Enter counted physical cash; observe live discrepancy calculation (balanced / excess / short).
  - Check "Post adjustment entry for discrepancy" if difference is non-zero.
  - Enter operator password (and TOTP token if 2FA enabled); submit.
  - Verify day is officially closed, lock banner appears, and books lock date advances.
- [ ] **Ledger Lock Enforcement (HTTP 423)**:
  - Attempt to record a new booking, payment, or expense with a date on or before the closed lock date.
  - Verify mutation is rejected with HTTP 423 Locked and a clear error message.
  - Verify locked entries in the Cash Book table display a lock icon and edit/delete actions are disabled.
- [ ] **Reopening Closed Books**:
  - Click "Reopen Last Close" in the lock banner; verify `ReopenCloseModal` opens.
  - Enter audit reason (minimum 5 characters) and step-up password.
  - Submit; verify lock date lowers to the previous close (or unlocks completely) and auto-adjustment entry is reversed.
- [ ] **Printable Day Book & Sandboxed Iframe**:
  - Click "Print" button; verify `PrintDayBookModal` opens.
  - Verify preview is rendered inside an iframe with strict sandbox (`sandbox="allow-same-origin allow-modals"`).
  - Switch document language between English, हिन्दी, and ગુજરાતી; verify table headers and labels update immediately.
  - Click "Print Day Book" to trigger browser print dialog.
- [ ] **CSV Export**:
  - Click "Export CSV" button; verify downloaded CSV (`DayBook-YYYY-MM-DD.csv`) includes opening balance, chronological rows with running balances, closing balance, and formula injection protection.

## 3.16 Manual Verification Checklist — Part 6c & 6c-fix CSV Export, Import & Undo

- [ ] **Data Management Hub Navigation & Tab Layout**:
  - Click "Data Import/Export" in sidebar or navigate to `#data`.
  - Verify heading "Data Import & Export" and subtitle load cleanly.
  - Verify 3 tabs: "Export System Data", "Import CSV Data", "Recent Batches".
- [ ] **Export Cards & Filter Validation**:
  - Verify export cards: Customers, Expenses, Bookings, Cash Book, Receivables, Passenger Manifest, Payments Ledger, and Tour-wise Profit/Loss.
  - Verify 366-day date range limit: Requesting date range >366 days shows a clear error toast.
  - Verify zero Aadhaar in Passenger Manifest: Download CSV and verify neither the word "Aadhaar" nor any 12-digit UID appears in the file.
  - Verify Payments Ledger: Verify refunds have negative amounts and voided receipts are flagged.
- [ ] **CSV Import Wizard**:
  - Step 1: Select "Customer" or "Expense", click download template, verify format guidelines.
  - Step 2: Upload a valid `.csv` file <= 1 MB. Files > 1 MB are blocked with friendly error toast.
  - Step 2 Security: Upload a file containing an Aadhaar column; verify immediate red security banner and block.
  - Step 3: Column mapping correctly maps detected columns.
  - Step 4: Validate & Preview displays StatCards (total, valid, invalid), sample valid records, and structured error rows `{ row, field, reason }`.
- [ ] **HMAC Token Protection**:
  - Preview generates tamper-proof HMAC token. Any tampering with column mappings or file content invalidates the token.
- [ ] **Granular Batch Undo**:
  - Recent Batches table displays date, type, imported count, skipped count, and status without leaking filenames.
  - Clicking "Undo" on a committed batch prompts confirmation.
  - Undo reverses records not locked by books close, correctly setting status to `reverted` or `partially_reverted` and displaying breakdown toast.

## 3.17 Manual Verification Checklist — Part 6f Bug Fixes & Refinements

> [!NOTE]
> Per explicit owner decision, no new automated tests were added in Part 6f. All verifications are conducted manually using the checklist below and throwaway browser checks with Playwright.

- [ ] **Bug 1: Dialog Stacking & Focus Isolation (PaymentTracker & ReceiptModal)**:
  - On Overview or Payment Tracking screen, click "Payment History" on any booking; verify exactly 1 dialog opens.
  - Inside the ledger modal, click "Receipt" on any payment row; verify Receipt modal opens cleanly on top (2 dialogs stacked).
  - Press `Escape`; verify ONLY the Receipt modal closes and focus returns to the ledger; ledger modal remains open.
  - Press `Escape` again; verify ledger modal closes cleanly.
- [ ] **Bug 2: Financial Calculation Synchronization Across Screens**:
  - Open a booking with multiple payments/advances (e.g. `YHB-NST-NOV-001`).
  - Compare Total, Paid, and Balance figures across:
    - (a) Overview booking table row
    - (b) Payment Tracking card
    - (c) Payment History ledger modal header
    - (d) Customer Drawer financial summary
  - Verify all 4 surfaces display identical, authoritative numbers computed from non-void ledger payments.
- [ ] **Bugs 3 & 4: Drawer Backdrop Stacking, Responsive Layout & History Drawer**:
  - Open Customer Drawer on desktop; verify drawer contents are crisp and sharp, with no overlay blur bleeding into the panel.
  - Verify Close Drawer button (`X`) is immediately clickable without backdrop pointer-event interception.
  - View Customer Drawer at 360px viewport width (e.g. Chrome DevTools mobile emulation); verify `document.body.scrollWidth === window.innerWidth` (zero horizontal page scroll).
  - Check large currency figures in StatCards; verify text wraps/scales cleanly without text clipping.
  - Open History Drawer on any booking with no prior edit history; verify localized empty state message:
    - English: "No changes recorded for this item yet. Change history is recorded from the version that introduced it, so older edits are not available."
    - हिन्दी: "इस आइटम के लिए अभी तक कोई बदलाव दर्ज नहीं किया गया है। परिवर्तन इतिहास उस संस्करण से दर्ज किया गया है जिसमें इसे पेश किया गया था, इसलिए पुराने संपादन उपलब्ध नहीं हैं।"
    - ગુજરાતી: "આ આઇટમ માટે હજુ સુધી કોઈ ફેરફારો નોંધાયા નથી. ફેરફાર ઇતિહાસ તે સંસ્કરણથી રેકોર્ડ કરવામાં આવ્યો છે જેમાં તે રજૂ કરવામાં આવ્યો હતો, તેથી જૂના ફેરફારો ઉપલબ્ધ નથી."
  - Verify language toggle buttons have minimum 44px touch targets.
- [ ] **Bug 5: Seat Layout Modal Opening in Booking Form**:
  - Open Booking Form in new booking or edit booking mode.
  - Navigate to Step 2 ("Passengers & Seats").
  - Click "Select seat from coach layout" (or "Seat <ID>"); verify "Choose Seat" modal opens immediately.
  - Verify seat grid renders and coach berths can be clicked and selected.
  - Click "Confirm Selection"; verify modal closes and selected seat is assigned.
- [ ] **Step 2a: UI Smoke Script Assertions & Extra Checks**:
  - Verify `TARGET_URL` is used for navigation restore at line 931.
  - Verify "Verified..." log is printed only after assertions pass.
  - Verify extra checks for Payment History (1 dialog) and Manifest modal (preview iframe & enabled print) run without errors.
  - Verify any assertion failure records an error in `report.md`, sets failure flag, and exits non-zero.
- [ ] **Step 2b: Departure Key Special Characters**:
  - Create or inspect a tour whose name contains special characters (`___`, `/`, `?`, `#`, spaces, Hindi, or Gujarati).
  - Open manifest for that departure; verify backend parses key from the right (`busType = parts[last]`, `dateStr = parts[last-1]`, `tourName = parts[0..last-2]`).
  - Verify manifest loads without HTTP 400 or invalid date errors.
- [ ] **Step 2c: Manifest Print Boarded Box & Remarks Layout**:
  - Open Print Manifest preview; verify "Boarded" column renders as an empty printed box (`<span class="chk-box"></span>`), never an `<input>` element.
  - Verify "Remarks" column renders as an empty write-in cell (`<span class="write-in-cell"></span>`) with baseline height for handwriting.
- [ ] **Step 2d: Customer Link Banner Actionability & Grammar**:
  - In Customer Master, verify the "Needs Attention" alert banner counts only actionable linkable bookings (`evalResult.canLink`).
  - Verify correct grammar: "1 booking needs attention" vs "N bookings need attention".
  - Click "Link now" or link all unlinked bookings; verify banner completely disappears once actionable count reaches 0.

## 3.18 Manual Verification Checklist — Part 6g UI Smoke Resilience & Manifest Modal Polish

> [!NOTE]
> Per explicit owner decision, no new automated tests were added in Part 6g. All verifications are conducted manually using the checklist below and verified via `npm run ui:smoke`.

- [ ] **Manifest Print Disabled Reason & Screen-Reader Communication**:
  - Open Journeys screen (`#journey`), click "Print Manifest" -> "Print Manifest (Without Aadhaar)".
  - While manifest data is loading, verify helper indicator displays "Loading passengers..." with a small spinner and the Print button is disabled.
  - If a departure has 0 booked passengers, verify helper indicator displays "No passengers on this departure" and the Print button is disabled.
  - Inspect the disabled Print button in DevTools; verify `aria-describedby="manifest-print-disabled-reason"` points directly to the helper text element with `role="status"`.
  - For a departure with booked passengers, once loading completes, verify the Print button becomes enabled.
  - Select "Print Manifest (With Aadhaar)"; verify the amber warning "Safety acknowledgment required to print Aadhaar" appears and Print is disabled until the safety acknowledgment checkbox is checked.
- [ ] **Smoke Test Resilience & Zero-Hang Guarantee**:
  - Run `npm run ui:smoke -- --quick`.
  - Verify that if an assertion or check throws inside a modal, the `finally` block guarantees dialog dismissal (Cancel/Escape) and does not leak backdrop overlays.
  - Verify that before navigating to subsequent screens (e.g. Destinations), `dismissAnyOpenModals()` ensures no lingering modal overlays intercept pointer clicks.
  - Verify navigation clicks use fast intercept detection and recovery (5000ms timeout cap, Escape fallback) to prevent hanging for 37 retries.
  - Verify terminal output prints clean status lines and exits cleanly without requiring manual Ctrl+C.

## 3.19 Manual Verification Checklist — Part 6S-1 Seat Foundation & Conflict Protection

> [!NOTE]
> Per explicit owner decision, automated tests were not run and no new automated tests were written in Part 6S-1 ("automated tests not run, per owner decision"). All verifications are conducted manually using the checklist below and verified via Playwright quick inspection.

- [ ] **Configurable Layouts Visual Inspection & Berth Counts**:
  - Open New Booking modal, select **"2x1 Sleeper Luxury (38 berths)"**, click "Select Seat". Verify 6 rows of 3 (Left 1, Right 2 cabins, each with Lower and Upper berths = 36 berths) plus Row 7 back single berth (Left L7 Lower & Upper = 2 berths), totaling 38 berths (19 lower, 19 upper). [FLAGGED for owner confirmation].
  - Select **"2x2 Sleeper Luxury (48 berths)"**, click "Select Seat". Verify 6 rows x 4 berths per deck (Left cabins L1..L12, Right cabins R1..R12, each with Lower and Upper berths), totaling 48 berths (24 lower, 24 upper).
  - Select **"2x2 Sleeper Standard (40 berths)"**, click "Select Seat". Verify 5 rows x 4 berths per deck (Left cabins L1..L10, Right cabins R1..R10, each with Lower and Upper berths), totaling 40 berths (20 lower, 20 upper).
  - Select **"2x3 Seater Express (60 seats)"**, click "Select Seat". Verify 12 rows x 5 seats per row (2 seats on left, aisle, 3 seats on right, numbered 1..60), totaling 60 seats on a single deck.
- [ ] **Shared SeatMap Component Accessibility & UX**:
  - Verify every seat target has a minimum 44px touch target for mobile/tablet usability.
  - Verify non-color-reliant status cues: checkmark icon for selected, lock icon for booked, clean outline for available.
  - Verify `role="region"` and `aria-label="Coach Seat Layout"` on the scroll container.
  - Verify internal horizontal scrolling within the modal region on small screens (360px viewport) with zero page-level horizontal overflow.
- [ ] **Server-Side Double Booking Prevention**:
  - Create a booking on a tour, departure date, and bus type with a specific seat (e.g. `lower-L1`).
  - Attempt to create a second booking with the exact same seat on the same tour, journey date, and bus type. Verify server rejects with HTTP 409 `SEAT_CONFLICT` and descriptive error message.
  - Attempt to book the same seat on a different tour, date, or different bus type on the same date. Verify booking succeeds (scoped multi-bus support).
- [ ] **Intra-Booking Duplicate Seat Rejection**:
  - In a single booking with multiple passengers, attempt to assign the same seat ID to two passengers. Verify server rejects with HTTP 409 `SEAT_CONFLICT`.
- [ ] **Passenger Seat Reassignment (Swap Seat)**:
  - In Journeys screen, click a passenger's seat pill to open the Reassign Seat modal.
  - Verify available seats list only shows genuinely free berths for that departure's bus layout.
  - Reassign to an occupied seat via forged API request; verify server returns HTTP 409 and does not mutate the passenger's seat.
- [ ] **Trash Restore Seat Conflict Protection**:
  - Soft-delete a booking holding a seat.
  - Create a new booking occupying that same seat on the departure.
  - Attempt to restore the deleted booking from Trash. Verify restore fails with HTTP 409 `SEAT_CONFLICT` (`conflicts.seatConflict = true`).
- [ ] **Legacy Seat ID Mapping**:
  - Verify existing bookings with legacy IDs (e.g. `lower-L1-1` or `lower-L1-2`) resolve to canonical layout seats without throwing errors or requiring destructive DB migrations.

## 3.20 Manual Verification Checklist — Part 6S-1 Fix (Bus Type Enum Validation & Unification)

> [!NOTE]
> Per explicit owner decision, automated tests were not run and no new automated tests were written in Part 6S-1 Fix ("automated tests not run, per owner decision"). All verifications are conducted manually using the checklist below.

- [ ] **Destination / Tour Creation with All 4 Bus Types**:
  - In Destinations (`#tours`) screen, create a destination with each of the 4 bus types ("2x1 Sleeper Luxury (38 berths)", "2x2 Sleeper Luxury (48 berths)", "2x2 Sleeper Standard (40 berths)", "2x3 Seater Express (60 seats)"); verify each creates and saves successfully without Mongoose enum validation errors.
  - Attempt to submit an invalid bus type (e.g. via direct API write); verify server rejects with HTTP 400 and clear message listing all 4 allowed standard types.
  - Verify existing destinations and bookings with legacy bus types ("2x1 Sleeper Luxury", "2x2 Sleeper Luxury", "2x1", etc.) load and display without errors.

## 3.21 Manual Verification Checklist — Part 6S-2a (Live Seat Map, Seat Hold & Block, and Move Seat)

> [!NOTE]
> Per explicit owner decision, automated tests were not run and no new automated tests were written in Part 6S-2a ("automated tests not run, per owner decision"). All verifications are conducted manually using the checklist below.

- [ ] **1. Live Seat Map Departure Rendering & Layouts**:
  - Open Journeys screen (`#journeys`), click the "Seat Map" button on a departure card.
  - Verify Live Seat Map opens showing accurate header info (tour name, formatted journey date, bus type, and layout badge).
  - Verify stats summary counter bar shows Total, Available, Booked, Held, and Blocked counts.
  - Verify layout renders with proper geometry for the selected bus type (e.g. 2x1 sleeper, 2x2 sleeper 48, 2x2 sleeper 40, or 2x3 seater 60).
- [ ] **2. Timed Hold & Real-Time Countdown**:
  - Click any available seat to open the Seat Action Drawer.
  - Select "Hold Seat", choose a timed duration (e.g. 15 minutes), enter optional customer name ("Ramesh Bhai") and phone.
  - Save hold; verify seat turns yellow (`held`), shows holder name, clock icon, and live countdown timer ticking down every 30 seconds.
  - Attempt to book the held seat from another session or tab without `holdId`; verify server rejects with HTTP 409 `SEAT_HELD` and descriptive message.
- [ ] **3. Manual Hold vs Block Distinction**:
  - Create a manual hold (no expiration) on a seat; verify yellow badge with pin icon and "Manual Hold" indicator.
  - Create a block (maintenance / VIP) on another seat; verify red/gray blocked styling with lock icon and note.
- [ ] **4. Hold Expiry Without Background Job (TTL-Free Computed Expiry)**:
  - Create a timed hold for a short period.
  - Once expiry timestamp passes, refresh or query the seat map; verify seat status immediately shifts to `available` without requiring a background cron daemon or MongoDB TTL runner.
- [ ] **5. Release Hold / Block**:
  - In Seat Action Drawer for a held or blocked seat, click "Release Hold" / "Unblock Seat".
  - Confirm release; verify seat immediately transitions back to green `available` state and counts update.
- [ ] **6. Book from Held Seat (Conversion)**:
  - For a seat held by customer, click "Book Held Seat" in the Action Drawer.
  - Verify Booking Form opens with pre-selected seat and hold reference.
  - Submit booking; verify hold record transitions to `status: "converted"` with `convertedBookingId` recorded.
  - Verify seat displays as blue `booked` on the Live Seat Map.
- [ ] **7. Move Booked Seat (Reassignment Without Billing Impact)**:
  - On a booked seat, open the Action Drawer and click "Move Seat".
  - In Move Seat Modal, select an available destination seat on the bus.
  - Confirm move; verify passenger is reassigned to the new seat, the old seat immediately becomes available, and booking total fare / billing remains untouched.
  - Attempt to move passenger into a held or blocked seat; verify server rejects with HTTP 409 `SEAT_HELD`.
- [ ] **8. Keyboard Accessibility & WCAG Standards**:
  - Navigate the seat map using only the keyboard (`Tab`, `Shift+Tab`).
  - Press `Enter` or `Space` on any seat button to open the action drawer.
  - Press `Escape` to close the action drawer or modal, and verify focus returns to the triggering seat button.
- [ ] **9. Responsive Layout & Touch Targets**:
  - Inspect on mobile viewport (360px) and desktop (1440px).
  - Verify zero page-level horizontal overflow scrollbars.
  - Verify all touch targets meet minimum 44px clickable dimensions.

---

## 3.22 Manual Verification Checklist — Part 6S-2b (Unified Sleeper Layouts, Ladies Reservations, Couple Pairs, and Fare Presets)

> [!NOTE]
> Per explicit owner decision, automated tests were not run and no new automated tests were written in Part 6S-2b ("automated tests not run, per owner decision"). All verifications were conducted manually using the checklist below with browser validation (Playwright).

- [x] **1. Unified Sleeper Layout Geometry & Visual Reference Match**:
  - Open Journeys screen, select any departure with 2x1 sleeper (38 berths), 2x2 sleeper (48 berths), or 2x2 sleeper (40 berths), and open the Live Seat Map.
  - Verify all sleeper coaches display on a single screen without a deck switcher tab bar (upper and lower decks shown side-by-side).
  - Verify rounded coach body container styling with amber/yellow front strip showing "▲ Front" on the left and "Driver" with a steering wheel icon (☸) on the right.
  - Verify four column headers: Left Lower, Left Upper, central vertical aisle ("SLEEPER"), Right Lower, Right Upper.
  - For 2x1 sleeper (38 berths), verify rear berth section at the bottom renders wide berths B1 and B2.
- [x] **2. Responsive Viewports (360px Mobile & 1440px Desktop)**:
  - Inspect layout at 360px mobile viewport: verify zero horizontal overflow on the page body (`document.documentElement.scrollWidth <= window.innerWidth`); coach layout region scrolls horizontally within its own container.
  - Inspect layout at 1440px desktop viewport: verify spacious presentation with all interactive berth elements clearly visible.
- [x] **3. Departure Seat Settings & Fare Presets**:
  - Click "Seat Settings" button on the Live Seat Map to open the Departure Seat Settings modal.
  - Enter custom fare presets (Lower, Upper, Rear, Seater), and click "Save Seat Settings".
  - Verify settings persist via `PUT /api/departures/:key/seat-config` and are displayed when re-opening the modal.
  - Verify suggested fares pre-fill automatically when creating a new booking from the seat map for that departure.
- [x] **4. Multi-Select Batch Actions (Ladies & Couple Pairs)**:
  - Click "Select Multiple" on the Live Seat Map toolbar.
  - Select an available seat and click "Mark Ladies"; verify purple ladies-reserved border and badge appear on the seat.
  - Select two available seats and click "Make Couple Pair"; verify couple pair icon and partner linking cue appear.
  - Test "Remove Ladies" and "Break Pair" to ensure settings can be cleared.
- [x] **5. Server-Side Ladies Seat Protection & Override Gate**:
  - Attempt to book a male passenger on a ladies-reserved seat without override; verify server rejects with HTTP 409 and code `LADIES_SEAT`.
  - Book a female passenger on the ladies-reserved seat; verify booking succeeds with HTTP 201.
  - In Booking Form, when a male passenger is assigned to a ladies seat, verify modal prompt appears requiring an operator override reason (min 3 chars). Submit with override reason; verify booking succeeds and `LADIES_SEAT_OVERRIDE` audit log is recorded.
- [x] **6. Server-Side Couple Pair Protection**:
  - Attempt to book only one seat of a couple pair alone; verify server rejects with HTTP 409 and code `COUPLE_PAIR` stating both seats must be booked together.
  - Book both seats of the couple pair in the same booking; verify server accepts with HTTP 201.
  - In Booking Form, selecting one seat of a couple pair auto-selects its partner seat for the next available traveler.
- [x] **7. Mixed-Gender Berth Advisory Warning**:
  - When two passengers of different genders are assigned to the same double cabin/berth (e.g. L1-1 and L1-2), verify non-blocking warning banner appears alerting the operator before confirmation.
- [x] **8. Keyboard Accessibility (WCAG 2.1 AA)**:
  - Tab through seat map buttons; press `Enter` to open the Seat Action Drawer.
  - Press `Escape` to close the drawer, verifying focus cleanly returns to the trigger seat button.
- [x] **9. Cleanup & Non-Interference**:
  - All test bookings created during verification soft-deleted through the app's `deletedAt` mechanism (`YHB-CHK-7119`, `YHB-CHK-8510`, `YHB-CHK-6197`, `YHB-CHK-1205`, `YHB-CHK-7199`, `YHB-CHK-9643`, `YHB-CHK-7329`, `YHB-CHK-2549`, `YHB-CHK-4133`, `YHB-NST-NOV-005`, `YHB-NST-NOV-006`, `YHB-NST-NOV-007`).
  - Verify existing bookings and legacy bus types continue loading and rendering correctly without regression.

---

## 3.23 Manual Verification Checklist — Part 6S-3a (WhatsApp Seat Card & Pickup List)

> [!NOTE]
> Per explicit owner decision, automated tests were not run and no new automated tests were written in Part 6S-3a ("automated tests not run, per owner decision"). All verifications were conducted manually using the checklist below with browser validation (Playwright Chromium headless DOM execution).

- [x] **1. Canvas Seat Card Generation Across All 4 Layouts**:
  - Open Live Seat Map for each coach type (`sleeper-2x1-38`, `sleeper-2x2-48`, `sleeper-2x2-40`, `seater-2x3-60`), select a booked seat, and click "Share Seat".
  - Verify 1080px wide Canvas generates successfully and displays in modal preview.
  - Verify coach geometry matches layout: front amber strip with "▲ Front" and steering wheel, column headers, central aisle, berth boxes (`L{r}`, `U{r}`), and rear bottom berths B1/B2 on 2x1 sleeper (38 berths).
- [x] **2. Strict Privacy & PII Boundary**:
  - Verify recipient passenger's seats are highlighted in vibrant blue (`#2563eb`) with white text and checkmark (✔).
  - Verify all other booked or held seats are rendered in neutral grey (`#f1f5f9`) with 45° diagonal hatch lines (`#e2e8f0`) and lock glyphs (🔒).
  - Verify other passengers' names, mobile numbers, ages, genders, and balances are completely masked on the image.
- [x] **3. Multilingual Font Rendering (Anti-Tofu)**:
  - Switch language selector in ShareSeatModal between English (`en`), Gujarati (`gu`), and Hindi (`hi`).
  - Verify canvas renders localized headers, labels, and text using `@fontsource/noto-sans-gujarati` and `@fontsource/noto-sans-devanagari`.
  - Verify zero missing glyph boxes (□) or broken conjuncts.
- [x] **4. Financial Privacy & Ledger Balance Toggle**:
  - Verify "Include balance due in message and card" toggle defaults to OFF.
  - With toggle OFF: verify no balance due pill or financial figures appear on the canvas image or message text.
  - With toggle ON: verify balance due badge renders in card footer (`Balance Due: ₹...`) and `{balance}` placeholder appears in message.
- [x] **5. WhatsApp Phone Normalization & Sharing**:
  - Verify phone normalization helper (`normalizeIndianPhone`):
    - 10-digit number (`9876543210`) -> `wa.me/919876543210`.
    - Formats with leading `0` or spaces/dashes (`098765 43210`) -> normalized cleanly to `919876543210`.
    - Missing or invalid phone -> "Open WhatsApp chat" button is disabled with explanatory text (`aria-describedby`); "Download PNG" and "Copy Message" buttons remain fully active.
  - Verify message template is customizable, supports placeholders, and persists edits to `localStorage`.
- [x] **6. Pickup-Wise Manifest Grouping & Sorting**:
  - In Journeys screen, open Manifest Print Modal and select `"📍 Pickup-Wise"` preset or toggle "Group by Pickup" switch ON.
  - Verify passengers are grouped by pickup stop (`pickupPoint`).
  - Verify pickup groups are sorted chronologically by pickup time (`pickupTime`, e.g. `06:00 AM` before `07:30 AM`).
  - Verify passengers within each pickup stop are ordered by physical seat position (`compareSeats`).
  - Verify passengers without a pickup point are grouped under `"No pickup point"` and placed at the bottom.
  - Verify sequential numbering (`Sr No`) runs continuously across all pickup groups.
- [x] **7. Driver WhatsApp Plain Text Export**:
  - Click "Copy as WhatsApp text" in Manifest Print Modal footer.
  - Verify clipboard contents are formatted cleanly for driver/coordinator:
    - Bold asterisk headers (`*📍 STOP NAME - TIME (N passengers)*`).
    - Numbered passenger rows (`1. Seat L1: Ramesh Bhai - 9876543210 (Bal: ₹500)`).
  - **Strict Security Verification**: Verify ZERO Aadhaar numbers appear in driver plain-text export, even when the Aadhaar column is enabled in the print manifest settings.
- [x] **8. Keyboard Accessibility & Responsive Viewports**:
  - Navigate `ShareSeatModal` using only keyboard (`Tab`, `Space`, `Escape`). Focus trap keeps focus inside modal; `Escape` closes modal and returns focus to triggering seat.
  - Inspect on 360px mobile viewport: verify zero horizontal overflow on page body; image preview fits within modal container.

---

## 3.24 Manual Verification Checklist — Part 6S-3b (Group Booking & Payment Split)

> [!NOTE]
> Per explicit owner decision, automated tests were not run and no new automated tests were written in Part 6S-3b ("automated tests not run, per owner decision"). All verifications were conducted manually using the checklist below and verified with an end-to-end real browser Playwright execution.

- [x] **1. Part 0 Carry-over: Boarding Details in BookingForm**:
  - Open new booking form; verify "Boarding & Drop Details (Optional)" card is present with Pickup point, Pickup time, and Drop point inputs.
  - Type in pickup point; verify `#tour-pickup-datalist` suggests existing tour stops.
  - Verify invalid time formats (e.g. `25:00` or `abc`) trigger a validation error toast.
- [x] **2. Part 0 Carry-over: Driver WhatsApp Text Phone Selection & Zero Aadhaar**:
  - In Journeys screen, open Manifest Print Modal and click "Copy as WhatsApp text".
  - If mobile/phone column is NOT selected in manifest columns, verify passenger phone numbers are completely omitted from the plain text.
  - If mobile/phone column IS selected, verify phone numbers appear.
  - **Zero Aadhaar Guarantee**: Verify Aadhaar numbers NEVER appear in the driver plain-text export under any circumstances.
- [x] **3. Group Booking Wizard (2-Step Creation)**:
  - In Journeys screen or Departure card, click "Group Booking" (or "New Group Booking").
  - Step 1: Fill Group Name ("Patel Parivar Yatra"), Leader Name, Leader Phone, Tour, Journey Date, Bus Type, and Default Pickup/Drop.
  - Click "Proceed to Member Details"; verify Step 2 loads with live summary bar (Members, Seats, Total Fare).
  - Add 3 member bookings (e.g. Ramesh ₹2,500, Suresh ₹5,000, Mahesh ₹2,500).
  - Allocate berths using coach grid: Ramesh -> `left-L1-1`, Suresh -> `left-L2-1` & `left-L3-1`, Mahesh -> `right-L1-1`.
  - Click "Create Group"; verify 3 distinct member bookings (`YHB-...`) and 1 `BookingGroup` are created in MongoDB.
- [x] **4. Pre-Validation & Concurrency Safeguards**:
  - Verify coach capacity check: requesting more seats than bus capacity is rejected with HTTP 400.
  - Verify duplicate seat check: assigning the same seat to two members within the group is rejected with HTTP 409 `SEAT_CONFLICT`.
  - Verify departure collision check: assigning a seat already booked or held by another traveler on the departure is rejected with HTTP 409.
  - Verify rollback compensation: if any member fails during sequential creation, earlier members are automatically soft-deleted.
- [x] **5. Departure Groups Modal & Group Detail Drawer**:
  - On the Departure Card, click "Groups"; verify `DepartureGroupsModal` lists the group with member count, seat count, total fare, and balance due.
  - Click "View Group"; verify `GroupDetailDrawer` slides out.
  - Verify financial cards (Total Fare, Total Advance, Balance Due).
  - Verify member table lists each member with individual invoice number, seat badges, fare, and balance.
  - Click "Copy for WhatsApp"; verify formatted group summary is copied to clipboard.
- [x] **6. Live Seat Map & Travelers Indicators**:
  - Open Live Seat Map for the departure; verify seats booked by the group show `👥 Patel...` tag pills.
  - Click any group seat; verify Seat Action Drawer displays group name and leader contact.
  - Navigate to Travelers (`#passengers`); verify group member rows display `👥 Group` badge.
- [x] **7. One Total Payment Split Engine (Proportional, Equal, Manual)**:
  - In `GroupDetailDrawer`, click "Record Group Payment".
  - Enter total amount ₹5,000 (with total group balance due ₹10,000 across Ramesh ₹2,500, Suresh ₹5,000, Mahesh ₹2,500).
  - Verify Proportional mode preview table: Ramesh gets ₹1,250, Suresh gets ₹2,500, Mahesh gets ₹1,250.
  - Test 1-paise integer remainder distribution (e.g. ₹3,333.33): verify remainder paise is awarded deterministically to largest balance due with 0 floating-point drift.
  - Switch to "Equal Share": verify funds distribute equally up to individual balance caps.
  - Test overpayment protection: entering ₹15,000 (> ₹10,000) displays error "exceeds total group balance due" and disables submission.
  - Submit ₹4,000 via UPI; verify 3 discrete `Payment` records created in `Payment` collection with atomic receipt numbers (`REC-...`).
  - Verify member booking balances and paid states update automatically in MongoDB.
- [x] **8. Undo Group Payment**:
  - In `GroupDetailDrawer` payments history, click "Undo Payment" on the recorded group payment; confirm void.
  - Verify group payment status changes to `"undone"`.
  - Verify all 3 associated `Payment` records are marked `isVoid: true`.
  - Verify all 3 member bookings have their advance and balance restored to original amounts.
- [x] **9. Disband Group**:
  - In `GroupDetailDrawer`, click "Disband"; confirm.
  - Verify group status changes to `"disbanded"`.
  - Verify member bookings remain completely intact on the departure with `groupId` cleared.
- [x] **10. Accessibility & Viewport Responsiveness**:
  - Verify full keyboard navigation (`Tab`, `Enter`, `Escape`) across all group modals and drawer.
  - Test on 360px mobile viewport: verify zero horizontal page scroll (`scrollWidth === innerWidth`).
  - Test on 1440px desktop viewport: verify crisp responsive cards and tables.

---

## 3.25 Manual Verification Checklist — Part 6S-4 (Booking Review Step & Lower/Upper Deck Tabs)

> [!NOTE]
> Per explicit owner decision, automated tests were not run and no new automated tests were written in Part 6S-4 ("automated tests not run, per owner decision"). All verifications were conducted manually using the checklist below and verified with an end-to-end real browser Playwright execution.

- [x] **1. Problem 1 Verification: Step 0 Enter Key Prevention**:
  - Open New Booking form (`/` -> "New Booking").
  - On Step 0 (Tour, Date, Contact), fill Tour, Journey Date, Bus Type, and Primary Contact.
  - Focus inside phone number field (`#contactPhone`) and press Enter.
  - Verify form does NOT submit, does NOT advance to Step 1, and Step 0 remains active (`PASS: Enter in Step 0 input did NOT advance or submit`).
- [x] **2. Problem 2 Verification: Sleeper Seat Picker Deck Tabs**:
  - Advance to Step 1 (Passengers & Seats). Fill passenger 1 details and click seat selector.
  - In Seat Picker modal, verify Design System Tabs are rendered:
    - "Lower deck" (with live count, e.g. `Lower deck (0/18)`).
    - "Upper deck" (with live count).
    - "Rear berths (2)" (for 2x1 38-berth bus).
  - Verify front amber strip with "▲ Front" on the left and "Driver" (☸) on the right.
  - Verify 3-column structure: Left cabin, central aisle ("SLEEPER"), Right cabin with 2 berths side-by-side.
  - Click "Upper deck" tab; select an available upper berth (e.g. `left-U1-1`).
  - Confirm selection and return to passenger form.
- [x] **3. Problem 1 Verification: Step 2 Enter Key Prevention**:
  - Advance to Step 2 (Pricing & Payment).
  - Enter base amount (₹5,000) and advance received (₹2,000).
  - Focus inside advance received field (`#advanceReceived`) and press Enter.
  - Verify form does NOT submit and does NOT redirect to home overview (`PASS: Enter in Pricing input did NOT submit`).
- [x] **4. Problem 1 Verification: Review Step Presentation & Contents**:
  - On Step 2, click "Next: Review".
  - Verify Step 3 (Review Step) is presented and active.
  - Verify Review screen displays:
    - Tour destination and journey date.
    - Bus arrangement.
    - Primary traveler contact name and phone number.
    - Passenger list with formatted seat labels (e.g. "Seat Left U1-1").
    - Pricing summary (Base fare, Total amount, Advance paid, Balance due).
    - Boarding & drop points (if provided).
    - Operational notice ("Please review all booking details carefully before confirming").
- [x] **5. Problem 1 Verification: 'Back to edit' Workflow**:
  - On Step 3 Review screen, click "Back to edit".
  - Verify form navigates back to Step 2 (Pricing & Payment).
  - Verify all entered values (e.g. advance received ₹2,000) are strictly preserved.
  - Click "Next: Review" again; verify returns cleanly to Step 3.
- [x] **6. Problem 1 Verification: Single-Shot Confirmation**:
  - On Step 3 Review screen, click "Confirm Booking".
  - Verify button displays loading spinner and disables during flight.
  - Verify booking is saved to MongoDB, toast notification appears, and operator is redirected to dashboard.
- [x] **7. Problem 2 Verification: Group Booking Modal Coach Map Unification**:
  - Open Group Booking Modal ("Group Booking" on Departure).
  - Advance to Step 2 (Member Details).
  - Verify coach selection uses the shared `SeatMap` with Lower deck / Upper deck tabs and unified styling.
- [x] **8. Responsive Viewport Check (360px Mobile)**:
  - Resize viewport to 360px mobile width.
  - Verify deck tabs, berth buttons, summary footer, and Review screen render cleanly with zero horizontal overflow or clipping.

---

## 4. Current Testing Gaps & Roadmap

With 361 unit & regression tests passing across 93 TAP test suites, 78 component tests passing across 17 Vitest suites, zero ESLint errors (with `jsx-a11y` enabled), and the automated `ui:smoke` tool in place, Phase 6 Part 6a is officially completed. Remaining gaps scheduled for future phases:

1. **Backend Integration / API Route Tests**:
   - Cash Book routes (`/api/cashbook`, `/api/cashbook/close`, `/api/cashbook/reopen`) and money-changing route locks are validated against `tests/integration-cashbook.test.js` and pure unit tests.
   - *Phase 7 Plan*: Introduce automated integration tests using an in-memory MongoDB runner (`mongodb-memory-server`) to test all remaining Express route handlers, auth cookies, and Mongoose schema validations end-to-end.
2. **Visual Regression Snapshot Testing**:
   - *Phase 7 Plan*: Compare screenshots captured by `npm run ui:smoke` against golden baseline images to catch unintended visual regressions automatically.
