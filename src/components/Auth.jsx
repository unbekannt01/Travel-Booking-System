"use client"

import { useState } from "react"
import { LogIn, UserPlus, Mail, Lock, User, Bus } from "lucide-react"

export default function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({ name: "", email: "", password: "" })
  const [error, setError] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    const baseUrl = "http://localhost:5000"
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register"

    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || "Authentication failed")
      }

      console.log(`[v0] ${isLogin ? "Login" : "Registration"} successful`, data)

      localStorage.setItem("auth-token", data.token)
      localStorage.setItem("user", JSON.stringify(data.user))
      onAuthSuccess(data.user)
    } catch (err) {
      console.error("[v0] Auth Error:", err.message)
      setError(err.message || "Authentication failed. Please check your connection.")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
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
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    required
                    placeholder="Enter your name"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none font-bold text-sm"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>
            )}

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
                />
              </div>
            </div>

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
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}

            <button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {isLogin ? <LogIn size={18} strokeWidth={3} /> : <UserPlus size={18} strokeWidth={3} />}
              {isLogin ? "Sign In Now" : "Create Account"}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-50 text-center">
            <p className="text-sm font-bold text-slate-500">
              {isLogin ? "Don't have an account?" : "Already a member?"}
              <button onClick={() => setIsLogin(!isLogin)} className="ml-2 text-primary hover:underline font-black">
                {isLogin ? "Register Here" : "Login Instead"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
