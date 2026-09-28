"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { saveWeeklyPartialData } from "@/app/reports/weekly/actions"
import { Button } from "@/components/ui/Button"
import { AlertCircle, X, Save, RotateCcw, Sparkles, Camera, Info } from "lucide-react"

interface WeeklyManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekStartStr: string;
  weekLabel: string;
  agents: any[];
  onSuccess: () => void;
  autoSums?: Record<string, ManualRow>;
  manualSubmitted: boolean;
  eagentComplete?: boolean;
}

// Fields that are snapshots and should NOT be auto-summed (but still pre-populated from latest snapshot)
const SNAPSHOT_FIELDS: (keyof ManualRow)[] = ["unique_leads", "rico_hot_pipeline", "past_due_todos", "rico_past_due_tasks"]
// Fields not available in daily data
const MANUAL_ONLY_FIELDS: (keyof ManualRow)[] = ["saved"]
const AUTO_FIELDS: (keyof ManualRow)[] = ["pivot", "dismissed_todos"]

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
        className={`w-10 h-5 rounded-md text-center text-xs font-mono outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all ${
          isDirty 
            ? "bg-blue-100 border-2 border-blue-500 text-blue-900 font-bold shadow-sm ring-1 ring-blue-500 focus:ring-2" 
            : "bg-white border border-slate-200 text-slate-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        }`}
      />
    </div>
  )
}

interface ManualRow {
  unique_leads: number
  rico_hot_pipeline: number
  pivot: number
  saved: number
  dismissed_todos: number
  past_due_todos: number
  rico_past_due_tasks: number
}

const EMPTY_ROW: ManualRow = {
  unique_leads: 0,
  rico_hot_pipeline: 0,
  pivot: 0,
  saved: 0,
  dismissed_todos: 0,
  past_due_todos: 0,
  rico_past_due_tasks: 0,
}

type FieldConfigItem = {
  key: keyof ManualRow
  label: string
  short: string
  color: string
  auto: boolean
  dividerLeft: boolean
  website: string
}

const FIELD_CONFIG: FieldConfigItem[] = [
  { key: "unique_leads", label: "Unique Leads", short: "Leads", color: "text-blue-600", auto: false, dividerLeft: false, website: "Ricochet" },
  { key: "rico_hot_pipeline", label: "Rico Hot", short: "Hot", color: "text-orange-600", auto: false, dividerLeft: false, website: "Ricochet" },
  { key: "rico_past_due_tasks", label: "Rico PD", short: "RPD", color: "text-amber-600", auto: false, dividerLeft: false, website: "Ricochet" },
  { key: "pivot", label: "#PIVOT", short: "Pivot", color: "text-cyan-600", auto: true, dividerLeft: true, website: "eAgent" },
  { key: "saved", label: "#SAVED", short: "Saved", color: "text-emerald-600", auto: false, dividerLeft: false, website: "eAgent" },
  { key: "dismissed_todos", label: "Dismissed", short: "Dism", color: "text-violet-600", auto: true, dividerLeft: true, website: "eAgent" },
  { key: "past_due_todos", label: "Past Due", short: "PD", color: "text-rose-600", auto: false, dividerLeft: false, website: "eAgent" },
]

// Tab definitions
const VA_FIELD_KEYS: (keyof ManualRow)[] = ["unique_leads", "rico_hot_pipeline"]
const MANAGER_FIELD_KEYS: (keyof ManualRow)[] = ["rico_past_due_tasks", "pivot", "saved", "dismissed_todos", "past_due_todos"]

const VA_FIELDS = FIELD_CONFIG.filter(f => VA_FIELD_KEYS.includes(f.key))
const MANAGER_FIELDS = FIELD_CONFIG.filter(f => MANAGER_FIELD_KEYS.includes(f.key))

type TabType = "va" | "manager"

