# YatraHub - Tourism Booking Management System

A comprehensive full-stack tour booking and management system built with React, Express, and MongoDB. YatraHub enables tour operators to manage bookings, passengers, payments, and tour analytics with features like 2FA authentication, invoice generation, and offline support.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Running the Application](#-running-the-application)
- [Project Structure](#-project-structure)
- [Key Features Guide](#-key-features-guide)
- [API Endpoints](#-api-endpoints)
- [Security Features](#-security-features)
- [Customization](#-customization)
- [Troubleshooting](#-troubleshooting)
- [Environment Variables Reference](#-environment-variables-reference)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### Core Functionality
- **Booking Management**: Create, edit, and delete tour bookings with passenger details
- **Interactive Seat Selection**: Visual 2x1 and 2x2 sleeper bus layouts with real-time seat availability
- **Invoice Generation**: Auto-generated invoice numbers with customizable format (YHB-DEST-MON-XXX)
- **Payment Tracking**: Monitor pending payments with urgency indicators and WhatsApp reminders
- **Tour Templates**: Pre-configure tour packages with pricing (berth-based or fixed)
- **Passenger Manifest**: Internal admin-only database with contact details and Aadhar information
- **Journey Management**: Daily departure coordination with check-in system and bulk communication

### Analytics & Reporting
- **Tour Analytics**: Revenue tracking, booking trends, and performance metrics with charts
- **Payment Dashboard**: Track paid vs. pending payments with visual indicators
- **Export Capabilities**: PDF and Excel export for passenger manifests and reports

### Authentication & Security
- **Two-Factor Authentication (2FA)**: Google Authenticator integration
- **Password Reset**: Secure email-based password recovery
- **2FA Recovery**: Email-based account recovery for lost authenticator access
- **Multi-device Session Management**: Track and control active sessions
- **JWT Token Management**: Secure token-based authentication with expiry

### User Experience
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Print-Friendly Invoices**: Professional invoice generation with company branding
- **Offline Support**: PWA capabilities with local storage sync
- **WhatsApp Integration**: Direct message sending for reminders and confirmations
- **Custom Company Branding**: Customizable logo, tagline, and organizer details

---

## 🛠 Tech Stack

### Frontend
- **React 19.2** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS 4** - Utility-first CSS framework
- **Recharts** - Data visualization charts
- **Lucide React** - Icon library
- **Material UI** - Component library (icons)

### Backend
- **Node.js** - Runtime environment
- **Express 4** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose 8** - MongoDB ODM
- **JWT** - Authentication tokens
- **Bcrypt** - Password hashing
- **Speakeasy** - 2FA TOTP generation
- **QRCode** - QR code generation for 2FA
- **Nodemailer** - Email service

---

## 📦 Prerequisites

Before installation, ensure you have:

- **Node.js** (v16.20.1 or higher)
- **MongoDB** (v4.0 or higher) - running locally or remote connection
- **npm** or **yarn** package manager
- **Gmail account** (for email notifications) with App Password enabled

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd yatrahub
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
cd ..
```

---

## ⚙️ Configuration

### Backend Configuration

Create a `.env` file in the `backend` directory:

```env
# Server Configuration
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/sb_tourism

# JWT Secret (change this to a random string)
JWT_SECRET=your-super-secret-jwt-key-here

# Email Configuration (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=true
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5173
```

### Gmail App Password Setup

1. Enable 2-Step Verification on your Google Account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Generate a new app password for "Mail"
4. Use the 16-character password in `EMAIL_PASS`

### Frontend Configuration

The frontend connects to the backend at `http://localhost:5000` by default. If you need to change this, update the API endpoints in:
- `src/App.jsx`
- `src/components/*.jsx`

---

## 🏃 Running the Application

### Development Mode

**Option 1: Run Frontend and Backend Separately**

Terminal 1 (Backend):
```bash
cd backend
npm start
```

Terminal 2 (Frontend):
```bash
npm run dev
```

**Option 2: Use Concurrent Processes**

Install concurrently globally:
```bash
npm install -g concurrently
```

Then from root directory:
```bash
concurrently "cd backend && npm start" "npm run dev"
```

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000

### Production Build

```bash
# Build frontend
npm run build

# Serve frontend build
npm run preview

# Backend runs the same
cd backend
npm start
```

---

## 📁 Project Structure

```
yatrahub/
├── backend/                    # Backend server
│   ├── models/                # Mongoose models
│   │   ├── User.js           # User schema with 2FA
│   │   ├── Booking.js        # Booking schema
│   │   ├── Tour.js           # Tour template schema
│   │   └── EmailToken.js     # Email verification tokens
│   ├── routes/               # API routes
│   │   ├── auth.js           # Authentication endpoints
│   │   ├── bookings.js       # Booking CRUD
│   │   └── tours.js          # Tour templates
│   ├── middleware/           # Custom middleware
│   │   └── verifyToken.js    # JWT verification
│   ├── .env                  # Environment variables
│   ├── index.js              # Server entry point
│   └── package.json          # Backend dependencies
│
├── src/                       # Frontend source
│   ├── components/           # React components
│   │   ├── Auth.jsx          # Login/Register
│   │   ├── Dashboard.jsx     # Main dashboard
│   │   ├── BookingForm.jsx   # Create/edit bookings
│   │   ├── InvoiceView.jsx   # Invoice display
│   │   ├── TourInventory.jsx # Tour templates
│   │   ├── PassengerManagement.jsx  # Passenger database
│   │   ├── JourneyManager.jsx       # Daily departures
│   │   ├── PaymentTracker.jsx       # Payment monitoring
│   │   ├── TourAnalytics.jsx        # Analytics dashboard
│   │   ├── TwoFactorSetup.jsx       # 2FA setup flow
│   │   ├── TwoFactorVerify.jsx      # 2FA login
│   │   ├── ResetPassword.jsx        # Password reset
│   │   └── Recover2FA.jsx           # 2FA recovery
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utility functions
│   ├── App.jsx               # Root component
│   ├── main.jsx              # React entry point
│   └── index.css             # Global styles
│
├── public/                    # Static assets
├── index.html                # HTML entry point
├── package.json              # Frontend dependencies
├── vite.config.js            # Vite configuration
└── tailwind.config.js        # Tailwind configuration
```

---

## 🎯 Key Features Guide

### Creating Your First Booking

1. **Register/Login** to the system
2. **Create Tour Template** (optional but recommended):
   - Go to "Destinations" tab
   - Add tour name, duration, bus type
   - Set pricing (berth-based or fixed)
3. **Create Booking**:
   - Click "New Reservation"
   - Fill contact information
   - Select or enter tour details
   - Add passengers with seat selection
   - Set payment details
   - Save booking

### Setting Up 2FA

1. Go to **Settings** → **Security Settings**
2. Click **Enable 2FA**
3. Scan QR code with Google Authenticator app
4. Enter 6-digit code to verify
5. 2FA is now active for all logins

### Managing Payments

1. Go to **Dashboard** → **Payment Tracking** section
2. View pending payments with urgency indicators:
   - 🔴 **Red**: Less than 3 days until journey
   - 🟡 **Yellow**: 3-10 days until journey
   - 🟢 **Green**: More than 10 days
3. Send WhatsApp reminders or mark as paid

### Journey Coordination

1. Navigate to **Journeys** tab
2. Select date and tour filter
3. View all departures for the day
4. Check-in passengers individually
5. Send WhatsApp/Email confirmations
6. Export seat layout as PDF

### Analytics & Reports

1. Go to **Analytics** tab
2. Filter by time range or specific tour
3. View metrics:
   - Total revenue and bookings
   - Passenger counts
   - Payment status breakdown
   - Performance by tour
4. Export detailed reports

---

## 🔌 API Endpoints

### Authentication

```
POST   /api/auth/register              - Register new user
POST   /api/auth/login                 - Login (returns tempToken if 2FA enabled)
POST   /api/auth/verify-2fa-login      - Verify 2FA code and complete login
POST   /api/auth/logout                - Logout and invalidate token
POST   /api/auth/setup-2fa             - Initialize 2FA setup
POST   /api/auth/verify-2fa-setup      - Complete 2FA setup
POST   /api/auth/disable-2fa           - Disable 2FA (requires code)
POST   /api/auth/forgot-password       - Request password reset email
POST   /api/auth/reset-password        - Reset password with token
POST   /api/auth/request-2fa-recovery  - Request 2FA recovery email
POST   /api/auth/finalize-2fa-recovery - Complete 2FA recovery
PUT    /api/auth/update-profile        - Update user profile
PUT    /api/auth/update-company        - Update company settings
GET    /api/auth/active-sessions       - Get active login sessions
POST   /api/auth/logout-device/:tokenId - Logout specific device
```

### Bookings

```
GET    /api/bookings                   - Get all user bookings
GET    /api/bookings/invoice/:invoiceNo - Get booking by invoice
POST   /api/bookings                   - Create new booking
PUT    /api/bookings/:id               - Update booking
DELETE /api/bookings/:id               - Delete booking
PUT    /api/bookings/:id/passengers/:idx/checkin - Toggle passenger check-in
PUT    /api/bookings/:id/toggle-payment - Toggle payment status
POST   /api/bookings/generate-invoice  - Generate invoice number
```

### Tours

```
GET    /api/tours                      - Get all tour templates
POST   /api/tours                      - Create tour template
PUT    /api/tours/:id                  - Update tour template
DELETE /api/tours/:id                  - Delete tour template
```

---

## 🔒 Security Features

### Authentication
- **JWT Tokens** with 7-day expiry
- **Bcrypt** password hashing (10 salt rounds)
- **Multi-device** session tracking
- **Token invalidation** on logout

### Two-Factor Authentication
- **TOTP-based** (Time-based One-Time Password)
- **Google Authenticator** compatible
- **QR Code** setup for easy onboarding
- **Backup codes** via email recovery

### Password Security
- **Email-based** password reset
- **Token expiration** (1 hour)
- **Rate limiting** on password reset attempts
- **Single-use** reset tokens

### Data Protection
- **User-scoped** data (bookings, tours)
- **Authorization** middleware on all protected routes
- **Input validation** on all endpoints
- **CORS** configuration for frontend

---

## 🎨 Customization

### Company Branding

Update in **Settings** → **Company Branding**:
- Company Name
- Tagline
- Headquarters Address
- Phone Number
- Logo Upload
- Tour Organizers (multiple)

### Invoice Format

Default format: `YHB-[DEST]-[MONTH]-[SEQ]`

Example: `YHB-NEP-JAN-001`

Customize in `backend/routes/bookings.js`:
```javascript
const generateInvoiceNo = (tourName, journeyDate) => {
  // Your custom logic here
}
```

### Color Scheme

Edit `src/index.css` theme variables:
```css
:root {
  --color-primary: hsl(221 83% 53%);
  --color-secondary: hsl(174 60% 51%);
  --color-accent: hsl(45 93% 47%);
}
```

---

## 🐛 Troubleshooting

### MongoDB Connection Issues

**Error**: `MongoServerError: Authentication failed`

**Solution**: Check MongoDB URI in `.env` and ensure MongoDB is running:
```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

### Email Not Sending

**Error**: `Invalid login: 535-5.7.8 Username and Password not accepted`

**Solution**: 
1. Enable 2-Step Verification on Google Account
2. Generate App Password at https://myaccount.google.com/apppasswords
3. Use 16-character app password in `EMAIL_PASS`

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::5000`

**Solution**:
```bash
# Find and kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Or change port in backend/.env
PORT=5001
```

### Frontend Not Connecting to Backend

**Error**: Network errors or CORS issues

**Solution**: Verify CORS configuration in `backend/index.js`:
```javascript
app.use(cors({
  origin: ["http://localhost:5173"], // Add your frontend URL
  credentials: true,
}))
```

---

## 📝 Environment Variables Reference

### Backend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Backend server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/sb_tourism` |
| `JWT_SECRET` | Secret key for JWT signing | `your-secret-key-here` |
| `EMAIL_HOST` | SMTP server host | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP server port | `587` |
| `EMAIL_SECURE` | Use TLS | `true` |
| `EMAIL_USER` | Email address | `your-email@gmail.com` |
| `EMAIL_PASS` | Email app password | `your-app-password` |
| `FRONTEND_URL` | Frontend URL for email links | `http://localhost:5173` |

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Email: support@yatrahub.com (if applicable)

---

## 🙏 Acknowledgments

- Built with ❤️ for tour operators
- Icons by [Lucide](https://lucide.dev)
- UI components inspired by modern design systems
- Charts powered by [Recharts](https://recharts.org)

---

**Made with 🚌 YatraHub - Making tour management effortless**
