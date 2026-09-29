"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  getRoleplayModules,
  getAgentRoleplayScores,
  upsertRoleplayScore,
  createRoleplayModule,
  updateModuleOrder,
  updateModule,
  deleteRoleplayModule,
  type RoleplayModule,
  type RoleplayScore,
} from "@/app/reports/agent/roleplay-actions"
import { cn } from "@/lib/utils"
import {
  Trophy, Lock, CheckCircle2, AlertCircle, Plus, Pencil, Trash2,
  GripVertical, ChevronUp, ChevronDown, X, Save, Loader2, BookOpen,
  Zap,
} from "lucide-react"

// ── Constants ─────────────────────────────────────────────────────────────────

const TIERS = ["Beginner", "Intermediate", "Advanced"] as const
type Tier = typeof TIERS[number]
const PASS_SCORE = 80

const CATEGORIES = ["Auto", "Life", "Home", "Renters", "General"]

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

// Build a lookup: { [moduleId]: { [tier]: RoleplayScore } }
type ScoreMap = Record<string, Record<string, RoleplayScore>>
function buildScoreMap(scores: RoleplayScore[]): ScoreMap {
  const map: ScoreMap = {}
  for (const s of scores) {
    if (!map[s.module_id]) map[s.module_id] = {}
    map[s.module_id][s.tier] = s
  }
  return map
}

// Determine if a tier is unlocked for entry
function isTierUnlocked(
  moduleIndex: number,
  tier: Tier,
  modules: RoleplayModule[],
  scoreMap: ScoreMap
): boolean {
  // First module, Beginner is always open
  if (moduleIndex === 0 && tier === "Beginner") return true

  // For Intermediate: need Beginner ≥ 80 in same module
  if (tier === "Intermediate") {
    const begScore = scoreMap[modules[moduleIndex].id]?.["Beginner"]
    return !!begScore && begScore.score >= PASS_SCORE
  }

  // For Advanced: need Intermediate ≥ 80 in same module
  if (tier === "Advanced") {
    const intScore = scoreMap[modules[moduleIndex].id]?.["Intermediate"]
    return !!intScore && intScore.score >= PASS_SCORE
  }

  // For Beginner of module N>0: need all 3 tiers of previous module ≥ 80
  if (tier === "Beginner" && moduleIndex > 0) {
    const prevId = modules[moduleIndex - 1].id
    const prevMap = scoreMap[prevId] ?? {}
    return TIERS.every(t => prevMap[t] && prevMap[t].score >= PASS_SCORE)
  }

  return false
}

function isModuleComplete(moduleId: string, scoreMap: ScoreMap): boolean {
  const m = scoreMap[moduleId] ?? {}
  return TIERS.every(t => m[t] && m[t].score >= PASS_SCORE)
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
        <span className="text-[10px] text-slate-400 font-mono">
          {formatDate(score.completed_at)}
        </span>
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center">
        <Lock className="w-3.5 h-3.5 text-slate-300" />
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="flex items-center justify-center">
        <span className="text-[10px] text-slate-400 italic">—</span>
      </div>
    )
  }

  return (
    <button
      onClick={onEnter}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors cursor-pointer whitespace-nowrap"
    >
      <Plus className="w-3 h-3" />
      Score
    </button>
  )
}

// Inline score entry form
interface ScoreFormProps {
  onSave: (score: number, date: string) => Promise<void>
  onCancel: () => void
  saving: boolean
}

