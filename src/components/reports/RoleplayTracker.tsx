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
  X, Save, Loader2, BookOpen, Zap, Upload, Eye,
} from "lucide-react"

// ── Constants ─────────────────────────────────────────────────────────────────

const TIERS = ["Beginner", "Intermediate", "Advanced"] as const
type Tier = typeof TIERS[number]
const PASS_SCORE = 80

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= PASS_SCORE) return "bg-emerald-100 text-emerald-800 border border-emerald-200"
  if (score >= 70) return "bg-amber-100 text-amber-800 border border-amber-200"
  return "bg-rose-100 text-rose-800 border border-rose-200"
}

function scoreIcon(score: number) {
  if (score >= PASS_SCORE) return <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
  return <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
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
  if (score) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className={cn(
          "flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold",
          scoreColor(score.score)
        )}>
          {scoreIcon(score.score)}
          {score.score}
        </div>
        <span className="text-[10px] text-slate-400 font-mono">{formatDate(score.completed_at)}</span>
      </div>
    )
  }
  if (!unlocked) {
    return <div className="flex items-center justify-center"><Lock className="w-3.5 h-3.5 text-slate-300" /></div>
  }
  if (!canEdit) {
    return <div className="flex items-center justify-center"><span className="text-[10px] text-slate-400 italic">—</span></div>
  }
  return (
    <button
      onClick={onEnter}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors cursor-pointer whitespace-nowrap"
    >
      <Plus className="w-3 h-3" /> Score
    </button>
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
          className="w-14 px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel() }}
        />
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-32 px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
        />
      </div>
      {err && <p className="text-[10px] text-rose-500">{err}</p>}
      <div className="flex gap-1">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
        >
          <X className="w-3 h-3" /> Cancel
        </button>
      </div>
    </div>
  )
}

// ── OCR Preview types ─────────────────────────────────────────────────────────

