"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import {
  Star, Users, Mail, Search, Building2, PhoneForwarded, Hash,
  Check, ChevronDown, ChevronRight, User as UserIcon, X,
  Plus, Pencil, Trash2, Loader2, AlertCircle, CheckCircle2
} from "lucide-react"
import { useChat } from "@/lib/chat/chatContext"
import { saveDirectoryEntry, deleteDirectoryEntry } from "./actions"

// ── Helpers ──────────────────────────────────────────────────────────────────────

function formatPhone(phone: string | null) {
  if (!phone) return { main: null, ext: null }
  const match = phone.match(/^(.*?)(?:x|ext\.?)\s*(\d+)$/i)
  if (match) {
    return { main: match[1].trim(), ext: match[2].trim() }
  }
  return { main: phone.trim(), ext: null }
}

function fallbackCopy(text: string) {
  try {
    const textArea = document.createElement("textarea")
    textArea.value = text
    textArea.style.position = "fixed"
    textArea.style.left = "-999999px"
    textArea.style.top = "-999999px"
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    document.execCommand("copy")
    textArea.remove()
  } catch (e) {
    console.error("Fallback copy failed:", e)
  }
}

function Highlight({ text, query }: { text: string | null | undefined; query: string }) {
  if (!text) return null
  if (!query) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const parts = text.split(new RegExp(`(${escaped})`, "gi"))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-200/80 text-yellow-900 rounded-sm px-0.5 font-medium">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

function CopyableItem({
  text,
  copyValue,
  id,
  copiedId,
  onCopy,
  highlightQuery,
  isMono = true,
  className = "",
}: {
  text: string | null | undefined
  copyValue?: string | null
  id: string
  copiedId: string | null
  onCopy: (text: string, id: string) => void
  highlightQuery?: string
  isMono?: boolean
  className?: string
}) {
  if (!text) return <span className="text-slate-300">—</span>
  const valToCopy = copyValue || text
  const isCopied = copiedId === id

  return (
    <button
      type="button"
      onClick={() => onCopy(valToCopy, id)}
      title="Click to copy"
      className={`relative inline-flex items-center text-left cursor-pointer px-1 py-0.5 -mx-1 rounded transition-colors select-none hover:bg-blue-50/80 focus:outline-none ${className}`}
    >
      <span className={`${isMono ? "font-mono" : ""} text-[13px] ${isCopied ? "text-[#2563EB] font-semibold" : "text-[#1E3553]"} hover:text-[#2563EB] transition-colors`}>
        {highlightQuery ? <Highlight text={text} query={highlightQuery} /> : text}
      </span>

      {/* Zero layout-shift floating tooltip */}
      {isCopied && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 pointer-events-none whitespace-nowrap bg-[#0F2F5A] text-white text-[11px] font-semibold px-2 py-0.5 rounded shadow-md animate-in fade-in zoom-in-95 duration-100 flex items-center gap-1">
          <Check className="w-3 h-3 text-emerald-400" />
          <span>Copied!</span>
        </span>
      )}
    </button>
  )
}

// ── Types ────────────────────────────────────────────────────────────────────────

type DirectoryEntry = {
  id: string
  group_id: string
  name: string
  position: string | null
  role: string | null
  sca_code: string | null
  sub_code: string | null
  email: string | null
  ricochet_phone: string | null
  ring_central_phone: string | null
  primary_phone: string | null
  secondary_phone: string | null
  notes: string | null
  display_order: number
}

type DirectoryGroup = {
  id: string
  name: string
  group_type: string
  address: string | null
  office_phone: string | null
  fax: string | null
  toll_free_phone: string | null
  email: string | null
  office_identifiers: string | null
  entries: DirectoryEntry[]
}

type FlatEntry = DirectoryEntry & { officeName: string }
type TabType = "Offices" | "HQ" | "Helpful Numbers" | "Carriers"

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

const SPANISH_NOTES_REGEX = /\b(\*?S\s*[-–]\s*(CSR;?\s*)?Spanish|\*?S\s*[-–]|Spanish\s*Speaking|Bilingual)\b/i

export function isSpanishSpeaker(
  entry: { name?: string | null; notes?: string | null },
  spanishAgentNames: Set<string>
): boolean {
  // 1. Direct check in directory entry notes (e.g. "*S – CSR; Spanish Speaking")
  if (entry.notes && SPANISH_NOTES_REGEX.test(entry.notes)) {
    return true
  }

  // 2. Check name against agents table with speaks_spanish = true
  const cleanName = (entry.name || '').replace(/\s*\(\s*Mgr\.?\s*\)/i, '').trim().toLowerCase()
  if (!cleanName) return false
  if (spanishAgentNames.has(cleanName)) return true

  // Check first name
  const firstName = cleanName.split(' ')[0]
  if (spanishAgentNames.has(firstName)) return true

  // Check substring / alias matching
  for (const name of spanishAgentNames) {
    if (cleanName.includes(name) || name.includes(cleanName)) return true
  }

  return false
}

// ── Main Component ───────────────────────────────────────────────────────────────

export default function StaffPage() {
  const [groups, setGroups] = useState<DirectoryGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<TabType>("Offices")
  const [selectedOffice, setSelectedOffice] = useState("All Offices")
  const [selectedTeam, setSelectedTeam] = useState("All Teams")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [dbMissing, setDbMissing] = useState(false)
  const [spanishOnly, setSpanishOnly] = useState(false)
  const [spanishAgentNames, setSpanishAgentNames] = useState<Set<string>>(new Set())

  // Favorites state persisted in localStorage
  const [favorites, setFavorites] = useState<string[]>([])
  const [showFavorites, setShowFavorites] = useState(true)

  // Expandable detail rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Group expand state (for Carriers/Helpful Numbers tabs)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  // ── Load favorites from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem("alsop_directory_favorites") || localStorage.getItem("directory-favorites")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setFavorites(parsed)
        }
      }
    } catch (e) {
      console.error("Failed to load favorites", e)
    }
  }, [])

  // ── Auth & Permissions ──
  const { currentAgent } = useChat()
  const [devRoleOverride, setDevRoleOverride] = useState<boolean | null>(null)

  const isManagerOrAdmin = useMemo(() => {
    if (devRoleOverride !== null) return devRoleOverride
    if (process.env.NODE_ENV === "development" && !currentAgent) {
      // Default to manager in local dev so user can view & test immediately
      return true
    }
    if (!currentAgent) return false
    const role = (currentAgent.role || "").toLowerCase()
    const team = (currentAgent.team || "").toLowerCase()
    const name = (currentAgent.name || "").toLowerCase()
    return (
      role === "admin" ||
      role === "manager" ||
      team === "managers" ||
      team === "management" ||
      name.includes("eric alsop") ||
      name.includes("charlie")
    )
  }, [currentAgent, devRoleOverride])

  // ── Modal & Form State ──
  const [modalOpen, setModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [formData, setFormData] = useState({
    id: "",
    group_id: "",
    name: "",
    position: "",
    role: "",
    email: "",
    ring_central_phone: "",
    ricochet_phone: "",
    notes: "",
  })

  // ── Reusable Data loading ──
  const loadDirectory = useCallback(async () => {
    try {
      setLoading(true)
      const { data: grps, error: grpError } = await supabase
        .from("directory_groups")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true })

      if (grpError) {
        if (grpError.code === "42P01") { setDbMissing(true); setLoading(false); return }
        throw grpError
      }

      const { data: ents, error: entError } = await supabase
        .from("directory_entries")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true })

      if (entError) throw entError

      // Exclude archived agents and load Spanish-speaking agent names
      const { data: agentData } = await supabase.from("agents").select("name, active, speaks_spanish")
      const archivedNames = new Set<string>()
      const spanishNames = new Set<string>()
      if (agentData) {
        agentData.forEach((a: { name: string | null; active: boolean | null; speaks_spanish?: boolean }) => {
          if (a.active === false && a.name) archivedNames.add(a.name.trim().toLowerCase())
          if (a.speaks_spanish && a.name) spanishNames.add(a.name.trim().toLowerCase())
        })
      }
      setSpanishAgentNames(spanishNames)

      const validEntries = (ents || []).filter(e => {
        if (!e.is_active) return false
        if (archivedNames.has((e.name || "").trim().toLowerCase())) return false
        return true
      })

      const merged = (grps || []).map(g => ({
        ...g,
        entries: validEntries.filter(e => e.group_id === g.id).sort((a, b) => a.display_order - b.display_order)
      }))

      setGroups(merged)

      // Initialize groups as expanded (for Carriers/Helpful tabs)
      setExpandedGroups(prev => {
        const next = { ...prev }
        merged.forEach(g => {
          if (next[g.id] === undefined) next[g.id] = true
        })
        return next
      })
    } catch (err) {
      console.error("Error loading directory:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDirectory()
  }, [loadDirectory])

  // ── Open Add Modal ──
  const handleOpenAddModal = useCallback(() => {
    const defaultGroup = groups.find(g => g.group_type === "office") || groups[0]
    setFormData({
      id: "",
      group_id: defaultGroup?.id || "",
      name: "",
      position: "",
      role: "",
      email: "",
      ring_central_phone: "",
      ricochet_phone: "",
      notes: "",
    })
    setFormError(null)
    setModalOpen(true)
  }, [groups])

  // ── Open Edit Modal ──
  const handleOpenEditModal = useCallback((entry: FlatEntry) => {
    setFormData({
      id: entry.id,
      group_id: entry.group_id,
      name: entry.name,
      position: entry.position || "",
      role: entry.role || "",
      email: entry.email || "",
      ring_central_phone: entry.ring_central_phone || "",
      ricochet_phone: entry.ricochet_phone || "",
      notes: entry.notes || "",
    })
    setFormError(null)
    setModalOpen(true)
  }, [])

  // ── Form Submit (Save / Reassign) ──
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setFormError("Full Name is required.")
      return
    }
    if (!formData.group_id) {
      setFormError("Please select an office or group.")
      return
    }

    setIsSubmitting(true)
    setFormError(null)
    try {
      const res = await saveDirectoryEntry({
        id: formData.id || undefined,
        group_id: formData.group_id,
        name: formData.name,
        position: formData.position || null,
        role: formData.role || formData.position || null,
        email: formData.email || null,
        ring_central_phone: formData.ring_central_phone || null,
        ricochet_phone: formData.ricochet_phone || null,
        notes: formData.notes || null,
      })

      if (res.success) {
        setModalOpen(false)
        setToastMsg({
          type: "success",
          text: formData.id ? "Employee updated and office reassigned!" : "Employee added to directory!"
        })
        setTimeout(() => setToastMsg(null), 4000)
        await loadDirectory()
      } else {
        setFormError(res.error || "Failed to save directory entry.")
      }
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Form Delete / Deactivate ──
  const handleDeleteEntry = async () => {
    if (!formData.id) return
    if (!window.confirm(`Are you sure you want to remove "${formData.name}" from the directory?`)) {
      return
    }

    setIsSubmitting(true)
    setFormError(null)
    try {
      const res = await deleteDirectoryEntry(formData.id)
      if (res.success) {
        setModalOpen(false)
        setToastMsg({ type: "success", text: "Employee removed from directory." })
        setTimeout(() => setToastMsg(null), 4000)
        await loadDirectory()
      } else {
        setFormError(res.error || "Failed to delete entry.")
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to delete entry.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Copy on Click Handler ──
  const handleCopy = useCallback((text: string, id: string) => {
    if (!text) return
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        fallbackCopy(text)
      })
    } else {
      fallbackCopy(text)
    }
    setCopiedId(id)
    setTimeout(() => {
      setCopiedId(prev => (prev === id ? null : prev))
    }, 1500)
  }, [])

  // ── Favorite Toggle ──
  const toggleFavorite = useCallback((entry: FlatEntry) => {
    setFavorites(prev => {
      const identifier = entry.name.trim().toLowerCase()
      const isFav = prev.includes(identifier) || prev.includes(entry.id)
      const next = isFav
        ? prev.filter(x => x !== identifier && x !== entry.id)
        : prev.length >= 20 ? prev : [...prev, identifier]
      try {
        localStorage.setItem("alsop_directory_favorites", JSON.stringify(next))
        localStorage.setItem("directory-favorites", JSON.stringify(next))
      } catch (err) {
        console.error("Failed to save favorites to localStorage", err)
      }
      return next
    })
  }, [])

  const checkIsFavorite = useCallback((entry: FlatEntry) => {
    const nameKey = entry.name.trim().toLowerCase()
    return favorites.includes(entry.id) || favorites.includes(nameKey)
  }, [favorites])

  const toggleRowExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const scrollToLetter = (letter: string) => {
    const el = document.getElementById(`section-${letter}`)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // ── Computed data ──

  const isFlatTab = activeTab === "Offices" || activeTab === "HQ"

  const officeNames = useMemo(() =>
    Array.from(new Set(groups.filter(g => g.group_type === "office").map(g => g.name)))
  , [groups])

  const teamOptions = useMemo(() => {
    const positions = new Set<string>()
    groups.filter(g => g.group_type === "office" || g.group_type === "custom").forEach(g => {
      g.entries.forEach(e => {
        const pos = e.position?.trim() || e.role?.trim()
        if (pos) positions.add(pos)
      })
    })
    return ["All Teams", ...Array.from(positions).sort()]
  }, [groups])

  // Flat entries for Offices / HQ with Eric Alsop deduplicated as Montclair / Claremont (MCM)
  const { flatEntries, totalCount } = useMemo(() => {
    if (!isFlatTab) return { flatEntries: [] as FlatEntry[], totalCount: 0 }

    const targetType = activeTab === "Offices" ? "office" : "custom"
    const matchingGroups = groups.filter(g => g.group_type === targetType)

    // Deduplicate entries by name (especially Eric Alsop in Montclair & Claremont)
    const entryMap = new Map<string, FlatEntry>()

    for (const group of matchingGroups) {
      for (const entry of group.entries) {
        const cleanName = entry.name.replace(/\s*\(\s*Mgr\.?\s*\)/i, "").trim()
        const key = cleanName.toLowerCase()

        if (entryMap.has(key)) {
          const existing = entryMap.get(key)!
          const offices = new Set([existing.officeName, group.name])
          let combinedOffice = Array.from(offices).join(" / ")

          // If Eric Alsop or Montclair + Claremont
          if (key.includes("eric alsop") || (offices.has("MONTCLAIR") && offices.has("CLAREMONT")) || (offices.has("Montclair") && offices.has("Claremont"))) {
            combinedOffice = "Montclair / Claremont (MCM)"
          }

          existing.officeName = combinedOffice
          existing.position = existing.position || entry.position
          existing.role = existing.role || entry.role
          existing.email = existing.email || entry.email
          existing.ricochet_phone = existing.ricochet_phone || entry.ricochet_phone
          existing.ring_central_phone = existing.ring_central_phone || entry.ring_central_phone
          existing.sca_code = existing.sca_code || entry.sca_code
          existing.sub_code = existing.sub_code || entry.sub_code
          existing.notes = existing.notes || entry.notes
          existing.name = cleanName
        } else {
          let officeDisplay = group.name
          if (key.includes("eric alsop")) {
            officeDisplay = "Montclair / Claremont (MCM)"
          }

          const entryCopy: FlatEntry = {
            ...entry,
            name: cleanName,
            officeName: officeDisplay,
          }
          entryMap.set(key, entryCopy)
        }
      }
    }

    let all: FlatEntry[] = Array.from(entryMap.values())
    const total = all.length

    // Office filter
    if (activeTab === "Offices" && selectedOffice !== "All Offices") {
      all = all.filter(e =>
        e.officeName.toLowerCase().includes(selectedOffice.toLowerCase())
      )
    }

    // Team filter
    if (selectedTeam !== "All Teams") {
      all = all.filter(e => e.position === selectedTeam || e.role === selectedTeam)
    }

    // Search filter
    if (search) {
      const s = search.toLowerCase()
      all = all.filter(e =>
        e.name.toLowerCase().includes(s) ||
        e.officeName.toLowerCase().includes(s) ||
        (e.position?.toLowerCase().includes(s)) ||
        (e.role?.toLowerCase().includes(s)) ||
        (e.email?.toLowerCase().includes(s)) ||
        (e.ricochet_phone?.toLowerCase().includes(s)) ||
        (e.ring_central_phone?.toLowerCase().includes(s)) ||
        (e.sca_code?.toLowerCase().includes(s)) ||
        (e.sub_code?.toLowerCase().includes(s)) ||
        (e.notes?.toLowerCase().includes(s))
      )
    }

    // Spanish language filter
    if (spanishOnly) {
      all = all.filter(e => isSpanishSpeaker(e, spanishAgentNames))
    }

    all.sort((a, b) => a.name.localeCompare(b.name))
    return { flatEntries: all, totalCount: total }
  }, [groups, activeTab, search, selectedOffice, selectedTeam, isFlatTab, spanishOnly, spanishAgentNames])

  // Alphabetical sections
  const sections = useMemo(() => {
    const map: Record<string, FlatEntry[]> = {}
    for (const entry of flatEntries) {
      const letter = entry.name[0]?.toUpperCase() || "#"
      if (!map[letter]) map[letter] = []
      map[letter].push(entry)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [flatEntries])

  const activeLetters = useMemo(() => new Set(sections.map(([l]) => l)), [sections])

  // Favorite entries
  const favoriteEntries = useMemo(() => {
    if (!isFlatTab || favorites.length === 0) return []
    return flatEntries.filter(e => checkIsFavorite(e))
  }, [flatEntries, favorites, isFlatTab, checkIsFavorite])

  // Grouped data for Carriers / Helpful Numbers
  const filteredGroups = useMemo(() => {
    if (isFlatTab) return []
    const s = search.toLowerCase()
    const typeMap: Record<string, string> = { "Helpful Numbers": "helpful_numbers", "Carriers": "carriers" }
    const targetType = typeMap[activeTab] || "carriers"

    return groups.filter(g => g.group_type === targetType).map(g => {
      let filtered = g.entries
      if (s) {
        filtered = filtered.filter(e =>
          (e.name?.toLowerCase().includes(s)) ||
          (e.position?.toLowerCase().includes(s)) ||
          (e.role?.toLowerCase().includes(s)) ||
          (e.email?.toLowerCase().includes(s)) ||
          (e.primary_phone?.toLowerCase().includes(s)) ||
          (e.secondary_phone?.toLowerCase().includes(s)) ||
          (e.ricochet_phone?.toLowerCase().includes(s)) ||
          (e.ring_central_phone?.toLowerCase().includes(s)) ||
          (e.notes?.toLowerCase().includes(s))
        )
      }
      return { ...g, entries: filtered }
    }).filter(g => g.entries.length > 0)
  }, [groups, search, activeTab, isFlatTab])

  // Count label
  const isFiltered = !!(search || selectedOffice !== "All Offices" || selectedTeam !== "All Teams" || spanishOnly)
  const countLabel = isFlatTab
    ? isFiltered
      ? `${flatEntries.length} of ${totalCount} contacts`
      : `${totalCount} contacts`
    : null

  // ── Contact row renderer (flat tabs: Offices / HQ) ──

  const renderContactRow = (entry: FlatEntry, keyPrefix: string) => {
    const isFav = checkIsFavorite(entry)
    const isExpanded = expandedRows.has(entry.id)
    const hasDetail = !!(entry.notes || entry.sca_code || entry.sub_code)
    const rc = formatPhone(entry.ring_central_phone)

    return (
      <React.Fragment key={`${keyPrefix}${entry.id}`}>
        <tr className="border-b border-[#D6E2F0] hover:bg-[#F3F8FF] transition-colors bg-white">
          {/* Star */}
          <td className="px-2 py-2 w-8 text-center">
            <button
              onClick={() => toggleFavorite(entry)}
              className="focus:outline-none p-1 rounded hover:bg-yellow-50 transition-colors"
              title={isFav ? "Remove favorite" : "Add favorite"}
            >
              <Star className={`w-3.5 h-3.5 transition-colors ${isFav ? "text-yellow-400 fill-yellow-400" : "text-slate-300 hover:text-yellow-400"}`} />
            </button>
          </td>

          {/* Name */}
          <td className="px-3 py-2 whitespace-nowrap">
            <button
              onClick={hasDetail ? () => toggleRowExpand(entry.id) : undefined}
              className={`flex items-center gap-1.5 text-left ${hasDetail ? "cursor-pointer" : "cursor-default"}`}
            >
              {hasDetail && (
                isExpanded
                  ? <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                  : <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
              )}
              <span className="font-medium text-[#1E3553]">
                <Highlight text={entry.name} query={search} />
              </span>
              {isSpanishSpeaker(entry, spanishAgentNames) && (
                <span className="ml-1.5 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200" title="Speaks Spanish">
                  Spa
                </span>
              )}
            </button>
          </td>

          {/* Role */}
          <td className="px-3 py-2 text-slate-600 whitespace-nowrap text-[13px]">
            <Highlight text={entry.position || entry.role || "—"} query={search} />
          </td>

          {/* Office */}
          <td className="px-3 py-2 text-slate-600 whitespace-nowrap text-[13px]">
            <Highlight text={entry.officeName} query={search} />
          </td>

          {/* Ricochet */}
          <td className="px-3 py-2 whitespace-nowrap">
            <CopyableItem
              text={entry.ricochet_phone}
              id={`${keyPrefix}${entry.id}-rico`}
              copiedId={copiedId}
              onCopy={handleCopy}
              highlightQuery={search}
            />
          </td>

          {/* RingCentral */}
          <td className="px-3 py-2 whitespace-nowrap">
            <CopyableItem
              text={rc.main}
              id={`${keyPrefix}${entry.id}-rc`}
              copiedId={copiedId}
              onCopy={handleCopy}
              highlightQuery={search}
            />
          </td>

          {/* Extension (digits only, no 'x') */}
          <td className="px-3 py-2 whitespace-nowrap">
            <CopyableItem
              text={rc.ext}
              id={`${keyPrefix}${entry.id}-ext`}
              copiedId={copiedId}
              onCopy={handleCopy}
              highlightQuery={search}
            />
          </td>

          {/* Email */}
          <td className="px-3 py-2 whitespace-nowrap">
            <CopyableItem
              text={entry.email}
              id={`${keyPrefix}${entry.id}-email`}
              copiedId={copiedId}
              onCopy={handleCopy}
              isMono={false}
              highlightQuery={search}
            />
          </td>

          {/* Edit Action for Managers/Admins */}
          {isManagerOrAdmin && (
            <td className="px-2 py-2 whitespace-nowrap text-center">
              <button
                type="button"
                onClick={() => handleOpenEditModal(entry)}
                className="inline-flex items-center justify-center p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                title={`Edit ${entry.name} / Reassign office`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </td>
          )}
        </tr>

        {/* Expanded detail row */}
        {isExpanded && hasDetail && (
          <tr className="bg-[#F7FAFC] border-b border-[#D6E2F0]">
            <td />
            <td colSpan={isManagerOrAdmin ? 8 : 7} className="px-3 py-2 text-[12px] text-slate-500">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {entry.sca_code && <span><strong className="font-semibold text-slate-700">SCA Code:</strong> {entry.sca_code}</span>}
                {entry.sub_code && <span><strong className="font-semibold text-slate-700">Sub Code:</strong> {entry.sub_code}</span>}
                {entry.notes && <span><strong className="font-semibold text-slate-700">Notes:</strong> {entry.notes}</span>}
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────────

  if (dbMissing) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center space-y-4 min-h-screen text-[#1E3553]">
        <h1 className="text-2xl font-bold text-red-600">Database Setup Required</h1>
        <p>Please run the migration script and seed the directory database tables.</p>
      </div>
    )
  }

  const availableTabs: TabType[] = ["Offices", "HQ", "Helpful Numbers", "Carriers"]
  const isCarriers = activeTab === "Carriers"

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 min-h-screen text-[#1E3553] bg-[#F7FAFC]">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#1E3553]">Office Directory</h1>
            {isManagerOrAdmin ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                <Building2 className="w-3 h-3" />
                Manager Mode (Can Add & Reassign)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Producer Mode (View-Only)
              </span>
            )}
            {process.env.NODE_ENV === "development" && (
              <button
                type="button"
                onClick={() => setDevRoleOverride(prev => prev === null ? !isManagerOrAdmin : !prev)}
                className="text-[11px] font-medium text-slate-500 hover:text-blue-600 underline cursor-pointer ml-1"
                title="Toggle between Manager and Producer view for local testing"
              >
                (Test as {isManagerOrAdmin ? "Producer" : "Manager"})
              </button>
            )}
          </div>
          <p className="text-sm text-slate-500">Find agents, HQ teams, helpful numbers and carriers. Click any phone number or email to copy.</p>
        </div>

        {/* Manager Add Employee button */}
        {isManagerOrAdmin && (
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-[13px] font-semibold transition-all shadow-xs shrink-0 cursor-pointer self-start sm:self-auto"
            title="Add a new employee to the directory"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        )}
      </div>

      {/* ── Feedback Toast ── */}
      {toastMsg && (
        <div className={`p-3 rounded-lg border text-sm flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
          toastMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {toastMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span className="font-medium">{toastMsg.text}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-slate-600 p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Controls & Tabs ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-[#D6E2F0] pb-0">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pb-2 xl:pb-4">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, phone, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-[#D6E2F0] focus:outline-none focus:ring-1 focus:ring-[#2563EB] bg-white shadow-xs text-[13px]"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Count */}
          {countLabel && !loading && (
            <span className="text-[11px] text-slate-400 whitespace-nowrap">{countLabel}</span>
          )}

          {/* Office filter */}
          {activeTab === "Offices" && (
            <div className="relative">
              <select
                value={selectedOffice}
                onChange={e => setSelectedOffice(e.target.value)}
                className="pl-3 pr-8 py-1.5 rounded-lg border border-[#D6E2F0] bg-white text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2563EB] appearance-none shadow-xs"
              >
                <option value="All Offices">All Offices</option>
                {officeNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Team filter */}
          {(activeTab === "Offices" || activeTab === "HQ") && (
            <div className="relative">
              <select
                value={selectedTeam}
                onChange={e => setSelectedTeam(e.target.value)}
                className="pl-3 pr-8 py-1.5 rounded-lg border border-[#D6E2F0] bg-white text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2563EB] appearance-none shadow-xs"
              >
                {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Spanish language toggle */}
          {(activeTab === "Offices" || activeTab === "HQ") && (
            <button
              onClick={() => setSpanishOnly(!spanishOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-colors shadow-xs ${
                spanishOnly
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-[#D6E2F0] bg-white text-slate-600 hover:bg-slate-50"
              }`}
              title="Filter Spanish-speaking agents"
            >
              <span>Spanish</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 overflow-x-auto w-full xl:w-auto xl:pt-4">
          {availableTabs.map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSelectedTeam("All Teams"); setSearch("") }}
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-slate-500 hover:text-[#1E3553]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content ── */}
      {loading ? (
        <div className="space-y-3">
          <div className="h-8 bg-white rounded animate-pulse" />
          <div className="h-8 bg-white rounded animate-pulse" />
          <div className="h-8 bg-white rounded animate-pulse" />
          <div className="h-8 bg-white rounded animate-pulse" />
        </div>
      ) : isFlatTab ? (
        /* ════════════ FLAT ALPHABETICAL VIEW (Offices / HQ) ════════════ */
        flatEntries.length === 0 ? (
          <div className="text-center py-16 text-slate-500 bg-white rounded-xl border border-[#D6E2F0] border-dashed">
            <Search className="w-8 h-8 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-[#1E3553]">No contacts found</p>
            <p className="text-[13px] mt-1">Try searching by first name only, or clear your filters.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-xs border border-[#D6E2F0]">
            {/* Alphabet Jump Bar */}
            <div className="flex justify-center flex-wrap gap-0.5 px-4 py-2 border-b border-[#D6E2F0] bg-[#FAFBFD]">
              {ALPHABET.map(letter => {
                const isActive = activeLetters.has(letter)
                return (
                  <button
                    key={letter}
                    onClick={() => isActive && scrollToLetter(letter)}
                    disabled={!isActive}
                    className={`w-7 h-7 rounded text-[12px] font-semibold transition-colors ${
                      isActive
                        ? "text-[#2563EB] hover:bg-[#EAF3FF] cursor-pointer"
                        : "text-slate-200 cursor-default"
                    }`}
                  >
                    {letter}
                  </button>
                )
              })}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-left">
                <thead className="bg-[#0F2F5A] text-white">
                  <tr>
                    <th className="px-2 py-2.5 w-8" />
                    <th className="px-3 py-2.5 font-semibold">Name</th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Role</th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Office</th>
                    <th className="px-3 py-2.5 font-semibold">Ricochet</th>
                    <th className="px-3 py-2.5 font-semibold">RingCentral</th>
                    <th className="px-3 py-2.5 font-semibold">Ext.</th>
                    <th className="px-3 py-2.5 font-semibold">Email</th>
                    {isManagerOrAdmin && (
                      <th className="px-2 py-2.5 font-semibold text-center w-14">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {/* ── Favorites Section ── */}
                  {favoriteEntries.length > 0 && (
                    <>
                      <tr className="bg-yellow-50/70 border-b border-yellow-200/80">
                        <td colSpan={isManagerOrAdmin ? 9 : 8} className="px-4 py-1.5">
                          <button
                            onClick={() => setShowFavorites(!showFavorites)}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-yellow-700 uppercase tracking-wider hover:text-yellow-800"
                          >
                            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                            Favorites ({favoriteEntries.length})
                            {showFavorites
                              ? <ChevronDown className="w-3 h-3" />
                              : <ChevronRight className="w-3 h-3" />}
                          </button>
                        </td>
                      </tr>
                      {showFavorites && favoriteEntries.map(e => renderContactRow(e, "fav-"))}
                    </>
                  )}

                  {/* ── Alphabetical Sections ── */}
                  {sections.map(([letter, entries]) => (
                    <React.Fragment key={letter}>
                      <tr id={`section-${letter}`}>
                        <td colSpan={isManagerOrAdmin ? 9 : 8} className="px-4 py-1 bg-slate-50/90 border-y border-[#D6E2F0]">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{letter}</span>
                        </td>
                      </tr>
                      {entries.map(e => renderContactRow(e, ""))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* ════════════ GROUPED TABLE VIEW (Carriers / Helpful Numbers) ════════════ */
        filteredGroups.length === 0 ? (
          <div className="text-center py-16 text-slate-500 bg-white rounded-xl border border-[#D6E2F0] border-dashed">
            <Search className="w-8 h-8 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-[#1E3553]">No results found</p>
            <p className="text-[13px] mt-1">Try adjusting your search.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-xs border border-[#D6E2F0]">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-left">
                <thead className="bg-[#0F2F5A] text-white">
                  <tr>
                    {isCarriers ? (
                      <>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Carrier</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Contact / Department</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Primary Phone</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Secondary Phone</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Email</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Notes</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Contact</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Primary Phone</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Secondary Phone</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Email</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Notes</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map(group => {
                    const GroupIcon = isCarriers ? Hash : PhoneForwarded
                    const colSpan = isCarriers ? 6 : 5
                    return (
                      <React.Fragment key={group.id}>
                        <tr className="bg-[#EAF3FF] border-b border-[#D6E2F0]">
                          <td colSpan={colSpan} className="px-4 py-2.5">
                            <div className="flex flex-col gap-1 text-[12px] text-[#1E3553]">
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                <button onClick={() => toggleGroup(group.id)} className="flex items-center gap-2 hover:text-[#2563EB] focus:outline-none">
                                  {expandedGroups[group.id] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                  <GroupIcon className="w-4 h-4 text-slate-500" />
                                  <span className="font-bold uppercase tracking-wide text-[13px]">{group.name}</span>
                                </button>
                                {group.address && <span className="text-slate-600">{group.address}</span>}
                              </div>
                              {(group.office_phone || group.fax || group.toll_free_phone || group.email || group.office_identifiers) && (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 ml-8">
                                  {group.office_phone && (
                                    <span>
                                      <strong className="font-semibold text-[#1E3553]">Office: </strong>
                                      <CopyableItem text={group.office_phone} id={`grp-${group.id}-off`} copiedId={copiedId} onCopy={handleCopy} />
                                    </span>
                                  )}
                                  {group.fax && (
                                    <span>
                                      <strong className="font-semibold text-[#1E3553]">Fax: </strong>
                                      <CopyableItem text={group.fax} id={`grp-${group.id}-fax`} copiedId={copiedId} onCopy={handleCopy} />
                                    </span>
                                  )}
                                  {group.toll_free_phone && (
                                    <span>
                                      <strong className="font-semibold text-[#1E3553]">Toll Free: </strong>
                                      <CopyableItem text={group.toll_free_phone} id={`grp-${group.id}-toll`} copiedId={copiedId} onCopy={handleCopy} />
                                    </span>
                                  )}
                                  {group.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                                      <CopyableItem text={group.email} id={`grp-${group.id}-email`} copiedId={copiedId} onCopy={handleCopy} isMono={false} />
                                    </span>
                                  )}
                                  {group.office_identifiers && <span>{group.office_identifiers}</span>}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedGroups[group.id] && group.entries.map(entry => {
                          const primaryPhone = entry.primary_phone || entry.ricochet_phone
                          const secondaryPhone = entry.secondary_phone || entry.ring_central_phone
                          return (
                            <tr key={entry.id} className="border-b border-[#D6E2F0] hover:bg-[#F3F8FF] transition-colors bg-white">
                              {isCarriers ? (
                                <>
                                  <td className="px-4 py-2.5 whitespace-nowrap"><span className="font-medium">{entry.name}</span></td>
                                  <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{entry.role || entry.position}</td>
                                  <td className="px-4 py-2.5 whitespace-nowrap">
                                    <CopyableItem text={primaryPhone} id={`c-${entry.id}-p`} copiedId={copiedId} onCopy={handleCopy} highlightQuery={search} />
                                  </td>
                                  <td className="px-4 py-2.5 whitespace-nowrap">
                                    <CopyableItem text={secondaryPhone} id={`c-${entry.id}-s`} copiedId={copiedId} onCopy={handleCopy} highlightQuery={search} />
                                  </td>
                                  <td className="px-4 py-2.5 whitespace-nowrap">
                                    <CopyableItem text={entry.email} id={`c-${entry.id}-e`} copiedId={copiedId} onCopy={handleCopy} isMono={false} highlightQuery={search} />
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-600">{entry.notes}</td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-2.5 whitespace-nowrap"><span className="font-medium">{entry.name}</span></td>
                                  <td className="px-4 py-2.5 whitespace-nowrap">
                                    <CopyableItem text={primaryPhone} id={`h-${entry.id}-p`} copiedId={copiedId} onCopy={handleCopy} highlightQuery={search} />
                                  </td>
                                  <td className="px-4 py-2.5 whitespace-nowrap">
                                    <CopyableItem text={secondaryPhone} id={`h-${entry.id}-s`} copiedId={copiedId} onCopy={handleCopy} highlightQuery={search} />
                                  </td>
                                  <td className="px-4 py-2.5 whitespace-nowrap">
                                    <CopyableItem text={entry.email} id={`h-${entry.id}-e`} copiedId={copiedId} onCopy={handleCopy} isMono={false} highlightQuery={search} />
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-600">{entry.notes}</td>
                                </>
                              )}
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── Add / Edit Modal (Managers / Admins only) ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#D6E2F0] animate-in zoom-in-95 duration-150 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#0F2F5A] text-white">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-300" />
                <h3 className="text-base font-semibold">
                  {formData.id ? "Edit Employee & Office Assignment" : "Add Employee to Directory"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isSubmitting && setModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Office / Location Dropdown (Reassign office) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Office Location <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.group_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, group_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <optgroup label="Offices">
                    {groups
                      .filter(g => g.group_type === "office")
                      .map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="HQ / Departments">
                    {groups
                      .filter(g => g.group_type === "custom")
                      .map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Reassigning office automatically moves this listing and updates the agent's assigned office.
                </p>
              </div>

              {/* Position / Role */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Role / Position
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value, role: e.target.value }))}
                  placeholder="e.g. CSR, Sales Producer, Manager"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="e.g. employee@farmersagent.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Phones Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    RingCentral Phone
                  </label>
                  <input
                    type="text"
                    value={formData.ring_central_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, ring_central_phone: e.target.value }))}
                    placeholder="(909) 555-0100 x101"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Ricochet Phone
                  </label>
                  <input
                    type="text"
                    value={formData.ricochet_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, ricochet_phone: e.target.value }))}
                    placeholder="(909) 555-0102"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Notes / Details
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. *S – CSR; Spanish Speaking"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 mt-2">
                {formData.id ? (
                  <button
                    type="button"
                    onClick={handleDeleteEntry}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{formData.id ? "Save Changes" : "Add Employee"}</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
