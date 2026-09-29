# YatraHub (यात्रा हब) 🚌
### Tour Booking, Invoice & Manifest Management System for Indian Bus Operators

> **Tailored exclusively for small Indian bus & yatra tour operators** managing 1–10 sleeper coaches, fixed departure dates, advance token bookings, boarding balance collections, custom ticket designs, and conductor passenger seat layouts.

---

## ⚡ Quickstart (< 5 minutes)

### Prerequisites
- **Node.js**: v18+ (tested on Node v20, v22, and v24)
- **MongoDB**: Local MongoDB (`mongodb://localhost:27017/sb_tourism`) or MongoDB Atlas URI

### 1. Clone & Setup
```bash
git clone https://github.com/unbekannt01/Travel-Booking-System.git
cd Travel-Booking-System
```

### 2. Configure Environment Variables
Create `backend/.env` (or copy from `backend/.env.example`):
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/sb_tourism
JWT_SECRET=super_secret_jwt_key_yatrahub_2026
FRONTEND_URL=http://localhost:5173
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

Create `.env` in the root for frontend Vite (optional, defaults to `http://localhost:5000`):
```env
VITE_API_URL=http://localhost:5000
```

### 3. Install Dependencies
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..
```

### 4. Run Development Servers
In two separate terminals:

```bash
# Terminal 1: Backend API (port 5000)
cd backend
npm run dev
```

```bash
# Terminal 2: Frontend Vite app (port 5173)
npm run dev
```

Open your browser at **`http://localhost:5173`**.

---

## 🖥️ Offline Windows Desktop App (Electron + SQLite)

YatraHub can run as a **100% offline Windows desktop application** with an embedded high-performance SQLite database (`better-sqlite3`).

### 1. Run in Desktop Development Mode
```bash
# Starts Vite dev server and launches Electron desktop window concurrently
npm run dev:desktop
```
- **Zero Login Required**: Automatically logs in as the local operator.
- **Embedded SQLite**: Database file stored at `%APPDATA%/yatrahub/yatrahub.db`.
- **Automatic Daily Backups**: Rolling daily snapshots retained automatically (last 7 days).
- **Manual Backup & Restore**: One-click database export and restore directly from Settings.

### 2. Package Windows NSIS Installer
```bash
# Packages standalone Windows NSIS installer into release/
npm run dist:win
```

---

## 🧪 Automated Test Suite

YatraHub includes a comprehensive, dual-mode automated test suite:
- **Web & Business Logic Tests** (84 tests across 14 test suites via native Node test runner):
  ```bash
  npm test
  ```
- **Offline Desktop & SQLite Engine Tests** (14 tests verifying schema, seat locks, backups & parity):
  ```bash
  npm run test:desktop
  ```
- **Code Hygiene & Linting**:
  ```bash
  npm run lint
  ```
- **Production Bundle Compilation**:
  ```bash
  npm run build
  ```

### Test Coverage Summary (**84 tests across 14 test suites**):
1. **Double-Booking & Seat Conflicts** (`tests/double-booking.test.js`):
   - Internal duplicate seat rejection in the same booking (`400 Bad Request`).
   - Cross-booking collision rejection on the same tour, date, and seat (`409 Conflict`).
   - Seat release upon booking cancellation.
2. **Single-Source Invoice Numbers** (`tests/invoice-generation.test.js`):
   - Tour code acronyms (`KYX`, `CDX`), month codes, and zero-collision sequential counters.
3. **Payment Ledger & Calculations** (`tests/payment-calculations.test.js`):
   - Advance + balance = total, partial installment ledger appending, overpayment guards, voiding.
4. **Pricing & GST Calculations** (`tests/pricing-calculations.test.js`):
   - Exclusive and inclusive 5% GST, rupee/percentage discounts, tax-exempt tours, 2-decimal rounding.
5. **Cancellation & Refunds** (`tests/cancellation-calculations.test.js`):
   - Retention fees, full refunds, non-refundable advances, fee validation.
6. **Multi-language Documents (en, hi, gu)** (`tests/i18n-documents.test.js`):
   - Complete dictionary parity across English, Hindi, and Gujarati for invoices, receipts, and QR passes.
7. **QR Boarding Passes & Receipts** (`tests/boarding-pass-receipt.test.js`):
   - Dynamic QR payload (`invoiceNo-seatId`), Aadhaar masking (`XXXX XXXX 1234`), receipt vouchers.
