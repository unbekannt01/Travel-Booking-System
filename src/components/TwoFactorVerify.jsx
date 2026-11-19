import { useState } from "react"
import { Shield, ArrowRight, AlertCircle } from "lucide-react"
import { verify2FALogin } from "../data/auth"
import { Button, Input, Field, Card } from "./ui/index"
import { formatAuthError } from "../utils/validators"

export default function TwoFactorVerify({ tempToken, onVerifySuccess }) {
  const [verificationCode, setVerificationCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const data = await verify2FALogin(tempToken, verificationCode)
      onVerifySuccess(data.user)
    } catch (err) {
      console.error("2FA Verification Error:", err.message)
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-(--yh-bg-subtle) flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-(--yh-success)/15 text-(--yh-success) shadow-sm mb-3">
            <Shield size={28} />
          </div>
          <h1 className="text-2xl font-black text-(--yh-text-primary) tracking-tight">
            Two-Factor Verification
          </h1>
          <p className="text-xs text-(--yh-text-muted) font-medium mt-1">
            Enter the 6-digit code from Google Authenticator
          </p>
        </div>

        <Card elevation="md" className="p-6 sm:p-8 rounded-3xl border-(--yh-border-subtle)">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="p-3.5 rounded-xl bg-(--yh-surface-muted) border border-(--yh-border-subtle) text-center">
              <p className="text-xs text-(--yh-text-muted) leading-relaxed">
                Open your authenticator app on your phone and enter the active 6-digit security code for YatraHub.
              </p>
            </div>

            <Field label="6-Digit Authenticator Code" required>
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                pattern="[0-9]{6}"
                placeholder="000000"
                className="text-center text-2xl font-mono font-bold tracking-[0.4em] py-3.5"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                disabled={loading}
              />
            </Field>

            {error && (
              <div role="alert" className="p-3 rounded-xl bg-(--yh-danger)/10 border border-(--yh-danger)/20 text-xs text-(--yh-danger) font-medium flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={loading || verificationCode.length !== 6}
              className="w-full"
              icon={<ArrowRight size={16} />}
            >
              {loading ? "Verifying..." : "Verify & Continue"}
            </Button>
          </form>

          <p className="text-[11px] text-(--yh-text-muted) text-center mt-5 pt-4 border-t border-(--yh-border-subtle)">
            TOTP codes rotate every 30 seconds. Enter the current code before the timer expires.
          </p>
        </Card>
      </div>
    </div>
  )
}
