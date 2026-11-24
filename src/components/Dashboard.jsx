import { useState, useEffect, useCallback, lazy, Suspense } from "react"
import { useToast } from "./common/ToastContext"
import { useConfirm } from "./common/ConfirmModalContext"
import {
  listBookings,
  createBooking,
  updateBooking,
  deleteBooking,
  restoreBooking,
  cancelBooking,
} from "../data/bookings"
import {
  listTours,
  createTour,
  updateTour,
  deleteTour,
} from "../data/tours"
import { recordPayment, voidPayment } from "../data/payments"
import { disable2FA } from "../data/auth"
import { updateCompanySettings } from "../data/settings"
import { getAuthToken } from "../data/client"

import { AppShell, PageSkeleton, ChunkErrorBoundary, getSkeletonVariant } from "./shell"

const SCREEN_LOADERS = {
  dashboard: () => import("./dashboard/DashboardHome"),
  form: () => import("./BookingForm"),
  passengers: () => import("./PassengerManagement"),
  customers: () => import("./customers/CustomerManager"),
  tours: () => import("./TourInventory"),
  expenses: () => import("./ExpenseTracker"),
  journey: () => import("./JourneyManager"),
  analytics: () => import("./TourAnalytics"),
  outstanding: () => import("./analytics/OutstandingManager"),
  cashbook: () => import("./cashbook/CashBook"),
  trash: () => import("./trash/Trash"),
  data: () => import("./data/DataManagement"),
  settings: () => import("./dashboard/SettingsPanel"),
}

const DashboardHome = lazy(SCREEN_LOADERS.dashboard)
const BookingForm = lazy(SCREEN_LOADERS.form)
const PassengerManagement = lazy(SCREEN_LOADERS.passengers)
const CustomerManager = lazy(SCREEN_LOADERS.customers)
const TourInventory = lazy(SCREEN_LOADERS.tours)
const ExpenseTracker = lazy(SCREEN_LOADERS.expenses)
const JourneyManager = lazy(SCREEN_LOADERS.journey)
const TourAnalytics = lazy(SCREEN_LOADERS.analytics)
const OutstandingManager = lazy(SCREEN_LOADERS.outstanding)
const CashBook = lazy(SCREEN_LOADERS.cashbook)
const Trash = lazy(SCREEN_LOADERS.trash)
const DataManagement = lazy(SCREEN_LOADERS.data)
const SettingsPanel = lazy(SCREEN_LOADERS.settings)

const InvoiceView = lazy(() => import("./InvoiceView"))
const TwoFactorSetup = lazy(() => import("./TwoFactorSetup"))
const Disable2FAModal = lazy(() => import("./dashboard/Disable2FAModal"))
const InvoicesModal = lazy(() => import("./dashboard/InvoicesModal"))
const CancelBookingModal = lazy(() => import("./dashboard/CancelBookingModal"))
const NotFoundPage = lazy(() => import("./common/NotFoundPage"))

const prefetchedTabs = new Set()

function prefetchTabChunk(tabId) {
  if (prefetchedTabs.has(tabId)) return
  const loader = SCREEN_LOADERS[tabId]
  if (loader) {
    prefetchedTabs.add(tabId)
    loader().catch(() => {
      prefetchedTabs.delete(tabId)
    })
  }
}

const ALLOWED_TABS = [
  "dashboard",
  "form",
  "passengers",
  "customers",
  "journey",
  "tours",
  "expenses",
  "analytics",
  "outstanding",
  "cashbook",
  "trash",
  "data",
  "settings",
]

