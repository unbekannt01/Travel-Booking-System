# YatraHub (TBS) — System Architecture

## 1. Overview
YatraHub is an on-premise local web application designed specifically for small Indian bus and yatra tour operators. It manages passenger reservations, sleeper coach seat manifests, GST invoices, multi-installment payment ledgers, QR boarding passes, and custom ticket templates.

The application runs strictly in a **local web mode**:
- **Frontend**: React 19 SPA bundled with Vite, styled with Tailwind CSS.
- **Backend API**: Node.js with Express 5 REST API.
- **Database**: Local MongoDB instance (`mongodb://127.0.0.1:27017/yatrahub`) using Mongoose 8 ODM.
- **Shared Core**: Pure JavaScript ESM module (`shared/businessLogic.js`) shared between frontend and backend.

---

## 2. System Architecture Diagram

```mermaid
graph TD
    subgraph Client ["Client Browser (http://localhost:5173)"]
        UI["React 19 UI Components<br/>(Dashboard, Modals, Forms, Ticket Templates)"]
        State["Contexts & State<br/>(ToastContext, ConfirmModalContext)"]
        DataLayer["Data Access Layer<br/>(src/data/*.js)"]
        RestAdapter["REST Adapter<br/>(src/data/adapters/rest.js)"]
        HTTPClient["HTTP Client<br/>(src/data/client.js)"]
        
        UI --> State
        UI --> DataLayer
        DataLayer --> RestAdapter
        RestAdapter --> HTTPClient
    end

    subgraph Shared ["Shared Logic (shared/)"]
        BizLogic["shared/businessLogic.js<br/>(Pricing, GST, Invoices, Receipts, Seat Conflicts, Phone/Aadhaar)"]
    end

    subgraph Backend ["Backend API (http://localhost:5000)"]
        ExpressApp["Express 5 App<br/>(backend/index.js)"]
        SecurityLayer["Security Layer<br/>(Helmet, Strict CORS, MongoSanitize, RateLimit)"]
        AuthMiddleware["Auth Middleware<br/>(verifyToken, tokenVersion & activeTokens check)"]
        
        subgraph Routes ["API Routes"]
            AuthRoute["/api/auth (auth.js)"]
            BookingRoute["/api/bookings (bookings.js)"]
            TourRoute["/api/tours (tours.js)"]
            PaymentRoute["/api/payments (payments.js)"]
        end
        
        ExpressApp --> SecurityLayer
        SecurityLayer --> AuthMiddleware
        AuthMiddleware --> Routes
    end

    subgraph Database ["Local Database"]
        MongoDB[("MongoDB 27017<br/>yatrahub")]
        subgraph Models ["Mongoose Models"]
            UserModel["User (Company, 2FA, Settings)"]
            BookingModel["Booking (Passengers, Berths, Invoices)"]
            TourModel["Tour (Packages, Pricing, Berths)"]
            PaymentModel["Payment (Receipts, Ledger, Voids)"]
            EmailTokenModel["EmailToken (Reset, 2FA Recovery)"]
        end
    end

    HTTPClient -->|"HTTP REST JSON (/api/*)"| ExpressApp
    UI -.->|"Pure Utilities"| BizLogic
    Routes -.->|"Imports Business Rules"| BizLogic
    Routes --> Models
    Models --> MongoDB
```

---

## 3. Frontend Architecture

### 3.1 Directory Structure
- `src/components/`: Modular React components.
  - `src/components/dashboard/`: Dashboard layout, sidebar navigation, top header, home statistics, settings panel, and invoice management modals.
  - `src/components/common/`: Shared UI components including `BoardingPassModal`, `SeatLayoutModal`, `ReceiptModal`, `ConfirmModalContext`, and `ToastContext`.
  - `src/components/tickets/`: Ticket template registry and 6 modular printable ticket styles (`classic`, `modern`, `heritage`, `corporate`, `thermal`, `transit`).
  - `src/components/BookingForm.jsx`: New reservation interface with interactive sleeper bus berth selector.
  - `src/components/InvoiceView.jsx`: Printable GST tax invoice with company branding, passenger table, and bank/UPI payment counterfoil.
  - `src/components/JourneyManager.jsx`: Bus departure coordination, manifest status, batch boarding, seat swap, and quick balance collection.
  - `src/components/PaymentTracker.jsx`: Multi-installment payment ledger, payment recording, and receipt voucher generation.
  - `src/components/TourInventory.jsx`: Tour package management, coach type configuration, and berth pricing.
  - `src/components/TourAnalytics.jsx`: Revenue metrics, booking statistics, and occupancy analytics.
