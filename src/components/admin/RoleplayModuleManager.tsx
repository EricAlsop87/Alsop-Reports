"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  getRoleplayModules,
  createRoleplayModule,
  updateModule,
  updateModuleOrder,
  deleteRoleplayModule,
  getAllAgents,
  upsertRoleplayScore,
  type RoleplayModule,
} from "@/app/reports/agent/roleplay-actions"
import {
  BookOpen, Plus, Pencil, Trash2, ChevronUp, ChevronDown,
  Save, X, Loader2, CheckCircle2, AlertCircle, Upload, Eye
} from "lucide-react"
import { cn } from "@/lib/utils"

const CATEGORIES = ["Auto", "Life", "Home", "Renters", "General"]
const TIERS = ["Beginner", "Intermediate", "Advanced"] as const

type OcrRow = {
  rowIndex: number
  scores: { tier: typeof TIERS[number]; score: number; completedAt: string }[]
  rawLine: string
}

export function RoleplayModuleManager() {
  const [modules, setModules] = useState<RoleplayModule[]>([])
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null)

  // Add form
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState("")
  const [addCategory, setAddCategory] = useState("Auto")
  const [addSaving, setAddSaving] = useState(false)

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editCategory, setEditCategory] = useState("Auto")
  const [editSaving, setEditSaving] = useState(false)

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Reorder
  const [reordering, setReordering] = useState(false)

  // OCR Upload
  const [ocrUploading, setOcrUploading] = useState(false)
  const [ocrPreview, setOcrPreview] = useState<OcrRow[] | null>(null)
  const [ocrImporting, setOcrImporting] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string, type: "ok" | "err") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [modRes, agentRes] = await Promise.all([
      getRoleplayModules(),
      getAllAgents(),
    ])
    if (modRes.success) setModules(modRes.data ?? [])
    else setError(modRes.error ?? "Failed to load modules")
    
    if (agentRes.success) setAgents(agentRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Add ─────────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!addName.trim()) return
    setAddSaving(true)
    const res = await createRoleplayModule(addName.trim(), addCategory)
    setAddSaving(false)
    if (res.success) {
      setShowAdd(false)
      setAddName("")
      setAddCategory("Auto")
      await load()
      showToast("Module added", "ok")
    } else {
      showToast(res.error ?? "Failed to add", "err")
    }
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  const handleEdit = async (id: string) => {
    if (!editName.trim()) return
    setEditSaving(true)
    const res = await updateModule(id, editName.trim(), editCategory)
    setEditSaving(false)
    if (res.success) {
      setModules(prev => prev.map(m =>
        m.id === id ? { ...m, name: editName.trim(), category: editCategory } : m
      ))
      setEditingId(null)
      showToast("Module updated", "ok")
    } else {
      showToast(res.error ?? "Failed to update", "err")
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const res = await deleteRoleplayModule(id)
    if (res.success) {
      setModules(prev => prev.filter(m => m.id !== id))
      setDeletingId(null)
      showToast("Module removed", "ok")
    } else {
      showToast(res.error ?? "Failed to delete", "err")
    }
  }

  // ── Reorder ─────────────────────────────────────────────────────────────────
  const handleMove = async (index: number, dir: "up" | "down") => {
    const swap = dir === "up" ? index - 1 : index + 1
    if (swap < 0 || swap >= modules.length) return
    const next = [...modules]
    ;[next[index], next[swap]] = [next[swap], next[index]]
    const updated = next.map((m, i) => ({ ...m, sort_order: i }))
    setModules(updated)
    setReordering(true)
    await updateModuleOrder(updated.map(m => ({ id: m.id, sort_order: m.sort_order })))
    setReordering(false)
  }

  // ── OCR ─────────────────────────────────────────────────────────────────────
  const handleFileSelect = async (file: File) => {
    setOcrPreview(null)
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
    if (!ocrPreview || !selectedAgentId) {
      alert("Please select an agent to import scores for.")
      return
    }
    setOcrImporting(true)
    let imported = 0

    for (const row of ocrPreview) {
      const mod = modules[row.rowIndex]
      if (!mod) continue
      for (const s of row.scores) {
        const res = await upsertRoleplayScore({
          moduleId: mod.id, 
          agentId: selectedAgentId, 
          tier: s.tier,
          score: s.score, 
          completedAt: s.completedAt
        })
        if (res.success && res.updated) imported++
      }
    }

    setOcrImporting(false)
    setOcrPreview(null)
    setSelectedAgentId("")
    alert(`✅ Imported ${imported} score${imported !== 1 ? "s" : ""} successfully for the selected agent.`)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-indigo-50/60 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-800">Agency Coach AI Roleplays</h3>
            <p className="text-[11px] text-slate-500">
              {modules.length} module{modules.length !== 1 ? "s" : ""} · Drag ▲▼ to set training order
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60 transition-colors cursor-pointer shrink-0"
          >
            {ocrUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {ocrUploading ? "Reading..." : "Upload Screenshot"}
          </button>
          <button
            onClick={() => { setShowAdd(true); setAddName(""); setAddCategory("Auto") }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Add Module
          </button>
        </div>
      </div>

      {/* OCR Preview Panel */}
      {ocrPreview && (
        <div className="border-b border-amber-200 bg-amber-50/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Screenshot Read Successfully ({ocrPreview.reduce((a, r) => a + r.scores.length, 0)} scores found)
              </p>
              <p className="text-xs text-amber-700 mt-1">Select which agent these scores belong to, then import them.</p>
            </div>
            <button onClick={() => setOcrPreview(null)} className="p-1 rounded text-amber-600 hover:bg-amber-100 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 p-3 bg-white border border-amber-200 rounded-lg">
            <span className="text-sm font-semibold text-slate-700 shrink-0">Assign to Agent:</span>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="flex-1 max-w-sm px-3 py-2 text-sm border border-slate-300 rounded outline-none focus:border-indigo-500"
            >
              <option value="">-- Select an Agent --</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button
              onClick={handleOcrImport}
              disabled={ocrImporting || !selectedAgentId}
              className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-bold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer ml-auto"
            >
              {ocrImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Import Scores
            </button>
          </div>

          <div className="overflow-x-auto border border-amber-200 rounded-lg bg-white">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr className="border-b border-amber-100 bg-amber-50/50">
                  <th className="text-left py-2 px-3 font-semibold text-amber-800">Detected Module Row</th>
                  {TIERS.map(t => <th key={t} className="px-3 py-2 font-semibold text-amber-800 text-center">{t}</th>)}
                </tr>
              </thead>
              <tbody>
                {ocrPreview.map(row => {
                  const mod = modules[row.rowIndex]
                  return (
                    <tr key={row.rowIndex} className="border-b border-amber-50">
                      <td className="py-2 px-3 text-slate-700 font-medium">
                        {mod ? `${row.rowIndex + 1}. ${mod.name}` : <span className="text-rose-500">⚠ Unmapped (Row {row.rowIndex + 1})</span>}
                      </td>
                      {TIERS.map(tier => {
                        const s = row.scores.find(x => x.tier === tier)
                        return (
                          <td key={tier} className="px-3 py-2 text-center border-l border-amber-50">
                            {s ? (
                              <div className="flex flex-col items-center">
                                <span className={cn("font-bold", s.score >= 80 ? "text-emerald-600" : s.score >= 70 ? "text-amber-600" : "text-rose-600")}>
                                  {s.score}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">{s.completedAt}</span>
                              </div>
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
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b",
          toast.type === "ok"
            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
            : "bg-rose-50 text-rose-700 border-rose-100"
        )}>
          {toast.type === "ok"
            ? <CheckCircle2 className="w-3.5 h-3.5" />
            : <AlertCircle className="w-3.5 h-3.5" />}
          {toast.msg}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading modules...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 text-rose-600 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Module list */}
      {!loading && !error && (
        <div className="divide-y divide-slate-50">
          {modules.length === 0 && (
            <div className="py-10 text-center text-slate-400 text-sm">
              No modules yet. Click <strong>Add Module</strong> to create the first one.
            </div>
          )}

          {modules.map((mod, i) => {
            const isEditing = editingId === mod.id
            const isDeleting = deletingId === mod.id

            return (
              <div
                key={mod.id}
                className={cn(
                  "px-4 py-1.5 transition-colors flex items-center",
                  isEditing ? "bg-blue-50/50" : isDeleting ? "bg-rose-50/40" : "hover:bg-slate-50/60"
                )}
              >
                <div className="flex items-center gap-3 w-full">
                  {/* Order controls */}
                  <div className="flex flex-col items-center gap-0 shrink-0 opacity-40 hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleMove(i, "up")}
                      disabled={i === 0 || reordering}
                      className="p-0 text-slate-400 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMove(i, "down")}
                      disabled={i === modules.length - 1 || reordering}
                      className="p-0 text-slate-400 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200"
                          autoFocus
                          onKeyDown={e => { if (e.key === "Enter") handleEdit(mod.id); if (e.key === "Escape") setEditingId(null) }}
                        />
                        <select
                          value={editCategory}
                          onChange={e => setEditCategory(e.target.value)}
                          className="w-28 px-2.5 py-1 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200"
                        >
                          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                        <button
                          onClick={() => handleEdit(mod.id)}
                          disabled={editSaving}
                          className="flex items-center justify-center w-8 h-7 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center justify-center w-8 h-7 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-mono text-slate-400 shrink-0 w-4 text-right">
                          {i + 1}.
                        </span>
                        <div className="min-w-0 flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {mod.name}
                          </p>
                          <span className="shrink-0 text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            {mod.category}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Delete confirmation */}
                    {isDeleting && (
                      <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 space-y-1.5">
                        <p className="font-semibold">Delete "{mod.name}"?</p>
                        <p className="text-rose-500">All agent scores for this module will be hidden.</p>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleDelete(mod.id)}
                            className="px-2.5 py-1 bg-rose-600 text-white rounded-md text-[11px] font-bold hover:bg-rose-700 cursor-pointer"
                          >
                            Confirm Delete
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="px-2.5 py-1 bg-white border border-rose-200 text-rose-600 rounded-md text-[11px] font-semibold hover:bg-rose-50 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  {!isEditing && !isDeleting && (
                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button
                        onClick={() => {
                          setEditingId(mod.id)
                          setEditName(mod.name)
                          setEditCategory(mod.category)
                          setDeletingId(null)
                        }}
                        className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setDeletingId(mod.id); setEditingId(null) }}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Module form (inline below list) */}
      {showAdd && (
        <div className="border-t border-indigo-100 bg-indigo-50/40 px-4 py-3 space-y-2">
          <p className="text-xs font-bold text-indigo-700">New Module</p>
          <input
            value={addName}
            onChange={e => setAddName(e.target.value)}
            placeholder="e.g. Auto Lead – Deliver Price & Overcome 'Too Expensive'"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
            autoFocus
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setShowAdd(false) }}
          />
          <div className="flex items-center gap-2">
            <select
              value={addCategory}
              onChange={e => setAddCategory(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <button
              onClick={handleAdd}
              disabled={!addName.trim() || addSaving}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
            >
              {addSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
