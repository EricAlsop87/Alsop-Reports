"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { saveEAgentData } from "@/app/reports/daily/actions"
import { Button } from "@/components/ui/Button"
import { AlertCircle, X, Save, RotateCcw } from "lucide-react"

interface EAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  agents: any[]; // List of active agents for the date
  onSuccess: () => void;
}

// ── Compact Stepper Component ──
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
    <div className="flex items-center">
      <input
        type="number"
        min={0}
        value={value}
        data-col={colKey}
        data-row={rowIndex}
        onFocus={(e) => e.target.select()}
        onKeyDown={handleKeyDown}
        onChange={(e) => set(parseInt(e.target.value) || 0)}
        className={`w-12 h-5 rounded-md text-center text-sm font-mono outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all ${
          isDirty 
            ? "bg-blue-100 border-2 border-blue-500 text-blue-900 font-bold shadow-sm ring-1 ring-blue-500 focus:ring-2" 
            : "bg-white border border-slate-200 text-slate-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        }`}
      />
    </div>
  )
}

export function EAgentModal({ isOpen, onClose, dateStr, agents, onSuccess }: EAgentModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state: agent_id -> { pivots }
  const [formData, setFormData] = useState<Record<string, { pivots: number }>>({})
  const baselineRef = useRef<Record<string, { pivots: number }>>({})

  const [showSales, setShowSales] = useState(false)

  // Sorted agents alphabetically
  const sortedAgents = [...agents].sort((a, b) => 
    (a.agents?.name || "").localeCompare(b.agents?.name || "")
  )

  const filteredAgents = sortedAgents.filter(a => 
    showSales || (a.agents?.team !== "Sales" && a.agents?.team !== "EA")
  )

  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, { pivots: number }> = {}
      agents.forEach(a => {
        initial[a.agent_id] = {
          pivots: a.pivots || 0
        }
      })
      setFormData(initial)
      baselineRef.current = JSON.parse(JSON.stringify(initial))
      setError(null)
      setShowSales(false) // Reset to default on open
    }
  }, [isOpen, agents])

  const updateField = useCallback((agentId: string, field: "pivots", value: number) => {
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
    const reset: Record<string, { pivots: number }> = {}
    agents.forEach(a => {
      reset[a.agent_id] = { pivots: 0 }
    })
    setFormData(reset)
  }, [agents])

  const checkUnsavedAndClose = () => {
    let hasUnsaved = false;
    for (const [agentId, currentRow] of Object.entries(formData)) {
      const baselineRow = baselineRef.current[agentId]
      if (!baselineRow) continue;
      if (currentRow.pivots !== baselineRow.pivots) {
        hasUnsaved = true;
        break;
      }
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

    // Only send rows that were changed
    const updates = Object.keys(formData)
      .filter(agentId => {
        const base = baselineRef.current[agentId]
        return !base || base.pivots !== formData[agentId].pivots
      })
      .map(agentId => ({
        agent_id: agentId,
        pivots: formData[agentId].pivots
      }))

    if (updates.length === 0) {
      setLoading(false)
      onSuccess()
      onClose()
      return
    }

    const result = await saveEAgentData(dateStr, updates)
    
    setLoading(false)
    if (result.success) {
      onSuccess()
      onClose()
    } else {
      setError(result.error || "Failed to save data.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-max max-w-[95vw] flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 gap-8">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              eAgent Entry
              <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{dateStr}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Use steppers or type directly</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer group">
              <span className="text-[11px] text-slate-500 font-medium group-hover:text-slate-900 transition-colors uppercase tracking-wide">Show Sales</span>
              <div className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={showSales} onChange={(e) => setShowSales(e.target.checked)} />
                <div className="w-7 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
              </div>
            </label>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
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
        <div className="flex-grow overflow-y-auto px-2 py-2">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b-2 border-slate-300 bg-slate-50/50">
                <th className="py-1 px-3 text-[11px] uppercase tracking-wider text-slate-600 font-bold border-r-2 border-slate-300">Agent</th>
                <th className="py-1 px-1 text-[11px] uppercase tracking-wider text-cyan-700 font-bold text-center">
                  <div className="flex flex-col items-center">
                    <span>Pivots</span>
                    <span className="text-[9px] text-slate-400 font-medium">eAgent</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map((agent, index) => {
                const d = formData[agent.agent_id]
                if (!d) return null
                const hasData = d.pivots > 0
                const rowBg = index % 2 !== 0 ? "bg-slate-200/40" : "bg-white"
                return (
                  <tr 
                    key={agent.agent_id} 
                    className={`border-b border-slate-300 transition-colors ${rowBg} hover:bg-indigo-100/65`}
                  >
                    <td className="py-1 px-3 border-r-2 border-slate-300">
                      <span className={`text-sm font-semibold ${hasData ? "text-slate-900" : "text-slate-500"}`}>{agent.agents?.name}</span>
                    </td>
                    <td className="py-1 px-1">
                      <div className="flex justify-center">
                        <Stepper 
                          value={d.pivots}
                          onChange={(v) => updateField(agent.agent_id, "pivots", v)}
                          rowIndex={index}
                          colKey="pivots"
                          isDirty={baselineRef.current[agent.agent_id]?.pivots !== d.pivots}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
          <Button variant="outline" onClick={checkUnsavedAndClose} disabled={loading} className="text-slate-600 border-slate-300 hover:bg-slate-200 text-xs px-3 py-1.5">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 text-xs px-4 py-1.5">
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin h-3.5 w-3.5 border-2 border-white/20 border-t-white rounded-full" />
                Saving...
              </span>
            ) : (
              <><Save className="w-3.5 h-3.5" /> Save eAgent Data</>
            )}
          </Button>
        </div>

      </div>
    </div>
  )
}