- `src/data/`: Centralized Data Access Layer (DAL). Components never execute raw `fetch()` calls; all requests route through:
  - `src/data/client.js`: HTTP request wrapper with bearer token injection and error handling.
  - `src/data/adapters/index.js` & `src/data/adapters/rest.js`: REST adapter converting backend JSON into normalized application entities.
  - Domain modules: `src/data/auth.js`, `src/data/bookings.js`, `src/data/tours.js`, `src/data/payments.js`, `src/data/settings.js`.
- `src/i18n/`: Internationalization dictionaries (`documents.js`) offering complete translation parity across English (`en`), Hindi (`hi`), and Gujarati (`gu`).
- `src/utils/`: Pure helpers for dates, currency formatting, CSV generation (`csv.js`), seat auto-allocation (`seatAssignment.js`), and validators (`validators.js`).

---

## 4. Shared Business Logic (`shared/businessLogic.js`)

Core financial and domain rules are centralized in a zero-dependency ESM module imported directly by both frontend and backend:

| Function | Purpose |
| :--- | :--- |
| `round2(num)` | Standardizes 2-decimal rupee rounding using `Number.EPSILON`. |
| `calculatePricing(...)` | Recomputes pricing, discounts (fixed / percentage), and 5% GST (tax-inclusive or exclusive). |
| `generateTourCode(tourName)` | Extracts uppercase 3-letter acronyms (e.g. "Dwarka Somnath" → "DSX"). |
| `getMonthCode(date)` | Returns 3-letter month code (e.g. "OCT"). |
| `buildInvoicePrefix(customPrefix, tourName, journeyDate)` | Constructs single-source invoice prefixes (e.g. "YHB-DSX-OCT-"). |
| `calculateNextInvoiceNo(existingInvoices, prefix)` | Calculates zero-collision sequential invoice counters (e.g. "YHB-DSX-OCT-001"). |
| `buildReceiptPrefix(customPrefix, date)` | Builds payment voucher prefixes (e.g. "REC-2610-"). |
| `calculateNextReceiptNo(existingReceipts, prefix)` | Calculates sequential payment receipt numbers (e.g. "REC-2610-001"). |
| `getDayBounds(dateInput)` | Normalizes journey dates to UTC start and end bounds to avoid timezone misalignment. |
| `validateIndianPhone(phone)` | Validates 10-digit Indian mobile numbers (starting with 6, 7, 8, or 9). |
| `validateAadhaar(aadhar)` | Validates 12-digit Indian Aadhaar number format. |
| `calculateCancellationRefund(...)` | Validates cancellation charges and calculates customer refunds. |
| `computeLedgerTotals(payments, totalAmount)` | Calculates total received, total refunded, and remaining balance from ledger entries. |
| `findSeatConflicts(...)` | Detects internal and cross-booking seat collisions for the same tour and journey date. |

---

## 5. Backend Architecture (Express 5)

### 5.1 Server Configuration (`backend/index.js`)
- Initializes Express application with JSON body parser.
- Enables CORS for local frontend ports (`http://localhost:5173`).
- Connects to local MongoDB database (`mongodb://127.0.0.1:27017/yatrahub`).
- Manages startup index synchronization for the `Booking` collection.

### 5.2 Middleware (`backend/middleware/auth.js`)
- `verifyToken`: Extracts Bearer token from `Authorization` header, verifies signature against `process.env.JWT_SECRET`, and confirms token existence in `user.activeTokens` to enforce session validity and logout invalidation.

### 5.3 Routes
1. **`/api/auth`** (`backend/routes/auth.js`):
   - Operator registration and password login.
   - TOTP 2-Factor Authentication setup, verification, and disablement.
   - Password reset via email token (`nodemailer`).
   - 2FA recovery flow.
   - Active session listing and per-device revocation.
   - Company branding, logo, invoice prefixes, and bank detail updates.
