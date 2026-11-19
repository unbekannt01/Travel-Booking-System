import { useState, useEffect } from "react"
import { Lock, Check, ArrowLeft, Loader2, XCircle, AlertCircle, Eye, EyeOff } from "lucide-react"
import { validateResetToken, resetPassword } from "../data/auth"
import { Button, Input, Field, Card } from "./ui/index"
import { checkPasswordCriteria, formatAuthError } from "../utils/validators"
import { cn } from "../utils/cn"

export default function ResetPassword({ token, onComplete }) {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenError, setTokenError] = useState("")

  const criteria = checkPasswordCriteria(newPassword)
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword
  const canSubmit = criteria.isValid && passwordsMatch && !loading

  useEffect(() => {
    let isMounted = true
    const validate = async () => {
      try {
        const data = await validateResetToken(token)
        if (!isMounted) return

        if (!data || !data.valid) {
          setTokenValid(false)
          setTokenError((data && data.message) || "Invalid or expired password reset link")
        } else {
          setTokenValid(true)
        }
      } catch (err) {
        if (!isMounted) return
        setTokenValid(false)
        setTokenError(err.message || "Failed to validate reset token. Please request a new link.")
      } finally {
        if (isMounted) setValidating(false)
      }
    }

    validate()
    return () => {
      isMounted = false
    }
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!passwordsMatch) {
      setError("Passwords do not match")
      return
    }
    if (!criteria.isValid) {
      setError("Password does not meet complexity requirements")
      return
    }

    setLoading(true)
    setError("")

    try {
      await resetPassword(token, newPassword)
      setSuccess(true)
      setTimeout(() => onComplete(), 1800)
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen bg-(--yh-bg-subtle) flex items-center justify-center p-4 sm:p-6 text-center">
        <Card elevation="md" className="w-full max-w-md p-8 rounded-3xl border-(--yh-border-subtle) space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-(--yh-brand)/10 text-(--yh-brand) mx-auto">
            <Loader2 className="animate-spin" size={24} />
          </div>
          <h2 className="text-xl font-bold text-(--yh-text-primary)">
            Validating Reset Link...
          </h2>
          <p className="text-xs text-(--yh-text-muted)">
            Please wait while we verify your password reset security token.
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
              Reset Link Expired
            </h2>
            <p className="text-xs text-(--yh-text-muted) leading-relaxed">
              {tokenError || "This password reset link has expired or has already been used."}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-(--yh-surface-muted) border border-(--yh-border-subtle) text-left flex items-start gap-2.5 text-xs text-(--yh-text-muted)">
            <AlertCircle size={16} className="text-(--yh-warning) shrink-0 mt-0.5" />
            <span>
              For your account security, password reset links expire after 1 hour and cannot be reused.
            </span>
          </div>
          <Button
            variant="primary"
            onClick={onComplete}
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
    <div className="min-h-screen bg-(--yh-bg-subtle) flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-(--yh-brand)/10 text-(--yh-brand) shadow-sm mb-3">
            <Lock size={28} />
          </div>
          <h1 className="text-2xl font-black text-(--yh-text-primary) tracking-tight">
            Set New Password
          </h1>
          <p className="text-xs text-(--yh-text-muted) font-medium mt-1">
            Create a strong password for your operator account
          </p>
        </div>

        <Card elevation="md" className="p-6 sm:p-8 rounded-3xl border-(--yh-border-subtle)">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-(--yh-success)/15 text-(--yh-success) mx-auto">
                <Check size={28} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-bold text-(--yh-text-primary)">
                Password Updated!
              </h2>
              <p className="text-xs text-(--yh-text-muted)">
                Redirecting you to sign in with your new password...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="New Password" required>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    placeholder="Enter new password"
                    className="pr-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-(--yh-text-muted) hover:text-(--yh-text-primary) p-1 rounded-md"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              {/* Password Policy Checklist (SEC-010) */}
              <div className="p-3.5 rounded-xl bg-(--yh-surface-muted) border border-(--yh-border-subtle) space-y-2">
                <p className="text-[11px] font-bold text-(--yh-text-primary)">
                  Password Security Requirements:
                </p>
                <div className="space-y-1.5 text-xs">
                  {[
                    { label: "At least 10 characters", pass: criteria.minLength },
                    { label: "Uppercase letter (A-Z)", pass: criteria.hasUpper },
                    { label: "Lowercase letter (a-z)", pass: criteria.hasLower },
                    { label: "Number (0-9)", pass: criteria.hasDigit },
                    { label: "Special symbol (!@#$%^&*)", pass: criteria.hasSpecial },
                  ].map((rule, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center gap-2 transition-colors",
                        rule.pass ? "text-(--yh-success) font-semibold" : "text-(--yh-text-muted)",
                      )}
                    >
                      <span className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0",
                        rule.pass ? "bg-(--yh-success)/15 text-(--yh-success)" : "bg-(--yh-border-subtle) text-(--yh-text-muted)",
                      )}>
                        {rule.pass ? "✓" : "•"}
                      </span>
                      <span>{rule.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Field label="Confirm Password" required>
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </Field>

              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-(--yh-danger) font-medium">
                  Passwords do not match
                </p>
              )}

              {error && (
                <div role="alert" className="p-3 rounded-xl bg-(--yh-danger)/10 border border-(--yh-danger)/20 text-xs text-(--yh-danger) font-medium flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={!canSubmit}
                className="w-full mt-2"
                icon={<Check size={16} />}
              >
                {loading ? "Updating password..." : "Update Password"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={onComplete}
                className="w-full text-xs text-(--yh-text-muted)"
                icon={<ArrowLeft size={14} />}
              >
                Back to Sign In
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