type OcrRow = {
  rowIndex: number
  scores: { tier: Tier; score: number; completedAt: string }[]
  rawLine: string
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

  // Agent "show all" toggle (agents only see current+next by default)
  const [showAll, setShowAll] = useState(false)

  // Screenshot upload (manager only)
  const [ocrUploading, setOcrUploading] = useState(false)
  const [ocrPreview, setOcrPreview] = useState<OcrRow[] | null>(null)
  const [ocrImporting, setOcrImporting] = useState(false)
  const [ocrImageUrl, setOcrImageUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // ── Derived: active module index ──────────────────────────────────────────
  const activeModuleIndex = modules.findIndex((m, i) => {
    if (isModuleComplete(m.id, scoreMap)) return false
    if (i === 0) return true
    return isModuleComplete(modules[i - 1].id, scoreMap)
  })

  // Which modules agents see: current + next only (unless showAll)
  const visibleModules = isManagerOrAdmin || showAll
    ? modules
    : modules.filter((_, i) => i === activeModuleIndex || i === activeModuleIndex + 1)

  // ── Score entry ───────────────────────────────────────────────────────────
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

  // ── OCR upload ────────────────────────────────────────────────────────────
  const handleFileSelect = async (file: File) => {
    setOcrPreview(null)
    setOcrImageUrl(URL.createObjectURL(file))
    setOcrUploading(true)

    const form = new FormData()
    form.append("image", file)

    try {
      const res = await fetch("/api/roleplay/parse-screenshot", { method: "POST", body: form })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? "OCR failed")
      setOcrPreview(data.rows ?? [])
    } catch (e: any) {
      alert(`Screenshot parsing failed: ${e.message}`)
    } finally {
      setOcrUploading(false)
    }
  }

  const handleOcrImport = async () => {
    if (!ocrPreview) return
    setOcrImporting(true)
    let imported = 0

    for (const row of ocrPreview) {
      const mod = modules[row.rowIndex]
      if (!mod) continue
      for (const s of row.scores) {
        const res = await upsertRoleplayScore({
          moduleId: mod.id, agentId, tier: s.tier,
          score: s.score, completedAt: s.completedAt, enteredBy: currentAgent?.id,
        })
        if (res.success && res.updated) imported++
      }
    }

    // Refresh scores
    const scoreRes = await getAgentRoleplayScores(agentId)
    if (scoreRes.success) setScores(scoreRes.data ?? [])

    setOcrImporting(false)
    setOcrPreview(null)
    setOcrImageUrl(null)
    alert(`✅ Imported ${imported} score${imported !== 1 ? "s" : ""} successfully.`)
  }

  // ── Progress summary ──────────────────────────────────────────────────────
  const completedCount = modules.filter(m => isModuleComplete(m.id, scoreMap)).length
  const totalCount = modules.length
  const activeModule = activeModuleIndex >= 0 ? modules[activeModuleIndex] : null
  const activeTier = activeModule
    ? TIERS.find(t => { const s = scoreMap[activeModule.id]?.[t]; return !s || s.score < PASS_SCORE }) ?? null
    : null

  // ── Render ────────────────────────────────────────────────────────────────

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
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">Agency Coach AI Roleplays</h3>
            {totalCount > 0 && (
              <p className="text-[11px] text-slate-500 leading-tight">
                {completedCount === totalCount ? (
                  <span className="text-emerald-600 font-semibold">All {totalCount} modules complete! 🏆</span>
                ) : (
                  <>
                    <span className="font-semibold text-slate-700">{completedCount} of {totalCount}</span> complete
                    {activeModule && activeTier && (
                      <span className="text-slate-400">
                        {" · "}<Zap className="w-2.5 h-2.5 inline text-amber-500" />{" "}
                        <span className="font-medium text-slate-600">{activeModule.name}</span>
                        {" — "}{activeTier}
                      </span>
                    )}
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Agent-only: toggle between current/next and full list */}
          {!isManagerOrAdmin && totalCount > 2 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              {showAll ? "Show current" : "View all"}
            </button>
          )}

          {/* Manager: screenshot upload */}
          {isManagerOrAdmin && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={ocrUploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {ocrUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {ocrUploading ? "Reading..." : "Upload Screenshot"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── OCR Preview Panel ── */}
      {ocrPreview && (
        <div className="border-b border-amber-200 bg-amber-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-amber-800">
              📋 Screenshot Preview — {ocrPreview.reduce((a, r) => a + r.scores.length, 0)} scores found
            </p>
            <button onClick={() => { setOcrPreview(null); setOcrImageUrl(null) }}
              className="p-1 rounded text-amber-600 hover:bg-amber-100 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr className="border-b border-amber-200">
                  <th className="text-left py-1.5 px-2 font-semibold text-amber-700">Module (by row position)</th>
                  {TIERS.map(t => <th key={t} className="px-2 py-1.5 font-semibold text-amber-700">{t}</th>)}
                </tr>
              </thead>
              <tbody>
                {ocrPreview.map(row => {
                  const mod = modules[row.rowIndex]
                  return (
                    <tr key={row.rowIndex} className="border-b border-amber-100">
                      <td className="py-1.5 px-2 text-slate-700 font-medium">
                        {mod ? `${row.rowIndex + 1}. ${mod.name}` : <span className="text-rose-500">⚠ No matching module (row {row.rowIndex + 1})</span>}
                      </td>
                      {TIERS.map(tier => {
                        const s = row.scores.find(x => x.tier === tier)
                        return (
                          <td key={tier} className="px-2 py-1.5 text-center">
                            {s ? (
                              <span className={cn("px-1.5 py-0.5 rounded font-bold", scoreColor(s.score))}>
                                {s.score}
                              </span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-amber-600">
            ℹ Only scores higher than existing records will be imported (best-score rule applies).
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleOcrImport}
              disabled={ocrImporting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60 cursor-pointer"
            >
              {ocrImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Import Scores
            </button>
            <button
              onClick={() => { setOcrPreview(null); setOcrImageUrl(null) }}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 cursor-pointer"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {totalCount === 0 && (
        <div className="p-10 flex flex-col items-center gap-2 text-slate-400">
          <Trophy className="w-8 h-8 text-slate-300" />
          <p className="text-sm font-medium">No training modules set up yet</p>
          <p className="text-xs text-center">Managers can add modules in <strong>Admin → Data Sync</strong>.</p>
        </div>
      )}

      {/* ── Table ── */}
      {totalCount > 0 && (
        <>
          {/* Agent narrow-view label */}
          {!isManagerOrAdmin && !showAll && totalCount > 2 && (
            <div className="px-4 py-2 bg-indigo-50/60 border-b border-indigo-100">
              <p className="text-[11px] text-indigo-600 font-medium">
                Showing your current module{activeModuleIndex + 1 < totalCount ? " and the next one" : ""}. Click <strong>View all</strong> to see all {totalCount} modules.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[220px]">
                    Module
                  </th>
                  {TIERS.map(tier => (
                    <th key={tier} className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center min-w-[140px]">
                      {tier}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-24">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleModules.map((mod) => {
                  // Find actual index in full modules array for locking logic
                  const modIndex = modules.findIndex(m => m.id === mod.id)
                  const complete = isModuleComplete(mod.id, scoreMap)
                  const modUnlocked = modIndex === 0 || isModuleComplete(modules[modIndex - 1].id, scoreMap)
                  const isActive = activeModuleIndex === modIndex

                  return (
                    <tr
                      key={mod.id}
                      className={cn(
                        "border-b border-slate-50 transition-colors",
                        complete ? "bg-emerald-50/30"
                          : isActive ? "bg-amber-50/30"
                          : !modUnlocked ? "bg-slate-50/60 opacity-60"
                          : "hover:bg-slate-50/50"
                      )}
                    >
                      {/* Module name */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-slate-400 shrink-0 w-5 text-right">
                              {modIndex + 1}.
                            </span>
                            <span className={cn(
                              "text-sm font-semibold leading-tight",
                              !modUnlocked ? "text-slate-400" : "text-slate-800"
                            )}>
                              {mod.name}
                            </span>
                          </div>
                          <span className="ml-7 text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full w-fit">
                            {mod.category}
                          </span>
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
                          <td key={tier} className="px-4 py-3 text-center align-middle">
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

                      {/* Status badge */}
                      <td className="px-4 py-3 text-center">
                        {complete ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Done
                          </span>
                        ) : isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                            <Zap className="w-3 h-3" /> Active
                          </span>
                        ) : !modUnlocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                            In Progress
                          </span>
                        )}
                      </td>
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
