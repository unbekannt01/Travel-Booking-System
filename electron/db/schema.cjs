// SQLite Database Schema Definitions & Migrations

const MIGRATIONS = [
  {
    version: 1,
    name: "initial_normalized_schema",
    up: (db) => {
      // 1. Tours table
      db.exec(`
        CREATE TABLE IF NOT EXISTS tours (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          destination TEXT,
          duration TEXT,
          busType TEXT,
          totalSeats INTEGER DEFAULT 36,
          pricing TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );
      `)

      // 2. Bookings table
      db.exec(`
        CREATE TABLE IF NOT EXISTS bookings (
          id TEXT PRIMARY KEY,
          invoiceNo TEXT UNIQUE NOT NULL,
          tourId TEXT,
          tourName TEXT NOT NULL,
          journeyDate TEXT NOT NULL,
          busType TEXT,
          totalAmount REAL DEFAULT 0,
          advanceReceived REAL DEFAULT 0,
          discount REAL DEFAULT 0,
          gstPercent REAL DEFAULT 0,
          baseAmount REAL DEFAULT 0,
          gstAmount REAL DEFAULT 0,
          isPaid INTEGER DEFAULT 0,
          paymentMode TEXT DEFAULT 'Cash',
          status TEXT DEFAULT 'Confirmed',
          contactName TEXT NOT NULL,
          contactPhone TEXT NOT NULL,
          notes TEXT,
          bookingDate TEXT,
          deletedAt TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_bookings_tour_date ON bookings (tourName, journeyDate);
        CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status, deletedAt);
        CREATE INDEX IF NOT EXISTS idx_bookings_invoiceNo ON bookings (invoiceNo);
      `)

      // 3. Passengers table
      db.exec(`
        CREATE TABLE IF NOT EXISTS passengers (
          id TEXT PRIMARY KEY,
          bookingId TEXT NOT NULL,
          seatId TEXT,
          name TEXT NOT NULL,
          age INTEGER,
          gender TEXT,
          phone TEXT,
          aadhar TEXT,
          checkedIn INTEGER DEFAULT 0,
          createdAt TEXT,
          FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_passengers_bookingId ON passengers (bookingId);
        CREATE INDEX IF NOT EXISTS idx_passengers_seatId ON passengers (seatId);
      `)

      // 4. Payments table
      db.exec(`
        CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          bookingId TEXT NOT NULL,
          receiptNo TEXT UNIQUE NOT NULL,
          amount REAL NOT NULL,
          type TEXT DEFAULT 'partial',
          paymentMode TEXT DEFAULT 'Cash',
          paymentDate TEXT NOT NULL,
          referenceNo TEXT,
          notes TEXT,
          recordedBy TEXT,
          isVoid INTEGER DEFAULT 0,
          voidReason TEXT,
          voidedAt TEXT,
          voidedBy TEXT,
          createdAt TEXT,
          FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_payments_bookingId ON payments (bookingId);
        CREATE INDEX IF NOT EXISTS idx_payments_receiptNo ON payments (receiptNo);
      `)

      // 5. Settings table
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `)

      // 6. Active Seats table (UNIQUE active seat constraint across tour + journeyDate + seatId)
      db.exec(`
        CREATE TABLE IF NOT EXISTS active_seats (
          tourName TEXT NOT NULL,
          journeyDate TEXT NOT NULL,
          seatId TEXT NOT NULL,
          bookingId TEXT NOT NULL,
          passengerId TEXT NOT NULL,
          PRIMARY KEY (tourName, journeyDate, seatId),
          FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_active_seats_bookingId ON active_seats (bookingId);
      `)
    },
  },
]

module.exports = {
  MIGRATIONS,
}
