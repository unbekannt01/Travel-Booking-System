# YatraHub: Desktop Architecture Specification (Offline Windows App)

## 1. Executive Summary & Objective

YatraHub is designed for small bus and yatra tour operators across India (1–10 sleeper coaches, package tours with fixed departure dates, token advances, balance collections at boarding, and bus passenger manifests).

Roadside travel agency offices and bus station booths often face intermittent or absent internet connectivity. YatraHub is engineered to run as a **self-contained, offline Windows desktop application (Electron + SQLite, single operator, zero cloud reliance, zero subscription login)** while preserving the existing Express + MongoDB web path for future cloud deployment.

Because of the architectural isolation in `src/data/`, UI components (`src/components/`) communicate exclusively through the Data Access Layer. Both the web client and offline desktop shell use identical function signatures with zero UI code alterations.

---

## 2. Implemented Architecture: Web vs. Desktop

```
┌────────────────────────────────────────────────────────────────────────┐
│                          React 19 Frontend                             │
│       (src/components/, src/utils/, src/hooks/, Tailwind CSS)          │
│                            [100% UNCHANGED]                            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Calls pure async data functions
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Data Access Layer (src/data/)                       │
│                                                                        │
│   Runtime Switcher: window.electron ? sqliteAdapter : restAdapter      │
│   ┌───────────────────────────────┐  ┌──────────────────────────────┐  │
│   │   REST Adapter (rest.js)      │  │   SQLite Adapter (sqlite.js) │  │
│   │   -> fetch() via client.js    │  │   -> window.electron.invoke  │  │
│   │   -> Express 5 + MongoDB API  │  │   -> Electron Main Process   │  │
│   └───────────────────────────────┘  │   -> better-sqlite3 engine   │  │
│                                      └──────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              Shared Pure Business Logic (shared/businessLogic)         │
│   - Rounding & Rupee Calculations (round2)                             │
│   - Pricing, Discounts & GST Tax Split (calculatePricing)              │
│   - Sequential Invoice / Receipt Numbering (YHB-KYX-OCT-001)           │
│   - Cancellation Retention & Refund Logic (calculateCancellationRefund)│
│   - Payment Ledger Reconciliation (computeLedgerTotals)                │
│   - Seat Conflict Detection & Duplicate Prevention                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. SQLite Database Schema & Concurrency Rules

The SQLite engine runs with **WAL mode (`PRAGMA journal_mode = WAL`)**, **Foreign Keys enabled (`PRAGMA foreign_keys = ON`)**, and a **5000ms busy timeout**.

### Normalized Tables
1. **`tours`**: `id PRIMARY KEY`, `name`, `destination`, `duration`, `busType`, `totalSeats`, `pricing` (JSON), `createdAt`, `updatedAt`
2. **`bookings`**: `id PRIMARY KEY`, `invoiceNo UNIQUE`, `tourId`, `tourName`, `journeyDate`, `busType`, `totalAmount`, `advanceReceived`, `discount`, `gstPercent`, `baseAmount`, `gstAmount`, `isPaid`, `paymentMode`, `status`, `contactName`, `contactPhone`, `notes`, `bookingDate`, `deletedAt`, `createdAt`, `updatedAt`
3. **`passengers`**: `id PRIMARY KEY`, `bookingId REFERENCES bookings(id) ON DELETE CASCADE`, `seatId`, `name`, `age`, `gender`, `phone`, `aadhar`, `checkedIn`, `createdAt`
4. **`payments`**: `id PRIMARY KEY`, `bookingId REFERENCES bookings(id) ON DELETE CASCADE`, `receiptNo UNIQUE`, `amount`, `type`, `paymentMode`, `paymentDate`, `referenceNo`, `notes`, `recordedBy`, `isVoid`, `voidReason`, `voidedAt`, `voidedBy`, `createdAt`
5. **`settings`**: `key PRIMARY KEY`, `value`
6. **`active_seats`**: `tourName`, `journeyDate`, `seatId`, `bookingId REFERENCES bookings(id) ON DELETE CASCADE`, `passengerId`, `PRIMARY KEY (tourName, journeyDate, seatId)`

### Unique Active Seat Enforcement
- A dedicated `active_seats` table enforces composite primary key uniqueness on `(tourName, journeyDate, seatId)`.
- When an active booking is created, updated, or seat-swapped, active seats are atomically verified and locked in a transaction.
- If an operator attempts to double-book a seat for the same tour and calendar date, SQLite raises a 409 conflict.
- When a booking is cancelled or soft-deleted, its active seats are immediately released.
- When restoring a soft-deleted booking, seats are verified before restoring.

---

## 4. Single-User Offline Operator Session

In desktop mode, multi-tenant JWT registration is bypassed:
- The app automatically launches directly into the Dashboard without login or password prompts.
- `SettingsPanel` displays an **Offline Desktop Security** status badge.
- Operator settings (Company Name, GSTIN, Invoice Prefix, Receipt Prefix, Ticket Template) are saved directly to the SQLite `settings` table.

---

## 5. Automated Daily Backups & Recovery

Data loss is the primary risk for offline desktop applications. YatraHub implements a two-tier safety architecture:
1. **Automated Rolling Daily Snapshots**:
   - On application startup, the system checks `%APPDATA%/yatrahub/backups/`.
   - If today's snapshot doesn't exist, a backup is created: `yatrahub-backup-YYYY-MM-DD.db` using `better-sqlite3`'s streaming `.backup()` API.
   - Older backups are pruned automatically, preserving the last **7 rolling daily snapshots**.
2. **Manual Export & Restore**:
   - **Export Database Backup**: Lets the operator choose any directory or USB drive via native Windows file dialog.
   - **Restore from Backup**: Validates the selected SQLite file, closes existing database connections, overwrites the active database file, runs migrations, and reloads the window.

---

## 6. Development & Build Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs web Vite dev server (`http://localhost:5173`) |
| `npm run dev:desktop` | Runs Vite dev server and launches Electron desktop window concurrently |
| `npm run test` | Runs web unit test suite (84 tests) |
| `npm run test:desktop` | Runs offline SQLite and contract parity test suite (14 tests) |
| `npm run build` | Builds Vite production bundle into `dist/` |
| `npm run dist:win` | Packages full standalone Windows installer (`release/YatraHub Setup.exe`) |