function parseTabFromHash(rawHash) {
  if (!rawHash) return { tab: null, subTab: null }
  const clean = rawHash.replace(/^#\/?/, "")
  const [tabPart, queryPart] = clean.split("?")
  const tab = ALLOWED_TABS.includes(tabPart) ? tabPart : null
  let subTab = null
  if (queryPart) {
    const params = new URLSearchParams(queryPart)
    subTab = params.get("tab")
  }
  return { tab, subTab }
}

export default function Dashboard({ user, onLogout, onUserUpdate }) {
  const { toast } = useToast()
  const confirm = useConfirm()

  const [bookings, setBookings] = useState([])
  const [dataInitialTab, setDataInitialTab] = useState(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const { subTab } = parseTabFromHash(window.location.hash)
      if (subTab) return subTab
    }
    return "export"
  })

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const { tab } = parseTabFromHash(window.location.hash)
      if (tab) return tab
    }
    return "dashboard"
  })

  useEffect(() => {
    const handleHashChange = () => {
      if (typeof window !== "undefined" && window.location.hash) {
        const { tab, subTab } = parseTabFromHash(window.location.hash)
        if (tab) {
          setActiveTab(tab)
          if (tab === "data" && subTab) {
            setDataInitialTab(subTab)
          }
        }
      }
    }
    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [])
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [editingBooking, setEditingBooking] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [tours, setTours] = useState([])
  const [showAllInvoices, setShowAllInvoices] = useState(false)
  const [invoiceTourFilter, setInvoiceTourFilter] = useState("all")
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
    invoiceTheme: user?.invoiceTheme || "classic",
    invoiceColor: user?.invoiceColor || "#4f46e5",
    documentLanguage: user?.documentLanguage || "en",
    ticketTemplate: user?.ticketTemplate || "classic",
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
        invoiceTheme: user.invoiceTheme || "classic",
        invoiceColor: user.invoiceColor || "#4f46e5",
        documentLanguage: user.documentLanguage || "en",
        ticketTemplate: user.ticketTemplate || "classic",
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
      return { ok: true, booking: savedBooking }
    } catch (error) {
      console.error("Error saving booking:", error)
      const message = error.message || "Failed to save booking"
      toast.error(message)
      return {
        ok: false,
        error: message,
        status: error.status,
        data: error.data,
      }
    }
  }

  const handleDeleteBooking = async (id) => {
    const bookingToDelete = bookings.find((b) => (b._id || b.id) === id)
    const invoiceLabel = bookingToDelete?.invoiceNo ? `#${bookingToDelete.invoiceNo}` : "this reservation"

    const confirmed = await confirm({
      title: "Delete Booking?",
      message: `Are you sure you want to delete ${invoiceLabel}? It will be removed from your active manifests and lists, with an option to undo.`,
      confirmText: "Delete Booking",
      cancelText: "Cancel",
      isDestructive: true,
    })

    if (confirmed) {
      try {
        await deleteBooking(id)
        setBookings((prev) => prev.filter((b) => (b._id || b.id) !== id))

        toast.undo(`Booking ${invoiceLabel} deleted.`, async () => {
          try {
            const restored = await restoreBooking(id)
            setBookings((prev) => [restored, ...prev])
            toast.success(`Booking ${invoiceLabel} restored!`)
          } catch (restoreErr) {
            console.error("Error restoring booking:", restoreErr)
            toast.error("Failed to restore booking")
          }
        }, 8000)
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

  const handlePrefetchTab = useCallback((tabId) => {
    prefetchTabChunk(tabId)
  }, [])

  const handleNavigate = useCallback((tab, subTab = null) => {
    if (ALLOWED_TABS.includes(tab)) {
      setActiveTab(tab)
      if (tab === "data" && subTab) {
        setDataInitialTab(subTab)
        window.location.hash = `#data?tab=${subTab}`
      } else {
        window.location.hash = `#${tab}`
      }
    }
  }, [])

  const handleEditBookingByIdOrObj = useCallback((bookingOrId) => {
    if (typeof bookingOrId === "string") {
      const found = bookings.find((b) => (b.id || b._id) === bookingOrId)
      if (found) {
        setEditingBooking(found)
      } else {
        setEditingBooking({ id: bookingOrId })
      }
    } else {
      setEditingBooking(bookingOrId)
    }
    setActiveTab("form")
  }, [bookings])

  if (selectedBooking) {
    return (
      <ChunkErrorBoundary resetKey={selectedBooking._id || selectedBooking.id || "invoice"}>
        <Suspense fallback={<div className="min-h-screen bg-canvas p-6"><PageSkeleton variant="form" /></div>}>
          <InvoiceView
            booking={selectedBooking}
            onBack={() => setSelectedBooking(null)}
            user={user}
          />
        </Suspense>
      </ChunkErrorBoundary>
    )
  }

  if (show2FASetup) {
    return (
      <ChunkErrorBoundary resetKey="2fa-setup">
        <Suspense fallback={<div className="min-h-screen bg-canvas p-6"><PageSkeleton variant="form" /></div>}>
          <TwoFactorSetup
            token={getAuthToken()}
            onSetupComplete={handle2FASetupComplete}
            onSkip={() => setShow2FASetup(false)}
          />
        </Suspense>
      </ChunkErrorBoundary>
    )
  }

  const totalRevenue = bookings.reduce((acc, b) => acc + (b.totalAmount || 0), 0)

  const handleNewBooking = () => {
    setEditingBooking(null)
    setActiveTab("form")
  }

  return (
    <>
      <AppShell
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onPrefetchTab={handlePrefetchTab}
        isEditingBooking={Boolean(editingBooking)}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onNewBooking={handleNewBooking}
        user={user}
        companySettings={companySettings}
        totalRevenue={totalRevenue}
        onLogout={onLogout}
      >
        <ChunkErrorBoundary resetKey={activeTab}>
          <Suspense fallback={<PageSkeleton variant={getSkeletonVariant(activeTab)} />}>
            {activeTab === "dashboard" && (
              <DashboardHome
                bookings={bookings}
                tours={tours}
                filteredBookings={filteredBookings}
                loading={_loading}
                setShowAllInvoices={setShowAllInvoices}
                setSelectedBooking={setSelectedBooking}
                setEditingBooking={setEditingBooking}
                setActiveTab={setActiveTab}
                handleDeleteBooking={handleDeleteBooking}
                handleCancelBooking={handleCancelBooking}
                handleMarkPaymentPaid={handleMarkPaymentPaid}
                handleVoidPayment={handleVoidPayment}
                user={user}
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
                user={user}
              />
            )}

            {activeTab === "customers" && (
              <CustomerManager
                onNewBooking={(customer) => {
                  setEditingBooking({
                    contactName: customer.name,
                    contactPhone: customer.phone,
                    contactEmail: customer.email,
                    passengers: [
                      {
                        name: customer.name,
                        city: customer.city || "",
                        age: "",
                        gender: "",
                        seatId: "",
                        aadhar: "",
                      },
                    ],
                  })
                  setActiveTab("form")
                }}
                onNavigate={handleNavigate}
                onEditBooking={handleEditBookingByIdOrObj}
              />
            )}

            {activeTab === "tours" && (
              <TourInventory
                tours={tours}
                onAdd={handleSaveTour}
                onDelete={handleDeleteTour}
              />
            )}

            {activeTab === "expenses" && (
              <ExpenseTracker
                tours={tours}
                bookings={bookings}
                user={user}
                onNavigate={handleNavigate}
              />
            )}

            {activeTab === "journey" && (
              <JourneyManager
                bookings={bookings}
                onUpdateBooking={handleUpdateBookingState}
                user={user}
                onNavigate={handleNavigate}
                onEditBooking={handleEditBookingByIdOrObj}
              />
            )}

            {activeTab === "analytics" && <TourAnalytics bookings={bookings} tours={tours} user={user} />}

            {activeTab === "outstanding" && (
              <OutstandingManager bookings={bookings} tours={tours} user={user} />
            )}

            {activeTab === "cashbook" && (
              <CashBook user={user} />
            )}

            {activeTab === "trash" && (
              <Trash user={user} />
            )}

            {activeTab === "data" && (
              <DataManagement
                user={user}
                tours={tours}
                initialTab={dataInitialTab}
                key={dataInitialTab}
              />
            )}

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

            {!["dashboard", "form", "passengers", "customers", "tours", "journey", "analytics", "outstanding", "cashbook", "trash", "data", "settings", "expenses"].includes(activeTab) && (
              <NotFoundPage onGoOverview={() => setActiveTab("dashboard")} />
            )}
          </Suspense>
        </ChunkErrorBoundary>
      </AppShell>

      {show2FADisable && (
        <ChunkErrorBoundary resetKey="disable-2fa">
          <Suspense fallback={<PageSkeleton variant="modal" />}>
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
          </Suspense>
        </ChunkErrorBoundary>
      )}

      {showAllInvoices && (
        <ChunkErrorBoundary resetKey="all-invoices">
          <Suspense fallback={<PageSkeleton variant="modal" />}>
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
          </Suspense>
        </ChunkErrorBoundary>
      )}

      {cancellingBooking && (
        <ChunkErrorBoundary resetKey="cancel-booking">
          <Suspense fallback={<PageSkeleton variant="modal" />}>
            <CancelBookingModal
              booking={cancellingBooking}
              onClose={() => setCancellingBooking(null)}
              onConfirm={handleConfirmCancel}
            />
          </Suspense>
        </ChunkErrorBoundary>
      )}
    </>
  )
}
