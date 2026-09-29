"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser"
import {
  User, Bell, Shield, KeyRound, Loader2, Check, AlertCircle, X,
  Mail, Building, Users, ShieldCheck, UserCog, Moon,
  Monitor, MessageSquare, ShieldAlert, Send, Camera, Eye, EyeOff
} from "lucide-react"
import { sendDesktopNotification, requestDesktopPermission } from "@/lib/chat/notifications"
import { useToast } from "@/components/ui/Toast"
import AvatarEditor from "react-avatar-editor"

interface Agent {
  id: string
  name: string
  team: string
  office: string
  role: string
  email: string
  status_message: string | null
  avatar_url: string | null
}

interface Preferences {
  desktop_enabled: boolean
  toast_enabled: boolean
  notify_on_dm: boolean
  notify_on_mentions: boolean
  notify_on_team_mentions: boolean
  notify_on_urgent: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
}

export default function PersonalSettingsPage() {
  const supabase = createSupabaseBrowserClient()
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const { addToast } = useToast()

  // Profile fields
  const [agent, setAgent] = useState<Agent | null>(null)
  const [statusMessage, setStatusMessage] = useState("")

  // Preferences fields
  const [prefs, setPrefs] = useState<Preferences>({
    desktop_enabled: true,
    toast_enabled: true,
    notify_on_dm: true,
    notify_on_mentions: true,
    notify_on_team_mentions: true,
    notify_on_urgent: true,
    quiet_hours_start: "",
    quiet_hours_end: "",
  })

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  // Display & theme preferences
  const [theme, setTheme] = useState("light")
  const [savingTheme, setSavingTheme] = useState(false)

  // Local device preferences
  const [persistentToasts, setPersistentToasts] = useState(false)

  // Feedback states
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Avatar Editor States
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [scale, setScale] = useState(1.2)
  const [editorRef, setEditorRef] = useState<any | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // MFA / Two-Factor Authentication
  const [mfaFactors, setMfaFactors] = useState<any[]>([])
  const [mfaLoading, setMfaLoading] = useState(false)
  const [mfaEnrolling, setMfaEnrolling] = useState(false)
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null)
  const [mfaSecret, setMfaSecret] = useState<string | null>(null)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [mfaVerifyCode, setMfaVerifyCode] = useState("")
  const [mfaVerifying, setMfaVerifying] = useState(false)
  const [mfaShowSecret, setMfaShowSecret] = useState(false)
  const [mfaUnenrolling, setMfaUnenrolling] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0])
      setScale(1.2)
    }
  }

  const handleSaveAvatar = async () => {
    if (!editorRef || !agent) return
    setUploadingAvatar(true)
    try {
      const canvas = editorRef.getImageScaledToCanvas()
      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) {
          setUploadingAvatar(false)
          return
        }
        const file = new File([blob], 'avatar.png', { type: 'image/png' })
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/chat/upload', {
          method: 'POST',
          body: fd
        })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to upload')
        
        const { error: dbErr } = await supabase
          .from('agents')
          .update({ avatar_url: data.url })
          .eq('id', agent.id)
          
        if (dbErr) throw dbErr
        
        setAgent({ ...agent, avatar_url: data.url })
        setUploadFile(null)
        addToast({ title: 'Profile Updated', message: 'Your picture was saved.', variant: 'success' })
        setUploadingAvatar(false)
      }, 'image/png')
    } catch (err: any) {
      addToast({ title: 'Upload Failed', message: err.message, variant: 'error' })
      setUploadingAvatar(false)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Fetch agent record
        const { data: agentData, error: agentErr } = await supabase
          .from('agents')
          .select('*')
          .eq('auth_user_id', user.id)
          .single()

        if (agentErr || !agentData) {
          throw new Error("Could not find agent profile in the database")
        }

        const enrichedAgent: Agent = {
          ...agentData,
          email: user.email || "",
        }
        setAgent(enrichedAgent)
        setStatusMessage(agentData.status_message || "")

        if (agentData && agentData.system_variants) {
          const displayPrefs = (agentData.system_variants as Record<string, any>).display_prefs || {}
          setTheme(displayPrefs.theme || localStorage.getItem("dsr_theme") || "light")
        }

        if (typeof window !== "undefined") {
          setPersistentToasts(localStorage.getItem("persistent_toasts") === "true")
        }

        // 2. Fetch preferences
        const { data: prefData } = await supabase
          .from('chat_notification_preferences')
          .select('*')
          .eq('agent_id', agentData.id)
          .single()

        if (prefData) {
          setPrefs({
            desktop_enabled: prefData.desktop_enabled ?? true,
            toast_enabled: prefData.toast_enabled ?? true,
            notify_on_dm: prefData.notify_on_dm ?? true,
            notify_on_mentions: prefData.notify_on_mentions ?? true,
            notify_on_team_mentions: prefData.notify_on_team_mentions ?? true,
            notify_on_urgent: prefData.notify_on_urgent ?? true,
            quiet_hours_start: prefData.quiet_hours_start || "",
            quiet_hours_end: prefData.quiet_hours_end || "",
          })
        }

        // 3. Load MFA factors
        try {
          const { data: mfaData } = await supabase.auth.mfa.listFactors()
          if (mfaData) {
            setMfaFactors(mfaData.totp || [])
          }
        } catch {
          // MFA may not be available
        }
      } catch (err: any) {
        console.error(err)
        setFeedback({ type: "error", message: "Failed to load settings data. Please refresh." })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleDesktopToggle = async (checked: boolean) => {
    if (checked && typeof window !== "undefined" && "Notification" in window) {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setFeedback({ type: "error", message: "Desktop notification permission was denied by your browser." })
        setPrefs(prev => ({ ...prev, desktop_enabled: false }))
        return
      }
    }
    setPrefs(prev => ({ ...prev, desktop_enabled: checked }))
  }

  const handleSaveProfile = async () => {
    if (!agent) return
    setFeedback(null)
    setSavingProfile(true)

    try {
      const { error } = await supabase
        .from('agents')
        .update({
          status_message: statusMessage.trim() || null
        })
        .eq('id', agent.id)

      if (error) throw error

      setAgent(prev => prev ? { ...prev, status_message: statusMessage.trim() || null } : null)
      setFeedback({ type: "success", message: "Status message updated successfully." })
    } catch (err: any) {
      console.error(err)
      setFeedback({ type: "error", message: err.message || "Failed to update profile." })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSavePrefs = async () => {
    if (!agent) return
    setFeedback(null)
    setSavingPrefs(true)

    try {
      const { error } = await supabase
        .from('chat_notification_preferences')
        .upsert({
          agent_id: agent.id,
          desktop_enabled: prefs.desktop_enabled,
          toast_enabled: prefs.toast_enabled,
          notify_on_dm: prefs.notify_on_dm,
          notify_on_mentions: prefs.notify_on_mentions,
          notify_on_team_mentions: prefs.notify_on_team_mentions,
          notify_on_urgent: prefs.notify_on_urgent,
          quiet_hours_start: prefs.quiet_hours_start || null,
          quiet_hours_end: prefs.quiet_hours_end || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'agent_id' })

      if (error) throw error

      setFeedback({ type: "success", message: "Chat and notification preferences saved." })
    } catch (err: any) {
      console.error(err)
      setFeedback({ type: "error", message: err.message || "Failed to save preferences." })
    } finally {
      setSavingPrefs(false)
    }
  }

  const handleToggleTheme = async (isDark: boolean) => {
    if (!agent) return
    const newTheme = isDark ? "dark" : "light"
    setTheme(newTheme)
    setSavingTheme(true)

    try {
      const { data: agentData } = await supabase
        .from('agents')
        .select('system_variants')
        .eq('id', agent.id)
        .single()

      const variants = (agentData?.system_variants as Record<string, any>) || {}
      variants.display_prefs = {
        ...(variants.display_prefs || {}),
        theme: newTheme
      }

      const { error } = await supabase
        .from('agents')
        .update({
          system_variants: variants,
          updated_at: new Date().toISOString()
        })
        .eq('id', agent.id)

      if (error) throw error

      localStorage.setItem("dsr_theme", newTheme)
      window.dispatchEvent(new Event("theme-change"))
    } catch (err: any) {
      console.error(err)
      setFeedback({ type: "error", message: err.message || "Failed to update theme on server." })
    } finally {
      setSavingTheme(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordFeedback(null)

    if (!currentPassword) {
      setPasswordFeedback({ type: "error", message: "Please enter your current password." })
      return
    }

    // Sanitize — strip any control characters (security hardening)
    const sanitized = newPassword.replace(/[\x00-\x1F\x7F]/g, '')
    if (sanitized !== newPassword) {
      setPasswordFeedback({ type: "error", message: "Password contains invalid characters." })
      return
    }

    if (sanitized.length < 12) {
      setPasswordFeedback({ type: "error", message: "Password must be at least 12 characters long." })
      return
    }

    if (!/[A-Z]/.test(sanitized)) {
      setPasswordFeedback({ type: "error", message: "Password must contain at least one uppercase letter." })
      return
    }

    if (!/\d/.test(sanitized)) {
      setPasswordFeedback({ type: "error", message: "Password must contain at least one number." })
      return
    }

    if (sanitized !== confirmPassword) {
      setPasswordFeedback({ type: "error", message: "Passwords do not match." })
      return
    }

    if (sanitized === currentPassword) {
      setPasswordFeedback({ type: "error", message: "New password must be different from your current password." })
      return
    }

    setUpdatingPassword(true)

    try {
      // Check if session is AAL1 but user has MFA enabled (needs AAL2 to change password)
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalData?.currentLevel === 'aal1' && aalData?.nextLevel === 'aal2') {
        setPasswordFeedback({ 
          type: "error", 
          message: "Security requirement: Because you have MFA enabled, you must sign out and sign back in (with your MFA code) to change your password." 
        })
        setUpdatingPassword(false)
        return
      }

      // Update to new password. Supabase's 'Secure Password Change' requires the current password.
      const payload: any = {
        password: sanitized,
        current_password: currentPassword,
        data: { security_upgraded: true } // Mark user as having completed the required password update
      }
      
      const { error: updateError } = await supabase.auth.updateUser(payload)



      if (updateError) throw updateError

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPasswordFeedback({ type: "success", message: "Password updated successfully! Use your new password next time you sign in." })
    } catch (err: any) {
      console.error(err)
      setPasswordFeedback({ type: "error", message: err.message || "Failed to update password." })
    } finally {
      setUpdatingPassword(false)
    }
  }

  // ── MFA Handlers ──────────────────────────────────────────────────────────

  const loadMfaFactors = async () => {
    setMfaLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (!error && data) {
        setMfaFactors(data.totp || [])
      }
    } catch {
      // Ignore — MFA may not be configured
    } finally {
      setMfaLoading(false)
    }
  }

  const handleMfaEnroll = async () => {
    setMfaEnrolling(true)
    setFeedback(null)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      })
      if (error) throw error
      if (data) {
        setMfaQrCode(data.totp.qr_code)
        setMfaSecret(data.totp.secret)
        setMfaFactorId(data.id)
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to start MFA enrollment." })
    } finally {
      setMfaEnrolling(false)
    }
  }

  const handleMfaVerify = async () => {
    if (!mfaFactorId || mfaVerifyCode.length !== 6) return
    setMfaVerifying(true)
    setFeedback(null)
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      })
      if (challengeErr) throw challengeErr

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaVerifyCode,
      })
      if (verifyErr) throw verifyErr

      setFeedback({ type: "success", message: "Two-factor authentication is now enabled! 🔒" })
      setMfaQrCode(null)
      setMfaSecret(null)
      setMfaFactorId(null)
      setMfaVerifyCode("")
      setMfaShowSecret(false)
      await loadMfaFactors()
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Invalid code. Please try again." })
    } finally {
      setMfaVerifying(false)
    }
  }

  const handleMfaUnenroll = async (factorId: string) => {
    if (!confirm("Are you sure you want to disable two-factor authentication? This will make your account less secure.")) return
    setMfaUnenrolling(true)
    setFeedback(null)
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) throw error
      setFeedback({ type: "success", message: "Two-factor authentication has been disabled." })
      await loadMfaFactors()
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to disable MFA." })
    } finally {
      setMfaUnenrolling(false)
    }
  }

  const mfaEnabled = mfaFactors.some(f => f.status === 'verified')

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px] gap-2 text-sm text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading your settings...
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <UserCog className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Settings</h1>
          <p className="text-sm text-slate-500">Manage your profile details, chat notifications, and password settings.</p>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`flex items-start gap-2 text-sm rounded-lg px-4 py-3 border transition-all ${
          feedback.type === "success"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {feedback.type === "success" ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="ml-auto p-0.5 rounded-md hover:bg-slate-100/50">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2/3 width on LG) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Profile Card */}
          {agent && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="w-4 h-4 text-blue-600" />
                  Profile Details
                </CardTitle>
                <CardDescription>View your office credentials and edit your public status message.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Visual Avatar Summary */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 relative group">
                  <div className="relative shrink-0">
                    {agent.avatar_url ? (
                      <img src={agent.avatar_url} alt={agent.name} className="w-14 h-14 rounded-full object-cover shadow-sm border border-slate-200" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-lg font-bold shadow-sm">
                        {agent.name.charAt(0)}
                      </div>
                    )}
                    <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-slate-200 shadow-sm rounded-full flex items-center justify-center text-slate-500 hover:text-blue-600 cursor-pointer transition-colors" title="Change Avatar">
                      <Camera className="w-3.5 h-3.5" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">{agent.name}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <Mail className="w-3.5 h-3.5" /> {agent.email}
                    </p>
                  </div>
                </div>

                {/* Avatar Cropper Modal */}
                {uploadFile && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setUploadFile(null)} />
                    <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-5 flex flex-col gap-4 z-10">
                      <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Position Profile Picture</h3>
                      
                      <div className="flex justify-center bg-slate-50 rounded-lg p-2 border border-slate-100 overflow-hidden">
                        <AvatarEditor
                          ref={setEditorRef}
                          image={uploadFile}
                          width={200}
                          height={200}
                          border={20}
                          borderRadius={100}
                          color={[255, 255, 255, 0.6]}
                          scale={scale}
                          rotate={0}
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500">Zoom</label>
                        <input 
                          type="range" 
                          min="1" max="3" step="0.01" 
                          value={scale} 
                          onChange={(e) => setScale(parseFloat(e.target.value))} 
                          className="w-full accent-blue-600"
                        />
                      </div>

                      <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 mt-1">
                        <Button variant="outline" onClick={() => setUploadFile(null)} disabled={uploadingAvatar}>Cancel</Button>
                        <Button onClick={handleSaveAvatar} disabled={uploadingAvatar} className="flex items-center gap-1.5">
                          {uploadingAvatar && <Loader2 className="w-4 h-4 animate-spin" />}
                          {uploadingAvatar ? "Saving..." : "Save Picture"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Read-Only Org details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-slate-50/50 border border-slate-150 rounded-lg">
                    <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Office Location</span>
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mt-1">
                      <Building className="w-3.5 h-3.5 text-slate-400" /> {agent.office || "Unspecified"}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50/50 border border-slate-150 rounded-lg">
                    <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Associated Team</span>
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mt-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" /> {agent.team || "No team assigned"}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50/50 border border-slate-150 rounded-lg">
                    <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Access Permissions</span>
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mt-1">
                      {agent.role === "admin" ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200">Administrator</Badge>
                        </>
                      ) : (
                        <>
                          <Shield className="w-3.5 h-3.5 text-blue-500" />
                          <Badge className="bg-blue-50 text-blue-700 border-blue-100">Standard Agent</Badge>
                        </>
                      )}
                    </span>
                  </div>
                </div>



              </CardContent>
            </Card>
          )}

          {/* Color Theme Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Moon className="w-4 h-4 text-blue-600" />
                Color Theme
              </CardTitle>
              <CardDescription>Choose your dashboard color theme.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition-colors">
                <div className="flex gap-2.5 items-start">
                  <Moon className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="block text-sm font-semibold text-slate-800">Dark Mode</span>
                    <span className="block text-xs text-slate-400 mt-0.5">Toggle deep charcoal dark colors</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={theme === "dark"}
                    disabled={savingTheme}
                    onChange={(e) => handleToggleTheme(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Password Update Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="w-4 h-4 text-blue-600" />
                Change Password
              </CardTitle>
              <CardDescription>Update your portal password to keep your account secure.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md" autoComplete="off">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => { setCurrentPassword(e.target.value); setPasswordFeedback(null) }}
                      placeholder="Enter your current password"
                      required
                      autoComplete="current-password"
                      spellCheck={false}
                      maxLength={128}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 pr-10"
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
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-500 mb-3">Enter a new password that meets the requirements below.</p>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setPasswordFeedback(null) }}
                      placeholder="Enter a strong password"
                      required
                      autoComplete="new-password"
                      spellCheck={false}
                      maxLength={128}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 pr-10"
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

                  {/* Password Strength Bar + Requirements */}
                  {newPassword.length > 0 && (() => {
                    const strength = (newPassword.length >= 12 ? 1 : 0) + (/[A-Z]/.test(newPassword) ? 1 : 0) + (/\d/.test(newPassword) ? 1 : 0) + (/[^A-Za-z0-9]/.test(newPassword) ? 1 : 0)
                    const colors = ['bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-emerald-500']
                    const labels = ['Weak', 'Fair', 'Good', 'Strong']
                    return (
                      <div className="mt-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1 flex-1">
                            {[1, 2, 3, 4].map(level => (
                              <div
                                key={level}
                                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${level <= strength ? colors[strength - 1] : 'bg-slate-200'}`}
                              />
                            ))}
                          </div>
                          <span className={`text-xs font-medium ${strength <= 1 ? 'text-red-500' : strength === 2 ? 'text-orange-500' : strength === 3 ? 'text-amber-500' : 'text-emerald-600'}`}>
                            {labels[strength - 1] || ''}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {[
                            { met: newPassword.length >= 12, label: '12+ characters' },
                            { met: /[A-Z]/.test(newPassword), label: 'Uppercase letter' },
                            { met: /\d/.test(newPassword), label: 'Number' },
                            { met: newPassword === confirmPassword && confirmPassword.length > 0, label: 'Passwords match' },
                          ].map(req => (
                            <div key={req.label} className={`flex items-center gap-1.5 text-xs transition-colors ${req.met ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {req.met ? <Check className="w-3.5 h-3.5" /> : <div className="w-3 h-3 rounded-full border border-current opacity-50" />}
                              {req.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setPasswordFeedback(null) }}
                      placeholder="Re-enter your password"
                      required
                      autoComplete="new-password"
                      spellCheck={false}
                      maxLength={128}
                      className={`w-full px-3 py-2 pr-10 bg-slate-50 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                        confirmPassword.length > 0 && newPassword !== confirmPassword
                          ? 'border-red-300 bg-red-50/50'
                          : confirmPassword.length > 0 && newPassword === confirmPassword
                          ? 'border-emerald-300 bg-emerald-50/30'
                          : 'border-slate-200'
                      }`}
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
                  {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Passwords don&apos;t match
                    </p>
                  )}
                </div>

                {/* Inline Feedback */}
                {passwordFeedback && (
                  <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2.5 border ${
                    passwordFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {passwordFeedback.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    {passwordFeedback.message}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={
                    updatingPassword ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword ||
                    newPassword.length < 12 ||
                    !/[A-Z]/.test(newPassword) ||
                    !/\d/.test(newPassword) ||
                    newPassword !== confirmPassword
                  }
                >
                  {updatingPassword ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Updating...</>
                  ) : (
                    "Change Password"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Two-Factor Authentication Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="w-4 h-4 text-blue-600" />
                Two-Factor Authentication
              </CardTitle>
              <CardDescription>
                Add an extra layer of security with an authenticator app. We recommend <strong>Microsoft Authenticator</strong> since you already use it for Allstate. Google Authenticator also works.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mfaLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Checking 2FA status...
                </div>
              ) : mfaEnabled ? (
                /* ── MFA is ON ── */
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-emerald-800">Two-factor authentication is enabled</p>
                      <p className="text-xs text-emerald-600">Your account is protected with an authenticator app.</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const factor = mfaFactors.find(f => f.status === 'verified')
                      if (factor) handleMfaUnenroll(factor.id)
                    }}
                    disabled={mfaUnenrolling}
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    {mfaUnenrolling ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Disabling...</>
                    ) : (
                      "Disable Two-Factor Authentication"
                    )}
                  </Button>
                </div>
              ) : mfaQrCode ? (
                /* ── Enrollment in progress ── */
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                    <p className="text-sm font-semibold text-blue-800">Step 1: Scan this QR code</p>
                    <p className="text-xs text-blue-700">
                      Open <strong>Microsoft Authenticator</strong> (or Google Authenticator) and scan the QR code below. If you can&apos;t scan it, you can enter the secret key manually.
                    </p>
                    <div className="flex justify-center py-2">
                      <img src={mfaQrCode} alt="MFA QR Code" className="w-48 h-48 rounded-lg border border-slate-200 bg-white p-2" />
                    </div>
                    <div className="text-center">
                      <button
                        onClick={() => setMfaShowSecret(!mfaShowSecret)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 underline cursor-pointer"
                      >
                        {mfaShowSecret ? "Hide" : "Can't scan? Enter manually"}
                      </button>
                      {mfaShowSecret && mfaSecret && (
                        <div className="mt-2 p-2 bg-white border border-slate-200 rounded-lg">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Secret Key</p>
                          <code className="text-sm font-mono text-slate-800 select-all break-all">{mfaSecret}</code>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <p className="text-sm font-semibold text-slate-800">Step 2: Enter the 6-digit code</p>
                    <p className="text-xs text-slate-600">
                      After scanning, your app will show a 6-digit code. Enter it below to finish setup.
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={mfaVerifyCode}
                        onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="w-32 px-3 py-2.5 text-center text-lg font-mono font-bold tracking-[0.3em] bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleMfaVerify() }}
                      />
                      <Button
                        onClick={handleMfaVerify}
                        disabled={mfaVerifying || mfaVerifyCode.length !== 6}
                      >
                        {mfaVerifying ? (
                          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Verifying...</>
                        ) : (
                          "Verify & Enable"
                        )}
                      </Button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setMfaQrCode(null)
                      setMfaSecret(null)
                      setMfaFactorId(null)
                      setMfaVerifyCode("")
                      setMfaShowSecret(false)
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel setup
                  </button>
                </div>
              ) : (
                /* ── MFA is OFF — show enable button ── */
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-amber-800">Two-factor authentication is not enabled</p>
                      <p className="text-xs text-amber-600">We recommend enabling 2FA to protect your account.</p>
                    </div>
                  </div>
                  <Button onClick={handleMfaEnroll} disabled={mfaEnrolling}>
                    {mfaEnrolling ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Setting up...</>
                    ) : (
                      <>
                        <Shield className="w-4 h-4 mr-2" />
                        Enable Two-Factor Authentication
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1/3 width on LG) */}
        <div>
          {/* Notifications Preferences Card */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="w-4 h-4 text-blue-600" />
                Notification Prefs
              </CardTitle>
              <CardDescription>Control how and when you receive internal chat alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Preview Test Notification */}
              <button
                onClick={async () => {
                  const firstName = agent?.name?.split(' ')[0] || 'there'

                  // 1. Always fire the in-app toast (works immediately)
                  addToast({
                    title: `Hey ${firstName}! 👋`,
                    message: 'This is what your chat notifications will look like. Looking good!',
                    variant: 'notification',
                    duration: 6000,
                  })

                  // 2. Try desktop notification too
                  if (typeof window !== 'undefined' && 'Notification' in window) {
                    if (Notification.permission === 'default') {
                      const perm = await requestDesktopPermission()
                      if (perm === 'granted') {
                        sendDesktopNotification(
                          `Hey ${firstName}! 👋`,
                          'This is your desktop notification preview. It works!',
                        )
                      } else {
                        addToast({
                          title: 'Desktop notifications blocked',
                          message: 'Your browser blocked desktop notifications. You can enable them in browser settings.',
                          variant: 'warning',
                          duration: 6000,
                        })
                      }
                    } else if (Notification.permission === 'granted') {
                      sendDesktopNotification(
                        `Hey ${firstName}! 👋`,
                        'This is your desktop notification preview. It works!',
                      )
                    }
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 hover:border-indigo-200 transition-all cursor-pointer group"
              >
                <Send className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                Preview Test Notification
              </button>

              {/* Toggles */}
              <div className="space-y-4">
                
                {/* Desktop Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex gap-2.5 items-start">
                    <Monitor className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="block text-sm font-semibold text-slate-800">Desktop Notifications</span>
                      <span className="block text-xs text-slate-400 mt-0.5">Show browser banner alerts</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.desktop_enabled}
                      onChange={(e) => handleDesktopToggle(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* In-App Toast Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex gap-2.5 items-start">
                    <Bell className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="block text-sm font-semibold text-slate-800">In-App Toasts</span>
                      <span className="block text-xs text-slate-400 mt-0.5">Show pop-up alerts in the bottom-right</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.toast_enabled}
                      onChange={(e) => setPrefs(prev => ({ ...prev, toast_enabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* DM Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex gap-2.5 items-start">
                    <MessageSquare className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="block text-sm font-semibold text-slate-800">Direct Messages</span>
                      <span className="block text-xs text-slate-400 mt-0.5">Alert on direct 1-to-1 DMs</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.notify_on_dm}
                      onChange={(e) => setPrefs(prev => ({ ...prev, notify_on_dm: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Mentions Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex gap-2.5 items-start">
                    <span className="text-slate-500 font-semibold text-xs mt-0.5 shrink-0 w-4 select-none">@</span>
                    <div>
                      <span className="block text-sm font-semibold text-slate-800">Personal @Mentions</span>
                      <span className="block text-xs text-slate-400 mt-0.5">Alert when tagged by name</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.notify_on_mentions}
                      onChange={(e) => setPrefs(prev => ({ ...prev, notify_on_mentions: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Team Mentions Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex gap-2.5 items-start">
                    <Users className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="block text-sm font-semibold text-slate-800">Team @Mentions</span>
                      <span className="block text-xs text-slate-400 mt-0.5">Alert on @Sales, @CSR tags</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.notify_on_team_mentions}
                      onChange={(e) => setPrefs(prev => ({ ...prev, notify_on_team_mentions: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Urgent Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex gap-2.5 items-start">
                    <ShieldAlert className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="block text-sm font-semibold text-slate-800">Urgent Messages</span>
                      <span className="block text-xs text-slate-400 mt-0.5">Always alert on high priority</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.notify_on_urgent}
                      onChange={(e) => setPrefs(prev => ({ ...prev, notify_on_urgent: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

              </div>

              {/* Persistent Toasts Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="flex gap-2.5 items-start">
                  <Bell className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Persistent Pop-ups</p>
                    <p className="text-xs text-slate-500">Keep notification pop-ups on screen until manually dismissed</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={persistentToasts}
                    onChange={(e) => {
                      setPersistentToasts(e.target.checked)
                      if (typeof window !== "undefined") {
                        localStorage.setItem("persistent_toasts", e.target.checked ? "true" : "false")
                      }
                      addToast({ title: "Settings Saved", message: "Pop-up duration updated.", variant: "success" })
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Save Preferences */}
              <div className="border-t border-slate-100 pt-6">
                <Button onClick={handleSavePrefs} disabled={savingPrefs} className="w-full">
                  {savingPrefs ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Preferences
                </Button>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
