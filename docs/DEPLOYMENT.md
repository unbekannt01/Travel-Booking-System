# YatraHub (TBS) — Local Deployment Guide (Windows)

This document provides step-by-step instructions for installing, configuring, running, and maintaining YatraHub locally on a Windows workstation.

---

## 1. System Requirements
- **Operating System**: Windows 10 or Windows 11 (64-bit)
- **Node.js**: v20.x or v22.x LTS ([Download Node.js](https://nodejs.org/))
- **MongoDB**: Community Edition v7.0 or v8.0 ([Download MongoDB](https://www.mongodb.com/try/download/community))
- **MongoDB Database Tools**: Required for `mongodump` and `mongorestore` ([Download Tools](https://www.mongodb.com/try/download/database-tools))
- **Git**: (Optional, for repository management by owner)

---

## 2. MongoDB Installation & Service Setup

1. **Install MongoDB Community Server**:
   - Run the `.msi` installer.
   - Choose **Complete** setup.
   - Check **"Install MongoDB as a Service"** (Service Name: `MongoDB`, runs under Network Service).
   - Ensure the default port is `27017`.
   - Data Directory default: `C:\Program Files\MongoDB\Server\8.0\data\`
   - Log Directory default: `C:\Program Files\MongoDB\Server\8.0\log\`

2. **Verify MongoDB Service Status**:
   Open Windows PowerShell as Administrator and run:
   ```powershell
   Get-Service -Name MongoDB
   ```
   If not running, start it:
   ```powershell
   Start-Service -Name MongoDB
   ```

3. **Install MongoDB Database Tools**:
   - Download the ZIP or MSI package and extract to `C:\Program Files\MongoDB\Tools\bin`.
   - Add `C:\Program Files\MongoDB\Tools\bin` to your System `PATH` environment variable so `mongodump` and `mongorestore` are available in any terminal.

---

## 3. Environment Configuration

### 3.1 Backend Configuration (`backend/.env`)
In the `backend/` directory, create a `.env` file (or copy from `backend/.env.example`):

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/yatrahub
NODE_ENV=production
FRONTEND_URL=http://localhost:5173

# Cryptographic Keys (Must be >= 32 characters)
# Generate via: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=super_secret_jwt_key_yatrahub_2026_change_in_production
TOTP_ENC_KEY=super_secret_totp_key_yatrahub_2026_change_in_production
DATA_ENC_KEY=super_secret_data_key_yatrahub_2026_change_in_production

# Email Notifications (Password Reset & 2FA Recovery)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
```

> [!IMPORTANT]
> - Use `127.0.0.1` instead of `localhost` in `MONGODB_URI` because Node resolves `localhost` to IPv6 `::1` first while a default local MongoDB listens on IPv4 only, which gives `ECONNREFUSED ::1:27017`.
> - Ensure `JWT_SECRET`, `TOTP_ENC_KEY`, and `DATA_ENC_KEY` are cryptographically random strings (minimum 32 characters).
> - Never commit `.env` files to source control.
> - If migrating an existing database with unencrypted 2FA or Aadhaar numbers, first take a `mongodump` backup (see Section 6.1), then run the migration scripts from the project root — first as a dry run, then without the `--dry-run` flag:
>   ```powershell
>   node scripts/migrate-encrypt-totp.js --dry-run
>   node scripts/migrate-encrypt-aadhaar.js --dry-run
>   node scripts/migrate-encrypt-totp.js
>   node scripts/migrate-encrypt-aadhaar.js
>   ```

### 3.2 Frontend Configuration (`.env`)
In the root directory, create a `.env` file:

```env
VITE_API_URL=http://localhost:5000
```

---

## 4. Installation & First-Time Build

Open Windows PowerShell in the project root:

```powershell
# 1. Install frontend dependencies
npm install

# 2. Install backend dependencies
cd backend
npm install
cd ..

# 3. Verify test suite and build
npm test
npm run build
```

---

## 5. Running the Application

YatraHub requires two processes running concurrently: the backend API and the frontend dev server.

### Option A: Two Terminal Windows (Recommended for Development)

**Terminal 1 (Backend API):**
```powershell
cd D:\Travel-Booking-System\backend
npm start
```
*Output: `Server running on port 5000` & `Connected to MongoDB`*

**Terminal 2 (Frontend Client):**
```powershell
cd D:\Travel-Booking-System
npm run dev
```
*Output: `VITE v7.x.x ready in ... ms  ➜  Local: http://localhost:5173/`*

Open **`http://localhost:5173`** in Google Chrome or Microsoft Edge.

### Option B: Background Service via PM2 (Recommended for Daily Local Production)

To run YatraHub continuously on your machine without keeping terminal windows open:

```powershell
# Install PM2 globally
npm install -g pm2

# Start Backend
cd D:\Travel-Booking-System\backend
pm2 start index.js --name "yatrahub-backend"

# Serve Frontend Production Build
cd D:\Travel-Booking-System
npm run build
pm2 serve dist 5173 --name "yatrahub-frontend" --spa

# Save PM2 process list
pm2 save
```

---

## 6. Database Backup & Disaster Recovery

All booking, customer, payment, and tour records are stored in MongoDB. Operators must take regular snapshots.

### 6.1 Creating a Database Backup (`mongodump`)
To back up the database to a dated folder:

```powershell
$backupDate = Get-Date -Format "yyyy-MM-dd_HHmm"
$backupDir = "D:\Travel-Booking-System\backups\$backupDate"
New-Item -ItemType Directory -Force -Path $backupDir

mongodump --uri="mongodb://127.0.0.1:27017/yatrahub" --out="$backupDir"
Write-Host "Backup created successfully at $backupDir"
```

### 6.2 Restoring from a Backup (`mongorestore`)
To restore the database from a backup snapshot (warning: replaces existing records):

```powershell
$backupPath = "D:\Travel-Booking-System\backups\2026-11-17_1740\yatrahub"

mongorestore --uri="mongodb://127.0.0.1:27017/yatrahub" --drop "$backupPath"
Write-Host "Database restored successfully."
```

### 6.3 Automated Daily Backup Script (Windows Task Scheduler)
Create a batch script `D:\Travel-Booking-System\scripts\auto-backup.bat`:

```bat
@echo off
set DATE_STR=%date:~10,4%-%date:~4,2%-%date:~7,2%
set BACKUP_DIR=D:\Travel-Booking-System\backups\%DATE_STR%
mkdir "%BACKUP_DIR%"
mongodump --uri="mongodb://127.0.0.1:27017/yatrahub" --out="%BACKUP_DIR%"
```
Schedule this script in **Windows Task Scheduler** to run daily at 11:59 PM.