8. **Ticket Templates Registry** (`tests/ticket-templates.test.js`):
   - Validation for all 6 modular ticket templates (`classic`, `modern`, `heritage`, `corporate`, `thermal`, `transit`), fallback resolution, multilingual output, and batch printing.
9. **Coach Seat Layout & Manifest** (`tests/seat-layout.test.js`):
   - 2x1 (36 berths) and 2x2 (40 berths) coach mapping, booked passenger assignment, unbooked seats marked Available, cancelled booking release, Upper & Lower deck separation.
10. **CSV Export Utility** (`tests/csv-export.test.js`):
    - UTF-8 Byte Order Mark (`\uFEFF`) for Excel compatibility, comma/newline/quote escaping, and spreadsheet formula injection protection (`=`, `+`, `-`, `@`).
11. **Customer History Lookup** (`tests/customer-history.test.js`):
    - Indian mobile number normalization (`+91`, `0`, spaces) and matching past bookings by phone.
12. **Auto-Assign Seats Utility** (`tests/ui-improvements.test.js`):
    - Deck preference (`lower` / `upper`), unassigned count reporting, 2x1 and 2x2 seat allocations.
13. **Soft Delete & Restore** (`tests/ui-improvements.test.js`):
    - Exclusion of soft-deleted bookings, seat release upon deletion, and instant restore.
14. **Validators** (`tests/validators.test.js`):
    - Indian mobile numbers, 12-digit Aadhaar formatting, and masking.

---

## 🎨 Feature Modules & Operator Capabilities

### 1. Custom Ticket Templates (Phase 6)
- **6 Professional Ticket Designs**:
  1. **Classic Express**: Traditional dual-column boarding pass with dashed tear-off stub and bold seat badge.
  2. **Modern Minimalist**: Contemporary card with gradient accent bar, rounded pill tags, and soft shadows.
  3. **Royal Yatra**: Traditional Indian pilgrimage aesthetic with "॥ शुभ यात्रा ॥" header, saffron/gold borders, and passenger blessings.
  4. **Corporate Executive**: Slate & Navy executive travel voucher with GST breakdown, counterfoil, and conductor stamp box.
  5. **Conductor Slip (Thermal)**: High-density receipt slip with monospace fonts, high-contrast QR code, and rapid check format.
  6. **Metro Transit**: Vibrant transit ticket with color-coded deck indicators (Emerald Lower / Violet Upper) and departure timeline.
- **Admin / Settings Selection**: Operators preview and select their preferred ticket template in **Settings → Ticket & Boarding Pass Design Template**. The selected template is saved to their profile and automatically applied to all boarding passes.
- **Live Preview & Print Fidelity**: Live on-screen preview matches the exact `@page` print output without layout clipping or misalignment.

### 2. Downloadable Passenger Seat Layout (Phase 6)
- **Pre-Departure Coach Chart**:
  - Full bus layout showing driver cabin (front), left berths, central gangway/aisle, and right berths.
  - Real-time mapping of passenger names, ages, contact numbers, and invoice numbers directly against booked seats.
  - Unbooked/vacant seats explicitly shown as **"Available"** with clean dashed styling.
  - Cancelled bookings automatically release seats back to Available.
- **Separate Upper & Lower Deck Layouts**:
  - Dedicated visual diagrams and boarding manifests for **Lower Deck** and **Upper Deck**.
  - Generated with `page-break-after: always` so conductors receive separate, perfectly sized physical sheets for each deck.
  - Interactive deck filter: View Both Decks, Lower Deck Only, or Upper Deck Only.
- **Export Options**:
  - **Download / Print PDF**: Clean, print-ready document formatted with signature lines and conductor instructions.
  - **Export Conductor CSV**: RFC4180-compliant CSV download with UTF-8 BOM (`\uFEFF`) for flawless Gujarati/Hindi/English rendering in Microsoft Excel.

### 3. Multi-language Documents & QR Passes (Phase 5)
- Document language switcher (**English | हिन्दी | ગુજરાતી**) on invoices, boarding passes, and receipts.
- Live QR Code on every boarding pass encoding `${invoiceNo}-${seatId}` for instant gate scanning.
- Official printable Payment Voucher (`REC-XXXX`) with audit trail.

### 4. Money & Departures Coordination (Phases 1–3)
- Single-source invoice generation (`YHB-KYX-OCT-001`).
- Multi-installment payment ledger tracking advance tokens, bank details, and UPI transfers.
- Cancellation management with retention fees and customer refund calculations.
- Coach departure grouped cards showing capacity, occupancy percentage, boarded passengers, and pending dues.
- 1-click batch boarding ("Board All" / "Unboard All"), seat swap modal, and quick balance collection at coach steps.

