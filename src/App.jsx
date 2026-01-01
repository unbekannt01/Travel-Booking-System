/* eslint-disable react-hooks/exhaustive-deps */
"use client"

import { useState, useEffect } from "react"
import Auth from "./components/Auth"
import Dashboard from "./components/Dashboard"
import TwoFactorSetup from "./components/TwoFactorSetup"
import TwoFactorVerify from "./components/TwoFactorVerify"

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user")
    return saved ? JSON.parse(saved) : null
  })
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
  const [newName, setNewName] = useState(user?.name || "SB TOURISM")
  const [loading, setLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [twoFactorToken, setTwoFactorToken] = useState(null)
  const [show2FASetup, setShow2FASetup] = useState(false)
  const [temp2FAToken, setTemp2FAToken] = useState(null)

  const getAuthHeaders = () => {
    const token = localStorage.getItem("auth-token")
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem("auth-token")

        if (!token) {
          console.log("[v0] No token found, user not authenticated")
          return
        }

        const bookingsRes = await fetch("http://localhost:5000/api/bookings", {
          headers: getAuthHeaders(),
        })

        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json()
          console.log("[v0] Fetched user bookings from backend:", bookingsData)
          const formattedBookings = bookingsData.map((b) => ({
            ...b,
            id: b._id || b.id,
          }))
          setBookings(formattedBookings)
        } else if (bookingsRes.status === 401) {
          console.log("[v0] Token expired, please login again")
          handleLogout()
        }

        const toursRes = await fetch("http://localhost:5000/api/tours", {
          headers: getAuthHeaders(),
        })

        if (toursRes.ok) {
          const toursData = await toursRes.json()
          console.log("[v0] Fetched user tours from backend:", toursData)
          const formattedTours = toursData.map((t) => ({
            ...t,
            id: t._id || t.id,
          }))
          setTours(formattedTours)
        } else if (toursRes.status === 401) {
          console.log("[v0] Token expired, please login again")
          handleLogout()
        }
      } catch (error) {
        console.error("[v0] Error fetching data from backend:", error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchData()
    }
  }, [user]) // add user to useEffect dependency array

  useEffect(() => {
    const mainContent = document.getElementById("main-content")
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [activeTab])

  useEffect(() => {
    const token = localStorage.getItem("auth-token")
    if (token && !user) {
      // Verify token is still valid by checking user in localStorage
      const savedUser = localStorage.getItem("user")
      if (savedUser) {
        setUser(JSON.parse(savedUser))
      } else {
        // Token exists but no user - clear token
        localStorage.removeItem("auth-token")
        localStorage.removeItem("tokenId")
      }
    }
    setIsLoading(false)
  }, [user])

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (token) {
        await fetch("http://localhost:5000/api/auth/logout", {
          method: "POST",
          headers: getAuthHeaders(),
        })
      }
    } catch (error) {
      console.error("[v0] Error during backend logout:", error)
    }

    localStorage.removeItem("auth-token")
    localStorage.removeItem("tokenId")
    localStorage.removeItem("user")
    setUser(null)
    setTwoFactorToken(null)
    setShow2FASetup(false)
    setTemp2FAToken(null)
  }

  const handleUpdateName = async () => {
    if (!newName.trim()) return

    try {
      const res = await fetch("http://localhost:5000/api/auth/update-name", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ newName }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.message)

      localStorage.setItem("user", JSON.stringify(data.user))
      setUser(data.user)
      setIsEditingName(false)
      console.log("[v0] Name updated successfully")
    } catch (err) {
      console.error("[v0] Error updating name:", err.message)
      alert("Failed to update name: " + err.message)
    }
  }

  const handleSaveBooking = async (bookingData) => {
    console.log("[v0] Saving booking data to backend:", bookingData)
    try {
      const url = editingBooking
        ? `http://localhost:5000/api/bookings/${bookingData._id || bookingData.id}`
        : "http://localhost:5000/api/bookings"

      const method = editingBooking ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(bookingData),
      })

      if (response.ok) {
        const savedBooking = await response.json()
        console.log("[v0] Booking saved successfully:", savedBooking)

        setBookings((prev) => {
          if (editingBooking) {
            return prev.map((b) =>
              (b._id || b.id) === (savedBooking._id || savedBooking.id)
                ? { ...savedBooking, id: savedBooking._id || savedBooking.id }
                : b,
            )
          } else {
            return [{ ...savedBooking, id: savedBooking._id || savedBooking.id }, ...prev]
          }
        })

        setActiveTab("dashboard")
        setEditingBooking(null)
      } else {
        const error = await response.json()
        console.error("[v0] Error saving booking:", error)
        alert("Failed to save booking: " + error.message)
      }
    } catch (error) {
      console.error("[v0] Network error saving booking:", error)
      alert("Failed to connect to server. Please ensure the backend is running.")
    }
  }

  const handleDeleteBooking = async (id) => {
    if (confirm("Are you sure you want to delete this booking?")) {
      console.log("[v0] Deleting booking from backend:", id)
      try {
        const response = await fetch(`http://localhost:5000/api/bookings/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        })

        if (response.ok) {
          console.log("[v0] Booking deleted successfully")
          setBookings((prev) => prev.filter((b) => (b._id || b.id) !== id))
        } else {
          const error = await response.json()
          console.error("[v0] Error deleting booking:", error)
          alert("Failed to delete booking: " + error.message)
        }
      } catch (error) {
        console.error("[v0] Network error deleting booking:", error)
        alert("Failed to connect to server.")
      }
    }
  }

  const handleSaveTour = async (tourData) => {
    console.log("[v0] Saving tour to backend:", tourData)
    try {
      const url =
        tourData._id || tourData.id
          ? `http://localhost:5000/api/tours/${tourData._id || tourData.id}`
          : "http://localhost:5000/api/tours"

      const method = tourData._id || tourData.id ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(tourData),
      })

      if (response.ok) {
        const savedTour = await response.json()
        console.log("[v0] Tour saved successfully:", savedTour)

        setTours((prev) => {
          const existingIndex = prev.findIndex((t) => (t._id || t.id) === (savedTour._id || savedTour.id))
          if (existingIndex !== -1) {
            const updated = [...prev]
            updated[existingIndex] = {
              ...savedTour,
              id: savedTour._id || savedTour.id,
            }
            return updated
          } else {
            return [...prev, { ...savedTour, id: savedTour._id || savedTour.id }]
          }
        })
      } else {
        const error = await response.json()
        console.error("[v0] Error saving tour:", error)
        alert("Failed to save tour: " + error.message)
      }
    } catch (error) {
      console.error("[v0] Network error saving tour:", error)
      alert("Failed to connect to server.")
    }
  }

  const handleDeleteTour = async (id) => {
    if (confirm("Delete this tour template?")) {
      console.log("[v0] Deleting tour from backend:", id)
      try {
        const response = await fetch(`http://localhost:5000/api/tours/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        })

        if (response.ok) {
          console.log("[v0] Tour deleted successfully")
          setTours((prev) => prev.filter((t) => (t._id || t.id) !== id))
        } else {
          const error = await response.json()
          console.error("[v0] Error deleting tour:", error)
          alert("Failed to delete tour: " + error.message)
        }
      } catch (error) {
        console.error("[v0] Network error deleting tour:", error)
        alert("Failed to connect to server.")
      }
    }
  }

  const _filteredBookings = bookings.filter(
    (b) =>
      b.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.tourName.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const _uniqueTours = [...new Set(bookings.map((b) => b.tourName))].filter(Boolean)
  const _filteredInvoices =
    invoiceTourFilter === "all" ? bookings : bookings.filter((b) => b.tourName === invoiceTourFilter)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-bold">Loading...</p>
        </div>
      </div>
    )
  }

  if (temp2FAToken) {
    return (
      <TwoFactorVerify
        tempToken={temp2FAToken}
        onVerifySuccess={(user) => {
          setTemp2FAToken(null)
          setUser(user)
        }}
      />
    )
  }

  if (show2FASetup && twoFactorToken) {
    return (
      <TwoFactorSetup
        token={twoFactorToken}
        onSetupComplete={() => {
          setShow2FASetup(false)
          setTwoFactorToken(null)
          // User is already "logged in" but we might want to refresh their state
          const savedUser = JSON.parse(localStorage.getItem("user"))
          setUser(savedUser)
        }}
        onSkip={() => {
          setShow2FASetup(false)
          setTwoFactorToken(null)
          const savedUser = JSON.parse(localStorage.getItem("user"))
          setUser(savedUser)
        }}
      />
    )
  }

  return user ? (
    <Dashboard
      user={user}
      onLogout={handleLogout}
      onUserUpdate={setUser}
      bookings={bookings}
      setBookings={setBookings}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      selectedBooking={selectedBooking}
      setSelectedBooking={setSelectedBooking}
      editingBooking={editingBooking}
      setEditingBooking={setEditingBooking}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      tours={tours}
      setTours={setTours}
      isMobileMenuOpen={isMobileMenuOpen}
      setIsMobileMenuOpen={setIsMobileMenuOpen}
      showAllInvoices={showAllInvoices}
      setShowAllInvoices={setShowAllInvoices}
      invoiceTourFilter={invoiceTourFilter}
      setInvoiceTourFilter={setInvoiceTourFilter}
      isEditingName={isEditingName}
      setIsEditingName={setIsEditingName}
      newName={newName}
      setNewName={setNewName}
      loading={loading}
      setLoading={setLoading}
      handleUpdateName={handleUpdateName}
      handleSaveBooking={handleSaveBooking}
      handleDeleteBooking={handleDeleteBooking}
      handleSaveTour={handleSaveTour}
      handleDeleteTour={handleDeleteTour}
    />
  ) : (
    <Auth
      onAuthSuccess={setUser}
      onRequire2FA={(tempToken) => setTemp2FAToken(tempToken)}
      onShow2FASetup={(token) => {
        setTwoFactorToken(token)
        setShow2FASetup(true)
      }}
    />
  )
}
