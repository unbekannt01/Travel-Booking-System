# YatraHub (यात्रा हब) 🚌
### Tour Booking & Manifest Management System for Indian Bus Operators

> **Tailored for small Indian bus & yatra tour operators** managing 1–10 sleeper coaches, fixed departure dates, advance token bookings, boarding balance collections, and RTO/police-compliant passenger manifests.

---

## ⚡ Quickstart (< 5 minutes)

### Prerequisites
- **Node.js**: v18+ (tested on Node v20 and v24)
- **MongoDB**: Local MongoDB instance (`mongodb://localhost:27017`) or free MongoDB Atlas URI

### 1. Clone & Setup
```bash
git clone https://github.com/unbekannt01/Travel-Booking-System.git
cd Travel-Booking-System
```

### 2. Configure Backend
Create `backend/.env` (or copy from `backend/.env.example`):
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/sb_tourism
JWT_SECRET=super_secret_jwt_key_yatrahub_2026
FRONTEND_URL=http://localhost:5173
```

### 3. Install Dependencies
```bash
# Install root (frontend) dependencies
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

## 🧪 Running Automated Tests

YatraHub includes a comprehensive, zero-dependency test suite leveraging Node's native test runner (`node --test`).

```bash
npm test
```

### Test Coverage Highlights (19 test cases):
- **Double-booking prevention**: Verifies that 2 bookings on the same tour, date, and seat collide with `409 Conflict`.
- **Cancelled booking seat release**: Confirms seats from cancelled reservations are released immediately.
- **Invoice number generation**: Tests tour code acronym generation (`KYX`, `CDX`), month code formatting, and non-colliding serial counters under concurrent calls.
- **Payment calculations & ledger**: Validates advance + balance = total, partial payments appending to ledger, overpayment rejection, and full-settlement state transitions.
- **Passenger check-in**: Tests persistent passenger check-in toggle and bus manifest completion percentage.
- **Indian Phone & Aadhaar validation**: Rejects malformed phone numbers while accepting Indian formats (`+91`, `91`, `0`, or raw 10-digit starting with 6–9), validates 12-digit Aadhaar, and tests Aadhaar privacy masking (`XXXX XXXX 1234`).

---

## 🎯 Target User & Daily Operator Workflow

YatraHub is engineered specifically around the day-to-day operations of an Indian pilgrimage / tour coach operator:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Take Booking   │ ───►  │  Token Advance  │ ───►  │ Payment Ledger  │ ───►  │  Print Manifest │
│ (Select Sleeper │       │ (Record UPI/Cash│       │ (Track dues at  │       │ (Seat chart for │
│   Berths 1-36)  │       │   advance)      │       │    boarding)    │       │ driver & RTO)   │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

1. **Take Reservation**:
   - Operator selects tour package (e.g., *Kedarnath Yatra 9D/8N*) and departure date.
   - Interactive 2x1 / 2x2 luxury sleeper layout with distinct upper/lower berth pricing and real-time locked seat indicators.
   - Collects traveler details, pickup point, and Aadhaar numbers (masked as `XXXX XXXX 1234` for passenger privacy).
2. **Issue Tax / Tour Invoice**:
   - Auto-generates clean, professional invoices (`YHB-KYX-OCT-001`).
   - Invoices feature the operator's **Bank Account Details & UPI ID** (`yatra@okaxis`) so travelers can transfer their balance effortlessly.
3. **Track Balances & Recover Dues**:
   - Visual urgency alerts (Red < 3 days to departure, Yellow < 10 days).
   - 1-click pre-filled WhatsApp balance reminders.
   - Immutable payment ledger tracking multiple installments (Cash, UPI, Bank Transfer, Cheque).
4. **Day of Departure**:
   - **Today's Operations Banner** on the dashboard highlights coach departures, passenger count, and pending boarding collections.
   - Driver/Conductor checks in passengers boarding at stops via the **Journey Manager**.
   - 1-click printable passenger manifest matching transport department requirements.

---

## 🏗 Architecture & Offline Desktop Readiness

To enable YatraHub to be converted into an **offline Windows desktop application (Electron + SQLite)** without rewriting the user interface, the codebase enforces strict separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                       React 19 Frontend                         │
│  src/components/        src/utils/            src/hooks/        │
│  (UI & Views)           (Pure Helpers)        (State Hooks)     │
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
- **Desktop Transition**: When packaging with Electron and SQLite, only `src/data/client.js` is swapped for an Electron IPC invoke bridge. All 15+ UI views, modal dialogs, and styling remain **100% untouched**.
- See **[`ARCH_DESKTOP.md`](ARCH_DESKTOP.md)** for complete SQLite schema definitions, IPC design, and data backup workflows.

---

## 📁 Repository Structure

```
Travel-Booking-System/
├── ARCH_DESKTOP.md           # Plan and SQLite schema for offline Windows app
├── README.md                 # Project documentation & quickstart
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
│   ├── components/           # UI Views
│   │   ├── common/           # Toast & Confirm Modal contexts
│   │   ├── dashboard/        # Modular dashboard (Home, Sidebar, Settings, Invoices)
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
│   └── utils/                # Date, currency (INR), and validator utilities
│
└── tests/                    # Automated Test Suite (Node native test runner)
    ├── double-booking.test.js
    ├── invoice-generation.test.js
    ├── passenger-checkin.test.js
    ├── payment-calculations.test.js
    └── validators.test.js
```

---

## 📄 License
ISC License. Built for Indian tour and bus operators.