---

## 📋 Comprehensive Manual Test Checklist

Follow this checklist to verify the complete YatraHub system end-to-end:

### A. Authentication & Settings
1. **Login & Branding**:
   - Log into the dashboard.
   - Go to **Settings**. Click **Edit Company Info**.
   - Change **Company Name** (e.g. "Shree Ram Travels"), **Invoice Prefix** ("SRT"), and **Brand Accent Color**.
   - Select **Ticket & Boarding Pass Template** (try switching between "Classic Express", "Royal Yatra", and "Modern Minimalist").
   - Click **Save Changes**. Verify toast notification appears and changes persist after page reload.

### B. Booking & Seat Allocation
2. **Create New Reservation**:
   - Click **New Booking**. Select a tour (e.g., *Dwarka Somnath 5D/4N*) and journey date.
   - Enter passenger details (Name, Age, Gender, City, 12-digit Aadhaar).
   - Click **Select Seat from Coach Layout**.
   - Verify that 2x1 sleeper layout displays Lower Deck and Upper Deck.
   - Select a berth (e.g., `lower-L1`). Verify berth turns blue with "Selected" tag.
   - Enter ₹3,000 Advance Payment. Save the reservation.
   - Confirm single-source invoice number is generated (e.g., `SRT-DSX-OCT-001`).

3. **Collision & Conflict Guard**:
   - Create a second reservation for the same tour and journey date.
   - Open seat map. Verify `lower-L1` is locked with red border and cannot be selected.
   - Verify auto-assign button fills only available berths.

### C. Ticket Templates & Boarding Passes
4. **Custom Ticket Generation**:
   - Open **Passengers** or **Departures & Manifests**.
   - Click the **Boarding Pass (🎫)** button for your booking.
   - Verify that the passenger's ticket renders in your selected template design from Settings.
   - Use the **Design** dropdown in the modal header to preview all 6 templates:
     - Classic Express
     - Modern Minimalist
     - Royal Yatra (verify "॥ शुभ यात्रा ॥" and devotional framing)
     - Corporate Executive (verify GST table & inspection counterfoil)
     - Conductor Slip (verify thermal monospace slip)
     - Metro Transit (verify emerald lower deck pill)
   - Switch language pills (**English | हिन्दी | ગુજરાતી**). Verify labels update instantly.
   - Click **Print Ticket / Print All Tickets**. Verify popup opens print dialog with high-fidelity formatting.
   - Click **Share on WhatsApp**. Verify WhatsApp Web opens with pre-filled ticket details.

### D. Pre-Departure Seat Layout Chart (Upper & Lower Decks)
5. **Download Passenger Seat Layout**:
   - Go to **Departures & Journey Coordination** tab.
   - On the departure card, click **Layout** (or in the Manifest view, click **Seat Layout PDF**).
   - In the **Seat Layout Modal**:
     - Verify trip details: Tour name, Journey date, Bus number, Coach capacity.
     - Verify metrics: Booked Berths, Available Berths, Occupancy %.
     - Check the **2D Bus Coach Diagram**: Booked berths show passenger name and invoice #; vacant berths show "Available".
     - Toggle Deck filters: **Both Decks**, **Lower Deck Only**, **Upper Deck Only**.
   - Click **Print / Download PDF**:
     - Verify print preview generates separate clean pages for Lower Deck and Upper Deck with `page-break-after`.
     - Verify conductor checklist checkboxes and signature blocks.
   - Click **Export CSV**:
     - Verify file downloads as `Seat-Layout-<Tour>-<Date>.csv`.
     - Open in Excel: verify UTF-8 BOM properly displays names and formatting without garbled symbols.

### E. Boarding Check-in, Seat Swap & Quick Payment
6. **Day of Departure Operations**:
   - On the departure card, click **Open Boarding**.
   - Click **Board All**. Verify all passenger check-in toggles turn green (100% Complete).
   - Click **Unboard** on a single passenger to verify manual toggle.
   - Click **Swap Seat (⇄)**: select an available berth and confirm seat updates instantly.
   - Click **Collect (₹)** on a pending payment: record cash balance collection. Verify payment ledger appends new installment and due amount becomes ₹0 (PAID).