2. **`/api/bookings`** (`backend/routes/bookings.js`):
   - Reservation CRUD, soft-deletion, and restoration.
   - Conflict-guarded seat reservations.
   - Passenger check-in toggle and batch check-in.
   - Seat swap operations.
   - Booking cancellations with automated refund voucher creation.
3. **`/api/tours`** (`backend/routes/tours.js`):
   - Tour package catalog, departure scheduling, bus layout types, and berth pricing.
4. **`/api/payments`** (`backend/routes/payments.js`):
   - Multi-installment payment recording.
   - Receipt generation and sequential voucher numbers (`REC-XXXX`).
   - Payment voiding with reason tracking and automated balance recalculation.

---

## 6. Database Models (Mongoose)

### 6.1 `User`
- Operator profile (`userName`, `email`, `password` hash).
- 2FA configuration (`twoFactorSecret`, `twoFactorEnabled`).
- Company branding (`companyName`, `companyTagline`, `companyLogo`, `gstNumber`, `companyPhone`, `companyHeadquarters`).
- Operational settings (`invoicePrefix`, `receiptPrefix`, `invoiceTheme`, `invoiceColor`, `documentLanguage`, `ticketTemplate`, `termsAndConditions`).
- Financial details (`bankDetails`: account name, account number, IFSC, bank name, UPI ID).
- Conductor / organizer contact directory (`organizers`).
- Active session whitelist (`activeTokens`).

### 6.2 `Booking`
- User ownership (`userId`).
- Identification (`invoiceNo`, `date`, `tourName`, `journeyDate`, `busType`, `duration`).
- Customer contact (`contactName`, `contactPhone`, `contactEmail`).
- Financials (`totalAmount`, `advanceReceived`, `discount`, `discountType`, `gstRate`, `taxAmount`, `isTaxInclusive`, `isPaid`, `paymentMode`).
- Passenger roster (`passengers`: array of name, age, gender, city, seatId, aadhar, checkedIn).
- Cancellation ledger (`status`, `cancellationReason`, `cancellationCharge`, `refundAmount`, `refundPaymentMode`, `cancelledAt`).
- Soft-delete tracking (`deletedAt`).

### 6.3 `Tour`
- Operator ownership (`userId`).
- Package details (`name`, `duration`, `busType`, `journeyDate`).
- Berth pricing model (`pricingType`, `fixedPrice`, `lowerPrice`, `upperPrice`).

### 6.4 `Payment`
- Operator and booking association (`userId`, `bookingId`).
- Transaction details (`receiptNo`, `amount`, `type`: advance/partial/balance/refund, `paymentMode`, `paymentDate`, `referenceNo`, `notes`, `recordedBy`).
- Audit trail (`isVoid`, `voidReason`, `voidedAt`, `voidedBy`).

### 6.5 `EmailToken`
- Token storage (`userId`, `token`: SHA-256 hashed, `purpose`: password-reset / 2fa-recovery, `expiresAt`).

### 6.6 `Counter`
- Atomic sequence generation for invoice and receipt numbers (`userId`, `prefix`, `seq`).

### 6.7 `AuditLog`
- Security event ledger (`userId`, `action`, `ip`, `userAgent`, `meta`, `createdAt` with 180-day TTL).

---

## 7. Security Hardening Architecture (Phase 2)

- **Strict Output Encoding & CSP**: All user inputs rendered in ticket templates, invoices, and boarding passes are escaped via `escapeHtml()`, and strict Content-Security-Policy headers/meta tags block inline scripts and remote resources.
- **Server Authority Over Pricing & Seats**: The server recomputes tour rates, discounts, and 5% GST using `calculatePricing()`, rejecting client price tampering. The `Payment` ledger is the sole source of truth for booking financial synchronization (`syncBookingPayments()`).
- **Cryptographic Protection at Rest**:
  - TOTP 2FA secrets are encrypted at rest with AES-256-GCM (`TOTP_ENC_KEY`).
  - Passenger 12-digit Indian Aadhaar numbers are encrypted at rest with AES-256-GCM (`DATA_ENC_KEY`) and validated via the Verhoeff checksum algorithm. Responses return masked values (`XXXX XXXX 1234`) with an authorized reveal endpoint.
