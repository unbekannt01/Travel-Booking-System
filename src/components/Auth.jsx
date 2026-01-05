"use client"

import { useState, useEffect } from "react"
import { LogIn, UserPlus, Mail, Lock, User, Bus, Shield, Check, X } from "lucide-react"

export default function Auth({ onAuthSuccess, onRequire2FA, onShow2FASetup }) {
  const [isLogin, setIsLogin] = useState(true)
  const [view, setView] = useState("login") // login, register, forgot-password, recovery-request
  const [formData, setFormData] = useState({ userName: "", email: "", loginIdentifier: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [show2FAPrompt, setShow2FAPrompt] = useState(false)
  const [pendingAuthData, setPendingAuthData] = useState(null)

  // Reset form data when switching between login and register, or when component mounts
  useEffect(() => {
    setFormData({ userName: "", email: "", loginIdentifier: "", password: "" })
    setError("")
  }, [isLogin, view])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const baseUrl = "http://localhost:5000"
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register"

    // For login, send loginIdentifier (email or username) instead of separate fields
    const requestData = isLogin
      ? { loginIdentifier: formData.loginIdentifier, password: formData.password }
      : { userName: formData.userName, email: formData.email, password: formData.password }

    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestData),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || "Authentication failed")
      }

      console.log(`[v0] ${isLogin ? "Login" : "Registration"} successful`, data)

      if (data.requires2FA) {
        onRequire2FA(data.tempToken)
        return
      }

      localStorage.setItem("auth-token", data.token)
      localStorage.setItem("tokenId", data.tokenId)
      localStorage.setItem("user", JSON.stringify(data.user))

      // Clear form data after successful authentication
      setFormData({ userName: "", email: "", loginIdentifier: "", password: "" })

      if (!isLogin) {
        setPendingAuthData(data)
        setShow2FAPrompt(true)
      } else {
        onAuthSuccess(data.user)
      }
    } catch (err) {
      console.error("[v0] Auth Error:", err.message)
      setError(err.message || "Authentication failed. Please check your connection.")
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("http://localhost:5000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      alert("Reset link sent to your email")
      setView("login")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handle2FARecoveryRequest = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("http://localhost:5000/api/auth/request-2fa-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      alert("Recovery link sent to your email (valid for 1 hour)")
      setView("login")
    } catch (err) {
      setError(err.message)
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

  if (view === "forgot-password") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <h2 className="text-2xl font-black text-slate-900 mb-6">Reset Password</h2>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <input
              type="email"
              placeholder="Email Address"
              className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 outline-none font-bold text-sm"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <button className="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 transition-all">
              Send Reset Link
            </button>
            <button
              type="button"
              onClick={() => setView("login")}
              className="w-full text-slate-400 font-bold text-xs uppercase tracking-widest"
            >
              Back to Login
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (view === "recovery-request") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <h2 className="text-2xl font-black text-slate-900 mb-2">2FA Recovery</h2>
          <p className="text-slate-500 text-sm font-bold mb-6">
            Lost access to your 2FA app? We'll send a recovery link to your email.
          </p>
          <form onSubmit={handle2FARecoveryRequest} className="space-y-4">
            <input
              type="email"
              placeholder="Your Registered Email"
              className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 outline-none font-bold text-sm"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <button className="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 transition-all">
              Send Recovery Link
            </button>
            <button
              type="button"
              onClick={() => setView("login")}
              className="w-full text-slate-400 font-bold text-xs uppercase tracking-widest"
            >
              Back to Login
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      {show2FAPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-slate-100 animate-in zoom-in-95 duration-300">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center bg-blue-500 p-4 rounded-2xl text-white shadow-xl shadow-blue-500/20 mb-6">
                <Shield size={32} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Enable 2FA?</h2>
              <p className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-xs">
                Recommended for Account Security
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex gap-3">
                <Check className="text-green-500 shrink-0" size={20} strokeWidth={3} />
                <p className="text-sm font-bold text-slate-600">
                  Protects your account from unauthorized login attempts.
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex gap-3">
                <Check className="text-green-500 shrink-0" size={20} strokeWidth={3} />
                <p className="text-sm font-bold text-slate-600">
                  Requires a 6-digit code from Google Authenticator app.
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3">
                <Shield className="text-blue-500 shrink-0" size={20} strokeWidth={3} />
                <p className="text-sm font-black text-blue-700 uppercase tracking-wider text-[10px]">
                  Highly Recommended for your Safety
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handle2FAChoice(false)}
                className="py-4 rounded-2xl font-black text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                <X size={18} strokeWidth={3} />
                Maybe Later
              </button>
              <button
                onClick={() => handle2FAChoice(true)}
                className="bg-primary hover:bg-primary/90 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2"
              >
                <Check size={18} strokeWidth={3} />
                Activate Now
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center bg-primary p-4 rounded-2xl text-white shadow-xl shadow-primary/20 mb-6 rotate-3">
            <Bus size={32} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">YatraHub</h1>
          <p className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-xs">
            {isLogin ? "Welcome Back to Luxury" : "Join the Elite Travelers"}
          </p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Username</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    required
                    placeholder="Enter your username"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm"
                    value={formData.userName}
                    onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {isLogin ? (
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">
                  Email or Username
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    required
                    placeholder="Enter email or username"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm"
                    value={formData.loginIdentifier}
                    onChange={(e) => setFormData({ ...formData, loginIdentifier: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {isLogin ? <LogIn size={18} strokeWidth={3} /> : <UserPlus size={18} strokeWidth={3} />}
              {loading ? "Processing..." : isLogin ? "Sign In Now" : "Create Account"}
            </button>
          </form>

          {isLogin && (
            <div className="flex flex-col gap-2 text-right mt-8">
              <button
                type="button"
                onClick={() => setView("forgot-password")}
                className="text-[10px] font-black text-primary/60 hover:text-primary uppercase tracking-widest"
              >
                Forgot Password?
              </button>
              <button
                type="button"
                onClick={() => setView("recovery-request")}
                className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest"
              >
                Lost 2FA Access?
              </button>
            </div>
          )}

          <div className="mt-8 pt-8 border-t border-slate-50 text-center">
            <p className="text-sm font-bold text-slate-500">
              {isLogin ? "Don't have an account?" : "Already a member?"}
              <button
                onClick={() => {
                  setIsLogin(!isLogin)
                  setFormData({ userName: "", email: "", loginIdentifier: "", password: "" })
                  setError("")
                }}
                className="ml-2 text-primary hover:underline font-black"
              >
                {isLogin ? "Register Here" : "Login Instead"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
