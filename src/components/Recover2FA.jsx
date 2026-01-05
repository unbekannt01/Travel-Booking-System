/* eslint-disable no-unused-vars */
"use client"

import { useState, useEffect } from "react"
import { Shield, ShieldAlert, Check, Loader2, XCircle, AlertCircle, ArrowLeft } from "lucide-react"

export default function Recover2FA({ token, onShow2FASetup, onBackToLogin }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenError, setTokenError] = useState("")

  useEffect(() => {
    const validateToken = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/auth/validate-2fa-token/${token}`)
        const data = await res.json()

        if (!res.ok || !data.valid) {
          setTokenValid(false)
          setTokenError(data.message || "Invalid or expired recovery token")
        } else {
          setTokenValid(true)
        }
      } catch (err) {
        setTokenValid(false)
        setTokenError("Failed to validate token. Please try again.")
      } finally {
        setValidating(false)
      }
    }

    validateToken()
  }, [token])

  useEffect(() => {
    if (!tokenValid || validating) return

    const recoverAccount = async () => {
      setLoading(true)
      try {
        const res = await fetch("http://localhost:5000/api/auth/finalize-2fa-recovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.message)

        if (data.requiresSetup && data.tempToken) {
          localStorage.setItem("auth-token", data.tempToken)
          localStorage.setItem("user", JSON.stringify(data.user))

          setTimeout(() => {
            onShow2FASetup(data.tempToken)
          }, 1500)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    recoverAccount()
  }, [tokenValid, validating, token, onShow2FASetup])

  if (validating) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 text-center">
        <div className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100">
          <div className="space-y-6">
            <div className="inline-flex items-center justify-center bg-blue-500/10 p-5 rounded-3xl text-blue-500">
              <Loader2 className="animate-spin" size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Validating Recovery Link...</h2>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest leading-relaxed px-4">
              Please wait
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 text-center">
        <div className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100">
          <div className="space-y-6">
            <div className="inline-flex items-center justify-center bg-red-50 p-4 rounded-2xl text-red-500 mb-4">
              <XCircle size={48} strokeWidth={2} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Link Expired</h2>
              <p className="text-slate-600 font-bold text-sm">
                {tokenError || "This 2FA recovery link has expired or has already been used."}
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <p className="text-amber-800 text-xs font-bold text-left">
                Recovery links expire after 1 hour or after being used once for security reasons.
              </p>
            </div>
            <button
              onClick={() => onBackToLogin()}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <ArrowLeft size={18} strokeWidth={3} />
              Back to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100">
        {loading ? (
          <div className="space-y-6">
            <div className="inline-flex items-center justify-center bg-blue-500/10 p-5 rounded-3xl text-blue-500 animate-pulse">
              <Shield size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Recovering Access...</h2>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest leading-relaxed px-4">
              We are verifying your recovery link and disabling 2FA temporarily
            </p>
            <Loader2 className="animate-spin mx-auto text-blue-500" size={32} />
          </div>
        ) : error ? (
          <div className="space-y-6">
            <div className="inline-flex items-center justify-center bg-red-500/10 p-5 rounded-3xl text-red-500">
              <ShieldAlert size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Recovery Failed</h2>
            <p className="text-red-500/70 font-bold text-xs uppercase tracking-widest leading-relaxed">{error}</p>
            <button
              onClick={() => onBackToLogin()}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-slate-900/20 transition-all"
            >
              Return to Login
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-in zoom-in-95 duration-500">
            <div className="inline-flex items-center justify-center bg-green-500 p-5 rounded-3xl text-white shadow-xl shadow-green-500/20">
              <Check size={40} strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">2FA Disabled</h2>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
              Redirecting you to setup 2FA again...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