- **Session Hardening & Defense-in-Depth**:
  - `httpOnly`, `SameSite=Strict` session cookies with custom `X-Requested-With` header verification for CSRF mitigation.
  - Active session invalidation via per-user `tokenVersion` and `activeTokens` tracking.
  - Brute-force protection: Rate limiting on auth endpoints (10 req/15min) and 15-minute account lockouts after 5 consecutive failed attempts.
  - Password complexity policy: Minimum 10 characters, upper, lower, digit, symbol.
- **API Defense & Auditing**:
  - `helmet` security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, HSTS).
  - CORS strictly restricted to configured `FRONTEND_URL`.
  - Express 5-compatible NoSQL sanitizer (`mongoSanitize`) and Zod schema validation.
  - Payload limits: Strict 100KB global limit with route-specific 5MB limit for logo uploads.
  - Immutable audit trail (`AuditLog`) capturing sensitive operational events with PII-masked console logging.

---

## 8. UI Foundation (Design System v2 — Part 3.1)

- **Design Tokens (`src/index.css`)**: Semantic `--yh-*` CSS custom properties for Light (`:root`) and Dark (`[data-theme="dark"]`) themes mapped into Tailwind CSS 4 via `@theme` (Deep Indigo primary, warm Saffron/Amber accent, warm-tinted neutrals, WCAG AA semantic pairs, radii, shadows, z-index scale, and reduced-motion guards). Legacy CSS variables remain intact while screens migrate incrementally across Parts 3.2–3.5.
- **Offline Multi-Script Typography (`src/main.jsx`)**: Self-hosted `@fontsource-variable/inter` paired with `@fontsource/noto-sans-devanagari` and `@fontsource/noto-sans-gujarati` (weights 400–700) bundled directly into `dist/assets/` with zero external font CDNs.
- **Theme Handling (`src/theme/` + `public/theme-init.js`)**:
  - `public/theme-init.js` loads synchronously from `'self'` in `index.html` `<head>` before first paint to eliminate light/dark FOUC without loosening CSP.
  - `ThemeProvider` and `useTheme` support `"system"`, `"light"`, and `"dark"` modes, reacting to OS `prefers-color-scheme` changes and wrapping all `localStorage` access in `try/catch`.
- **Accessible UI Primitives (`src/components/ui/`)**: 25 token-driven, accessible primitives (`Button`, `IconButton`, `Input`, `Select`, `Textarea`, `Checkbox`, `Switch`, `Field`, `Card`, `Badge`, `StatusPill`, `Modal`/`Dialog`, `Drawer`, `Tabs`, `Table`, `Tooltip`, `Skeleton`, `EmptyState`, `Spinner`, `StatCard`, `PageHeader`, `SearchInput`, `Avatar`, `ConfirmDialog`, `Toast`) built with `class-variance-authority`, `clsx`, and `tailwind-merge`, plus `src/utils/cn.js` and `formatINR` (`src/utils/formatters.js`).
- **Toast & Confirm Providers (`src/components/common/`)**: Refactored into separate hook (`useToast.js`, `useConfirm.js`), provider (`ToastProvider.jsx`, `ConfirmModalProvider.jsx`), and `.js` compatibility barrels (`ToastContext.js`, `ConfirmModalContext.js`) backed by the new `Toast` and `ConfirmDialog` primitives.
- **Dev-Only UI Kit (`src/dev/UiKitPage.jsx`)**: Reachable at `#/ui-kit` strictly when `import.meta.env.DEV` is true and dead-code-eliminated from production builds.

---

## 9. App Shell, Navigation & Code Splitting (Part 3.2)

- **App Shell (`src/components/shell/`)**:
  - `AppShell.jsx`: Provides the "Skip to main content" link (first focusable element), `aria-live="polite"` route announcements, focus management onto `#main-content` (`tabIndex={-1}`) on tab change, and conditional `<PageHeader>` slot (deferred via `hasOwnHeading: true` for screens that still render their own heading until Parts 3.3–3.5).
  - `AppSidebar.jsx`: Desktop (`lg+`) collapsible sidebar (`w-64` expanded / `w-[76px]` collapsed) persisting collapsed state via `try/catch`-wrapped `localStorage`, company logo with `Avatar` fallback, active bar + bold state + `aria-current="page"`, tooltips when collapsed, and hover/focus route prefetching.
  - `AppTopBar.jsx`: Sticky header showing page title, global search (`SearchInput`), prominent **"New Booking"** CTA reachable from every screen, gated `ThemeSwitcher` (controlled by `SHOW_THEME_TOGGLE = false` in `src/components/shell/shellConfig.js` until Part 3.5 migrates inner screens), and accessible User Menu (Settings, Sign Out).
  - `MobileBottomNav.jsx` + `Drawer`: Mobile/tablet (`<lg`) fixed bottom bar (Overview, Travelers, center Book action, Journeys, More) paired with the focus-trapped, Escape-dismissible `Drawer` primitive for full navigation.
