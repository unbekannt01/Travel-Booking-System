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

## 2. Test Suites & Coverage Map (171 Tests / 22 Suites)

| Suite File | Subtests | Core Scenarios Covered |
| :--- | :---: | :--- |
| **`tests/operational-modals-journey.test.js`** | 18 | **Operational Modals & Journeys Screen (Part 3.4)**: `formatSeatLabel` human parsing (lower/upper sleeper berths, case normalization, fallback handling, custom identifiers); `formatSeatList` with comma separation, overflow truncation (`+N`), and fallback safety; `shellConfig` metadata verification (`journey.hasOwnHeading === false`, `dashboard.hasOwnHeading === false`, `passengers.hasOwnHeading === true`, `tours.hasOwnHeading === true`); boarding math and progress bar values (occupancy %, boarded passenger count); `CancelBookingModal` refund calculation (`totalPaid - fee`), zero-floor bounds checking, fee presets (₹0 fee for full refund, Retain All for 0 refund); `InvoicesModal` multi-field search and payment/cancellation status chip filtering. |
| **`tests/aadhaar-edit-roundtrip.test.js`** | 7 | **Masked Aadhaar Edit Round-Trip (SEC-012 & Task 0)**: Frontend validator detection of masked Aadhaar and `[UNCHANGED]` sentinel token; `isValidAadhaar` with `{ allowMasked: true }`; backend `isMaskedOrUnchangedAadhaar` verification; `BookingForm` Step 1 validation with masked Aadhaar; backend reconciliation preserving existing AES-256-GCM ciphertext on edit; re-encryption of new 12-digit Aadhaar when replaced; explicit clearance of Aadhaar; non-inheritance of Aadhaar by new passengers; guarantees raw masked strings are never persisted. |
| **`tests/overview-and-booking-form.test.js`** | 10 | **Overview & Stepped Booking Form (Part 3.3)**: Bus capacity (`2x1`=36, `2x2`=40) and clamped occupancy %; `getBookingPaymentStatus` (`Cancelled`/`Paid`/`Partial`/`Pending`); KPI & Today's Operations metrics + 7-day departure grouping; recent booking status & search filtering; payment urgency classification (`Overdue`, `Due on boarding`, `Due soon`, `Scheduled`); 4-step booking validation (Steps 0–2 & cross-step `validateAllBookingSteps`, duplicate/conflicting seats, Aadhaar, advance bounds), step click navigation rules, sticky summary composition via `calculatePricing`, server 400/409 error formatting, and `hasOwnHeading: false` shell verification. |
| **`tests/app-shell.test.js`** | 8 | **App Shell & Navigation (Part 3.2)**: Verifies 6 canonical tab IDs & labels; confirms `SHOW_THEME_TOGGLE === false`; validates `resolvePageMeta` (including New vs Edit Booking and unknown fallback); tests `isNavItemActive`, `isMoreDestinationActive`, `getSkeletonVariant`, and resilient sidebar collapsed-state persistence with a throwing storage mock. |
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
1..46
# tests 153
# suites 35
# pass 153
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
