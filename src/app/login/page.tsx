"use client"

import { useState, useEffect } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser"
import { Loader2, AlertCircle, Eye, EyeOff, CheckCircle, BarChart3, ShieldCheck, Shield } from "lucide-react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  // Password reset states
  const [view, setView] = useState<"login" | "forgot" | "recovery" | "mfa">("login")
  const [resetEmail, setResetEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // MFA states
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState("")

  useEffect(() => {
    if (typeof window !== "undefined") {
      const type = new URLSearchParams(window.location.search).get("type")
      if (type === "recovery") {
        setView("recovery")
      }
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        if (error.message.includes("Invalid login")) {
          setError("Incorrect email or password. Please try again.")
        } else if (error.message.includes("Email not confirmed")) {
          setError("Your account hasn't been activated yet. Contact your admin.")
        } else if (error.message.toLowerCase().includes("rate limit") || error.message.includes("request this after")) {
          setError("Too many login attempts. Please wait a few minutes and try again.")
        } else {
          setError(error.message)
        }
        return
      }

      // Check if MFA is required
      const { data: assuranceLevel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assuranceLevel?.nextLevel === 'aal2' && assuranceLevel?.currentLevel === 'aal1') {
        // User has MFA enrolled — need to verify
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const totpFactor = factors?.totp?.find((f: any) => f.status === 'verified')
        if (totpFactor) {
          setMfaFactorId(totpFactor.id)
          setView("mfa")
          return
        }
      }

      // No MFA required — redirect to dashboard
      router.push("/")
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mfaFactorId || mfaCode.length !== 6) return
    setError(null)
    setLoading(true)

    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      })
      if (challengeErr) throw challengeErr

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode,
      })
      if (verifyErr) throw verifyErr

      router.push("/")
      router.refresh()
    } catch (err: any) {
      setMfaCode("")
      setError(err.message?.includes("Invalid") ? "Invalid code. Please try again." : err.message || "Verification failed.")
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/login?type=recovery`
      })

      if (error) throw error

      setSuccessMessage("Password reset link sent! Please check your email.")
      setResetEmail("")
    } catch (err: any) {
      const msg = err.message || ""
      if (msg.toLowerCase().includes("rate limit") || msg.includes("request this after") || msg.includes("security purposes")) {
        setError("You've already requested a reset link recently. Please check your email (including spam) or wait a few minutes before trying again.")
      } else {
        setError(msg || "Failed to send reset link. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setLoading(true)

    // Sanitize — strip any control characters
    const sanitized = newPassword.replace(/[\x00-\x1F\x7F]/g, '')
    if (sanitized !== newPassword) {
      setError("Password contains invalid characters.")
      setLoading(false)
      return
    }

    if (sanitized.length < 12) {
      setError("Password must be at least 12 characters long.")
      setLoading(false)
      return
    }

    if (!/[A-Z]/.test(sanitized)) {
      setError("Password must contain at least one uppercase letter.")
      setLoading(false)
      return
    }

    if (!/\d/.test(sanitized)) {
      setError("Password must contain at least one number.")
      setLoading(false)
      return
    }

    if (sanitized !== confirmPassword) {
      setError("Passwords do not match.")
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: sanitized
      })

      if (error) throw error

      setSuccessMessage("Password updated successfully! Redirecting you...")
      setTimeout(() => {
        router.push("/")
        router.refresh()
      }, 2000)
    } catch (err: any) {
      const msg = err.message || ""
      if (msg.toLowerCase().includes("session") || msg.toLowerCase().includes("not authenticated")) {
        setError("Your password reset link has expired. Please request a new one.")
        setTimeout(() => setView("forgot"), 3000)
      } else if (msg.toLowerCase().includes("rate limit") || msg.includes("request this after")) {
        setError("Too many attempts. Please wait a few minutes and try again.")
      } else {
        setError(msg || "Failed to update password. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-100/40 blur-3xl dark:bg-blue-900/10" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-indigo-100/30 blur-3xl dark:bg-indigo-900/10" />
      </div>

      <div className="relative w-full max-w-md px-4">
        {/* Logo / Brand */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
            <BarChart3 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-tight">
            Alsop and Associates<br />Insurance Agency
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Internal Performance Hub
          </p>
        </div>

        {/* Login / Reset Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/60 dark:border-slate-800 p-8">
          
          {view === "login" && (
            <>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">
                Sign in
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                Enter your agency account credentials to access your dashboard.
              </p>

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-350 mb-1.5">
                    Work Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="agent@company.com"
                    required
                    autoFocus
                    autoComplete="email"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200"
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-350">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null)
                        setSuccessMessage(null)
                        setView("forgot")
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all pr-10 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Feedback */}
                {error && (
                  <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>
              </form>
            </>
          )}

          {view === "forgot" && (
            <>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">
                Reset Password
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                {/* Email */}
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700 dark:text-slate-350 mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="agent@company.com"
                    required
                    autoFocus
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200"
                  />
                </div>

                {/* Messages */}
                {error && (
                  <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {successMessage && (
                  <div className="flex items-start gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400">
                    <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || !resetEmail}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>

                {/* Back to Login */}
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setSuccessMessage(null)
                      setView("login")
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            </>
          )}

          {view === "recovery" && (
            <>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">
                Enter New Password
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                Choose a strong new password for your reports account.
              </p>

              <form onSubmit={handleUpdatePassword} className="space-y-4" autoComplete="off">
                {/* New Password */}
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 dark:text-slate-350 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter a strong password"
                      required
                      autoFocus
                      autoComplete="new-password"
                      spellCheck={false}
                      maxLength={128}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all pr-10 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Strength bar + checklist */}
                  {newPassword.length > 0 && (() => {
                    const strength = (newPassword.length >= 12 ? 1 : 0) + (/[A-Z]/.test(newPassword) ? 1 : 0) + (/\d/.test(newPassword) ? 1 : 0) + (/[^A-Za-z0-9]/.test(newPassword) ? 1 : 0)
                    const colors = ['bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-emerald-500']
                    const labels = ['Weak', 'Fair', 'Good', 'Strong']
                    return (
                      <div className="mt-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1 flex-1">
                            {[1, 2, 3, 4].map(level => (
                              <div key={level} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${level <= strength ? colors[strength - 1] : 'bg-slate-200 dark:bg-slate-700'}`} />
                            ))}
                          </div>
                          <span className={`text-xs font-medium ${strength <= 1 ? 'text-red-500' : strength === 2 ? 'text-orange-500' : strength === 3 ? 'text-amber-500' : 'text-emerald-600'}`}>
                            {labels[strength - 1] || ''}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          {[
                            { met: newPassword.length >= 12, label: '12+ characters' },
                            { met: /[A-Z]/.test(newPassword), label: 'Uppercase letter' },
                            { met: /\d/.test(newPassword), label: 'Number' },
                            { met: newPassword === confirmPassword && confirmPassword.length > 0, label: 'Passwords match' },
                          ].map(req => (
                            <div key={req.label} className={`flex items-center gap-1.5 text-xs transition-colors ${req.met ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {req.met ? <CheckCircle className="w-3.5 h-3.5" /> : <div className="w-3 h-3 rounded-full border border-current opacity-50" />}
                              {req.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 dark:text-slate-350 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    autoComplete="new-password"
                    spellCheck={false}
                    maxLength={128}
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200 ${
                      confirmPassword.length > 0 && newPassword !== confirmPassword
                        ? 'border-red-300 bg-red-50/50 dark:bg-red-950/20'
                        : confirmPassword.length > 0 && newPassword === confirmPassword
                        ? 'border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  />
                  {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Passwords don&apos;t match
                    </p>
                  )}
                </div>

                {/* Messages */}
                {error && (
                  <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {successMessage && (
                  <div className="flex items-start gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400">
                    <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={
                    loading ||
                    !newPassword ||
                    !confirmPassword ||
                    newPassword.length < 12 ||
                    !/[A-Z]/.test(newPassword) ||
                    !/\d/.test(newPassword) ||
                    newPassword !== confirmPassword
                  }
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </form>
            </>
          )}

          {view === "mfa" && (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 mx-auto rounded-xl bg-blue-50 flex items-center justify-center mb-3">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  Two-Factor Authentication
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Open Microsoft Authenticator and enter the 6-digit code.
                </p>
              </div>

              <form onSubmit={handleMfaVerify} className="space-y-4">
                <div className="flex justify-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    autoFocus
                    className="w-44 px-4 py-3 text-center text-2xl font-mono font-bold tracking-[0.4em] bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify & Sign In"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setView("login")
                    setMfaCode("")
                    setMfaFactorId(null)
                    setError(null)
                    supabase.auth.signOut()
                  }}
                  className="w-full text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 py-1 cursor-pointer"
                >
                  ← Back to login
                </button>
              </form>
            </>
          )}

        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          This is an internal agency portal. Contact your admin for access.
        </p>
      </div>
    </div>
  )
}