- **Routing Strategy**: Preserves `activeTab` state in `src/components/Dashboard.jsx` (`dashboard`, `passengers`, `journey`, `tours`, `analytics`, `settings`, `form`) without introducing a router library.
- **Lazy Loading & Error Recovery**:
  - `Auth` and `Dashboard` (`AppShell`) load eagerly. All 7 tab screens (`DashboardHome`, `BookingForm`, `PassengerManagement`, `TourInventory`, `JourneyManager`, `TourAnalytics`, `SettingsPanel`), full-screen views (`InvoiceView`, `TwoFactorSetup`, `TwoFactorVerify`, `ResetPassword`, `Recover2FA`), and on-demand modals (`Disable2FAModal`, `InvoicesModal`, `CancelBookingModal`) load via `React.lazy` with page-shaped `PageSkeleton` fallbacks.
  - `ChunkErrorBoundary.jsx` wraps lazy views with a friendly "Could not load this page" card and **Retry** / **Reload App** actions, resetting automatically when switching tabs so the shell remains usable.
- **Vendor Chunk Splitting (`vite.config.js`)**: `build.rollupOptions.output.manualChunks` separates `vendor-react`, `vendor-recharts` (loaded only on Analytics), `vendor-icons`, `vendor-ui`, and `vendor-misc`, reducing the main entry chunk from `1,123 kB` to `~80 kB` with zero chunks exceeding 500 kB.

---

## 10. Dashboard Overview & Stepped Booking Flow (Part 3.3)

- **Shell PageHeader Ownership (`src/components/shell/shellConfig.js`)**: Flipped `hasOwnHeading: false` for both `dashboard` and `form` so `AppShell` renders the single screen `<h1>` (`Overview`, `New Booking`, `Edit Booking`), paired with mobile safe-area bottom padding (`pb-[calc(5.5rem+env(safe-area-inset-bottom))]`) so cards and sticky form bars never sit behind `MobileBottomNav`.
- **Dashboard Overview (`src/components/dashboard/DashboardHome.jsx`, `src/utils/dashboardOverview.js`, overview section of `src/components/PaymentTracker.jsx`)**:
  - Pure metrics/grouping helpers (`computeOverviewMetrics`, `groupUpcomingDepartures`, `filterRecentBookings`, `getBookingPaymentStatus`, `getPaymentUrgencyMeta`) separated into `src/utils/dashboardOverview.js`.
  - Token-driven Today's Operations card, 4-card KPI row (`StatCard` + `Skeleton` loading states), Upcoming 7-Day Departures with accessible berth occupancy progress bars (`role="progressbar"` + `"X of Y berths booked, Z%"`), responsive Recent Bookings (`Table` on `md+`, stacked cards on `<md`) composing global top-bar search (`filteredBookings`) with local status chips and search, and standardized Payment Tracking overview cards with text+icon+color urgency badges (leaving PaymentTracker's modals untouched for Part 3.4).
- **Stepped Booking Flow (`src/components/BookingForm.jsx`, `src/utils/bookingFormHelpers.js`)**:
  - Structured into 4 accessible steps (**1. Tour & Date + Primary Contact**, **2. Passengers & Seats**, **3. Pricing & Payment**, **4. Review**) with `aria-current="step"`, `aria-live="polite"` step announcements, inline `<Field>` errors, per-step error summary, and focus movement to the first invalid field.
  - Full cross-step validation runs before save (using untouched `calculatePricing` in `src/utils/pricing.js` and `isValidIndianPhone`/`isValidAadhaar` in `src/utils/validators.js`). Review step masks passenger Aadhaar via `maskAadhaar()`.
  - `Dashboard.jsx`'s `handleSaveBooking` returns a structured `{ ok, booking | error, status, data }` result so `BookingForm` surfaces authoritative server HTTP 400/409 errors (seat conflicts, total mismatches, advance bounds) in a top-of-form `role="alert"` banner while preserving all entered user data.

