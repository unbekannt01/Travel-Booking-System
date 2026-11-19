import { useState, useEffect } from "react"
import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User,
  Bus,
  Shield,
  Check,
  Eye,
  EyeOff,
  ArrowLeft,
  KeyRound,
  AlertCircle,
} from "lucide-react"
import { login, register, forgotPassword, request2FARecovery } from "../data/auth"
import { useToast } from "./common/ToastContext"
import { Button, Input, Field, Card, Modal } from "./ui/index"
import { formatAuthError } from "../utils/validators"

export default function Auth({ onAuthSuccess, onRequire2FA, onShow2FASetup }) {
  const { toast } = useToast()
  const [isLogin, setIsLogin] = useState(true)
  const [view, setView] = useState("login") // login, forgot-password, recovery-request
  const [formData, setFormData] = useState({
    userName: "",
    email: "",
    loginIdentifier: "",
    password: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [show2FAPrompt, setShow2FAPrompt] = useState(false)
  const [pendingAuthData, setPendingAuthData] = useState(null)

  // Reset form data and errors on mode switch
  useEffect(() => {
    setFormData({ userName: "", email: "", loginIdentifier: "", password: "" })
    setError("")
    setShowPassword(false)
  }, [isLogin, view])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      let data
      if (isLogin) {
        data = await login(formData.loginIdentifier, formData.password)
      } else {
        data = await register(formData.userName, formData.email, formData.password)
      }

      if (data.requires2FA) {
        onRequire2FA(data.tempToken)
        return
      }

      setFormData({ userName: "", email: "", loginIdentifier: "", password: "" })

      if (!isLogin) {
        setPendingAuthData(data)
        setShow2FAPrompt(true)
      } else {
        onAuthSuccess(data.user)
      }
    } catch (err) {
      console.error("Auth Error:", err.message)
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await forgotPassword(formData.email)
      toast.success("Password reset link sent to your registered email")
      setView("login")
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  const handle2FARecoveryRequest = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await request2FARecovery(formData.email)
      toast.success("2FA recovery link sent to your registered email (valid for 1 hour)")
      setView("login")
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  const handle2FAChoice = (wants2FA) => {
    setShow2FAPrompt(false)
    if (wants2FA) {
      onShow2FASetup(pendingAuthData.token)
    } else {
      onAuthSuccess(pendingAuthData.user)
    }
  }

  // Forgot Password View
  if (view === "forgot-password") {
    return (
      <div className="min-h-screen bg-(--yh-bg-subtle) flex items-center justify-center p-4 sm:p-6">
        <Card elevation="md" className="w-full max-w-md p-6 sm:p-8 rounded-3xl border-(--yh-border-subtle)">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-(--yh-brand)/10 text-(--yh-brand) mb-3">
              <KeyRound size={24} />
            </div>
            <h2 className="text-xl font-bold text-(--yh-text-primary)">
              Reset Password
            </h2>
            <p className="text-xs text-(--yh-text-muted) mt-1">
              Enter your registered email address to receive password reset instructions.
            </p>
          </div>

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <Field label="Email Address" required>
              <Input
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
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
              disabled={loading || !formData.email.trim()}
              className="w-full"
            >
              {loading ? "Sending link..." : "Send Reset Link"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setView("login")}
              className="w-full text-xs text-(--yh-text-muted)"
              icon={<ArrowLeft size={14} />}
            >
              Back to Sign In
            </Button>
          </form>
        </Card>
      </div>
    )
  }

  // Lost 2FA Recovery View
  if (view === "recovery-request") {
    return (
      <div className="min-h-screen bg-(--yh-bg-subtle) flex items-center justify-center p-4 sm:p-6">
        <Card elevation="md" className="w-full max-w-md p-6 sm:p-8 rounded-3xl border-(--yh-border-subtle)">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-(--yh-warning)/15 text-(--yh-warning) mb-3">
              <Shield size={24} />
            </div>
            <h2 className="text-xl font-bold text-(--yh-text-primary)">
              2FA Account Recovery
            </h2>
            <p className="text-xs text-(--yh-text-muted) mt-1">
              Lost access to your authenticator app? We will send a secure recovery link to your registered email.
            </p>
          </div>

          <form onSubmit={handle2FARecoveryRequest} className="space-y-4">
            <Field label="Registered Email Address" required>
              <Input
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
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
              disabled={loading || !formData.email.trim()}
              className="w-full"
            >
              {loading ? "Sending recovery link..." : "Send Recovery Link"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setView("login")}
              className="w-full text-xs text-(--yh-text-muted)"
              icon={<ArrowLeft size={14} />}
            >
              Back to Sign In
            </Button>
          </form>
        </Card>
      </div>
    )
  }

  // Main Login / Register View
  return (
    <div className="min-h-screen bg-(--yh-bg-subtle) flex items-center justify-center p-4 sm:p-6">
      {/* Post-Registration 2FA Prompt Modal */}
      <Modal
        isOpen={show2FAPrompt}
        onClose={() => handle2FAChoice(false)}
        title="Enable Two-Factor Authentication?"
        description="Recommended for protecting operator credentials and passenger records."
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-(--yh-surface-muted) border border-(--yh-border-subtle) text-xs space-y-2">
            <div className="flex items-start gap-2">
              <Check size={16} className="text-(--yh-success) shrink-0 mt-0.5" />
              <span className="text-(--yh-text-primary)">
                Protects your system from unauthorized credential access.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Check size={16} className="text-(--yh-success) shrink-0 mt-0.5" />
              <span className="text-(--yh-text-primary)">
                Quick verification with Google Authenticator or Authy.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => handle2FAChoice(false)}
              className="w-full"
            >
              Maybe Later
            </Button>
            <Button
              variant="primary"
              onClick={() => handle2FAChoice(true)}
              className="w-full"
            >
              Activate Now
            </Button>
          </div>
        </div>
      </Modal>

      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-(--yh-brand) text-white shadow-md shadow-(--yh-brand)/25 mb-3">
            <Bus size={28} />
          </div>
          <h1 className="text-2xl font-black text-(--yh-text-primary) tracking-tight">
            YatraHub
          </h1>
          <p className="text-xs text-(--yh-text-muted) font-medium mt-1">
            {isLogin
              ? "Bus & Yatra Tour Operator Management System"
              : "Create New Operator Account"}
          </p>
        </div>

        {/* Auth Form Card */}
        <Card elevation="md" className="p-6 sm:p-8 rounded-3xl border-(--yh-border-subtle)">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <Field label="Username" required>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--yh-text-muted) pointer-events-none" />
                  <Input
                    type="text"
                    autoComplete="username"
                    required
                    placeholder="e.g. yatratours"
                    className="pl-10"
                    value={formData.userName}
                    onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </Field>
            )}

            {isLogin ? (
              <Field label="Email or Username" required>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--yh-text-muted) pointer-events-none" />
                  <Input
                    type="text"
                    autoComplete="username"
                    required
                    placeholder="Enter email or username"
                    className="pl-10"
                    value={formData.loginIdentifier}
                    onChange={(e) => setFormData({ ...formData, loginIdentifier: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </Field>
            ) : (
              <Field label="Email Address" required>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--yh-text-muted) pointer-events-none" />
                  <Input
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="name@example.com"
                    className="pl-10"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </Field>
            )}

            <Field label="Password" required>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--yh-text-muted) pointer-events-none" />
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                  placeholder="••••••••••"
                  className="pl-10 pr-10"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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

            {error && (
              <div role="alert" className="p-3 rounded-xl bg-(--yh-danger)/10 border border-(--yh-danger)/20 text-xs text-(--yh-danger) font-medium flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full mt-2"
              icon={isLogin ? <LogIn size={16} /> : <UserPlus size={16} />}
            >
              {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          {isLogin && (
            <div className="flex items-center justify-between text-xs mt-5 pt-4 border-t border-(--yh-border-subtle)">
              <button
                type="button"
                onClick={() => setView("forgot-password")}
                className="text-(--yh-brand) hover:underline font-medium"
              >
                Forgot Password?
              </button>
              <button
                type="button"
                onClick={() => setView("recovery-request")}
                className="text-(--yh-text-muted) hover:text-(--yh-text-primary) font-medium"
              >
                Lost 2FA Access?
              </button>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-(--yh-border-subtle) text-center text-xs text-(--yh-text-muted)">
            <span>{isLogin ? "Don't have an operator account?" : "Already registered?"}</span>
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setFormData({ userName: "", email: "", loginIdentifier: "", password: "" })
                setError("")
              }}
              className="ml-1.5 font-bold text-(--yh-brand) hover:underline"
            >
              {isLogin ? "Register Account" : "Sign In"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