export function WeeklyManualModal({ isOpen, onClose, weekStartStr, weekLabel, agents, onSuccess, autoSums, manualSubmitted, eagentComplete = false }: WeeklyManualModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, ManualRow>>({})
  const [showService, setShowService] = useState(false)
  const [activeColumn, setActiveColumn] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>("va")

  // Baseline snapshot for diffing — captured when the modal opens
  const baselineRef = useRef<Record<string, ManualRow>>({})

  const sortedAgents = [...agents].sort((a, b) =>
    (a.agents?.name || "").localeCompare(b.agents?.name || "")
  )

  const filteredAgents = sortedAgents.filter(a => {
    if (showService) return true;
    const team = a.agents?.team || "";
    return team !== "Service" && team !== "CSR";
  })

  // Initialize form data when opened — pre-populate from auto-sums if no manual data exists
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, ManualRow> = {}
      agents.forEach(a => {
        const existingManual = {
          unique_leads: a.unique_leads || 0,
          rico_hot_pipeline: a.rico_hot_pipeline || 0,
          pivot: a.pivot || 0,
          saved: a.saved || 0,
          dismissed_todos: a.w_dismissed_todos || 0,
          past_due_todos: a.w_past_due_todos || 0,
          rico_past_due_tasks: a.rico_past_due_tasks || 0,
        }
        const agentAutoSums = autoSums?.[a.agent_id]

        if (manualSubmitted) {
          // If already submitted, use existing saved data
          initial[a.agent_id] = existingManual
        } else {
          // Pre-populate ONLY the auto-summed fields, snapshots and manual fields are 0
          initial[a.agent_id] = {
            unique_leads: 0,
            rico_hot_pipeline: 0,
            pivot: agentAutoSums?.pivot || 0,
            saved: 0,
            dismissed_todos: agentAutoSums?.dismissed_todos || 0,
            past_due_todos: 0,
            rico_past_due_tasks: 0,
          }
        }
      })
      setFormData(initial)
      // Store baseline for diffing
      baselineRef.current = JSON.parse(JSON.stringify(initial))
      setError(null)
      setSuccessMsg(null)
    }
  }, [isOpen, agents, autoSums, manualSubmitted])

  const updateField = useCallback((agentId: string, field: keyof ManualRow, value: number) => {
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
    const reset: Record<string, ManualRow> = {}
    agents.forEach(a => {
      reset[a.agent_id] = { ...EMPTY_ROW }
    })
    setFormData(reset)
  }, [agents])

  const checkUnsavedAndClose = () => {
    // Check if ANY field in ANY agent is different from baseline
    let hasUnsaved = false;
    for (const [agentId, currentRow] of Object.entries(formData)) {
      const baselineRow = baselineRef.current[agentId]
      if (!baselineRow) continue;
      // check all fields
      for (const key of Object.keys(EMPTY_ROW) as (keyof ManualRow)[]) {
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

  // Get the active tab's fields
  const activeFields = activeTab === "va" ? VA_FIELDS : MANAGER_FIELDS
  const activeFieldKeys = activeTab === "va" ? VA_FIELD_KEYS : MANAGER_FIELD_KEYS

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    // Diff: only send fields that changed from baseline, scoped to the active tab
    const updates: { agent_id: string; [field: string]: number | string }[] = []

    for (const [agentId, currentRow] of Object.entries(formData)) {
      const baselineRow = baselineRef.current[agentId]
      if (!baselineRow) continue

      const changedFields: Record<string, number> = {}
      for (const key of activeFieldKeys) {
        if (currentRow[key] !== baselineRow[key]) {
          changedFields[key] = currentRow[key]
        }
      }

      if (Object.keys(changedFields).length > 0) {
        updates.push({ agent_id: agentId, ...changedFields })
      }
    }

    if (updates.length === 0) {
      setLoading(false)
      setSuccessMsg("No changes detected — nothing to save.")
      setTimeout(() => setSuccessMsg(null), 3000)
      return
    }

    try {
      const result = await saveWeeklyPartialData(weekStartStr, updates)

      setLoading(false)
      if (result.success) {
        // Update the baseline to reflect the newly saved state
        baselineRef.current = JSON.parse(JSON.stringify(formData))
        const count = result.changed ?? updates.length
        setSuccessMsg(`Saved! ${count} agent${count !== 1 ? "s" : ""} updated.`)
        setTimeout(() => setSuccessMsg(null), 3000)
        onSuccess()
      } else {
        setError(result.error || "Failed to save data.")
      }
    } catch (err: any) {
      setLoading(false)
      setError(err?.message || "Network error — please try again.")
    }
  }

  const saveButtonLabel = activeTab === "va" ? "Save Ricochet Data" : "Save Manager Data"
  const modalWidthClass = activeTab === "va" ? "max-w-[540px]" : "max-w-[850px]"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`bg-white border border-slate-200 rounded-xl shadow-2xl w-full ${modalWidthClass} transition-all duration-300 ease-in-out flex flex-col max-h-[90vh]`}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Weekly Manual Entry</h2>
            <p className="text-[11px] text-slate-500">{weekLabel} • Auto-populated from daily data — review & adjust</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetAll}
              title="Reset all to 0"
              className="text-slate-500 hover:text-amber-400 transition-colors p-1"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={checkUnsavedAndClose} className="text-slate-500 hover:text-slate-900 transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher & Controls */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setActiveTab("va"); setActiveColumn(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "va"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Ricochet (VA)
            </button>
            <button
              onClick={() => { setActiveTab("manager"); setActiveColumn(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "manager"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Manager
            </button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer group">
            <span className="text-slate-600 text-[10px] font-medium group-hover:text-slate-900 transition-colors">Show CSR</span>
            <div className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={showService} onChange={(e) => setShowService(e.target.checked)} />
              <div className="w-7 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
            </div>
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-xs flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </div>
        )}

        {/* Success */}
        {successMsg && (
          <div className="mx-4 mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-700 text-xs flex items-center gap-2">
            <Save className="w-3.5 h-3.5" /> {successMsg}
          </div>
        )}

        {/* Body — compact table */}
        <div className="flex-grow overflow-y-auto overflow-x-auto px-2 py-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-slate-200">
                <th className="py-1 px-4 text-[9px] uppercase tracking-wider text-slate-500 font-semibold whitespace-nowrap">Agent</th>
                {activeFields.map(f => (
                  <th 
                    key={f.key} 
                    onClick={() => setActiveColumn(activeColumn === f.key ? null : f.key)}
                    className={`py-1 px-1 text-[9px] uppercase tracking-wider ${f.color} font-semibold text-center whitespace-nowrap cursor-pointer hover:bg-slate-50 transition-colors${f.dividerLeft ? ' border-l-2 border-slate-400' : ''} ${activeColumn === f.key ? 'bg-blue-100' : ''}`}
                  >
                    <span className="flex flex-col items-center justify-center gap-0 pointer-events-none">
                      <span className="text-[8px] text-slate-400 font-medium leading-none">{f.website}</span>
                      <span className="flex items-center justify-center gap-1">
                        {f.label}
                        {f.auto ? (
                          <span title="Auto-populated from daily data"><Sparkles className="w-2.5 h-2.5 text-amber-400" /></span>
                        ) : SNAPSHOT_FIELDS.includes(f.key) ? (
                          <span title="Snapshot — manual entry"><Camera className="w-2.5 h-2.5 text-slate-400" /></span>
                        ) : null}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map((agent, index) => {
                const d = formData[agent.agent_id]
                if (!d) return null
                const rowBg = index % 2 !== 0 ? "bg-slate-100" : "bg-white"
                return (
                  <tr
                    key={agent.agent_id}
                    className={`border-b border-slate-200 transition-colors ${rowBg} hover:bg-slate-200`}
                  >
                    <td className="py-0.5 px-4">
                      <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{agent.agents?.name}</span>
                    </td>
                    {activeFields.map(f => (
                      <td key={f.key} className={`py-0.5 px-1${f.dividerLeft ? ' border-l-2 border-slate-400' : ''} ${activeColumn === f.key ? 'bg-blue-100' : ''}`}>
                        <div className="flex justify-center">
                          <Stepper
                            value={d[f.key]}
                            onChange={(v) => updateField(agent.agent_id, f.key, v)}
                            rowIndex={index}
                            colKey={f.key}
                            isDirty={baselineRef.current[agent.agent_id]?.[f.key] !== d[f.key]}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info note */}
        <div className="px-4 py-1.5 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-start gap-2 text-[10px] text-slate-500 leading-relaxed">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>
                Data entry is split into two sections — <strong className="text-slate-700">Ricochet</strong> (for VAs) and <strong className="text-slate-700">Manager</strong>. 
                Each section saves independently, so your work won't be overwritten if someone else is entering data at the same time. 
                Only the numbers you change will be updated.
              </p>
              <p className="mt-1 text-slate-400">
                <span className="inline-flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5 text-amber-400" /> Auto-calculated from daily reports</span>
                <span className="mx-2">•</span>
                <span className="inline-flex items-center gap-0.5"><Camera className="w-2.5 h-2.5 text-slate-400" /> Manual weekly snapshot</span>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
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
              <><Save className="w-3.5 h-3.5" /> {saveButtonLabel}</>
            )}
          </Button>
        </div>

      </div>
    </div>
  )
}