---

## 11. Operational Modals & Journeys Screen (Part 3.4)

- **Operational Modals Migration to `Modal` Primitive**:
  - `src/components/common/SeatLayoutModal.jsx`: Fully migrated from hardcoded `fixed inset-0` overlays to the accessible `Modal` primitive with focus trapping, Escape dismissal, and body scroll lock. Tokenized deck navigation (Lower/Upper tabs), WCAG AA color-coded berth legend, and human-readable berth labels via `formatSeatLabel`. All print/export functions (`printSeatLayout`, CSV) remain untouched with strict output escaping.
  - `src/utils/seatFormatting.js` (re-exported in `src/utils/formatters.js`): Pure, testable formatting utilities (`formatSeatLabel`, `formatSeatList`). Parses sleeper berth codes (`"lower-L1-1"` → `"Lower L1-1"`, `"upper-R2-2"` → `"Upper R2-2"`) with case normalization and robust fallback safety; formats multi-seat lists with overflow truncation (`"Lower L1-1, Upper R2-2 +2"`).
  - `BookingForm.jsx` Auto-Assign Modal: Rebuilt on `Modal` with deck preference radios and accessible capacity checks.
  - `src/components/PaymentTracker.jsx` Modals: Record Payment and Payment Ledger migrated to `Modal`, `Table`, `Field`, `Input`, `Select`, and `StatusPill`. Void payment dialog migrated to a dedicated destructive confirmation prompt on `Modal`.
  - `src/components/dashboard/CancelBookingModal.jsx`: Rebuilt on `Modal` with real-time refund calculation (`Math.max(0, totalPaid - fee)`), bounds checking, preset buttons (₹0 fee for full refund, Retain All for ₹0 refund), clear seat release warning, and top `role="alert"` banner for server errors.
  - `src/components/dashboard/InvoicesModal.jsx`: Rebuilt on `Modal` (`size="xl"`), sticky toolbar featuring `SearchInput`, tour filter `Select`, and status filter chips (`All`, `Paid`, `Pending`, `Cancelled`) with `aria-pressed`. Desktop view (`md+`) renders accessible `Table` with invoice number, status pill, traveler name/phone, tour badge, journey date, passenger count, total amount (`formatINR`), and action icon buttons. Mobile view (`<md`) renders responsive stacked cards with `min-h-11` touch targets. Filter misses render `EmptyState`.
