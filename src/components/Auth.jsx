"use client"

import { useState, useEffect } from "react"
import { LogIn, UserPlus, Mail, Lock, User, Bus, Shield, Check, X } from "lucide-react"

export default function Auth({ onAuthSuccess, onRequire2FA, onShow2FASetup }) {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({ userName: "", email: "", loginIdentifier: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [show2FAPrompt, setShow2FAPrompt] = useState(false)
  const [pendingAuthData, setPendingAuthData] = useState(null)

  // Reset form data when switching between login and register, or when component mounts
  useEffect(() => {
    setFormData({ userName: "", email: "", loginIdentifier: "", password: "" })
    setError("")
  }, [isLogin])

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

  const handle2FAChoice = (wants2FA) => {
    setShow2FAPrompt(false)
    if (wants2FA) {
      onShow2FASetup(pendingAuthData.token)
    } else {
      onAuthSuccess(pendingAuthData.user)
    }
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
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Email or Username</label>
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
