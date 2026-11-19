import { useState, useEffect } from "react"
import { Shield, Check, Loader2, XCircle, AlertCircle, ArrowLeft } from "lucide-react"
import { validate2FAToken, finalize2FARecovery } from "../data/auth"
import { Button, Card } from "./ui/index"

export default function Recover2FA({ token, onShow2FASetup, onBackToLogin }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenError, setTokenError] = useState("")

  useEffect(() => {
    let isMounted = true
    const validate = async () => {
      try {
        const data = await validate2FAToken(token)
        if (!isMounted) return

        if (!data || !data.valid) {
          setTokenValid(false)
          setTokenError((data && data.message) || "Invalid or expired recovery link")
        } else {
          setTokenValid(true)
        }
      } catch (err) {
        if (!isMounted) return
        setTokenValid(false)
        setTokenError(err.message || "Failed to validate recovery token. Please request a new link.")
      } finally {
        if (isMounted) setValidating(false)
      }
    }

    validate()
    return () => {
      isMounted = false
    }
  }, [token])

  useEffect(() => {
    if (!tokenValid || validating) return

    let isMounted = true
    const recoverAccount = async () => {
      setLoading(true)
      try {
        const data = await finalize2FARecovery(token)
        if (!isMounted) return

        if (data.requiresSetup && data.tempToken) {
          localStorage.setItem("auth-token", data.tempToken)
          localStorage.setItem("user", JSON.stringify(data.user))

          setTimeout(() => {
            if (isMounted) onShow2FASetup(data.tempToken)
          }, 1200)
        }
      } catch (err) {
        if (isMounted) setError(err.message || "Failed to complete account recovery.")
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    recoverAccount()
    return () => {
      isMounted = false
    }
  }, [tokenValid, validating, token, onShow2FASetup])

  if (validating) {
    return (
      <div className="min-h-screen bg-(--yh-bg-subtle) flex items-center justify-center p-4 sm:p-6 text-center">
        <Card elevation="md" className="w-full max-w-md p-8 rounded-3xl border-(--yh-border-subtle) space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-(--yh-brand)/10 text-(--yh-brand) mx-auto">
            <Loader2 className="animate-spin" size={24} />
          </div>
          <h2 className="text-xl font-bold text-(--yh-text-primary)">
            Validating Recovery Link...
          </h2>
          <p className="text-xs text-(--yh-text-muted)">
            Please wait while we verify your one-time recovery token.
          </p>
        </Card>
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-(--yh-bg-subtle) flex items-center justify-center p-4 sm:p-6 text-center">
        <Card elevation="md" className="w-full max-w-md p-8 rounded-3xl border-(--yh-border-subtle) space-y-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-(--yh-danger)/10 text-(--yh-danger) mx-auto">
            <XCircle size={28} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-(--yh-text-primary)">
              Recovery Link Expired
            </h2>
            <p className="text-xs text-(--yh-text-muted) leading-relaxed">
              {tokenError || "This 2FA recovery link has expired or has already been used."}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-(--yh-surface-muted) border border-(--yh-border-subtle) text-left flex items-start gap-2.5 text-xs text-(--yh-text-muted)">
            <AlertCircle size={16} className="text-(--yh-warning) shrink-0 mt-0.5" />
            <span>
              For your account security, 2FA recovery links are strictly valid for 1 hour and expire upon single use.
            </span>
          </div>
          <Button
            variant="primary"
            onClick={onBackToLogin}
            className="w-full"
            icon={<ArrowLeft size={16} />}
          >
            Back to Sign In
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-(--yh-bg-subtle) flex items-center justify-center p-4 sm:p-6 text-center">
      <Card elevation="md" className="w-full max-w-md p-8 rounded-3xl border-(--yh-border-subtle)">
        {loading ? (
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-(--yh-brand)/10 text-(--yh-brand) mx-auto animate-pulse">
              <Shield size={24} />
            </div>
            <h2 className="text-xl font-bold text-(--yh-text-primary)">
              Recovering Access...
            </h2>
            <p className="text-xs text-(--yh-text-muted)">
              Verifying credentials and preparing to re-configure authenticator.
            </p>
            <Loader2 className="animate-spin mx-auto text-(--yh-brand)" size={24} />
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-(--yh-danger)/10 text-(--yh-danger) mx-auto">
              <AlertCircle size={24} />
            </div>
            <h2 className="text-xl font-bold text-(--yh-text-primary)">
              Recovery Failed
            </h2>
            <p className="text-xs text-(--yh-danger)">{error}</p>
            <Button
              variant="outline"
              onClick={onBackToLogin}
              className="w-full"
              icon={<ArrowLeft size={16} />}
            >
              Return to Sign In
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-(--yh-success)/15 text-(--yh-success) mx-auto">
              <Check size={28} />
            </div>
            <h2 className="text-xl font-bold text-(--yh-text-primary)">
              2FA Reset Successfully
            </h2>
            <p className="text-xs text-(--yh-text-muted)">
              Redirecting you to set up your new authenticator key...
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
