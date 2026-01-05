/* eslint-disable no-unused-vars */
"use client"

import { useState, useEffect } from "react"
import { Lock, Check, ArrowLeft, Loader2, XCircle, AlertCircle } from "lucide-react"

export default function ResetPassword({ token, onComplete }) {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenError, setTokenError] = useState("")

  useEffect(() => {
    const validateToken = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/auth/validate-reset-token/${token}`)
        const data = await res.json()

        if (!res.ok || !data.valid) {
          setTokenValid(false)
          setTokenError(data.message || "Invalid or expired reset token")
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch("http://localhost:5000/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message)

      setSuccess(true)
      setTimeout(() => onComplete(), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100">
          <div className="text-center py-8 space-y-4">
            <div className="inline-flex items-center justify-center bg-primary/10 p-4 rounded-full text-primary">
              <Loader2 className="animate-spin" size={32} />
            </div>
            <p className="text-slate-900 font-black">Validating Reset Link...</p>
            <p className="text-slate-500 text-sm font-bold">Please wait</p>
          </div>
        </div>
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center bg-red-50 p-4 rounded-2xl text-red-500 mb-4">
              <XCircle size={48} strokeWidth={2} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Link Expired</h2>
              <p className="text-slate-600 font-bold text-sm">
                {tokenError || "This password reset link has expired or has already been used."}
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <p className="text-amber-800 text-xs font-bold text-left">
                Password reset links expire after 1 hour or after being used once for security reasons.
              </p>
            </div>
            <button
              onClick={onComplete}
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
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-primary/10 p-4 rounded-2xl text-primary mb-6">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Set New Password</h2>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">
            Secure your YatraHub account
          </p>
        </div>

        {success ? (
          <div className="text-center py-8 space-y-4">
            <div className="inline-flex items-center justify-center bg-green-500 p-4 rounded-full text-white shadow-xl shadow-green-500/20">
              <Check size={32} strokeWidth={3} />
            </div>
            <p className="text-slate-900 font-black">Password Reset Successfully!</p>
            <p className="text-slate-500 text-sm font-bold">Redirecting you to login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all outline-none font-bold text-sm"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all outline-none font-bold text-sm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-xs font-black text-center">{error}</p>}

            <button
              disabled={loading}
              className="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} strokeWidth={3} />}
              Update Password
            </button>

            <button
              type="button"
              onClick={onComplete}
              className="w-full text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2"
            >
              <ArrowLeft size={12} /> Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
