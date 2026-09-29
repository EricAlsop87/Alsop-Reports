"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  getRoleplayModules,
  getAgentRoleplayScores,
  upsertRoleplayScore,
  type RoleplayModule,
  type RoleplayScore,
} from "@/app/reports/agent/roleplay-actions"
import { cn } from "@/lib/utils"
import {
  Trophy, Lock, CheckCircle2, AlertCircle, Plus,
  X, Save, Loader2, BookOpen, Zap, Eye,
} from "lucide-react"

// ── Constants ─────────────────────────────────────────────────────────────────

const TIERS = ["Beginner", "Intermediate", "Advanced"] as const
type Tier = typeof TIERS[number]
const PASS_SCORE = 80

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColorClass(score: number): string {
  if (score >= PASS_SCORE) return "text-emerald-600"
  if (score >= 70) return "text-amber-600"
  return "text-rose-600"
}

function scoreIcon(score: number) {
  if (score >= PASS_SCORE) return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
  return <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00")
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}

type ScoreMap = Record<string, Record<string, RoleplayScore>>
function buildScoreMap(scores: RoleplayScore[]): ScoreMap {
  const map: ScoreMap = {}
  for (const s of scores) {
    if (!map[s.module_id]) map[s.module_id] = {}
    map[s.module_id][s.tier] = s
  }
  return map
}

function isTierUnlocked(
  moduleIndex: number,
  tier: Tier,
  modules: RoleplayModule[],
  scoreMap: ScoreMap
): boolean {
  if (moduleIndex === 0 && tier === "Beginner") return true
  if (tier === "Intermediate") {
    const s = scoreMap[modules[moduleIndex].id]?.["Beginner"]
    return !!s && s.score >= PASS_SCORE
  }
  if (tier === "Advanced") {
    const s = scoreMap[modules[moduleIndex].id]?.["Intermediate"]
    return !!s && s.score >= PASS_SCORE
  }
  if (tier === "Beginner" && moduleIndex > 0) {
    const prevId = modules[moduleIndex - 1].id
    const prev = scoreMap[prevId] ?? {}
    return TIERS.every(t => prev[t] && prev[t].score >= PASS_SCORE)
  }
  return false
}

function isModuleComplete(moduleId: string, scoreMap: ScoreMap): boolean {
  const m = scoreMap[moduleId] ?? {}
  return TIERS.every(t => m[t] && m[t].score >= PASS_SCORE)
}

// ── Score Cell ────────────────────────────────────────────────────────────────

interface ScoreCellProps {
  score: RoleplayScore | undefined
  unlocked: boolean
  canEdit: boolean
  onEnter: () => void
}

function ScoreCell({ score, unlocked, canEdit, onEnter }: ScoreCellProps) {
  if (!unlocked) {
    return <div className="flex items-center justify-center py-2"><Lock className="w-3.5 h-3.5 text-slate-300" /></div>
  }

  if (score) {
    const content = (
      <div className="flex flex-col items-center justify-center gap-0 w-full h-full">
        <div className={cn("text-[13px] font-bold", scoreColorClass(score.score))}>
          {score.score}
        </div>
        <span className="text-[10px] text-slate-400 font-mono">{formatDate(score.completed_at)}</span>
      </div>
    )

    if (!canEdit) return content

    return (
      <button 
        onClick={onEnter}
        className="flex flex-col items-center justify-center gap-0 w-full h-full rounded hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className={cn("text-[13px] font-bold", scoreColorClass(score.score))}>
          {score.score}
        </div>
        <span className="text-[10px] text-slate-400 font-mono">{formatDate(score.completed_at)}</span>
      </button>
    )
  }

  if (!canEdit) {
    return <div className="flex items-center justify-center py-2"><span className="text-[10px] text-slate-400 italic">—</span></div>
  }

  return (
    <div className="flex items-center justify-center w-full h-full">
      <button
        onClick={onEnter}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
      >
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  )
}

// ── Inline Score Form ─────────────────────────────────────────────────────────

interface ScoreFormProps {
  onSave: (score: number, date: string) => Promise<void>
  onCancel: () => void
  saving: boolean
}

function ScoreForm({ onSave, onCancel, saving }: ScoreFormProps) {
  const [score, setScore] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [err, setErr] = useState("")
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  const handleSave = async () => {
    const n = parseInt(score, 10)
    if (isNaN(n) || n < 0 || n > 100) { setErr("Score must be 0–100"); return }
    if (!date) { setErr("Date is required"); return }
    setErr("")
    await onSave(n, date)
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[155px]">
      <div className="flex items-center gap-1">
        <input ref={ref} type="number" min={0} max={100} value={score}
          onChange={e => setScore(e.target.value)} placeholder="Score"
          className="w-14 px-2 py-1 text-xs border border-slate-300 rounded outline-none focus:border-slate-500"
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel() }}
        />
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-32 px-2 py-1 text-xs border border-slate-300 rounded outline-none focus:border-slate-500"
        />
      </div>
      {err && <p className="text-[10px] text-rose-500">{err}</p>}
      <div className="flex gap-1">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center justify-center w-8 h-6 rounded bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-60 cursor-pointer"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        </button>
        <button onClick={onCancel}
          className="flex items-center justify-center w-8 h-6 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface RoleplayTrackerProps {
  agentId: string
  currentAgent: { id: string; role?: string | null; team?: string | null } | null
  isManagerOrAdmin: boolean
}

