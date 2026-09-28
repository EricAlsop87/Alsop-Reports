"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/Button"
import { AlertCircle, X, Save, RotateCcw, CalendarDays } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

interface LeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  onSuccess: () => void;
}

// ── Compact Stepper Component (same as EAgentModal) ──
function Stepper({ 
  value, 
  onChange, 
  rowIndex, 
  colKey, 
  isDirty 
}: { 
  value: number; 
  onChange: (v: number) => void; 
  rowIndex?: number; 
  colKey?: string; 
  isDirty?: boolean;
}) {
  const set = (v: number) => onChange(Math.max(0, v))

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (colKey === undefined || rowIndex === undefined) return;
    
    if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      const nextRow = document.querySelector(`input[data-col="${colKey}"][data-row="${rowIndex + 1}"]`) as HTMLInputElement;
      if (nextRow) nextRow.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevRow = document.querySelector(`input[data-col="${colKey}"][data-row="${rowIndex - 1}"]`) as HTMLInputElement;
      if (prevRow) prevRow.focus();
    }
  }

  return (
    <div className="flex items-center gap-[2px]">
      <button
        onClick={() => set(value - 5)}
        className="w-7 h-7 rounded-l-md bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-bold transition-colors border border-rose-200 active:scale-95"
        tabIndex={-1}
      >-5</button>
      <button
        onClick={() => set(value - 1)}
        className="w-6 h-7 bg-white hover:bg-rose-50 text-rose-500 text-xs font-bold transition-colors border-y border-rose-200 active:scale-95"
        tabIndex={-1}
      >−</button>
      <input
        type="number"
        min={0}
        value={value}
        data-col={colKey}
        data-row={rowIndex}
        onFocus={(e) => e.target.select()}
        onKeyDown={handleKeyDown}
        onChange={(e) => set(parseInt(e.target.value) || 0)}
        className={`w-10 h-7 border-y border-x text-center text-sm font-mono outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all ${
          isDirty 
            ? "bg-blue-100 border-2 border-blue-500 text-blue-900 font-bold shadow-sm ring-1 ring-blue-500 focus:ring-2" 
            : "bg-white border-slate-200 text-slate-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        }`}
      />
      <button
        onClick={() => set(value + 1)}
        className="w-6 h-7 bg-white hover:bg-emerald-50 text-emerald-500 text-xs font-bold transition-colors border-y border-emerald-200 active:scale-95"
        tabIndex={-1}
      >+</button>
      <button
        onClick={() => set(value + 5)}
        className="w-7 h-7 rounded-r-md bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-[10px] font-bold transition-colors border border-emerald-200 active:scale-95"
        tabIndex={-1}
      >+5</button>
    </div>
  )
}

interface LeadEntry {
  contact: number
  quoted: number
  hot: number
  xsale: number
}

