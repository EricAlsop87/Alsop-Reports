"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import {
  UserPlus, Shield, ShieldCheck, Search, Mail, KeyRound,
  Check, X, AlertCircle, Eye, EyeOff, ChevronDown,
  Loader2, UserX, RefreshCw, ArrowLeft, Layout
} from "lucide-react"
import Link from "next/link"
import {
  getUnlinkedAgents,
  getLinkedAgents,
  inviteExistingAgent,
  inviteNewUser,
  resetUserPassword,
  revokeAccess,
  updateUserRole,
  getPagePermissions,
  updatePagePermission,
  getUserMfaStatus,
  resetUserMfa,
  type UnlinkedAgent,
  type PagePermission,
} from "./actions"

export default function UserManagementPage() {
  // Data
  const [unlinkedAgents, setUnlinkedAgents] = useState<UnlinkedAgent[]>([])
  const [linkedAgents, setLinkedAgents] = useState<UnlinkedAgent[]>([])
  const [loading, setLoading] = useState(true)

  // Invite form
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [newName, setNewName] = useState("")
  const [email, setEmail] = useState("")
  const [tempPassword, setTempPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [inviting, setInviting] = useState(false)

  // Reset password
  const [resetAgentId, setResetAgentId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState("")
  const [resetting, setResetting] = useState(false)

  // Feedback
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Search
  const [searchLinked, setSearchLinked] = useState("")

  // Page access permissions
  const [pagePerms, setPagePerms] = useState<PagePermission[]>([])
  const [permSaving, setPermSaving] = useState<string | null>(null)

  // MFA
  const [mfaStatus, setMfaStatus] = useState<Record<string, boolean>>({})
  const [mfaFilter, setMfaFilter] = useState<"all" | "compliant" | "non_compliant">("all")

  const fetchData = async () => {
    setLoading(true)
    const [unlinked, linked, perms] = await Promise.all([
      getUnlinkedAgents(),
      getLinkedAgents(),
      getPagePermissions(),
    ])
    setUnlinkedAgents(unlinked)
    setLinkedAgents(linked)
    setPagePerms(perms)

    const authUserIds = linked.map(a => a.auth_user_id).filter(Boolean) as string[]
    if (authUserIds.length > 0) {
      const mfa = await getUserMfaStatus(authUserIds)
      setMfaStatus(mfa)
    } else {
      setMfaStatus({})
    }
    
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleInvite = async () => {
    setFeedback(null)
    setInviting(true)

    let result
    if (mode === "existing") {
      result = await inviteExistingAgent(selectedAgentId, email, tempPassword)
    } else {
      result = await inviteNewUser(newName, email, tempPassword)
    }

    setFeedback({ type: result.success ? "success" : "error", message: result.message })

    if (result.success) {
      setSelectedAgentId("")
      setNewName("")
      setEmail("")
      setTempPassword("")
      await fetchData()
    }
    setInviting(false)
  }

  const handleResetPassword = async () => {
    if (!resetAgentId || !resetPassword) return
    setResetting(true)
    const result = await resetUserPassword(resetAgentId, resetPassword)
    setFeedback({ type: result.success ? "success" : "error", message: result.message })
    if (result.success) {
      setResetAgentId(null)
      setResetPassword("")
    }
    setResetting(false)
  }

  const handleRevoke = async (agentId: string, agentName: string) => {
    if (!confirm(`Remove login access for ${agentName}? They won't be able to sign in anymore.`)) return
    const result = await revokeAccess(agentId)
    setFeedback({ type: result.success ? "success" : "error", message: result.message })
    if (result.success) await fetchData()
  }

  const handleToggleRole = async (agentId: string, currentRole: string | null, name: string) => {
    const newRole = currentRole === "admin" ? "agent" : "admin"
    if (!confirm(`Are you sure you want to change ${name}'s role to ${newRole}?`)) return
    setLoading(true)
    const result = await updateUserRole(agentId, newRole)
    setFeedback({ type: result.success ? "success" : "error", message: result.message })
    if (result.success) await fetchData()
    setLoading(false)
  }

  const mfaCounts = {
    total: linkedAgents.length,
    compliant: linkedAgents.filter(a => a.auth_user_id && mfaStatus[a.auth_user_id]).length,
    non_compliant: linkedAgents.filter(a => !a.auth_user_id || !mfaStatus[a.auth_user_id]).length,
  }

  const mfaComplianceRate = mfaCounts.total > 0 
    ? Math.round((mfaCounts.compliant / mfaCounts.total) * 100) 
    : 0

  const filteredLinked = linkedAgents.filter(a => {
    const matchesSearch = 
      a.name.toLowerCase().includes(searchLinked.toLowerCase()) ||
      (a.email || "").toLowerCase().includes(searchLinked.toLowerCase())
    
    if (!matchesSearch) return false

    const isCompliant = !!(a.auth_user_id && mfaStatus[a.auth_user_id])
    if (mfaFilter === "compliant") return isCompliant
    if (mfaFilter === "non_compliant") return !isCompliant
    return true
  })

  const selectedAgent = unlinkedAgents.find(a => a.id === selectedAgentId)

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">User Access & Security Management</h1>
          <p className="text-xs sm:text-sm text-slate-500">Invite agents to the dashboard, manage login credentials, and monitor MFA compliance.</p>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-start gap-2 text-sm rounded-lg px-4 py-3 border ${
          feedback.type === "success"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {feedback.type === "success" ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Security & MFA Compliance Overview Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">MFA Compliance Rate</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900">{mfaComplianceRate}%</span>
                <span className="text-xs font-medium text-slate-500">({mfaCounts.compliant}/{mfaCounts.total} users)</span>
              </div>
            </div>
            <div className={`p-2.5 rounded-xl ${mfaComplianceRate === 100 ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`border-emerald-100 bg-emerald-50/30 shadow-xs cursor-pointer transition-all ${mfaFilter === "compliant" ? "ring-2 ring-emerald-500 bg-emerald-50/70" : "hover:border-emerald-300"}`}
          onClick={() => setMfaFilter(prev => prev === "compliant" ? "all" : "compliant")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">MFA Enabled</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-emerald-800">{mfaCounts.compliant}</span>
                <span className="text-xs font-medium text-emerald-600">users compliant</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-100/80 text-emerald-700">
              <Check className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`border-amber-100 bg-amber-50/30 shadow-xs cursor-pointer transition-all ${mfaFilter === "non_compliant" ? "ring-2 ring-amber-500 bg-amber-50/70" : "hover:border-amber-300"}`}
          onClick={() => setMfaFilter(prev => prev === "non_compliant" ? "all" : "non_compliant")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Pending MFA Setup</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-amber-800">{mfaCounts.non_compliant}</span>
                <span className="text-xs font-medium text-amber-600">users need setup</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-100/80 text-amber-700">
              <Shield className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invite Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="w-4 h-4 text-blue-600" />
            Invite User
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mode toggle */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setMode("existing")}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                mode === "existing"
                  ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600/10"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              Link Existing Agent
            </button>
            <button
              onClick={() => setMode("new")}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                mode === "new"
                  ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600/10"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              New Person
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left: Agent selection or name */}
            {mode === "existing" ? (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                  Select Agent
                </label>
                <div className="relative">
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 appearance-none cursor-pointer"
                  >
                    <option value="">Choose an agent...</option>
                    {unlinkedAgents.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {a.team || "No team"} · {a.office || "No office"}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {selectedAgent && (
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedAgent.name} will be linked to this email for login.
                  </p>
                )}
                {unlinkedAgents.length === 0 && !loading && (
                  <p className="mt-2 text-xs text-amber-600">
                    All agents already have login credentials linked.
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                />
              </div>
            )}

            {/* Right: Email and Temp Password */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="agent@allstate.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs sm:text-sm font-medium text-slate-700">
                    Temporary Password
                  </label>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder="Min 12 chars, 1 uppercase, 1 number"
                    autoComplete="new-password"
                    spellCheck={false}
                    maxLength={128}
                    className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Inline requirements */}
                {tempPassword.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                    {[
                      { met: tempPassword.length >= 12, label: '12+ chars' },
                      { met: /[A-Z]/.test(tempPassword), label: 'Uppercase' },
                      { met: /\d/.test(tempPassword), label: 'Number' },
                    ].map(req => (
                      <span key={req.label} className={`text-xs flex items-center gap-1 ${req.met ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {req.met ? <Check className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-current opacity-50 inline-block" />}
                        {req.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleInvite}
              disabled={
                inviting ||
                !email ||
                !tempPassword ||
                tempPassword.length < 12 ||
                !/[A-Z]/.test(tempPassword) ||
                !/\d/.test(tempPassword) ||
                (mode === "existing" && !selectedAgentId) ||
                (mode === "new" && !newName)
              }
              className="bg-blue-600 hover:bg-blue-500 text-white w-full sm:w-auto"
            >
              {inviting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Account...</>
              ) : (
                <><UserPlus className="w-4 h-4 mr-2" /> Send Invitation</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Users */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Active Users & MFA Compliance
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing {filteredLinked.length} of {linkedAgents.length} registered accounts
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Quick Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setMfaFilter("all")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    mfaFilter === "all" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  All ({mfaCounts.total})
                </button>
                <button
                  onClick={() => setMfaFilter("compliant")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${
                    mfaFilter === "compliant" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500 hover:text-emerald-600"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  MFA Compliant ({mfaCounts.compliant})
                </button>
                <button
                  onClick={() => setMfaFilter("non_compliant")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${
                    mfaFilter === "non_compliant" ? "bg-white text-amber-700 shadow-xs" : "text-slate-500 hover:text-amber-600"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Pending Setup ({mfaCounts.non_compliant})
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchLinked}
                  onChange={(e) => setSearchLinked(e.target.value)}
                  placeholder="Search users..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading users...
            </div>
          ) : filteredLinked.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12">
              {searchLinked || mfaFilter !== "all" ? "No users match your filters." : "No users have been invited yet."}
            </p>
          ) : (
            <div className="relative">
              {/* Top Synchronized Scrollbar (Visible on smaller screens) */}
              <div 
                id="top-scrollbar-container"
                className="overflow-x-auto border-b border-slate-200 bg-slate-100/70 xl:hidden"
                onScroll={(e) => {
                  const bottom = document.getElementById("bottom-scrollbar-container")
                  if (bottom && bottom.scrollLeft !== e.currentTarget.scrollLeft) {
                    bottom.scrollLeft = e.currentTarget.scrollLeft
                  }
                }}
              >
                <div style={{ width: "940px", height: "8px" }} />
              </div>

              {/* Main Table Scroll Container */}
              <div 
                id="bottom-scrollbar-container"
                className="overflow-x-auto"
                onScroll={(e) => {
                  const top = document.getElementById("top-scrollbar-container")
                  if (top && top.scrollLeft !== e.currentTarget.scrollLeft) {
                    top.scrollLeft = e.currentTarget.scrollLeft
                  }
                }}
              >
                <table className="w-full text-left border-collapse min-w-[920px]">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                      <th className="py-3 px-4 w-[22%]">User</th>
                      <th className="py-3 px-3 w-[26%]">Email Address</th>
                      <th className="py-3 px-3 w-[15%]">Team & Office</th>
                      <th className="py-3 px-2 text-center w-[8%]">Role</th>
                      <th className="py-3 px-2 text-center w-[9%]">MFA</th>
                      <th className="py-3 px-4 text-right w-[20%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredLinked.map(agent => {
                      const isCompliant = !!(agent.auth_user_id && mfaStatus[agent.auth_user_id])
                      return (
                        <tr key={agent.id} className="hover:bg-slate-50/80 transition-colors h-14">
                          {/* User Name & Avatar */}
                          <td className="py-2.5 px-4 truncate">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {agent.name.charAt(0)}
                              </div>
                              <span className="font-semibold text-slate-900 truncate" title={agent.name}>{agent.name}</span>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="py-2.5 px-3 text-xs text-slate-600 font-mono truncate" title={agent.email || ""}>
                            {agent.email || "—"}
                          </td>

                          {/* Team & Office */}
                          <td className="py-2.5 px-3 text-xs text-slate-600 truncate">
                            {agent.team || "No team"} · <span className="font-semibold">{agent.office || "No office"}</span>
                          </td>

                          {/* Role */}
                          <td className="py-2.5 px-2 text-center">
                            {agent.role === "admin" ? (
                              <Badge variant="default" className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 border-amber-200 font-semibold">
                                Admin
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-slate-50 text-slate-600 border-slate-200">
                                Agent
                              </Badge>
                            )}
                          </td>

                          {/* MFA Status */}
                          <td className="py-2.5 px-2 text-center">
                            {isCompliant ? (
                              <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-xs" title="MFA Enabled (Compliant)">
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              </div>
                            ) : (
                              <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-50 border border-rose-200 text-rose-500 shadow-xs" title="MFA Pending (Not Set Up)">
                                <X className="w-3.5 h-3.5 stroke-[2.5]" />
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-4 text-right">
                            {resetAgentId === agent.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="password"
                                  value={resetPassword}
                                  onChange={(e) => setResetPassword(e.target.value)}
                                  placeholder="12+ chars"
                                  autoComplete="new-password"
                                  spellCheck={false}
                                  maxLength={128}
                                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-md w-28 focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  onClick={handleResetPassword}
                                  disabled={
                                    resetting ||
                                    !resetPassword ||
                                    resetPassword.length < 12 ||
                                    !/[A-Z]/.test(resetPassword) ||
                                    !/\d/.test(resetPassword)
                                  }
                                  className="h-7 px-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs shrink-0"
                                  title="Confirm reset"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { setResetAgentId(null); setResetPassword("") }}
                                  className="h-7 px-1.5 text-slate-400 hover:text-slate-700 shrink-0"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleRole(agent.id, agent.role, agent.name)}
                                  className={`h-7 px-2 text-xs font-medium shrink-0 ${
                                    agent.role === "admin"
                                      ? "text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100"
                                      : "text-slate-600 border-slate-200 hover:bg-slate-100"
                                  }`}
                                  title={agent.role === "admin" ? "Demote to Agent" : "Promote to Admin"}
                                >
                                  <Shield className="w-3 h-3 mr-1" />
                                  {agent.role === "admin" ? "Admin" : "Role"}
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setResetAgentId(agent.id)}
                                  className="h-7 px-2 text-xs font-medium text-slate-600 border-slate-200 hover:bg-slate-100 shrink-0"
                                  title="Reset password"
                                >
                                  <KeyRound className="w-3 h-3 mr-1" />
                                  Password
                                </Button>

                                {isCompliant && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      if (!confirm(`Are you sure you want to reset MFA for ${agent.name}?`)) return
                                      setLoading(true)
                                      const res = await resetUserMfa(agent.id)
                                      setFeedback({ type: res.success ? "success" : "error", message: res.message })
                                      if (res.success) await fetchData()
                                      setLoading(false)
                                    }}
                                    className="h-7 px-1.5 text-xs font-medium text-amber-700 border-amber-200 bg-amber-50/50 hover:bg-amber-100 shrink-0"
                                    title="Reset user MFA"
                                  >
                                    Reset MFA
                                  </Button>
                                )}

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRevoke(agent.id, agent.name)}
                                  className="h-7 px-1.5 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700 shrink-0"
                                  title="Revoke access"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending (unlinked) Agents */}
      {unlinkedAgents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-4 h-4 text-slate-400" />
              Agents Without Login ({unlinkedAgents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 mb-3">
              These agents are in the system but don&apos;t have login credentials yet. Use &ldquo;Invite User&rdquo; above to give them access.
            </p>
            <div className="flex flex-wrap gap-2">
              {unlinkedAgents.map(a => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-600"
                >
                  {a.name}
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-400">{a.team || "—"}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Page Access by Team */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layout className="w-4 h-4 text-indigo-600" />
            Page Access by Team
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-500 mb-4">
            Control which teams can see each page. Admins and Managers always have full access regardless of these settings.
          </p>

          {pagePerms.length === 0 ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-slate-400">
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Loading permissions...</>
              ) : (
                <p className="text-center">
                  <AlertCircle className="w-4 h-4 inline mr-1.5 text-amber-500" />
                  Page permissions table not found. Run the migration in{" "}
                  <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">supabase/migrations/00015_page_permissions.sql</code>
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-4 font-medium text-slate-600 text-xs uppercase tracking-wider">Page</th>
                    {["Sales", "CSR", "EA"].map(team => (
                      <th key={team} className="text-center py-2 px-3 font-medium text-slate-600 text-xs uppercase tracking-wider">
                        {team}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagePerms.map(perm => (
                    <tr key={perm.page_key} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 pr-4 text-sm font-medium text-slate-700">
                        {perm.page_label}
                      </td>
                      {["Sales", "CSR", "EA"].map(team => {
                        const isAllowed = perm.allowed_teams.includes(team)
                        const isSaving = permSaving === `${perm.page_key}-${team}`
                        return (
                          <td key={team} className="text-center py-2.5 px-3">
                            <button
                              disabled={isSaving}
                              onClick={async () => {
                                const key = `${perm.page_key}-${team}`
                                setPermSaving(key)
                                const newTeams = isAllowed
                                  ? perm.allowed_teams.filter(t => t !== team)
                                  : [...perm.allowed_teams, team]
                                const result = await updatePagePermission(perm.page_key, newTeams)
                                if (result.success) {
                                  setPagePerms(prev =>
                                    prev.map(p =>
                                      p.page_key === perm.page_key
                                        ? { ...p, allowed_teams: newTeams }
                                        : p
                                    )
                                  )
                                } else {
                                  setFeedback({ type: "error", message: result.message })
                                }
                                setPermSaving(null)
                              }}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:ring-offset-1 ${
                                isSaving ? "opacity-50 cursor-wait" : "cursor-pointer"
                              } ${
                                isAllowed ? "bg-blue-600" : "bg-slate-200"
                              }`}
                              title={isAllowed ? `Revoke ${team} access to ${perm.page_label}` : `Grant ${team} access to ${perm.page_label}`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                                  isAllowed ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
