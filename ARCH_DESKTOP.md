# YatraHub: Desktop Architecture Plan (Offline Windows App)

## 1. Executive Summary & Objective

YatraHub is designed for small bus and yatra tour operators across India (1–10 sleeper coaches, package tours with fixed departure dates, token advances, balance collections at boarding, and bus passenger manifests).

Many of these operators operate out of roadside travel agency offices or bus stations with intermittent, unreliable internet access. The long-term commercial goal is to package YatraHub as a **self-contained, offline Windows desktop application (Electron + SQLite, single operator, zero cloud reliance, zero subscription login)**.

Because of the architectural isolation completed in **Phase 1**, all UI components (`src/components/`) communicate exclusively through the centralized Data Access Layer (`src/data/`). Converting YatraHub into an offline desktop application requires **zero changes to the UI layer or React components**. Only the `src/data/` module and an Electron main-process bridge need to be replaced.

---

## 2. Architectural Evolution: Web vs. Desktop

```
┌────────────────────────────────────────────────────────┐
│                   React 19 Frontend                    │
│   (src/components/, src/utils/, src/hooks/, Tailwind)  │
│                   [100% UNCHANGED]                     │
└───────────────────────────┬────────────────────────────┘
                            │ Calls pure async functions
                            ▼
┌────────────────────────────────────────────────────────┐
│            Data Access Layer (src/data/)               │
│                                                        │
│  CURRENT (Web):              DESKTOP (Electron/SQLite):│
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │ client.js (fetch)    │    │ client.js (IPC bridge│  │
│  │ -> Express 5 API     │ => │ -> window.electronAPI│  │
│  │ -> MongoDB (Atlas)   │    │ -> better-sqlite3    │  │
│  └──────────────────────┘    └──────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Swapping the Data Layer
In `src/data/client.js`, the HTTP `fetch()` wrapper is swapped for an Electron IPC invoke call:
```javascript
// src/data/client.js (Desktop Mode)
export async function request(endpoint, options = {}) {
  // Directly invoke Electron IPC handler
  return window.electronAPI.invoke(endpoint, options);
}
```
Alternatively, `src/data/{bookings,tours,auth,payments,settings}.js` can directly query an embedded SQLite instance via IPC handlers defined in the Electron main process.

---

## 3. SQLite Database Schema Mapping

The current MongoDB document structures map cleanly to relational SQLite tables with foreign keys and cascade rules.

```sql
-- 1. Configuration & Company Settings (Single user/operator)
CREATE TABLE IF NOT EXISTS company_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    user_name TEXT NOT NULL DEFAULT 'SB Tourism',
    company_name TEXT NOT NULL DEFAULT 'Yatra Travels',
    company_tagline TEXT DEFAULT 'Tours & Travels',
    company_headquarters TEXT DEFAULT 'City, State, 123456',
    company_phone TEXT DEFAULT '+91 98765 43210',
    company_logo TEXT,
    upi_id TEXT,
    account_name TEXT,
    bank_name TEXT,
    account_number TEXT,
    ifsc_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tour Templates & Destinations
CREATE TABLE IF NOT EXISTS tours (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    destination TEXT NOT NULL,
    duration TEXT,
    description TEXT,
    bus_type TEXT DEFAULT '2x1 Sleeper',
    fixed_price REAL DEFAULT 0,
    lower_berth_price REAL DEFAULT 0,
    upper_berth_price REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    invoice_no TEXT UNIQUE NOT NULL,
    date DATETIME NOT NULL,
    journey_date DATETIME NOT NULL,
    tour_name TEXT NOT NULL,
    bus_type TEXT DEFAULT '2x1 Sleeper',
    contact_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    contact_email TEXT,
    total_amount REAL NOT NULL DEFAULT 0,
    advance_received REAL NOT NULL DEFAULT 0,
    is_paid INTEGER NOT NULL DEFAULT 0, -- 0 = pending, 1 = settled
    status TEXT NOT NULL DEFAULT 'Confirmed', -- 'Confirmed' | 'Cancelled'
    cancellation_reason TEXT,
    cancelled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Passengers (Normalized 1-to-many relationship)
CREATE TABLE IF NOT EXISTS passengers (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    name TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    phone TEXT,
    seat_id TEXT,
    seat_type TEXT, -- 'Lower' | 'Upper' | 'Seater'
    seat_price REAL DEFAULT 0,
    aadhar_number TEXT,
    checked_in INTEGER NOT NULL DEFAULT 0, -- 0 = false, 1 = true
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- 5. Payment Records / Ledger (Audit trail of installments)
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    amount REAL NOT NULL,
    mode TEXT NOT NULL DEFAULT 'Cash', -- 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque'
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- 6. Indexes for Fast Local Lookup
CREATE INDEX IF NOT EXISTS idx_bookings_journey_date ON bookings(journey_date);
CREATE INDEX IF NOT EXISTS idx_bookings_tour_name ON bookings(tour_name);
CREATE INDEX IF NOT EXISTS idx_passengers_booking ON passengers(booking_id);
CREATE INDEX IF NOT EXISTS idx_passengers_seat ON passengers(seat_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
```

### Double-Booking Prevention Query in SQLite
With SQLite, the atomic check and reservation query becomes trivial:
```sql
SELECT p.seat_id, b.invoice_no, p.name 
FROM passengers p
JOIN bookings b ON p.booking_id = b.id
WHERE b.tour_name = :tourName
  AND DATE(b.journey_date) = DATE(:journeyDate)
  AND b.status NOT IN ('Cancelled', 'cancelled')
  AND p.seat_id IN (:seatIds);
```

---

## 4. Backup, Restore & Data Portability

Small bus operators frequently upgrade Windows computers or require backups in case of hardware failure:

1. **Zero-Cloud Single-File Backup**:
   - The entire database is stored in a single SQLite file: `%APPDATA%/YatraHub/yatrahub.db`.
   - Backup involves copying this single file or exporting it with 1 click to a USB flash drive or external drive (`yatrahub_backup_YYYY_MM_DD.db`).
2. **JSON / Excel Export**:
   - Built-in UI feature to export all bookings, passenger manifests, and revenue reports as `.xlsx` or `.json` for accounting and tax filing.
3. **Automatic Daily Snapshots**:
   - On application startup, Electron takes an automated rotating daily backup (keeping the last 14 days) in `%APPDATA%/YatraHub/backups/`.

---

## 5. Scope of Changes & Effort Matrix

| Area | Web (Current) | Desktop (Electron + SQLite) | Effort / Status |
|---|---|---|---|
| **UI Components (`src/components/`)** | React 19 + Tailwind | React 19 + Tailwind | **0% changes (Untouched)** |
| **Utilities (`src/utils/`)** | Pure JS helpers (date, formatting, validation) | Pure JS helpers | **0% changes (Untouched)** |
| **Styling & Assets (`src/index.css`)** | Tailwind 4 | Tailwind 4 | **0% changes (Untouched)** |
| **Data Layer (`src/data/`)** | Fetch HTTP calls to Express | IPC bridge to SQLite | **~1-2 days (Replace client.js)** |
| **Main Process (`electron/`)** | None | `main.js`, `preload.js`, SQLite runner | **~2-3 days (Standard boilerplate)** |
| **Windows Installer** | None | `electron-builder` (NSIS exe setup) | **~1 day** |

**Total Estimated Conversion Time**: 4 to 6 developer days.