export function RoleplayTracker({ agentId, currentAgent, isManagerOrAdmin }: RoleplayTrackerProps) {
  const [modules, setModules] = useState<RoleplayModule[]>([])
  const [scores, setScores] = useState<RoleplayScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Score entry
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [savingCell, setSavingCell] = useState<string | null>(null)

  // Agent "show all" toggle
  const [showAll, setShowAll] = useState(false)

  const canEdit = isManagerOrAdmin || (!!currentAgent && currentAgent.id === agentId)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [modRes, scoreRes] = await Promise.all([
      getRoleplayModules(),
      getAgentRoleplayScores(agentId),
    ])
    if (!modRes.success) { setError(modRes.error ?? "Failed to load"); setLoading(false); return }
    setModules(modRes.data ?? [])
    if (scoreRes.success) setScores(scoreRes.data ?? [])
    setLoading(false)
  }, [agentId])

  useEffect(() => { loadData() }, [loadData])

  const scoreMap = buildScoreMap(scores)

  // Derived: active module index
  const activeModuleIndex = modules.findIndex((m, i) => {
    if (isModuleComplete(m.id, scoreMap)) return false
    if (i === 0) return true
    return isModuleComplete(modules[i - 1].id, scoreMap)
  })

  const visibleModules = isManagerOrAdmin || showAll
    ? modules
    : modules.filter((_, i) => i === activeModuleIndex || i === activeModuleIndex + 1)

  const handleSaveScore = async (moduleId: string, tier: Tier, score: number, date: string) => {
    const key = `${moduleId}::${tier}`
    setSavingCell(key)
    const res = await upsertRoleplayScore({
      moduleId, agentId, tier, score, completedAt: date, enteredBy: currentAgent?.id,
    })
    setSavingCell(null)
    setEditingCell(null)

    if (res.success) {
      if (!res.updated) {
        alert("A higher score already exists for this tier — your entry was not saved.")
      } else {
        setScores(prev => {
          const filtered = prev.filter(s => !(s.module_id === moduleId && s.agent_id === agentId && s.tier === tier))
          return [...filtered, {
            id: `${moduleId}-${agentId}-${tier}`,
            module_id: moduleId, agent_id: agentId, tier, score,
            completed_at: date, entered_by: currentAgent?.id ?? null,
          }]
        })
      }
    } else {
      alert(`Failed to save score: ${res.error}`)
    }
  }

  const totalCount = modules.length

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center justify-center gap-2 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading training progress...
      </div>
    )
  }
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-rose-600 text-sm flex items-center gap-2">
        <AlertCircle className="w-4 h-4" /> {error}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 bg-white">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          Agency Coach AI Roleplays
        </h3>

        <div className="flex items-center gap-2 shrink-0">
          {!isManagerOrAdmin && totalCount > 2 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              {showAll ? "Show current" : "View all"}
            </button>
          )}
        </div>
      </div>

      {/* ── Empty State ── */}
      {totalCount === 0 && (
        <div className="p-10 flex flex-col items-center gap-2 text-slate-400">
          <Trophy className="w-8 h-8 text-slate-200" />
          <p className="text-sm font-medium">No training modules set up yet</p>
        </div>
      )}

      {/* ── Table ── */}
      {totalCount > 0 && (
        <>
          {!isManagerOrAdmin && !showAll && totalCount > 2 && (
            <div className="px-6 py-2 bg-slate-50 border-b border-slate-100">
              <p className="text-[11px] text-slate-500 font-medium">
                Showing your current module{activeModuleIndex + 1 < totalCount ? " and the next one" : ""}. Click <strong>View all</strong> to see all {totalCount} modules.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[220px]">
                    Module
                  </th>
                  {TIERS.map(tier => (
                    <th key={tier} className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center min-w-[140px]">
                      {tier}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleModules.map((mod) => {
                  const modIndex = modules.findIndex(m => m.id === mod.id)
                  const complete = isModuleComplete(mod.id, scoreMap)
                  const modUnlocked = modIndex === 0 || isModuleComplete(modules[modIndex - 1].id, scoreMap)
                  const isActive = activeModuleIndex === modIndex

                  return (
                    <tr
                      key={mod.id}
                      className={cn(
                        "border-b border-slate-100 transition-colors hover:bg-slate-50/50",
                        !modUnlocked && "bg-slate-50/30 opacity-60"
                      )}
                    >
                      {/* Module name */}
                      <td className="px-6 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] font-mono text-slate-400 shrink-0 w-4 text-right">
                            {modIndex + 1}.
                          </span>
                          <div className="min-w-0 flex items-center gap-2">
                            <span className={cn(
                              "text-sm font-medium truncate",
                              !modUnlocked ? "text-slate-400" : "text-slate-800"
                            )}>
                              {mod.name}
                            </span>
                            <span className="shrink-0 text-[10px] text-slate-400 hidden sm:inline-block">
                              ({mod.category})
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Tier cells */}
                      {TIERS.map(tier => {
                        const tierUnlocked = isTierUnlocked(modIndex, tier, modules, scoreMap)
                        const existing = scoreMap[mod.id]?.[tier]
                        const cellKey = `${mod.id}::${tier}`
                        const isEditingCell = editingCell === cellKey
                        const isSavingThisCell = savingCell === cellKey

                        return (
                          <td key={tier} className="px-6 py-2 text-center align-middle">
                            {isEditingCell ? (
                              <ScoreForm
                                onSave={(score, date) => handleSaveScore(mod.id, tier, score, date)}
                                onCancel={() => setEditingCell(null)}
                                saving={isSavingThisCell}
                              />
                            ) : (
                              <ScoreCell
                                score={existing}
                                unlocked={tierUnlocked}
                                canEdit={canEdit}
                                onEnter={() => setEditingCell(cellKey)}
                              />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
