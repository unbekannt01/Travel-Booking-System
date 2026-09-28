import { useState, useEffect } from "react"
import { Compass, Menu, X } from "lucide-react"
import { useToast } from "./common/ToastContext"
import { useConfirm } from "./common/ConfirmModalContext"
import {
  listBookings,
  createBooking,
  updateBooking,
  deleteBooking,
  cancelBooking,
} from "../data/bookings"
import {
  listTours,
  createTour,
  updateTour,
  deleteTour,
} from "../data/tours"
import { recordPayment, voidPayment } from "../data/payments"
import { updateProfile, disable2FA } from "../data/auth"
import { updateCompanySettings } from "../data/settings"
import { getAuthToken } from "../data/client"

import Sidebar from "./dashboard/Sidebar"
import DashboardHeader from "./dashboard/DashboardHeader"
import DashboardHome from "./dashboard/DashboardHome"
import SettingsPanel from "./dashboard/SettingsPanel"
import Disable2FAModal from "./dashboard/Disable2FAModal"
import InvoicesModal from "./dashboard/InvoicesModal"
import CancelBookingModal from "./dashboard/CancelBookingModal"

import BookingForm from "./BookingForm"
import InvoiceView from "./InvoiceView"
import TourInventory from "./TourInventory"
import PassengerManagement from "./PassengerManagement"
import TwoFactorSetup from "./TwoFactorSetup"
import JourneyManager from "./JourneyManager"
import TourAnalytics from "./TourAnalytics"