function ScoreForm({ onSave, onCancel, saving }: ScoreFormProps) {
  const [score, setScore] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [err, setErr] = useState("")
  const scoreRef = useRef<HTMLInputElement>(null)

  useEffect(() => { scoreRef.current?.focus() }, [])

  const handleSave = async () => {
    const n = parseInt(score, 10)
    if (isNaN(n) || n < 0 || n > 100) {
      setErr("Score must be 0–100")
      return
    }
    if (!date) {
      setErr("Date is required")
      return
    }
    setErr("")
    await onSave(n, date)
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[160px]">
      <div className="flex items-center gap-1.5">
        <input
          ref={scoreRef}
          type="number"
          min={0}
          max={100}
          value={score}
          onChange={e => setScore(e.target.value)}
          placeholder="Score"
          className="w-16 px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel() }}
        />
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-32 px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
        />
      </div>
      {err && <p className="text-[10px] text-rose-500">{err}</p>}
      <div className="flex gap-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors cursor-pointer"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
        >
          <X className="w-3 h-3" />
          Cancel
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

  // Editing state: which cell is open for score entry
  // Key: `${moduleId}::${tier}`
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [savingCell, setSavingCell] = useState<string | null>(null)

  // Module management state
  const [showAddModal, setShowAddModal] = useState(false)
  const [addName, setAddName] = useState("")
  const [addCategory, setAddCategory] = useState("Auto")
  const [addSaving, setAddSaving] = useState(false)

  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  const [editModuleName, setEditModuleName] = useState("")
  const [editModuleCategory, setEditModuleCategory] = useState("Auto")
  const [editModuleSaving, setEditModuleSaving] = useState(false)

  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null)

  const [reordering, setReordering] = useState(false)

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [modRes, scoreRes] = await Promise.all([
      getRoleplayModules(),
      getAgentRoleplayScores(agentId),
    ])
    if (!modRes.success) {
      setError(modRes.error ?? "Failed to load modules")
    } else {
      setModules(modRes.data ?? [])
    }
    if (scoreRes.success) {
      setScores(scoreRes.data ?? [])
    }
    setLoading(false)
  }, [agentId])

  useEffect(() => { loadData() }, [loadData])

  const scoreMap = buildScoreMap(scores)

  // Can the current user enter scores? Agents for themselves, admins always.
  const canEdit =
    isManagerOrAdmin ||
    (!!currentAgent && currentAgent.id === agentId)

  // ── Score entry ──────────────────────────────────────────────────────────────

  const handleSaveScore = async (
    moduleId: string,
    tier: Tier,
    score: number,
    date: string
  ) => {
    const key = `${moduleId}::${tier}`
    setSavingCell(key)
    const res = await upsertRoleplayScore({
      moduleId,
      agentId,
      tier,
      score,
      completedAt: date,
      enteredBy: currentAgent?.id,
    })
    setSavingCell(null)
    setEditingCell(null)

    if (res.success) {
      if (!res.updated) {
        // Existing score was already higher — give user feedback
        alert(`A higher score already exists for this tier. Your entry was not saved.`)
      } else {
        // Optimistically update local state
        setScores(prev => {
          const filtered = prev.filter(
            s => !(s.module_id === moduleId && s.agent_id === agentId && s.tier === tier)
          )
          return [
            ...filtered,
            {
              id: `${moduleId}-${agentId}-${tier}`,
              module_id: moduleId,
              agent_id: agentId,
              tier,
              score,
              completed_at: date,
              entered_by: currentAgent?.id ?? null,
            },
          ]
        })
      }
    } else {
      alert(`Failed to save score: ${res.error}`)
    }
  }

  // ── Module management ────────────────────────────────────────────────────────

  const handleAddModule = async () => {
    if (!addName.trim()) return
    setAddSaving(true)
    const res = await createRoleplayModule(addName.trim(), addCategory)
    setAddSaving(false)
    if (res.success) {
      setShowAddModal(false)
      setAddName("")
      setAddCategory("Auto")
      await loadData()
    } else {
      alert(`Failed to add module: ${res.error}`)
    }
  }

  const handleEditModule = async (id: string) => {
    if (!editModuleName.trim()) return
    setEditModuleSaving(true)
    const res = await updateModule(id, editModuleName.trim(), editModuleCategory)
    setEditModuleSaving(false)
    if (res.success) {
      setEditingModuleId(null)
      setModules(prev =>
        prev.map(m =>
          m.id === id
            ? { ...m, name: editModuleName.trim(), category: editModuleCategory }
            : m
        )
      )
    } else {
      alert(`Failed to update module: ${res.error}`)
    }
  }

  const handleDeleteModule = async (id: string) => {
    const res = await deleteRoleplayModule(id)
    if (res.success) {
      setDeletingModuleId(null)
      setModules(prev => prev.filter(m => m.id !== id))
    } else {
      alert(`Failed to delete module: ${res.error}`)
    }
  }

  const handleMoveModule = async (index: number, direction: "up" | "down") => {
    const newModules = [...modules]
    const swapIndex = direction === "up" ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newModules.length) return

    ;[newModules[index], newModules[swapIndex]] = [newModules[swapIndex], newModules[index]]
    const updated = newModules.map((m, i) => ({ ...m, sort_order: i }))
    setModules(updated)
    setReordering(true)
    await updateModuleOrder(updated.map(m => ({ id: m.id, sort_order: m.sort_order })))
    setReordering(false)
  }

  // ── Progress summary ─────────────────────────────────────────────────────────

  const completedCount = modules.filter(m => isModuleComplete(m.id, scoreMap)).length
  const totalCount = modules.length

  // Find the current active module (first incomplete one that is unlocked)
  const activeModule = modules.find((m, i) => {
    if (isModuleComplete(m.id, scoreMap)) return false
    if (i === 0) return true
    return isModuleComplete(modules[i - 1].id, scoreMap)
  })

  // Find the active tier within the active module
  let activeTier: Tier | null = null
  if (activeModule) {
    for (const tier of TIERS) {
      const s = scoreMap[activeModule.id]?.[tier]
      if (!s || s.score < PASS_SCORE) {
        activeTier = tier
        break
      }
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center justify-center gap-2 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading training progress...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-rose-600 text-sm flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        {error}
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
            <h3 className="text-sm font-bold text-slate-800">AI Roleplay Training</h3>
            {totalCount > 0 && (
              <p className="text-[11px] text-slate-500 leading-tight">
                {completedCount === totalCount ? (
                  <span className="text-emerald-600 font-semibold">All {totalCount} modules complete! 🏆</span>
                ) : (
                  <>
                    <span className="font-semibold text-slate-700">{completedCount} of {totalCount}</span> complete
                    {activeModule && activeTier && (
                      <span className="text-slate-400">
                        {" · "}
                        <Zap className="w-2.5 h-2.5 inline text-amber-500" />
                        {" "}
                        <span className="font-medium text-slate-600 truncate">{activeModule.name}</span>
                        {" — "}{activeTier}
                      </span>
                    )}
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        {isManagerOrAdmin && (
          <button
            onClick={() => { setShowAddModal(true); setAddName(""); setAddCategory("Auto") }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Module
          </button>
        )}
      </div>

      {/* ── Empty State ── */}
      {totalCount === 0 && (
        <div className="p-10 flex flex-col items-center gap-2 text-slate-400">
          <Trophy className="w-8 h-8 text-slate-300" />
          <p className="text-sm font-medium">No modules yet</p>
          {isManagerOrAdmin && (
            <p className="text-xs">Click <strong>Add Module</strong> to get started.</p>
          )}
        </div>
      )}

      {/* ── Table ── */}
      {totalCount > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                {isManagerOrAdmin && (
                  <th className="w-8 px-2 py-2.5" />
                )}
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[220px]">
                  Module
                </th>
                {TIERS.map(tier => (
                  <th
                    key={tier}
                    className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center min-w-[140px]"
                  >
                    {tier}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-24">
                  Status
                </th>
                {isManagerOrAdmin && (
                  <th className="px-2 py-2.5 w-20" />
                )}
              </tr>
            </thead>
            <tbody>
              {modules.map((mod, modIndex) => {
                const complete = isModuleComplete(mod.id, scoreMap)
                const modUnlocked = modIndex === 0 || isModuleComplete(modules[modIndex - 1].id, scoreMap)
                const isActive = activeModule?.id === mod.id
                const isEditingModule = editingModuleId === mod.id
                const isDeletingModule = deletingModuleId === mod.id

                return (
                  <tr
                    key={mod.id}
                    className={cn(
                      "border-b border-slate-50 transition-colors",
                      complete
                        ? "bg-emerald-50/30"
                        : isActive
                        ? "bg-amber-50/30"
                        : !modUnlocked
                        ? "bg-slate-50/60 opacity-60"
                        : "hover:bg-slate-50/50"
                    )}
                  >
                    {/* Reorder controls */}
                    {isManagerOrAdmin && (
                      <td className="px-1 py-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            onClick={() => handleMoveModule(modIndex, "up")}
                            disabled={modIndex === 0 || reordering}
                            className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 cursor-pointer transition-colors"
                            title="Move up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <GripVertical className="w-3 h-3 text-slate-200" />
                          <button
                            onClick={() => handleMoveModule(modIndex, "down")}
                            disabled={modIndex === modules.length - 1 || reordering}
                            className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 cursor-pointer transition-colors"
                            title="Move down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}

                    {/* Module name */}
                    <td className="px-4 py-3">
                      {isEditingModule ? (
                        <div className="flex flex-col gap-1.5">
                          <input
                            value={editModuleName}
                            onChange={e => setEditModuleName(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                            autoFocus
                          />
                          <select
                            value={editModuleCategory}
                            onChange={e => setEditModuleCategory(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200"
                          >
                            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                          </select>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEditModule(mod.id)}
                              disabled={editModuleSaving}
                              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                            >
                              {editModuleSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                              Save
                            </button>
                            <button
                              onClick={() => setEditingModuleId(null)}
                              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 cursor-pointer"
                            >
                              <X className="w-3 h-3" /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
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
                      )}

                      {/* Delete confirmation */}
                      {isDeletingModule && (
                        <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                          <p className="font-semibold mb-1.5">Delete this module?</p>
                          <p className="text-rose-500 mb-2">All agent scores for it will be hidden.</p>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleDeleteModule(mod.id)}
                              className="px-2 py-1 bg-rose-600 text-white rounded-md text-[11px] font-bold hover:bg-rose-700 cursor-pointer"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setDeletingModuleId(null)}
                              className="px-2 py-1 bg-white border border-rose-200 text-rose-600 rounded-md text-[11px] font-semibold hover:bg-rose-50 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Tier score cells */}
                    {TIERS.map(tier => {
                      const tierUnlocked = isTierUnlocked(modIndex, tier, modules, scoreMap)
                      const existing = scoreMap[mod.id]?.[tier]
                      const cellKey = `${mod.id}::${tier}`
                      const isEditingThisCell = editingCell === cellKey
                      const isSavingThisCell = savingCell === cellKey

                      return (
                        <td key={tier} className="px-4 py-3 text-center align-middle">
                          {isEditingThisCell ? (
                            <ScoreForm
                              onSave={(score, date) => handleSaveScore(mod.id, tier, score, date)}
                              onCancel={() => setEditingCell(null)}
                              saving={isSavingThisCell}
                            />
                          ) : (
                            <ScoreCell
                              score={existing}
                              unlocked={tierUnlocked}
                              canEdit={canEdit && !isEditingModule}
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

                    {/* Manager action buttons */}
                    {isManagerOrAdmin && (
                      <td className="px-2 py-3">
                        {!isEditingModule && !isDeletingModule && (
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => {
                                setEditingModuleId(mod.id)
                                setEditModuleName(mod.name)
                                setEditModuleCategory(mod.category)
                                setDeletingModuleId(null)
                              }}
                              className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Edit module"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDeletingModuleId(mod.id)
                                setEditingModuleId(null)
                              }}
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete module"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add Module Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Add Training Module</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Module Name <span className="text-rose-500">*</span>
                </label>
                <input
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="e.g. Auto Lead – Deliver Price & Overcome 'Too Expensive'"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") handleAddModule() }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                <select
                  value={addCategory}
                  onChange={e => setAddCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                >
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddModule}
                disabled={!addName.trim() || addSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {addSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Module
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
