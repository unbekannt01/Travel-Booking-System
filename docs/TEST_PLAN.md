# YatraHub (TBS) — Test Strategy & Test Plan

This document details the automated testing architecture, test runner configuration, coverage map across all 58 test suites (223 tests), automated UI smoke suite (`npm run ui:smoke`), and identified testing gaps.

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

## 2. Test Suites & Coverage Map (223 Tests / 24 Test Files / 58 TAP Suites)

| Suite File | Subtests | Core Scenarios Covered |
| :--- | :---: | :--- |
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
1. **8 Application Views**: Overview (`dashboard`), Travelers (`passengers`), Journeys (`journey`), Destinations (`tours`), Analytics (`analytics`), Settings (`settings`), Stepped Booking Form (`form`), and Dev UI Kit (`ui-kit`).
2. **4 Responsive Viewports**: Small mobile (`360x740`), Tablet (`768x1024`), Laptop/Desktop (`1024x768`), Wide Monitor (`1440x900`).
3. **2 Themes**: Light mode and Dark mode (`data-theme="dark"`).
4. **Horizontal Overflow Guard**: Asserts `document.documentElement.scrollWidth <= document.documentElement.clientWidth` across all viewports.
5. **WCAG 2.1 AA Accessibility Analysis**: Executes `new AxeBuilder({ page })` with `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']` tags to identify any remaining automated accessibility violations.
6. **Report Generation**: Writes detailed markdown report to gitignored `docs/screenshots/report.md` with captured page screenshots.

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
$env:UI_SMOKE_EMAIL="operator@yatrahub.local"
$env:UI_SMOKE_PASSWORD="OperatorPassword123!"
npm run ui:smoke
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

## 4. Current Testing Gaps & Roadmap

With 223 unit & regression tests passing across 58 TAP test suites, zero ESLint errors (with `jsx-a11y` enabled), and the automated `ui:smoke` tool in place, the remaining gaps scheduled for future phases are:

1. **Backend Integration / API Route Tests**:
   - Currently, API endpoints (`/api/bookings`, `/api/payments`, `/api/auth`) are validated against business logic and security unit tests.
   - *Phase 7 Plan*: Introduce automated integration tests using an in-memory MongoDB runner (`mongodb-memory-server`) to test Express route handlers, auth cookies, and Mongoose schema validations end-to-end.
2. **Visual Regression Snapshot Testing**:
   - *Phase 7 Plan*: Compare screenshots captured by `npm run ui:smoke` against golden baseline images to catch unintended visual regressions automatically.