export default function Dashboard({ user, onLogout, onUserUpdate }) {
  const { toast } = useToast()
  const confirm = useConfirm()

  const [bookings, setBookings] = useState([])
  const [activeTab, setActiveTab] = useState("dashboard")
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [editingBooking, setEditingBooking] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [tours, setTours] = useState([])
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showAllInvoices, setShowAllInvoices] = useState(false)
  const [invoiceTourFilter, setInvoiceTourFilter] = useState("all")
  const [isEditingName, setIsEditingName] = useState(false)
  const [newUserName, setNewUserName] = useState(user?.userName || "")
  const [_loading, setLoading] = useState(false)
  const [cancellingBooking, setCancellingBooking] = useState(null)

  const [show2FASetup, setShow2FASetup] = useState(false)
  const [show2FADisable, setShow2FADisable] = useState(false)
  const [disable2FACode, setDisable2FACode] = useState("")
  const [companySettings, setCompanySettings] = useState({
    companyName: user?.companyName || "Yatra Tours",
    companyTagline: user?.companyTagline || "Tourism & Travels",
    companyHeadquarters: user?.companyHeadquarters || "",
    companyPhone: user?.companyPhone || "",
    companyLogo: user?.companyLogo || "",
    gstNumber: user?.gstNumber || "",
    invoicePrefix: user?.invoicePrefix || "YHB",
    receiptPrefix: user?.receiptPrefix || "REC",
    termsAndConditions: user?.termsAndConditions || [
      "Valid Aadhar card is strictly required for all travelers.",
      "Advance payment is non-refundable upon confirmation.",
      "Final balance must be settled 24 hours prior to departure.",
      "Company is not liable for itinerary changes due to weather.",
    ],
    bankDetails: user?.bankDetails || {
      accountName: "",
      accountNumber: "",
      ifscCode: "",
      bankName: "",
      upiId: "",
    },
    organizers: user?.organizers || [],
  })
  const [isEditingCompany, setIsEditingCompany] = useState(false)

  useEffect(() => {
    if (user) {
      setCompanySettings({
        companyName: user.companyName || "Yatra Tours",
        companyTagline: user.companyTagline || "Tourism & Travels",
        companyHeadquarters: user.companyHeadquarters || "",
        companyPhone: user.companyPhone || "",
        companyLogo: user.companyLogo || "",
        gstNumber: user.gstNumber || "",
        invoicePrefix: user.invoicePrefix || "YHB",
        receiptPrefix: user.receiptPrefix || "REC",
        termsAndConditions: user.termsAndConditions || [
          "Valid Aadhar card is strictly required for all travelers.",
          "Advance payment is non-refundable upon confirmation.",
          "Final balance must be settled 24 hours prior to departure.",
          "Company is not liable for itinerary changes due to weather.",
        ],
        bankDetails: user.bankDetails || {
          accountName: "",
          accountNumber: "",
          ifscCode: "",
          bankName: "",
          upiId: "",
        },
        organizers: user.organizers || [],
      })
    }
  }, [user])

  const formatIndianPhone = (value) => {
    return value
      .replace(/^\+91\s*/, "")
      .replace(/\D/g, "")
      .slice(0, 10)
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const token = getAuthToken()
        if (!token) return

        const [bookingsData, toursData] = await Promise.all([
          listBookings(),
          listTours(),
        ])
        setBookings(bookingsData)
        setTours(toursData)
      } catch (error) {
        if (error.status === 401) {
          onLogout()
        } else {
          console.error("Error fetching data:", error)
        }
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchData()
    }
  }, [user, onLogout])

  useEffect(() => {
    const mainContent = document.getElementById("main-content")
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [activeTab])

  const handleUpdateName = async () => {
    if (!newUserName.trim()) return

    try {
      const data = await updateProfile(newUserName)
      onUserUpdate(data.user)
      setIsEditingName(false)
      toast.success("Name updated successfully")
    } catch (err) {
      console.error("Error updating username:", err.message)
      toast.error("Failed to update username: " + err.message)
    }
  }

  const handleUpdateCompany = async () => {
    try {
      const data = await updateCompanySettings(companySettings)
      onUserUpdate(data.user)
      setIsEditingCompany(false)
      toast.success("Company settings updated successfully!")
    } catch (err) {
      console.error("Error updating company settings:", err.message)
      toast.error("Failed to update company settings: " + err.message)
    }
  }

  const handleDisable2FA = async () => {
    try {
      await disable2FA(disable2FACode)
      const updatedUser = { ...user, twoFactorEnabled: false }
      localStorage.setItem("user", JSON.stringify(updatedUser))
      onUserUpdate(updatedUser)
      setShow2FADisable(false)
      setDisable2FACode("")
      toast.success("2FA disabled successfully!")
    } catch (err) {
      console.error("Error disabling 2FA:", err.message)
      toast.error("Failed to disable 2FA: " + err.message)
    }
  }

  const handle2FASetupComplete = () => {
    const updatedUser = { ...user, twoFactorEnabled: true }
    localStorage.setItem("user", JSON.stringify(updatedUser))
    onUserUpdate(updatedUser)
    setShow2FASetup(false)
    toast.success("2FA enabled successfully!")
  }

  const handleSaveBooking = async (bookingData) => {
    try {
      let savedBooking
      if (editingBooking) {
        savedBooking = await updateBooking(
          bookingData._id || bookingData.id,
          bookingData,
        )
      } else {
        savedBooking = await createBooking(bookingData)
      }

      setBookings((prev) => {
        if (editingBooking) {
          return prev.map((b) =>
            (b._id || b.id) === (savedBooking._id || savedBooking.id)
              ? { ...savedBooking, id: savedBooking._id || savedBooking.id }
              : b,
          )
        } else {
          return [
            { ...savedBooking, id: savedBooking._id || savedBooking.id },
            ...prev,
          ];
        }
      })

      setActiveTab("dashboard")
      setEditingBooking(null)
      toast.success("Booking saved successfully")
    } catch (error) {
      console.error("Error saving booking:", error)
      toast.error(error.message || "Failed to save booking")
    }
  }

  const handleDeleteBooking = async (id) => {
    const confirmed = await confirm({
      title: "Delete Booking?",
      message: "Are you sure you want to delete this booking? This action cannot be undone.",
      confirmText: "Delete Booking",
      cancelText: "Cancel",
      isDestructive: true,
    })

    if (confirmed) {
      try {
        await deleteBooking(id)
        setBookings((prev) => prev.filter((b) => (b._id || b.id) !== id))
        toast.success("Booking deleted successfully")
      } catch (error) {
        console.error("Error deleting booking:", error)
        toast.error(error.message || "Failed to delete booking")
      }
    }
  }

  const handleCancelBooking = (id) => {
    const booking = bookings.find((b) => (b._id || b.id) === id)
    if (booking) {
      setCancellingBooking(booking)
    }
  }

  const handleConfirmCancel = async ({ bookingId, cancellationCharge, refundPaymentMode, reason }) => {
    try {
      const updated = await cancelBooking(bookingId, {
        cancellationCharge,
        refundPaymentMode,
        reason,
      })
      setBookings((prev) =>
        prev.map((b) =>
          (b._id || b.id) === (updated._id || updated.id)
            ? { ...updated, id: updated._id || updated.id }
            : b,
        ),
      )
      toast.success("Booking cancelled and refund recorded.")
    } catch (error) {
      console.error("Error cancelling booking:", error)
      toast.error(error.message || "Failed to cancel booking")
    }
  }

  const handleUpdateBookingState = (updatedBooking) => {
    setBookings((prev) =>
      prev.map((b) =>
        (b._id || b.id) === (updatedBooking._id || updatedBooking.id)
          ? { ...updatedBooking, id: updatedBooking._id || updatedBooking.id }
          : b,
      ),
    )
  }

  const handleSaveTour = async (tourData) => {
    try {
      let savedTour
      if (tourData._id || tourData.id) {
        savedTour = await updateTour(tourData._id || tourData.id, tourData)
      } else {
        savedTour = await createTour(tourData)
      }

      setTours((prev) => {
        const existingIndex = prev.findIndex(
          (t) => (t._id || t.id) === (savedTour._id || savedTour.id),
        )
        if (existingIndex !== -1) {
          const updated = [...prev]
          updated[existingIndex] = {
            ...savedTour,
            id: savedTour._id || savedTour.id,
          }
          return updated
        } else {
          return [
            ...prev,
            { ...savedTour, id: savedTour._id || savedTour.id },
          ]
        }
      })
      toast.success("Tour saved successfully")
    } catch (error) {
      console.error("Error saving tour:", error)
      toast.error(error.message || "Failed to save tour")
    }
  }

  const handleDeleteTour = async (id) => {
    const confirmed = await confirm({
      title: "Delete Tour Template?",
      message: "Are you sure you want to delete this tour template?",
      confirmText: "Delete Tour",
      cancelText: "Cancel",
      isDestructive: true,
    })

    if (confirmed) {
      try {
        await deleteTour(id)
        setTours((prev) => prev.filter((t) => (t._id || t.id) !== id))
        toast.success("Tour deleted successfully")
      } catch (error) {
        console.error("Error deleting tour:", error)
        toast.error(error.message || "Failed to delete tour")
      }
    }
  }

  const filteredBookings = bookings.filter((b) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      (b.contactName && b.contactName.toLowerCase().includes(searchLower)) ||
      (b.invoiceNo && b.invoiceNo.toLowerCase().includes(searchLower)) ||
      (b.tourName && b.tourName.toLowerCase().includes(searchLower)) ||
      (b.contactPhone && b.contactPhone.includes(searchTerm.replace(/\D/g, "")))
    )
  })

  const uniqueTours = [...new Set(bookings.map((b) => b.tourName))].filter(
    Boolean,
  )
  const filteredInvoices =
    invoiceTourFilter === "all"
      ? bookings
      : bookings.filter((b) => b.tourName === invoiceTourFilter)

  const handleMarkPaymentPaid = async (paymentData) => {
    try {
      const updated = await recordPayment(paymentData)
      setBookings((prev) =>
        prev.map((b) =>
          (b._id || b.id) === (updated._id || updated.id)
            ? { ...updated, id: updated._id || updated.id }
            : b,
        ),
      )
      toast.success("Payment recorded successfully!")
    } catch (error) {
      console.error("Error recording payment:", error)
      toast.error(error.message || "Failed to record payment")
    }
  }

  const handleVoidPayment = async (paymentId, reason) => {
    try {
      const result = await voidPayment(paymentId, reason)
      if (result.booking) {
        setBookings((prev) =>
          prev.map((b) =>
            (b._id || b.id) === (result.booking._id || result.booking.id)
              ? { ...result.booking, id: result.booking._id || result.booking.id }
              : b,
          ),
        )
      }
      toast.success("Payment voided successfully.")
      return result
    } catch (error) {
      console.error("Error voiding payment:", error)
      toast.error(error.message || "Failed to void payment")
      throw error
    }
  }

  if (selectedBooking) {
    return (
      <InvoiceView
        booking={selectedBooking}
        onBack={() => setSelectedBooking(null)}
        user={user}
      />
    )
  }

  if (show2FASetup) {
    return (
      <TwoFactorSetup
        token={getAuthToken()}
        onSetupComplete={handle2FASetupComplete}
        onSkip={() => setShow2FASetup(false)}
      />
    )
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Mobile Header */}
      <header className="lg:hidden h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-1.5 rounded-lg text-white shadow-lg shadow-primary/20">
            <Compass size={18} strokeWidth={2.5} />
          </div>
          <h1 className="font-black text-sm tracking-tight text-slate-900">
            {user?.companyName || user?.userName || "YatraHub"}
          </h1>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <Sidebar
        user={user}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isEditingName={isEditingName}
        setIsEditingName={setIsEditingName}
        newUserName={newUserName}
        setNewUserName={setNewUserName}
        handleUpdateName={handleUpdateName}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={onLogout}
        bookings={bookings}
      />

      {/* Main Content Area */}
      <main
        id="main-content"
        className="flex-1 flex flex-col min-w-0 overflow-y-auto scroll-smooth"
      >
        <DashboardHeader
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onNewReservation={() => {
            setEditingBooking(null)
            setActiveTab("form")
          }}
        />

        <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto w-full">
          {activeTab === "dashboard" && (
            <DashboardHome
              bookings={bookings}
              tours={tours}
              filteredBookings={filteredBookings}
              setShowAllInvoices={setShowAllInvoices}
              setSelectedBooking={setSelectedBooking}
              setEditingBooking={setEditingBooking}
              setActiveTab={setActiveTab}
              handleDeleteBooking={handleDeleteBooking}
              handleCancelBooking={handleCancelBooking}
              handleMarkPaymentPaid={handleMarkPaymentPaid}
              handleVoidPayment={handleVoidPayment}
            />
          )}

          {activeTab === "form" && (
            <BookingForm
              onSave={handleSaveBooking}
              tours={tours}
              editData={editingBooking}
              bookings={bookings}
              onCancel={() => {
                setActiveTab("dashboard")
                setEditingBooking(null)
              }}
            />
          )}

          {activeTab === "passengers" && (
            <PassengerManagement
              bookings={bookings}
              onUpdateBooking={handleSaveBooking}
              onDeleteBooking={handleDeleteBooking}
              onEditBooking={(booking) => {
                setEditingBooking(booking)
                setActiveTab("form")
              }}
            />
          )}

          {activeTab === "tours" && (
            <TourInventory
              tours={tours}
              onAdd={handleSaveTour}
              onDelete={handleDeleteTour}
            />
          )}

          {activeTab === "journey" && (
            <JourneyManager bookings={bookings} onUpdateBooking={handleUpdateBookingState} />
          )}

          {activeTab === "analytics" && <TourAnalytics bookings={bookings} />}

          {activeTab === "settings" && (
            <SettingsPanel
              user={user}
              companySettings={companySettings}
              setCompanySettings={setCompanySettings}
              isEditingCompany={isEditingCompany}
              setIsEditingCompany={setIsEditingCompany}
              handleUpdateCompany={handleUpdateCompany}
              setShow2FASetup={setShow2FASetup}
              setShow2FADisable={setShow2FADisable}
              formatIndianPhone={formatIndianPhone}
              showToast={(msg, type) => toast[type] ? toast[type](msg) : toast.info(msg)}
            />
          )}
        </div>
      </main>

      <Disable2FAModal
        isOpen={show2FADisable}
        onClose={() => {
          setShow2FADisable(false)
          setDisable2FACode("")
        }}
        disable2FACode={disable2FACode}
        setDisable2FACode={setDisable2FACode}
        handleDisable2FA={handleDisable2FA}
      />

      <InvoicesModal
        isOpen={showAllInvoices}
        onClose={() => setShowAllInvoices(false)}
        filteredInvoices={filteredInvoices}
        invoiceTourFilter={invoiceTourFilter}
        setInvoiceTourFilter={setInvoiceTourFilter}
        uniqueTours={uniqueTours}
        setSelectedBooking={setSelectedBooking}
        setEditingBooking={setEditingBooking}
        setActiveTab={setActiveTab}
        handleDeleteBooking={handleDeleteBooking}
        handleCancelBooking={handleCancelBooking}
      />

      {cancellingBooking && (
        <CancelBookingModal
          booking={cancellingBooking}
          onClose={() => setCancellingBooking(null)}
          onConfirm={handleConfirmCancel}
        />
      )}
    </div>
  )
}