export function LeadsModal({ isOpen, onClose, dateStr, onSuccess }: LeadsModalProps) {
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])
  const [selectedDate, setSelectedDate] = useState(dateStr)
  
  // Form state: agent_id -> { contact, quoted, hot, xsale }
  const [formData, setFormData] = useState<Record<string, LeadEntry>>({})
  const baselineRef = useRef<Record<string, LeadEntry>>({})

  // Reset selectedDate when the modal opens with a new dateStr
  useEffect(() => {
    if (isOpen) setSelectedDate(dateStr)
  }, [isOpen, dateStr])

  // Load agents and existing leads data when opened or date changes
  useEffect(() => {
    if (!isOpen) return
    setInitialLoading(true)
    setError(null)

    async function loadData() {
      try {
        // 1. Load active, report-visible agents (excluding CSR agents)
        const { data: agentsData, error: agentsErr } = await supabase
          .from("agents")
          .select("id, name, team, report_visible")
          .eq("active", true)
          .eq("report_visible", true)
          .order("name")

        if (agentsErr) throw agentsErr

        const agentList = (agentsData || [])
          .filter(a => a.team?.trim().toUpperCase() !== "CSR")
          .map(a => ({ id: a.id, name: a.name }))
        setAgents(agentList)

        // 2. Load existing leads_snapshot for this date
        const { data: existingLeads } = await supabase
          .from("leads_snapshot")
          .select("agent_id, contact, quoted, hot, xsale")
          .eq("report_date", selectedDate)

        // Build form state
        const initial: Record<string, LeadEntry> = {}
        for (const a of agentList) {
          const existing = existingLeads?.find(l => l.agent_id === a.id)
          initial[a.id] = {
            contact: existing?.contact || 0,
            quoted: existing?.quoted || 0,
            hot: existing?.hot || 0,
            xsale: existing?.xsale || 0,
          }
        }
        setFormData(initial)
        baselineRef.current = JSON.parse(JSON.stringify(initial))
      } catch (err: any) {
        setError(err.message || "Failed to load data")
      } finally {
        setInitialLoading(false)
      }
    }

    loadData()
  }, [isOpen, selectedDate])

  const updateField = useCallback((agentId: string, field: keyof LeadEntry, value: number) => {
    setFormData(prev => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        [field]: value
      }
    }))
  }, [])

  const resetAll = useCallback(() => {
    if (!window.confirm("Are you sure you want to reset ALL agents to 0? This cannot be undone.")) return;
    setFormData(prev => {
      const reset: Record<string, LeadEntry> = {}
      for (const id of Object.keys(prev)) {
        reset[id] = { contact: 0, quoted: 0, hot: 0, xsale: 0 }
      }
      return reset
    })
  }, [])

  const checkUnsavedAndClose = () => {
    let hasUnsaved = false;
    for (const [agentId, currentRow] of Object.entries(formData)) {
      const baselineRow = baselineRef.current[agentId]
      if (!baselineRow) continue;
      const keys: (keyof LeadEntry)[] = ["contact", "quoted", "hot", "xsale"];
      for (const key of keys) {
        if (currentRow[key] !== baselineRow[key]) {
          hasUnsaved = true;
          break;
        }
      }
      if (hasUnsaved) break;
    }
    
    if (hasUnsaved) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to close and discard them?")) return;
    }
    onClose();
  }

  if (!isOpen) return null

  const handleSave = async () => {
    setLoading(true)
    setError(null)

    try {
      // Build upsert payloads only for rows that actually changed
      const rows = Object.entries(formData).filter(([agentId, data]) => {
        const base = baselineRef.current[agentId]
        if (!base) return true
        return base.contact !== data.contact || base.quoted !== data.quoted || base.hot !== data.hot || base.xsale !== data.xsale
      }).map(([agentId, data]) => ({
        agent_id: agentId,
        report_date: selectedDate,
        contact: data.contact,
        quoted: data.quoted,
        hot: data.hot,
        xsale: data.xsale,
      }))

      if (rows.length === 0) {
        setLoading(false)
        onSuccess()
        onClose()
        return
      }

      // Upsert to leads_snapshot (conflict on agent_id + report_date)
      const { error: upsertErr } = await supabase
        .from("leads_snapshot")
        .upsert(rows, { onConflict: "agent_id,report_date" })

      if (upsertErr) throw upsertErr

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to save leads data")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 gap-8">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Lead Pipeline Entry
              <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{selectedDate}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Enter DeerDama lead counts per agent</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={resetAll}
              title="Reset all to 0"
              className="text-slate-500 hover:text-amber-500 transition-colors p-1"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={checkUnsavedAndClose} className="text-slate-500 hover:text-slate-900 transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-xs flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </div>
        )}

        {/* Body — compact table */}
        <div className="flex-grow overflow-y-auto px-2 py-1">
          {initialLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-5 w-5 border-2 border-slate-300 border-t-blue-500 rounded-full" />
              <span className="ml-3 text-sm text-slate-500">Loading agents...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b-2 border-slate-300 bg-slate-50/50">
                  <th className="py-2 px-3 text-[11px] uppercase tracking-wider text-slate-600 font-bold border-r-2 border-slate-300">Agent</th>
                  <th className="py-2 px-1 text-[11px] uppercase tracking-wider text-blue-700 font-bold text-center border-r border-slate-200/80">Contacted</th>
                  <th className="py-2 px-1 text-[11px] uppercase tracking-wider text-violet-700 font-bold text-center border-r border-slate-200/80">Quoted</th>
                  <th className="py-2 px-1 text-[11px] uppercase tracking-wider text-orange-700 font-bold text-center border-r border-slate-200/80">Hot</th>
                  <th className="py-2 px-1 text-[11px] uppercase tracking-wider text-cyan-700 font-bold text-center">XDate</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, index) => {
                  const d = formData[agent.id]
                  if (!d) return null
                  const hasData = d.contact > 0 || d.quoted > 0 || d.hot > 0 || d.xsale > 0
                  const rowBg = index % 2 !== 0 ? "bg-slate-200/40" : "bg-white"
                  return (
                    <tr 
                      key={agent.id} 
                      className={`border-b border-slate-300 transition-colors ${rowBg} hover:bg-indigo-100/65`}
                    >
                      <td className="py-2 px-3 border-r-2 border-slate-300">
                        <span className={`text-sm font-semibold ${hasData ? "text-slate-900" : "text-slate-500"}`}>{agent.name}</span>
                      </td>
                      <td className="py-2 px-1 border-r border-slate-200/80">
                        <div className="flex justify-center">
                          <Stepper 
                            value={d.contact}
                            onChange={(v) => updateField(agent.id, "contact", v)}
                            rowIndex={index}
                            colKey="contact"
                            isDirty={baselineRef.current[agent.id]?.contact !== d.contact}
                          />
                        </div>
                      </td>
                      <td className="py-2 px-1 border-r border-slate-200/80">
                        <div className="flex justify-center">
                          <Stepper 
                            value={d.quoted}
                            onChange={(v) => updateField(agent.id, "quoted", v)}
                            rowIndex={index}
                            colKey="quoted"
                            isDirty={baselineRef.current[agent.id]?.quoted !== d.quoted}
                          />
                        </div>
                      </td>
                      <td className="py-2 px-1 border-r border-slate-200/80">
                        <div className="flex justify-center">
                          <Stepper 
                            value={d.hot}
                            onChange={(v) => updateField(agent.id, "hot", v)}
                            rowIndex={index}
                            colKey="hot"
                            isDirty={baselineRef.current[agent.id]?.hot !== d.hot}
                          />
                        </div>
                      </td>
                      <td className="py-2 px-1">
                        <div className="flex justify-center">
                          <Stepper 
                            value={d.xsale}
                            onChange={(v) => updateField(agent.id, "xsale", v)}
                            rowIndex={index}
                            colKey="xsale"
                            isDirty={baselineRef.current[agent.id]?.xsale !== d.xsale}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
          <Button variant="outline" onClick={checkUnsavedAndClose} disabled={loading} className="text-slate-600 border-slate-300 hover:bg-slate-200 text-xs px-3 py-1.5">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || initialLoading} className="bg-orange-600 hover:bg-orange-500 text-white flex items-center gap-2 text-xs px-4 py-1.5">
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin h-3.5 w-3.5 border-2 border-white/20 border-t-white rounded-full" />
                Saving...
              </span>
            ) : (
              <><Save className="w-3.5 h-3.5" /> Save Lead Data</>
            )}
          </Button>
        </div>

      </div>
    </div>
  )
}
