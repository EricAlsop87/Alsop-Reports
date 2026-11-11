"use client"

import { useEffect, useState, useMemo } from "react"
import { PageGuard } from "@/components/layout/PageGuard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { 
  PhoneForwarded, 
  Users, 
  Calendar, 
  TrendingUp, 
  Activity, 
  Search, 
  Repeat, 
  Layers, 
  Headphones, 
  UserCheck, 
  Flame,
  FileSpreadsheet,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  BarChart2,
  PieChart,
  Target,
  Sparkles,
  AlertCircle
} from "lucide-react"
import { getTransfersData, TransfersPayload, TransferRecord } from "./actions"

function formatDisplayDate(dateStr: string) {
  if (!dateStr) return ""
  const [y, m, d] = dateStr.split("-").map(Number)
  const dateObj = new Date(y, m - 1, d)
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${days[dateObj.getDay()]}, ${months[dateObj.getMonth()]} ${d}`
}

export default function TransfersPage() {
  const [data, setData] = useState<TransfersPayload | null>(null)
  const [loading, setLoading] = useState(true)

  // Navigation & Drilldown State
  const [activeTab, setActiveTab] = useState<"deepdive" | "matrix" | "telemarketers" | "leaderboard" | "log">("deepdive")
  const [selectedAgent, setSelectedAgent] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<string>("all")
  const [selectedTm, setSelectedTm] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getTransfersData()
      setData(res)
      if (res.agents.length > 0 && !selectedAgent) {
        // Default to #1 top agent (Charmaine or first in list)
        setSelectedAgent(res.topAgent.name || res.agents[0])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Currently selected agent's full stats
  const currentAgentStat = useMemo(() => {
    if (!data || !selectedAgent || !data.agentStats[selectedAgent]) return null
    return data.agentStats[selectedAgent]
  }, [data, selectedAgent])

  // Records for current agent
  const currentAgentRecords = useMemo(() => {
    if (!data || !selectedAgent) return []
    return data.records.filter(r => r.lia === selectedAgent)
  }, [data, selectedAgent])

  // Filtered Records for Log Tab
  const filteredRecords = useMemo(() => {
    if (!data) return []
    return data.records.filter(r => {
      if (selectedDate !== "all" && r.date !== selectedDate) return false
      if (selectedTm !== "all" && r.tm !== selectedTm) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesLead = r.leadName.toLowerCase().includes(q)
        const matchesMsg = r.message.toLowerCase().includes(q)
        const matchesLia = r.lia.toLowerCase().includes(q)
        const matchesTm = r.tm.toLowerCase().includes(q)
        if (!matchesLead && !matchesMsg && !matchesLia && !matchesTm) return false
      }
      return true
    })
  }, [data, selectedDate, selectedTm, searchQuery])

  // Dynamic Routing Matrix for current filter
  const matrixData = useMemo(() => {
    if (!data) return { rows: [], tms: [] }
    const currentTms = selectedTm === "all" ? data.telemarketers : [selectedTm]
    const agentMap: Record<string, Record<string, number>> = {}

    filteredRecords.forEach(r => {
      agentMap[r.lia] = agentMap[r.lia] || {}
      agentMap[r.lia][r.tm] = (agentMap[r.lia][r.tm] || 0) + 1
    })

    const rows = Object.entries(agentMap).map(([agent, tms]) => {
      let rowTotal = 0
      currentTms.forEach(tm => {
        rowTotal += tms[tm] || 0
      })
      const office = data.agentMeta[agent]?.office || "MCM"
      const team = data.agentMeta[agent]?.team || "Sales"
      return { agent, office, team, tms, total: rowTotal }
    }).sort((a, b) => b.total - a.total)

    return { rows, tms: currentTms }
  }, [data, filteredRecords, selectedTm])

  if (loading || !data) {
    return (
      <PageGuard pageKey="transfers">
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-8 w-64 bg-slate-200 animate-pulse rounded-md mb-2" />
              <div className="h-4 w-96 bg-slate-100 animate-pulse rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-xl border border-slate-200" />
            ))}
          </div>
        </div>
      </PageGuard>
    )
  }

  return (
    <PageGuard pageKey="transfers">
      <div className="p-6 md:p-8 max-w-[1550px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl text-white shadow-sm">
                <PhoneForwarded className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Lead Transfers & Telemarketer Tracker
              </h1>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold text-xs">
                CA 07 Ricochet Leads
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Ricochet live transfer intake tracking. Measure individual agent intake, telemarketer consistency, and pod lead distribution.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadData}
              className="text-xs font-semibold gap-1.5 border-slate-200"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Data
            </Button>
            <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
              📁 {data.dates.length} Days of Reports Analyzed
            </div>
          </div>
        </div>

        {/* Agency Summary KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Leads Transferred</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{data.totalTransfers}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Across {data.dates.length} days</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Daily Intake Average</p>
            <p className="text-xl font-black text-indigo-600 mt-0.5">{data.avgPerDay}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Transfers / day</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Telemarketers</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{data.telemarketers.length} TMs</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Top: {data.topTm.name}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Agent Recipient</p>
            <p className="text-xl font-black text-slate-900 mt-0.5 truncate">{data.topAgent.name}</p>
            <p className="text-[11px] text-blue-600 font-medium mt-0.5">{data.topAgent.count} leads ({Math.round((data.topAgent.count / data.totalTransfers) * 100)}%)</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm col-span-2 sm:col-span-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">2nd / 3rd Try Rate</p>
            <p className="text-xl font-black text-purple-700 mt-0.5">{data.multitryRate}%</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Re-transfer attempts</p>
          </div>
        </div>

        {/* ── Main Navigation View Switcher (Clean, intuitive tabs) ── */}
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            
            {/* View 1: Agent Deep-Dive (modeled after Lead Tracker's Agent Dashboard) */}
            <button
              onClick={() => setActiveTab("deepdive")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "deepdive" 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Agent Deep-Dive
            </button>

            {/* View 2: Agent Comparison Leaderboard (modeled after Lead Tracker's 2026 Overview) */}
            <button
              onClick={() => setActiveTab("leaderboard")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "leaderboard" 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Agent Comparison Table
            </button>

            {/* View 3: Pod & Team Balance Heatmap Matrix */}
            <button
              onClick={() => setActiveTab("matrix")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "matrix" 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Pod & Group Routing Matrix
            </button>

            {/* View 4: Telemarketers Output & Daily Rhythm */}
            <button
              onClick={() => setActiveTab("telemarketers")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "telemarketers" 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              Telemarketer Consistency
            </button>

            {/* View 5: Detailed Lead Log */}
            <button
              onClick={() => setActiveTab("log")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "log" 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Detailed Lead Log
            </button>
          </div>

          {/* Quick Date filter badge indicator */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">
              {data.records.length} total transfers recorded
            </span>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════════════
            VIEW 1: AGENT DEEP-DIVE (MODELED AFTER LEAD TRACKER'S AGENT DASHBOARD)
            ════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "deepdive" && currentAgentStat && (
          <div className="space-y-6">
            
            {/* Agent Selector Toolbar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Select Agent:
                </div>
                <select
                  value={selectedAgent}
                  onChange={e => setSelectedAgent(e.target.value)}
                  className="text-sm font-bold bg-indigo-50/70 border border-indigo-200 text-indigo-900 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {data.agents.map(a => (
                    <option key={a} value={a}>
                      {a} ({data.agentStats[a]?.total || 0} leads)
                    </option>
                  ))}
                </select>

                <Badge variant="outline" className="font-semibold text-xs bg-slate-50 border-slate-200">
                  {currentAgentStat.office} Office • {currentAgentStat.team}
                </Badge>
              </div>

              <div className="text-xs text-slate-500">
                Ranked <strong className="text-indigo-600 font-black">#{data.agents.indexOf(selectedAgent) + 1}</strong> of {data.agents.length} agents in lead receipt
              </div>
            </div>

            {/* Selected Agent KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Leads Taken</p>
                  <p className="text-3xl font-black text-slate-900 mt-1">{currentAgentStat.total}</p>
                  <p className="text-xs text-indigo-600 font-semibold mt-0.5">
                    {Math.round((currentAgentStat.total / data.totalTransfers) * 1000) / 10}% of all agency transfers
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Daily Intake Rate</p>
                  <p className="text-3xl font-black text-slate-900 mt-1">{currentAgentStat.dailyAvg}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Leads / day across {currentAgentStat.activeDays} active days
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">1st Try Clean Rate</p>
                  <p className="text-3xl font-black text-emerald-600 mt-1">
                    {Math.round((currentAgentStat.firstTryCount / currentAgentStat.total) * 100)}%
                  </p>
                  <p className="text-xs text-emerald-700 font-semibold mt-0.5">
                    {currentAgentStat.firstTryCount} clean transfers on 1st attempt
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">2nd / 3rd Try Re-routes</p>
                  <p className="text-3xl font-black text-purple-700 mt-1">{currentAgentStat.multiTryRate}%</p>
                  <p className="text-xs text-purple-600 font-semibold mt-0.5">
                    {currentAgentStat.multiTryCount} leads required 2nd/3rd call
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Visual Breakdown: Telemarketers Feeding Agent & Daily Rhythm */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* TM Feeders */}
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="p-4 pb-2 border-b border-slate-100">
                  <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Headphones className="w-3.5 h-3.5 text-indigo-600" />
                    Telemarketers Feeding {selectedAgent}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {Object.entries(currentAgentStat.tmBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([tm, count]) => {
                      const share = Math.round((count / currentAgentStat.total) * 100)
                      return (
                        <div key={tm} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-slate-800 font-bold">{tm}</span>
                            <span className="text-slate-500">
                              <strong className="text-slate-900 font-black">{count} leads</strong> ({share}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </CardContent>
              </Card>

              {/* Daily Intake Rhythm */}
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="p-4 pb-2 border-b border-slate-100">
                  <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    Daily Lead Intake for {selectedAgent}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {data.dates.map(date => {
                    const count = currentAgentStat.dateBreakdown[date] || 0
                    const share = currentAgentStat.total ? Math.round((count / currentAgentStat.total) * 100) : 0

                    return (
                      <div key={date} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="font-semibold text-slate-700">
                          {formatDisplayDate(date)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-black text-xs ${count > 0 ? "text-indigo-700" : "text-slate-400"}`}>
                            {count} leads
                          </span>
                          {count >= 6 && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] py-0 px-1 font-bold">
                              Heavy
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

            </div>

            {/* Table of Leads for this specific agent */}
            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Lead Records Received by {selectedAgent} ({currentAgentRecords.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Every transfer recorded in Slack for this producer.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-3">Telemarketer (TM)</th>
                      <th className="py-2.5 px-3">Lead / Customer Name</th>
                      <th className="py-2.5 px-3 text-center">Attempt</th>
                      <th className="py-2.5 px-4">Slack Message Confirmation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentAgentRecords.map((r, i) => (
                      <tr key={r.id || i} className={i % 2 === 0 ? "bg-white hover:bg-slate-50/80" : "bg-slate-50/40 hover:bg-slate-50"}>
                        <td className="py-2.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                          {formatDisplayDate(r.date)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-indigo-700 whitespace-nowrap">
                          {r.tm}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {r.leadName || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {r.tryCount > 1 ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-bold text-[10px] px-1.5 py-0">
                              {r.tryCount}nd Try
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold text-[10px] px-1.5 py-0">
                              1st Try
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 text-[11px] max-w-[450px] truncate" title={r.message}>
                          {r.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════════════
            VIEW 2: AGENT COMPARISON LEADERBOARD (MODELED AFTER LEAD TRACKER'S 2026 OVERVIEW)
            ════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "leaderboard" && (
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Agent Lead Transfer Comparison Leaderboard
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Side-by-side comparison of all producers taking transfers. Click any agent to view their full deep-dive.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3 text-center w-12">Rank</th>
                    <th className="py-3 px-4">Agent Name</th>
                    <th className="py-3 px-3">Office / Team</th>
                    <th className="py-3 px-3 text-center font-black">Total Leads</th>
                    <th className="py-3 px-3 text-center">Share %</th>
                    <th className="py-3 px-3 text-center">Daily Avg</th>
                    <th className="py-3 px-3">Primary TM Feeder</th>
                    <th className="py-3 px-3 text-center">1st Try</th>
                    <th className="py-3 px-3 text-center">2nd+ Try Rate</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.agents
                    .map(name => data.agentStats[name])
                    .filter(Boolean)
                    .sort((a, b) => b.total - a.total)
                    .map((stat, idx) => {
                      const share = Math.round((stat.total / data.totalTransfers) * 1000) / 10

                      return (
                        <tr 
                          key={stat.name}
                          onClick={() => {
                            setSelectedAgent(stat.name)
                            setActiveTab("deepdive")
                          }}
                          className={`cursor-pointer transition-colors ${
                            idx % 2 === 0 ? "bg-white hover:bg-indigo-50/40" : "bg-slate-50/40 hover:bg-indigo-50/40"
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            {stat.name}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-slate-600 font-semibold">{stat.office}</span>
                            <span className="text-slate-400 text-[10px] ml-1">({stat.team})</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-black text-slate-900 text-sm">
                            {stat.total}
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-indigo-700">
                            {share}%
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                            {stat.dailyAvg}/day
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800">{stat.topTm.name}</span>
                            <span className="text-slate-400 text-[10px] ml-1">({stat.topTm.count})</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-emerald-700">
                            {stat.firstTryCount}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-purple-700">
                            {stat.multiTryRate}%
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center justify-end gap-1">
                              Deep-Dive <ArrowRight className="w-3 h-3" />
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* ════════════════════════════════════════════════════════════════════════════
            VIEW 3: POD & TEAM ROUTING HEATMAP MATRIX (JOHN PAUL'S DIRECT QUESTION)
            ════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "matrix" && (
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Telemarketer to Agent Routing Heatmap Matrix
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Directly addresses whether telemarketers (like Shireen, Sophia, Jovelyn, Mark) are dispatching balanced leads to agent teams.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500">Color Intensity:</span>
                  <div className="flex items-center gap-1 text-[10px] font-bold">
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">0</span>
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">1-4</span>
                    <span className="px-1.5 py-0.5 bg-indigo-200 text-indigo-800 rounded">5-9</span>
                    <span className="px-1.5 py-0.5 bg-indigo-600 text-white rounded">10+</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 sticky left-0 bg-slate-50/95 z-10 border-r border-slate-200 min-w-[200px]">
                      Agent (LIA)
                    </th>
                    {matrixData.tms.map(tm => (
                      <th key={tm} className="py-3 px-3 text-center border-r border-slate-100 min-w-[130px]">
                        {tm}
                        <div className="text-[10px] font-medium text-slate-400 lowercase">
                          {data.byTm[tm] || 0} total leads
                        </div>
                      </th>
                    ))}
                    <th className="py-3 px-4 text-center font-black text-slate-900 bg-slate-100/70 min-w-[100px]">
                      Total Received
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixData.rows.map(({ agent, office, team, tms, total }, idx) => (
                    <tr key={agent} className={idx % 2 === 0 ? "bg-white hover:bg-slate-50/80" : "bg-slate-50/40 hover:bg-slate-50"}>
                      <td className="py-2.5 px-4 font-bold text-slate-800 sticky left-0 bg-inherit z-10 border-r border-slate-200 flex items-center justify-between">
                        <div>
                          <span>{agent}</span>
                          <span className="text-[10px] text-slate-400 font-normal ml-1.5">({office})</span>
                        </div>
                        {total >= 30 && (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 py-0 px-1 font-semibold">
                            High Vol
                          </Badge>
                        )}
                      </td>
                      {matrixData.tms.map(tm => {
                        const count = tms[tm] || 0
                        let bgClass = "text-slate-400"
                        if (count >= 10) bgClass = "bg-indigo-600 text-white font-black shadow-sm"
                        else if (count >= 5) bgClass = "bg-indigo-100 text-indigo-900 font-bold"
                        else if (count > 0) bgClass = "bg-blue-50 text-blue-800 font-semibold"

                        return (
                          <td key={tm} className="py-2 px-2 text-center border-r border-slate-100">
                            <span className={`inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-md text-xs ${bgClass}`}>
                              {count > 0 ? count : "-"}
                            </span>
                          </td>
                        )
                      })}
                      <td className="py-2.5 px-4 text-center font-black text-slate-900 bg-slate-100/50">
                        {total}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/90 font-black text-slate-900 border-t-2 border-slate-300">
                    <td className="py-3 px-4 sticky left-0 bg-slate-100 z-10 border-r border-slate-200">
                      Total Leads Dispatched
                    </td>
                    {matrixData.tms.map(tm => {
                      const colTotal = filteredRecords.filter(r => r.tm === tm).length
                      return (
                        <td key={tm} className="py-3 px-3 text-center border-r border-slate-200 text-indigo-700">
                          {colTotal}
                        </td>
                      )
                    })}
                    <td className="py-3 px-4 text-center text-sm font-black text-indigo-900 bg-indigo-50/80">
                      {filteredRecords.length}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        )}

        {/* ════════════════════════════════════════════════════════════════════════════
            VIEW 4: TELEMARKETER OUTPUT & DAILY CONSISTENCY MATRIX
            ════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "telemarketers" && (
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Headphones className="w-4 h-4 text-indigo-600" />
                Telemarketer Daily Output & Consistency Matrix
              </CardTitle>
              <CardDescription className="text-xs">
                Scan daily output volume per telemarketer across every report day to verify consistency.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 sticky left-0 bg-slate-50 z-10 border-r border-slate-200 min-w-[180px]">
                      Telemarketer (TM)
                    </th>
                    {data.dates.map(d => (
                      <th key={d} className="py-3 px-3 text-center border-r border-slate-100 min-w-[95px]">
                        {formatDisplayDate(d)}
                      </th>
                    ))}
                    <th className="py-3 px-3 text-center font-black text-slate-900 bg-slate-100/70">
                      Total
                    </th>
                    <th className="py-3 px-3 text-center font-bold">
                      Daily Avg
                    </th>
                    <th className="py-3 px-3">
                      Primary Recipient
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.telemarketers.map(tm => {
                    const stat = data.tmStats[tm]
                    return (
                      <tr key={tm} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-200">
                          {tm}
                          <div className="text-[10px] text-slate-400 font-normal">
                            {stat.sharePercent}% of agency leads
                          </div>
                        </td>
                        {data.dates.map(d => {
                          const count = data.tmDailyMatrix[tm]?.[d] || 0
                          return (
                            <td key={d} className="py-2.5 px-2 text-center border-r border-slate-100">
                              <span className={`inline-flex items-center justify-center min-w-[26px] h-6 px-1 rounded-md text-xs font-bold ${
                                count >= 15 ? "bg-emerald-100 text-emerald-800" :
                                count >= 10 ? "bg-blue-50 text-blue-700" :
                                count > 0 ? "bg-slate-100 text-slate-700" :
                                "text-slate-300"
                              }`}>
                                {count > 0 ? count : "-"}
                              </span>
                            </td>
                          )
                        })}
                        <td className="py-2.5 px-3 text-center font-black text-slate-900 bg-slate-100/50 text-sm">
                          {stat.total}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-indigo-700">
                          {stat.dailyAvg}/day
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-800">{stat.topAgent.name}</span>
                          <span className="text-slate-400 text-[10px] ml-1">({stat.topAgent.count} leads)</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/90 font-black text-slate-900 border-t-2 border-slate-300">
                    <td className="py-3 px-4 sticky left-0 bg-slate-100 z-10 border-r border-slate-200">
                      Total Dispatched
                    </td>
                    {data.dates.map(d => (
                      <td key={d} className="py-3 px-3 text-center border-r border-slate-200 text-indigo-800">
                        {data.byDate[d] || 0}
                      </td>
                    ))}
                    <td className="py-3 px-3 text-center text-sm font-black text-indigo-900 bg-indigo-50/80">
                      {data.totalTransfers}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-indigo-900">
                      {data.avgPerDay}/day
                    </td>
                    <td className="py-3 px-3" />
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        )}

        {/* ════════════════════════════════════════════════════════════════════════════
            VIEW 5: DETAILED LEAD LOG
            ════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "log" && (
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Granular Ricochet Lead Transfer Records ({filteredRecords.length})
                </CardTitle>
              </div>

              {/* Search & Date Filters */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
                >
                  <option value="all">All Dates ({data.dates.length} days)</option>
                  {data.dates.map(d => (
                    <option key={d} value={d}>{formatDisplayDate(d)}</option>
                  ))}
                </select>

                <div className="relative min-w-[220px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search customer, agent, TM..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Telemarketer (TM)</th>
                    <th className="py-3 px-3">Agent (LIA)</th>
                    <th className="py-3 px-3">Customer / Lead</th>
                    <th className="py-3 px-3 text-center">Attempt</th>
                    <th className="py-3 px-4">Slack Message Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((r, i) => (
                    <tr key={r.id || i} className={i % 2 === 0 ? "bg-white hover:bg-slate-50/80" : "bg-slate-50/40 hover:bg-slate-50"}>
                      <td className="py-2.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                        {formatDisplayDate(r.date)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-indigo-700 whitespace-nowrap">
                        {r.tm}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {r.lia}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                        {r.leadName || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {r.tryCount > 1 ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-bold text-[10px] px-1.5 py-0">
                            {r.tryCount}nd Try
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold text-[10px] px-1.5 py-0">
                            1st Try
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px] max-w-[450px] truncate" title={r.message}>
                        {r.message}
                      </td>
                    </tr>
                  ))}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                        No transfer records match your current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

      </div>
    </PageGuard>
  )
}
