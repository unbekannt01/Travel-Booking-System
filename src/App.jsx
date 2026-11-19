import { useState, useEffect, lazy, Suspense } from "react"
import Auth from "./components/Auth"
import Dashboard from "./components/Dashboard"
import { ChunkErrorBoundary, PageSkeleton } from "./components/shell"
import { logout } from "./data/auth"
import { getAuthToken } from "./data/client"

const TwoFactorSetup = lazy(() => import("./components/TwoFactorSetup"))
const TwoFactorVerify = lazy(() => import("./components/TwoFactorVerify"))
const ResetPassword = lazy(() => import("./components/ResetPassword"))
const Recover2FA = lazy(() => import("./components/Recover2FA"))
const DevUiKitPage = import.meta.env.DEV ? lazy(() => import("./dev/UiKitPage")) : null

export default function App() {
  const [hashRoute, setHashRoute] = useState(() =>
    import.meta.env.DEV ? window.location.hash : "",
  )

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const onHashChange = () => setHashRoute(window.location.hash)
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  const [user, setUser] = useState(() => {
    const token = getAuthToken()
    if (!token) return null
    const saved = localStorage.getItem("user")
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        localStorage.removeItem("user")
      }
    } else {
      localStorage.removeItem("auth-token")
      localStorage.removeItem("tokenId")
    }
    return null
  })

  const [isLoading] = useState(false)
  const [twoFactorToken, setTwoFactorToken] = useState(null)
  const [show2FASetup, setShow2FASetup] = useState(false)
  const [temp2FAToken, setTemp2FAToken] = useState(null)
  const [resetPasswordToken, setResetPasswordToken] = useState(() => {
    const path = window.location.pathname
    return path.startsWith("/reset-password/") ? path.split("/").pop() : null
  })
  const [recover2FAToken, setRecover2FAToken] = useState(() => {
    const path = window.location.pathname
    return path.startsWith("/recover-2fa/") ? path.split("/").pop() : null
  })

  const handleLogout = async () => {
    await logout()
    setUser(null)
    setTwoFactorToken(null)
    setShow2FASetup(false)
    setTemp2FAToken(null)
  }

  if (import.meta.env.DEV && DevUiKitPage && hashRoute === "#/ui-kit") {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-canvas text-ink-muted text-sm font-semibold">
            Loading UI Kit...
          </div>
        }
      >
        <DevUiKitPage />
      </Suspense>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--yh-bg-app)]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--yh-border-default)] border-t-[var(--yh-brand)] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[var(--yh-text-secondary)] font-bold">Loading...</p>
        </div>
      </div>
    )
  }

  if (resetPasswordToken) {
    return (
      <ChunkErrorBoundary resetKey="reset-password">
        <Suspense fallback={<div className="min-h-screen bg-canvas p-6"><PageSkeleton variant="form" /></div>}>
          <ResetPassword
            token={resetPasswordToken}
            onComplete={() => {
              setResetPasswordToken(null)
              window.history.pushState({}, "", "/")
            }}
          />
        </Suspense>
      </ChunkErrorBoundary>
    )
  }

  if (recover2FAToken) {
    return (
      <ChunkErrorBoundary resetKey="recover-2fa">
        <Suspense fallback={<div className="min-h-screen bg-canvas p-6"><PageSkeleton variant="form" /></div>}>
          <Recover2FA
            token={recover2FAToken}
            onShow2FASetup={(token) => {
              setRecover2FAToken(null)
              setTwoFactorToken(token)
              setShow2FASetup(true)
              window.history.pushState({}, "", "/")
            }}
          />
        </Suspense>
      </ChunkErrorBoundary>
    )
  }

  if (temp2FAToken) {
    return (
      <ChunkErrorBoundary resetKey="2fa-verify">
        <Suspense fallback={<div className="min-h-screen bg-canvas p-6"><PageSkeleton variant="form" /></div>}>
          <TwoFactorVerify
            tempToken={temp2FAToken}
            onVerifySuccess={(verifiedUser) => {
              setTemp2FAToken(null)
              setUser(verifiedUser)
            }}
          />
        </Suspense>
      </ChunkErrorBoundary>
    )
  }

  if (show2FASetup && twoFactorToken) {
    return (
      <ChunkErrorBoundary resetKey="2fa-setup">
        <Suspense fallback={<div className="min-h-screen bg-canvas p-6"><PageSkeleton variant="form" /></div>}>
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
        </Suspense>
      </ChunkErrorBoundary>
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
