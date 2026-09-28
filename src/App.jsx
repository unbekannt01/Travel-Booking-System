import { useState, useEffect } from "react"
import Auth from "./components/Auth"
import Dashboard from "./components/Dashboard"
import TwoFactorSetup from "./components/TwoFactorSetup"
import TwoFactorVerify from "./components/TwoFactorVerify"
import ResetPassword from "./components/ResetPassword"
import Recover2FA from "./components/Recover2FA"
import { logout } from "./data/auth"
import { getAuthToken } from "./data/client"

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user")
    return saved ? JSON.parse(saved) : null
  })
  const [isLoading, setIsLoading] = useState(true)
  const [twoFactorToken, setTwoFactorToken] = useState(null)
  const [show2FASetup, setShow2FASetup] = useState(false)
  const [temp2FAToken, setTemp2FAToken] = useState(null)
  const [resetPasswordToken, setResetPasswordToken] = useState(null)
  const [recover2FAToken, setRecover2FAToken] = useState(null)

  useEffect(() => {
    const token = getAuthToken()
    if (token && !user) {
      const savedUser = localStorage.getItem("user")
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser))
        } catch {
          localStorage.removeItem("user")
        }
      } else {
        localStorage.removeItem("auth-token")
        localStorage.removeItem("tokenId")
      }
    }
    setIsLoading(false)
  }, [user])

  useEffect(() => {
    const path = window.location.pathname
    if (path.startsWith("/reset-password/")) {
      const token = path.split("/").pop()
      setResetPasswordToken(token)
    } else if (path.startsWith("/recover-2fa/")) {
      const token = path.split("/").pop()
      setRecover2FAToken(token)
    }
  }, [])

  const handleLogout = async () => {
    await logout()
    setUser(null)
    setTwoFactorToken(null)
    setShow2FASetup(false)
    setTemp2FAToken(null)
  }

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

  if (resetPasswordToken) {
    return (
      <ResetPassword
        token={resetPasswordToken}
        onComplete={() => {
          setResetPasswordToken(null)
          window.history.pushState({}, "", "/")
        }}
      />
    )
  }

  if (recover2FAToken) {
    return (
      <Recover2FA
        token={recover2FAToken}
        onShow2FASetup={(token) => {
          setRecover2FAToken(null)
          setTwoFactorToken(token)
          setShow2FASetup(true)
          window.history.pushState({}, "", "/")
        }}
      />
    )
  }

  if (temp2FAToken) {
    return (
      <TwoFactorVerify
        tempToken={temp2FAToken}
        onVerifySuccess={(verifiedUser) => {
          setTemp2FAToken(null)
          setUser(verifiedUser)
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
    />
  ) : (
    <Auth
      onAuthSuccess={setUser}
      onRequire2FA={(token) => setTemp2FAToken(token)}
      onShow2FASetup={(token) => {
        setTwoFactorToken(token)
        setShow2FASetup(true)
      }}
    />
  )
}
