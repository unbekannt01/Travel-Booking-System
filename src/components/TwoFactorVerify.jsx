"use client"

import { useState } from "react"
import { Shield, ArrowRight } from "lucide-react"

export default function TwoFactorVerify({ tempToken, onVerifySuccess }) {
  const [verificationCode, setVerificationCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("http://localhost:5000/api/auth/verify-2fa-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tempToken,
          code: verificationCode,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || "Invalid verification code")
      }

      console.log("[v0] 2FA verification successful", data)

      localStorage.setItem("auth-token", data.token)
      localStorage.setItem("tokenId", data.tokenId)
      localStorage.setItem("user", JSON.stringify(data.user))

      onVerifySuccess(data.user)
    } catch (err) {
      console.error("[v0] 2FA Verification Error:", err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center bg-green-500 p-4 rounded-2xl text-white shadow-xl shadow-green-500/20 mb-6 animate-pulse">
            <Shield size={32} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Two-Factor Authentication</h1>
          <p className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-xs">
            Enter Code from Google Authenticator
          </p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center">
              <p className="text-sm font-bold text-slate-700">
                Open your Google Authenticator app and enter the 6-digit code for YatraHub
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">
                6-Digit Authentication Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                pattern="[0-9]{6}"
                placeholder="000000"
                className="w-full px-4 py-3.5 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-green-500/10 focus:border-green-500/60 transition-all outline-none font-black text-center text-2xl tracking-[0.5em]"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                <p className="text-red-600 text-xs font-bold text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || verificationCode.length !== 6}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-green-500/20 transition-all flex items-center justify-center gap-2"
            >
              <ArrowRight size={18} strokeWidth={3} />
              {loading ? "Verifying..." : "Verify & Continue"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-50">
            <p className="text-xs text-slate-400 text-center font-medium">
              The code refreshes every 30 seconds. Make sure to enter the current code.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
