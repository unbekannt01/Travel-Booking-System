import { useState } from "react"
import { Shield, Copy, CheckCircle2, Smartphone, AlertCircle } from "lucide-react"
import { setup2FA, verify2FASetup } from "../data/auth"
import { Button, Input, Field, Card } from "./ui/index"
import { formatAuthError } from "../utils/validators"

export default function TwoFactorSetup({ token, onSetupComplete, onSkip }) {
  const [qrCode, setQrCode] = useState("")
  const [secret, setSecret] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState("generate") // generate, verify
  const [copied, setCopied] = useState(false)

  const generateQRCode = async () => {
    setError("")
    setLoading(true)

    try {
      const data = await setup2FA(token)
      setQrCode(data.qrCode)
      setSecret(data.secret)
      setStep("verify")
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  const verifyAndEnable = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await verify2FASetup(verificationCode, token)
      onSetupComplete()
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  const copySecret = () => {
    if (!secret) return
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-(--yh-bg-subtle) flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-(--yh-brand)/10 text-(--yh-brand) shadow-sm mb-3">
            <Shield size={28} />
          </div>
          <h1 className="text-2xl font-black text-(--yh-text-primary) tracking-tight">
            Setup Two-Factor Authentication
          </h1>
          <p className="text-xs text-(--yh-text-muted) font-medium mt-1">
            Secure your account with Google Authenticator or Authy
          </p>
        </div>

        <Card elevation="md" className="p-6 sm:p-8 rounded-3xl border-(--yh-border-subtle)">
          {step === "generate" && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-(--yh-surface-muted) border border-(--yh-border-subtle) text-xs">
                <div className="flex gap-3">
                  <Smartphone className="text-(--yh-brand) shrink-0 mt-0.5" size={18} />
                  <div className="space-y-2 text-(--yh-text-muted)">
                    <p className="font-bold text-(--yh-text-primary)">Before continuing:</p>
                    <ol className="list-decimal ml-4 space-y-1">
                      <li>Open Google Authenticator on your smartphone</li>
                      <li>Click &quot;Generate Setup Key&quot; below to show QR code</li>
                      <li>Scan the code and enter the 6-digit code to confirm</li>
                    </ol>
                  </div>
                </div>
              </div>

              {error && (
                <div role="alert" className="p-3 rounded-xl bg-(--yh-danger)/10 border border-(--yh-danger)/20 text-xs text-(--yh-danger) font-medium flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                variant="primary"
                onClick={generateQRCode}
                disabled={loading}
                className="w-full"
                icon={<Shield size={16} />}
              >
                {loading ? "Generating Key..." : "Generate Setup Key"}
              </Button>

              <Button
                variant="ghost"
                onClick={onSkip}
                className="w-full text-xs text-(--yh-text-muted)"
              >
                Skip for Now
              </Button>
            </div>
          )}

          {step === "verify" && (
            <form onSubmit={verifyAndEnable} className="space-y-5">
              {/* QR Code Container */}
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-2xl border-2 border-(--yh-border-subtle) shadow-sm">
                  <img src={qrCode || "/placeholder.svg"} alt="2FA QR Code" className="w-44 h-44" />
                </div>
              </div>

              {/* Manual Entry Key */}
              <div className="p-3 rounded-xl bg-(--yh-surface-muted) border border-(--yh-border-subtle)">
                <p className="text-[10px] font-bold uppercase tracking-wider text-(--yh-text-muted) mb-1">
                  Manual Entry Key
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono font-bold text-(--yh-text-primary) break-all">
                    {secret}
                  </code>
                  <button
                    type="button"
                    onClick={copySecret}
                    className="p-1.5 hover:bg-(--yh-surface) rounded-lg transition-colors text-(--yh-text-muted) hover:text-(--yh-text-primary) shrink-0"
                    title="Copy Secret"
                  >
                    {copied ? (
                      <CheckCircle2 size={16} className="text-(--yh-success)" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>
              </div>

              <Field label="Enter 6-Digit Authenticator Code" required>
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
                icon={<CheckCircle2 size={16} />}
              >
                {loading ? "Verifying..." : "Verify & Enable 2FA"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={onSkip}
                className="w-full text-xs text-(--yh-text-muted)"
              >
                Skip for Now
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