- **Journeys Screen (`src/components/JourneyManager.jsx`)**:
  - Integrated into the AppShell heading hierarchy with `journey.hasOwnHeading: false` in `src/components/shell/shellConfig.js`, enabling the shell `<PageHeader>` to render a single `Journeys` `<h1>`.
  - Departure cards tokenized with accessible `role="progressbar"` (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`), departure status badges, and bus occupancy rates.
  - Boarding checklist with mobile card layout and desktop table layout, passenger check-in toggles, seat swap modal on `Modal`, and quick payment collection on `Modal`. All print/export manifest documents remain untouched with strict output escaping.
- **App Shell Header Polish (`src/components/shell/AppTopBar.jsx` & `AppShell.jsx`)**:
  - Added `hideTitleOnDesktop` prop to `AppTopBar.jsx` bound to `!pageMeta.hasOwnHeading`. On `lg+` viewports when `PageHeader` renders the page title in `<main>`, the duplicate top-bar title is hidden via `lg:hidden`, while remaining visible on mobile viewports (`<lg`).

  - Sticky live summary column on `lg+` and collapsible summary bar docked above the sticky step footer on `<lg`. Existing coach seat picker and auto-assign modals remain functionally intact for Part 3.4 restyling.

---

## 12. Remaining Screens, Auth & Dark Theme System (Part 3.5)

- **Travelers Screen (`src/components/PassengerManagement.jsx`)**:
  - Rebuilt with Design System v2 tokens, eliminating legacy hardcoded borders, shadows, and raw colors.
  - Heading ownership flipped: `passengers.hasOwnHeading: false` in `src/components/shell/shellConfig.js` so `AppShell` renders the unified `<h1>Travelers</h1>`.
  - Search toolbar with `SearchInput`, tour filter `Select`, and boarding status chips (`All`, `Boarded`, `Pending`).
  - Sensitive PII Protection: Masked Aadhaar display (`XXXX XXXX 1234`) with explicit "Reveal" action invoking `client.revealAadhaar(id)` and rendering in an accessible `Modal` dialog.
  - Safe CSV Export: RFC4180-compliant with UTF-8 BOM, spreadsheet formula injection neutralization (`=`, `+`, `-`, `@`), and sanitized passenger fields.
  - Accessible Manifest Print: Focus-managed print modal reusing `ticketRegistry` / print manifest templates with strict output escaping.
  - Responsive layout: Accessible `Table` on desktop (`md+`), touch-friendly stacked cards with large touch targets on mobile (`<md`). Filter misses render `EmptyState`.
- **Destinations Screen (`src/components/TourInventory.jsx`)**:
  - Heading ownership flipped: `tours.hasOwnHeading: false` so `AppShell` renders `<h1>Destinations & Packages</h1>`.
  - Package catalog cards tokenized with bus type badges, departure date, duration, pricing badges (`formatINR`), and action menus.
  - Create / Edit Tour Modal rebuilt on `Modal` primitive with `<Field>`, `<Input>`, `<Select>`, and dynamic pricing breakdown (`Fixed` vs `Per-Berth Lower/Upper`).
  - Live Invoice Prefix Preview: Real-time preview of sequential invoice codes (e.g. `YHB-DSX-NOV-001`) as tour name or prefix is typed via `getInvoicePreview`.
  - Delete tour confirmation using `useConfirm` / `ConfirmDialog` primitive.
- **Analytics Screen (`src/components/TourAnalytics.jsx`)**:
  - Heading ownership flipped: `analytics.hasOwnHeading: false` so `AppShell` renders `<h1>Analytics & Reports</h1>`.
  - KPI Stat Row: 4 responsive `StatCard`s with `formatINR` Indian rupee formatting (Total Revenue, Total Bookings, Passenger Count, Average Occupancy %).
  - Recharts Visualizations: Revenue trend area chart, tour performance bar chart, and payment status pie chart using CSS custom property tokens (`--yh-brand`, `--yh-success`, `--yh-warning`, `--yh-danger`, `--yh-text-primary`, `--yh-border-default`) for dark mode support.
  - Screen Reader Accessibility: Hidden accessible data tables (`sr-only`) accompanying every chart with full numeric data breakdown for assistive technologies.
  - Destination Performance: Accessible desktop `Table` and mobile stacked cards with revenue, booking count, and occupancy progress bars.
- **Settings Screen (`src/components/dashboard/SettingsPanel.jsx`)**:
  - Heading ownership flipped: `settings.hasOwnHeading: false` so `AppShell` renders `<h1>Settings</h1>`.
  - Tabbed Navigation: Built on `Tabs` primitive across 7 structured sections:
    1. Company Profile (name, tagline, GST, phone, address, conductor directory)
    2. Branding & Logo (secure upload with 5MB validation, instant preview, remove logo)
    3. Bank & UPI Details (account name, number, IFSC, bank name, UPI ID for invoices)
    4. Document & Invoice Numbering (invoice prefix, receipt prefix, document language)
    5. Ticket Templates (visual selector for 6 styles: Classic, Modern, Heritage, Corporate, Thermal, Transit)
    6. Terms & Conditions (custom operator booking terms rendered on invoices and tickets)
    7. Security & 2FA (TOTP two-factor status, QR code setup, active sessions revocation, password change)
  - Sticky Unsaved Changes Bar: Visual alert bar at bottom of panel with Save Changes and Discard actions when changes are pending.
- **Authentication & Security Screens**:
  - Redesigned with Design System v2 tokens and responsive card wrappers:
    - `Auth.jsx`: Login & Register forms with accessible inputs, `autoComplete` attributes, show/hide password toggles, real-time password complexity checklist (`checkPasswordCriteria`: ≥10 chars, upper, lower, digit, symbol), and user-friendly server error formatting (`formatAuthError`).
    - `TwoFactorVerify.jsx`: 6-digit numeric TOTP input with auto-focus and 2FA recovery link.
    - `TwoFactorSetup.jsx`: Step-by-step QR code scan, secret key copy with feedback, and verification code test.
    - `Recover2FA.jsx`: Email recovery code request and verification.
    - `ResetPassword.jsx`: Secure password reset with password complexity validation.
    - `Disable2FAModal.jsx`: Destructive action confirmation with password verification on `Modal`.
- **App-Wide States**:
  - 404 Route (`NotFoundPage.jsx`): User-friendly error page with "Back to Overview" CTA when route is invalid.
  - Root Error Boundary (`RootErrorBoundary.jsx`): Catches top-level uncaught React rendering exceptions, displaying a polished error fallback with Reload and Retry actions without white-screening.
  - API Unreachable Banner (`AppShell.jsx`): Subscribes to API connectivity events (`API_STATUS_EVENT` via `subscribeApiStatus` in `src/data/client.js`) and renders an accessible top banner when backend is offline/unreachable, automatically clearing when connection is restored.
- **Dark Theme Toggle & Print Isolation**:
  - Activated: `SHOW_THEME_TOGGLE = true` in `src/components/shell/shellConfig.js`.
  - Complete token coverage: Every screen, modal, card, table, and form element now uses `--yh-*` tokens.
  - Print Isolation (`src/index.css`): Strict `@media print` rules enforcing `background: white !important; color: black !important;` on `body`, `[data-theme="dark"]`, and `.dark` containers, ensuring ticket templates, invoices, receipts, and manifests print cleanly on paper regardless of active dark mode.

---

## 13. Quality Engineering & Phase 3 Verification (Part 3.6)

- **Design System v2 Token Completion & CSS Cleanup**:
  - All coach seat picker layouts (`BookingForm.jsx`), seat indicators, and modals fully migrated to `--yh-*` tokens and accessible primitives.
  - Redundant `tailwind.config.js` safely eliminated; Tailwind CSS 4 compiles standalone via `@import "tailwindcss";` and `@theme` definitions in `src/index.css`.
  - Legacy CSS variables (`--background`, `--foreground`, `--card`, `--popover`, `--border`, `--destructive`, `--chart-*`, etc.) cleaned up, with shorthand compatibility aliases mapped to canonical design system tokens.
- **Accessibility & Static Analysis (eslint-plugin-jsx-a11y)**:
  - Added `eslint-plugin-jsx-a11y` flat recommended configuration into `eslint.config.js`.
  - Systematically resolved all 24 JSX accessibility violations across forms, modals, drawers, tooltips, and tables, achieving 0 errors and 0 warnings.
  - Keyboard accessibility: Standardized `tabIndex={0}` on scrollable tables, managed focus on dialog openings, eliminated autofocus disruption, and isolated backdrop click overlays with `aria-hidden="true"`.
- **Automated UI Smoke & Axe Core Verification (`scripts/ui-smoke.mjs`)**:
  - Added `npm run ui:smoke` command executing Playwright-based headless browser traversal with `@axe-core/playwright`.
  - Audits all 8 application views (Overview, Travelers, Journeys, Destinations, Analytics, Settings, Booking Form, Dev UI Kit) across 4 standard viewports (360px mobile, 768px tablet, 1024px desktop, 1440px wide) in both Light and Dark themes.
  - Validates zero horizontal scrolling (`scrollWidth <= clientWidth`), captures full-page visual screenshots, and produces an axe-core WCAG 2.1 AA violation report in `docs/screenshots/report.md`.
- **Security & PII Hardening (SEC-012 Single Passenger Reconciliation)**:
  - Reconciled both `aadhar` and legacy `aadhaar` field keys on granular passenger updates (`PUT /:bookingId/passengers/:passengerIdentifier`), enforcing AES-256-GCM encryption on newly submitted 12-digit numbers while preserving existing ciphertexts when masked or unchanged.
  - Enforced `maskBookingPaxAadhaar(booking)` across all single/batch passenger updates and status routes (`checkin`, `batch-checkin`, `toggle-payment`, `cancel`, `restore`) to eliminate ciphertext leakage.
- **Dependency & Audit Baseline**:
  - Zero vulnerabilities across root and backend npm dependencies (`npm audit` and `npm audit --omit=dev` reporting 0 vulnerabilities).
  - 191 automated test cases passing across 46 TAP test suites covering business logic, pricing, crypto, tokens, auth, and UI states.
