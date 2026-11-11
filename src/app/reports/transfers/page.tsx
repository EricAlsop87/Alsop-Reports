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
  Clock
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

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>("all")
  const [selectedTm, setSelectedTm] = useState<string>("all")
  const [selectedAgent, setSelectedAgent] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"matrix" | "telemarketers" | "agents" | "log">("matrix")

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getTransfersData()
      setData(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered Records
  const filteredRecords = useMemo(() => {
    if (!data) return []
    return data.records.filter(r => {
      if (selectedDate !== "all" && r.date !== selectedDate) return false
      if (selectedTm !== "all" && r.tm !== selectedTm) return false
      if (selectedAgent !== "all" && r.lia !== selectedAgent) return false
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
  }, [data, selectedDate, selectedTm, selectedAgent, searchQuery])

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
      return { agent, tms, total: rowTotal }
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
              Live transfer analytics from daily Slack reports. Track telemarketer output, agent receipt volume, and group balance.
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

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Transfers</p>
                <p className="text-2xl font-black text-slate-900 mt-0.5">{data.totalTransfers}</p>
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Across {data.dates.length} report days
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <PhoneForwarded className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Daily Average</p>
                <p className="text-2xl font-black text-slate-900 mt-0.5">{data.avgPerDay}</p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Leads transferred / day</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <TrendingUp className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Top Telemarketer</p>
                <p className="text-lg font-black text-slate-900 mt-0.5 truncate max-w-[140px]">{data.topTm.name}</p>
                <p className="text-[11px] text-indigo-600 font-medium mt-0.5">{data.topTm.count} leads sent</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Headphones className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Top Agent Recipient</p>
                <p className="text-lg font-black text-slate-900 mt-0.5 truncate max-w-[140px]">{data.topAgent.name}</p>
                <p className="text-[11px] text-blue-600 font-medium mt-0.5">{data.topAgent.count} leads received</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <UserCheck className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">2nd / 3rd Try Rate</p>
                <p className="text-2xl font-black text-slate-900 mt-0.5">{data.multitryRate}%</p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Required multiple attempts</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Repeat className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Day of Week Volume Pattern */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Daily Volume & Day-of-the-Week Transfer Rhythm
            </CardTitle>
            <CardDescription className="text-xs">
              Understand which days produce the heaviest lead flow to staff accordingly.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
              {data.dates.map(date => {
                const count = data.byDate[date] || 0
                const [y, m, d] = date.split("-").map(Number)
                const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(y, m - 1, d).getDay()]
                const isSelected = selectedDate === date
                const isMax = count === Math.max(...Object.values(data.byDate))

                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(isSelected ? "all" : date)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected 
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : isMax
                        ? "bg-indigo-50/60 border-indigo-200 hover:border-indigo-300"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${isSelected ? "text-indigo-100" : "text-slate-500"}`}>
                        {dayName}
                      </span>
                      {isMax && !isSelected && (
                        <span className="text-[10px] font-bold text-indigo-600 bg-white px-1.5 py-0.2 rounded-full border border-indigo-200">
                          Peak
                        </span>
                      )}
                    </div>
                    <div className="text-lg font-black mt-1">
                      {count} <span className={`text-xs font-medium ${isSelected ? "text-indigo-100" : "text-slate-500"}`}>leads</span>
                    </div>
                    <div className={`text-[11px] font-medium mt-0.5 ${isSelected ? "text-indigo-200" : "text-slate-400"}`}>
                      {formatDisplayDate(date)}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Navigation Tabs & Active Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setActiveTab("matrix")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "matrix" 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Routing Heatmap Matrix
            </button>
            <button
              onClick={() => setActiveTab("telemarketers")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "telemarketers" 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              Telemarketers
            </button>
            <button
              onClick={() => setActiveTab("agents")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "agents" 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Agents (LIAs)
            </button>
            <button
              onClick={() => setActiveTab("log")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "log" 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Detailed Lead Log ({filteredRecords.length})
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100 focus:outline-none"
            >
              <option value="all">All Dates ({data.dates.length} days)</option>
              {data.dates.map(d => (
                <option key={d} value={d}>{formatDisplayDate(d)} ({data.byDate[d]} leads)</option>
              ))}
            </select>

            <select
              value={selectedTm}
              onChange={e => setSelectedTm(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100 focus:outline-none"
            >
              <option value="all">All Telemarketers ({data.telemarketers.length})</option>
              {data.telemarketers.map(tm => (
                <option key={tm} value={tm}>{tm} ({data.byTm[tm]} total)</option>
              ))}
            </select>

            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100 focus:outline-none"
            >
              <option value="all">All Agents ({data.agents.length})</option>
              {data.agents.map(a => (
                <option key={a} value={a}>{a} ({data.byAgent[a]} total)</option>
              ))}
            </select>

            {(selectedDate !== "all" || selectedTm !== "all" || selectedAgent !== "all") && (
              <button
                onClick={() => {
                  setSelectedDate("all")
                  setSelectedTm("all")
                  setSelectedAgent("all")
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: ROUTING MATRIX (JOHN PAUL DIZON'S CORE MEETING REQUEST) */}
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
                    Analyzes lead distribution across groups to verify if telemarketers (like Shireen, Sophia, Jovelyn, Mark) are feeding balanced numbers to agent teams.
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
                    <th className="py-3 px-4 sticky left-0 bg-slate-50/95 z-10 border-r border-slate-200 min-w-[180px]">
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
                  {matrixData.rows.map(({ agent, tms, total }, idx) => (
                    <tr key={agent} className={idx % 2 === 0 ? "bg-white hover:bg-slate-50/80" : "bg-slate-50/40 hover:bg-slate-50"}>
                      <td className="py-2.5 px-4 font-bold text-slate-800 sticky left-0 bg-inherit z-10 border-r border-slate-200 flex items-center justify-between">
                        <span>{agent}</span>
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

        {/* TAB 2: TELEMARKETERS PRODUCTION */}
        {activeTab === "telemarketers" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.telemarketers.map(tm => {
              const tmRecords = data.records.filter(r => r.tm === tm)
              const count = tmRecords.length
              const percent = Math.round((count / data.totalTransfers) * 100)

              // Agent breakdown for this TM
              const agentCounts: Record<string, number> = {}
              tmRecords.forEach(r => {
                agentCounts[r.lia] = (agentCounts[r.lia] || 0) + 1
              })
              const topAgentsForTm = Object.entries(agentCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)

              return (
                <Card key={tm} className="bg-white border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
                  <div>
                    <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                          <Headphones className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold text-slate-900">{tm}</CardTitle>
                          <span className="text-xs text-slate-400">Telemarketer</span>
                        </div>
                      </div>
                      <Badge className="bg-indigo-600 text-white font-black text-xs">
                        {count} Leads
                      </Badge>
                    </CardHeader>

                    <CardContent className="p-5 space-y-4">
                      {/* Percent of total */}
                      <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                          <span>Agency Share</span>
                          <span>{percent}% of all leads</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Top Agent Recipients for this TM */}
                      <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Primary Receiving Agents
                        </p>
                        <div className="space-y-1.5">
                          {topAgentsForTm.map(([agent, cnt]) => (
                            <div key={agent} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="font-semibold text-slate-700">{agent}</span>
                              <Badge variant="outline" className="font-bold text-indigo-700 bg-white border-indigo-200">
                                {cnt} leads
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </div>

                  <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                    <button
                      onClick={() => {
                        setSelectedTm(tm)
                        setActiveTab("log")
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1"
                    >
                      View all {count} transfers <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* TAB 3: AGENTS (LIAs) VIEW */}
        {activeTab === "agents" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(data.byAgent)
              .sort((a, b) => b[1] - a[1])
              .map(([agent, count], rank) => {
                const agentRecords = data.records.filter(r => r.lia === agent)
                const multiTry = agentRecords.filter(r => r.tryCount > 1).length
                
                // Which TM fed this agent most
                const tmCounts: Record<string, number> = {}
                agentRecords.forEach(r => {
                  tmCounts[r.tm] = (tmCounts[r.tm] || 0) + 1
                })
                const topTmForAgent = Object.entries(tmCounts).sort((a, b) => b[1] - a[1])[0]

                return (
                  <Card key={agent} className="bg-white border-slate-200 shadow-sm p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                        rank === 0 ? "bg-amber-100 text-amber-800" :
                        rank === 1 ? "bg-slate-200 text-slate-800" :
                        rank === 2 ? "bg-amber-700/20 text-amber-900" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        #{rank + 1}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900">{agent}</p>
                        <p className="text-[11px] text-slate-500">
                          Main feeder: <span className="font-semibold text-indigo-600">{topTmForAgent ? topTmForAgent[0] : "None"}</span> ({topTmForAgent ? topTmForAgent[1] : 0})
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-black text-slate-900">{count}</p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {multiTry > 0 ? `${multiTry} on 2nd try` : "All 1st try"}
                      </p>
                    </div>
                  </Card>
                )
              })}
          </div>
        )}

        {/* TAB 4: DETAILED LEAD LOG */}
        {activeTab === "log" && (
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Granular Ricochet Lead Transfer Records ({filteredRecords.length})
                </CardTitle>
              </div>

              {/* Search box */}
              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer, message, agent..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
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
