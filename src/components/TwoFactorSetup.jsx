"use client"

import { useState } from "react"
import { Shield, Copy, CheckCircle2, Smartphone } from "lucide-react"

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
      const res = await fetch("http://localhost:5000/api/auth/setup-2fa", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || "Failed to generate QR code")
      }

      setQrCode(data.qrCode)
      setSecret(data.secret)
      setStep("verify")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const verifyAndEnable = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("http://localhost:5000/api/auth/verify-2fa-setup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: verificationCode }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || "Invalid verification code")
      }

      onSetupComplete()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center bg-green-500 p-4 rounded-2xl text-white shadow-xl shadow-green-500/20 mb-6">
            <Shield size={32} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Setup 2FA</h1>
          <p className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-xs">
            Secure Your Account with Google Authenticator
          </p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          {step === "generate" && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
                <div className="flex gap-3">
                  <Smartphone className="text-blue-500 shrink-0 mt-1" size={20} />
                  <div className="text-sm text-slate-700">
                    <p className="font-bold mb-2">Before you continue:</p>
                    <ol className="list-decimal ml-4 space-y-1 font-medium">
                      <li>Install Google Authenticator app on your phone</li>
                      <li>Click the button below to generate your QR code</li>
                      <li>Scan the QR code with the app</li>
                      <li>Enter the 6-digit code to verify</li>
                    </ol>
                  </div>
                </div>
              </div>

              <button
                onClick={generateQRCode}
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2"
              >
                <Shield size={18} strokeWidth={3} />
                {loading ? "Generating..." : "Generate QR Code"}
              </button>

              <button
                onClick={onSkip}
                className="w-full text-slate-500 hover:text-slate-700 py-3 rounded-2xl font-bold text-sm transition-all"
              >
                Skip for Now
              </button>
            </div>
          )}

          {step === "verify" && (
            <form onSubmit={verifyAndEnable} className="space-y-6">
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-2xl border-4 border-slate-100">
                  <img src={qrCode || "/placeholder.svg"} alt="QR Code" className="w-48 h-48" />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Manual Entry Key</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono font-bold text-slate-700 break-all">{secret}</code>
                  <button
                    type="button"
                    onClick={copySecret}
                    className="p-2 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
                  >
                    {copied ? (
                      <CheckCircle2 size={18} className="text-green-500" />
                    ) : (
                      <Copy size={18} className="text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  className="w-full px-4 py-3.5 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-black text-center text-2xl tracking-[0.5em]"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                  disabled={loading}
                />
              </div>

              {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}

              <button
                type="submit"
                disabled={loading || verificationCode.length !== 6}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-green-500/20 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} strokeWidth={3} />
                {loading ? "Verifying..." : "Verify & Enable 2FA"}
              </button>

              <button
                type="button"
                onClick={onSkip}
                className="w-full text-slate-500 hover:text-slate-700 py-3 rounded-2xl font-bold text-sm transition-all"
              >
                Skip for Now
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