### F. Cancellations, Invoices & Audit Ledger
7. **Cancellation & Refund**:
   - From recent bookings, click **Cancel Booking**.
   - Enter cancellation fee (e.g. ₹500 fee on ₹3,000 advance).
   - Confirm refund due calculation: ₹2,500. Submit cancellation.
   - Verify booking turns red with Cancelled status and seats are immediately freed for new bookings.

---

## 🏗 Architecture & Offline Desktop Readiness

To enable YatraHub to be converted into an **offline Windows desktop application (Electron + SQLite)** without rewriting the user interface, the codebase enforces strict separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                       React 19 Frontend                         │
│  src/components/        src/utils/            src/i18n/         │
│  (UI & Templates)       (Pure Helpers)        (Dictionaries)    │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Data Access Layer (src/data/)                   │
│                                                                 │
│   src/data/bookings.js         src/data/tours.js                │
│   src/data/payments.js         src/data/settings.js             │
│   src/data/auth.js             src/data/client.js               │
└────────────────────────────────┬────────────────────────────────┘
                                 │
             ┌───────────────────┴───────────────────┐
             ▼                                       ▼
    Current Web Mode:                     Future Desktop Mode:
    Express 5 + MongoDB                   Electron IPC + SQLite
    (HTTP JSON REST API)                  (Zero internet / Local .db)
```

- **Frontend Isolation**: No React component makes direct `fetch()` or `axios` calls to backend endpoints. All data requests route through `src/data/`.
- **Desktop Transition**: When packaging with Electron and SQLite, only `src/data/client.js` is swapped for an Electron IPC invoke bridge. All UI views, ticket templates, and seat layout modals remain **100% untouched**.
- See **[`ARCH_DESKTOP.md`](ARCH_DESKTOP.md)** for complete SQLite schema definitions, IPC design, and data backup workflows.

---

## 📁 Repository Structure

```
Travel-Booking-System/
├── ARCH_DESKTOP.md           # Plan and SQLite schema for offline Windows app
├── README.md                 # Project documentation & manual test checklist
├── package.json              # Frontend scripts & dependencies
├── vite.config.js            # Vite bundler configuration
│
├── backend/                  # Node/Express 5 backend
│   ├── index.js              # Express app entry & middleware
│   ├── models/               # Mongoose schemas (Booking, Tour, User)
│   ├── routes/               # API endpoints (auth, bookings, tours)
│   ├── middleware/           # JWT auth verification
│   └── package.json          # Backend dependencies
│
├── src/                      # React 19 Frontend
│   ├── components/           # UI Views & Modals
│   │   ├── common/           # Modal contexts, BoardingPassModal, SeatLayoutModal, ReceiptModal
│   │   ├── dashboard/        # Modular dashboard (Home, Sidebar, SettingsPanel, InvoicesModal)
│   │   ├── tickets/          # Modular Ticket Templates Registry (6 styles)
│   │   ├── BookingForm.jsx   # Sleeper berth map & reservation form
│   │   ├── InvoiceView.jsx   # Printable invoice with Bank/UPI details
│   │   ├── JourneyManager.jsx# Bus departure coordinator & check-in
│   │   ├── PaymentTracker.jsx# Ledger & balance collection tracker
│   │   ├── TourInventory.jsx # Coach packages & destinations
│   │   └── TourAnalytics.jsx # Revenue charts & booking statistics
│   ├── data/                 # Centralized Data Access Layer
│   │   ├── client.js         # HTTP client (swappable for Electron IPC)
│   │   ├── bookings.js       # Booking queries & mutations
│   │   ├── tours.js          # Tour package operations
│   │   ├── payments.js       # Payment ledger recordings
│   │   └── settings.js       # Company & bank settings
│   ├── i18n/                 # Multilingual dictionaries (en, hi, gu)
│   └── utils/                # Pure utilities (date, formatters, pricing, seatLayout, csv)
│
└── tests/                    # Automated Test Suite (84 tests across 14 suites)
    ├── ticket-templates.test.js
    ├── seat-layout.test.js
    ├── csv-export.test.js
    ├── customer-history.test.js
    ├── boarding-pass-receipt.test.js
    ├── i18n-documents.test.js
    ├── cancellation-calculations.test.js
    ├── double-booking.test.js
    ├── invoice-generation.test.js
    ├── passenger-checkin.test.js
    ├── payment-calculations.test.js
    ├── pricing-calculations.test.js
    ├── ui-improvements.test.js
    └── validators.test.js
```

---

## 📄 License
ISC License. Built for Indian tour and bus operators.
