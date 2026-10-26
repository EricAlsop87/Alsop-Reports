"use client"

import React, { useState, useEffect, useMemo, useTransition } from "react"
import { useChat } from "@/lib/chat/chatContext"
import { useRouter } from "next/navigation"
import {
  Gift,
  Search,
  CheckCircle2,
  Clock,
  DollarSign,
  Users,
  Plus,
  Download,
  Filter,
  AlertCircle,
  Building2,
  Check,
  ChevronDown,
  ShieldAlert,
  Loader2,
  Calendar,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react"
import { ReferralEntry, ReferralSummary } from "@/lib/referralTypes"
import {
  getReferralsData,
  updateReferralEntry,
  addReferralEntry,
  deleteReferralEntry
} from "./actions"

const GIFT_PRESETS = [
  "Zelle",
  "Target",
  "Visa Gift Card",
  "Cash / Check",
  "Other"
]

const POLICY_PRESETS = [
  "Standard Auto",
  "Homeowners (HO-3)",
  "Renters",
  "Commercial BOP",
  "Dwelling Fire",
  "Condo",
  "Landlord",
  "Commercial Auto",
  "Motorcycle",
  "Umbrella",
  "Other"
]

const CARRIER_PRESETS = [
  "Allstate",
  "National General",
  "Hartford",
  "Foremost",
  "Bamboo",
  "Pacific Specialty",
  "CA Fair Plan",
  "Travelers",
  "Berkshire Hathaway",
  "Progressive",
  "Other"
]

const LEAD_SOURCE_PRESETS = [
  "Customer Referral",
  "Personal Referral",
  "Call in from advertising",
  "Realtor Partner",
  "Mortgage Partner",
  "Client Referral",
  "Instagram",
  "Other"
]

function getTodaySoldDate(): string {
  const d = new Date()
  const day = d.getDate()
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const m = months[d.getMonth()]
  const yr = String(d.getFullYear()).slice(-2)
  return `${day}-${m}-${yr}`
}

/**
 * Parses sold dates like "17-Sep-26", "4-Sep-26", "30-Sep-26" into epoch timestamps for sorting.
 */
export function parseSoldDate(dateStr: string | null | undefined): number {
  if (!dateStr) return 0
  const s = dateStr.trim()
  
  // Format: D-MMM-YY or DD-MMM-YY (e.g. 17-Sep-26, 4-Sep-26, 30-Sep-26)
  const dMmmYyMatch = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/)
  if (dMmmYyMatch) {
    const day = parseInt(dMmmYyMatch[1], 10)
    const monthStr = dMmmYyMatch[2].toLowerCase()
    let year = parseInt(dMmmYyMatch[3], 10)
    if (year < 100) year += 2000
    
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    }
    const month = months[monthStr] ?? 0
    return new Date(year, month, day).getTime()
  }

  // Format: YYYY-MM-DD or standard parseable dates
  const parsed = Date.parse(s)
  if (!isNaN(parsed)) return parsed

  return 0
}

export const OFFICE_DICT: Record<string, { code: string; name: string }> = {
  MC: { code: "MC", name: "Montclair" },
  MCM: { code: "MCM", name: "Montclair" },
  CH: { code: "CH", name: "Chino" },
  CM: { code: "CM", name: "Claremont" },
  CL: { code: "CL", name: "Claremont" },
  RC: { code: "RC", name: "Rancho Cucamonga" },
  MB: { code: "MB", name: "Montebello" },
  PQ: { code: "PQ", name: "Process & Quality" },
}

const PRODUCER_OFFICE_MAP: Record<string, string> = {
  // Montclair (MC)
  "eric alsop": "MC",
  "misty torrez": "MC",
  "misty": "MC",
  "suzanne yniguez": "MC",
  "suzanne": "MC",
  "brigilda aquino": "MC",
  "gilda aquino": "MC",
  "gilda": "MC",
  "alexandra quintana": "MC",
  "alexandra": "MC",
  "charmaine carrillo": "MC",
  "charmaine": "MC",
  "andrea alpine": "MC",
  "andrea": "MC",
  "christine lansing": "MC",
  "christine": "MC",
  "danielle self": "MC",
  "danielle": "MC",

  // Claremont (CM)
  "lori ohlhauser": "CM",
  "lori": "CM",
  "dawn zenor": "CM",
  "dawn": "CM",
  "denice santos": "CM",
  "denice": "CM",
  "chris elliott": "CM",
  "chris": "CM",
  "frank villalobos": "CM",
  "frank a villalobos": "CM",
  "frank": "CM",

  // Rancho Cucamonga (RC)
  "jennifer martinez": "RC",
  "liliana morales": "RC",
  "liliana": "RC",
  "maila castro": "RC",
  "maila": "RC",
  "sylvia duran": "RC",
  "sylvia": "RC",
  "rosalba lozano": "RC",
  "rosalba": "RC",
  "claudia sambrano": "RC",
  "claudia": "RC",
  "eddie sanchez": "RC",
  "eddie": "RC",
  "isabel torres": "RC",
  "isabel": "RC",
  "taylor davis": "RC",
  "taylor": "RC",
  "estela montalvo": "RC",
  "estela jimenez": "RC",
  "estela": "RC",
  "angelina": "RC",

  // Chino (CH)
  "john paul dizon": "CH",
  "giselle ramos": "CH",
  "giselle": "CH",
  "edwin sernas": "CH",
  "edwin": "CH",
  "roxanna topete": "CH",
  "roxana topete": "CH",
  "roxana": "CH",
  "jerome delfin": "CH",
  "jerome": "CH",
  "alex clancy": "CH",
  "alex": "CH",
  "danny bonilla": "CH",
  "danny": "CH",

  // Montebello (MB)
  "ricardo becerra": "MB",
  "ric becerra": "MB",
  "juanita calderon": "MB",
  "juanita": "MB",
  "rosario delgado": "MB",
  "rosie delgado": "MB",
  "rosie": "MB",
  "jose huerta": "MB",
  "jose": "MB",
  "christian reyes": "MB",
  "christian": "MB",
  "jenna zazueta": "MB",
  "jenna": "MB",
  "nancy gutierrez": "MB",
  "nancy g": "MB",
  "robert lewis": "MB",
  "robert lewis jr": "MB",
  "robert": "MB",
  "myles vinluan": "MB",
  "myles": "MB",
  "jonathan": "MB",

  // Process & Quality (PQ)
  "nancy maldonado": "PQ",
  "nancy": "PQ",
  "greg alsop": "PQ",
  "diane bedard": "PQ",
  "esmeralda cervantes": "PQ",
  "esme": "PQ",
  "cynthia romero-larias": "PQ",
  "carmen davis": "PQ",
  "carmen “gabby” davis": "PQ",
  "gabby davis": "PQ",
  "gabby": "PQ",
  "ariana crawford": "PQ",
  "ariana": "PQ",
  "olga soto": "PQ",
  "donna priddy": "PQ",
  "teyssy espino": "PQ",
  "teyssy": "PQ",
  "diana ramirez": "PQ",
  "diana": "PQ",
  "zypher schnakenberg": "PQ",
  "zypher": "PQ",
}

export function getProducerOfficeCodes(producer: string | null | undefined): string[] {
  if (!producer) return []
  const norm = producer.toLowerCase().replace(/\s+/g, " ").trim()
  const subParts = norm.split(",").map(s => s.trim())
  const codes: string[] = []

  for (const part of subParts) {
    if (PRODUCER_OFFICE_MAP[part]) {
      codes.push(PRODUCER_OFFICE_MAP[part])
      continue
    }
    // Fuzzy search
    let found = false
    for (const [key, code] of Object.entries(PRODUCER_OFFICE_MAP)) {
      if (part.includes(key) || key.includes(part)) {
        codes.push(code)
        found = true
        break
      }
    }
    if (!found) {
      for (const [code] of Object.entries(OFFICE_DICT)) {
        if (part.toUpperCase().includes(code)) {
          codes.push(code)
          break
        }
      }
    }
  }
  return codes
}

export function getProducerOfficeDisplay(producer: string | null | undefined): string {
  const codes = getProducerOfficeCodes(producer)
  if (codes.length === 0) return ""
  return codes.map(c => `${OFFICE_DICT[c]?.name || c} (${c})`).join(" & ")
}

function toTitleCase(str: string | null | undefined): string {
  if (!str) return ""
  return str.replace(/\b[A-Za-z0-9'-]+\b/g, (word) => {
    const upper = word.toUpperCase()
    // Acronyms to preserve
    if (upper === "LLC") return "LLC"
    if (upper === "BOP") return "BOP"
    if (upper === "DP3") return "DP3"
    if (upper === "CA") return "CA"

    const isAllUpper = word === upper
    const isAllLower = word === word.toLowerCase()
    if (isAllUpper || isAllLower) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    }
    return word
  })
}

export default function ReferralsPage() {
  const router = useRouter()
  const { currentAgent } = useChat()

  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<ReferralEntry[]>([])
  const [summary, setSummary] = useState<ReferralSummary>({
    totalReferrals: 0,
    giftsSentCount: 0,
    giftsPendingCount: 0,
    totalAmountSent: 0,
    allPoliciesCount: 0,
  })
  const [selectedMonth, setSelectedMonth] = useState("2026-09")
  const [availableMonths, setAvailableMonths] = useState<string[]>(["2026-09", "2026-10"])

  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "sent" | "needs_amount">("all")
  const [selectedOffice, setSelectedOffice] = useState<string>("all")
  const [selectedProducer, setSelectedProducer] = useState<string>("all")
  const [selectedLeadSource, setSelectedLeadSource] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Inline editing state tracking
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null)

  // Add Referral Modal
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newCustomer, setNewCustomer] = useState("")
  const [newProducer, setNewProducer] = useState("")
  const [customProducer, setCustomProducer] = useState("")
  const [newSource, setNewSource] = useState("Customer Referral")
  const [customSource, setCustomSource] = useState("")
  const [newPolicy, setNewPolicy] = useState("Standard Auto")
  const [customPolicy, setCustomPolicy] = useState("")
  const [newCarrier, setNewCarrier] = useState("Allstate")
  const [customCarrier, setCustomCarrier] = useState("")
  const [newSoldDate, setNewSoldDate] = useState(() => getTodaySoldDate())
  const [newAmount, setNewAmount] = useState("10.00")
  const [newGiftType, setNewGiftType] = useState("")
  const [customGiftType, setCustomGiftType] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Quick Add Row (Inline table entry)
  const [showQuickAddRow, setShowQuickAddRow] = useState(true)
  const [quickCustomer, setQuickCustomer] = useState("")
  const [quickProducer, setQuickProducer] = useState("")
  const [quickPolicy, setQuickPolicy] = useState("Standard Auto")
  const [quickCarrier, setQuickCarrier] = useState("Allstate")
  const [quickSource, setQuickSource] = useState("Customer Referral")
  const [quickCustomSource, setQuickCustomSource] = useState("")
  const [quickSoldDate, setQuickSoldDate] = useState(() => getTodaySoldDate())
  const [quickAmount, setQuickAmount] = useState("10.00")
  const [quickGiftType, setQuickGiftType] = useState("")
  const [quickCustomGiftType, setQuickCustomGiftType] = useState("")
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false)

  // Custom gift tracking for table rows
  const [customGiftRows, setCustomGiftRows] = useState<Record<string, string>>({})

  // Sorting state: default to "sold_date" descending (from recent date to first date of the month)
  const [sortKey, setSortKey] = useState<"sold_date" | "customer" | "producer" | "amount">("sold_date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  // Recipient Notes Drawer
  const [notesModalEntry, setNotesModalEntry] = useState<ReferralEntry | null>(null)
  const [notesDraft, setNotesDraft] = useState("")

  // Role verification
  const isManagerOrAdmin = useMemo(() => {
    if (!currentAgent) return false
    return currentAgent.role === "admin" || currentAgent.team === "Managers" || currentAgent.team === "Support"
  }, [currentAgent])

  // Load data
  const loadData = async (monthKey: string) => {
    try {
      setLoading(true)
      const res = await getReferralsData(monthKey)
      if (res.success) {
        setEntries(res.entries)
        setSummary(res.summary)
        if (res.availableMonths) setAvailableMonths(res.availableMonths)
      }
    } catch (err) {
      console.error("Failed to load referrals:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(selectedMonth)
  }, [selectedMonth])

  // Flash toast
  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type })
    setTimeout(() => setToastMsg(null), 3500)
  }

  // Producers list (filtered by selectedOffice if active)
  const producersList = useMemo(() => {
    const set = new Set<string>()
    entries.forEach(e => {
      if (e.producer) {
        const pCodes = getProducerOfficeCodes(e.producer)
        const matchOffice = selectedOffice === "all" || pCodes.some(c => 
          c === selectedOffice || 
          (selectedOffice === "MC" && (c === "MCM" || c === "MC")) ||
          (selectedOffice === "CM" && (c === "CL" || c === "CM")) ||
          (selectedOffice === "CL" && (c === "CL" || c === "CM"))
        )
        if (matchOffice) {
          set.add(e.producer)
        }
      }
    })
    return Array.from(set).sort()
  }, [entries, selectedOffice])

  // Comprehensive active producers list across all branches and entries
  const allProducers = useMemo(() => {
    const map = new Map<string, string>()
    entries.forEach(e => {
      if (e.producer && e.producer.trim()) {
        const title = toTitleCase(e.producer.trim())
        map.set(title.toLowerCase(), title)
      }
    })
    Object.keys(PRODUCER_OFFICE_MAP).forEach(k => {
      if (k.includes(" ")) {
        const title = toTitleCase(k.trim())
        if (!map.has(title.toLowerCase())) {
          map.set(title.toLowerCase(), title)
        }
      }
    })
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b))
  }, [entries])

  // Lead sources list & frequency (filtered by selectedOffice if active)
  const leadSourceStats = useMemo(() => {
    const counts: Record<string, number> = {}
    entries.forEach(e => {
      const pCodes = getProducerOfficeCodes(e.producer)
        const matchOffice = selectedOffice === "all" || pCodes.some(c => 
          c === selectedOffice || 
          (selectedOffice === "MC" && (c === "MCM" || c === "MC")) ||
          (selectedOffice === "CM" && (c === "CL" || c === "CM")) ||
          (selectedOffice === "CL" && (c === "CL" || c === "CM"))
        )
        if (matchOffice) {
        const src = (e.lead_source || "Direct").trim()
        if (src) {
          counts[src] = (counts[src] || 0) + 1
        }
      }
    })
    const sortedByCount = Object.entries(counts).sort((a, b) => b[1] - a[1])
    const allSources = Object.keys(counts).sort((a, b) => a.localeCompare(b))
    const topSources = sortedByCount.slice(0, 7).map(([src]) => src)

    return { allSources, topSources, counts }
  }, [entries, selectedOffice])

  const displayLeadSourcePills = useMemo(() => {
    const pills = [...leadSourceStats.topSources]
    if (
      selectedLeadSource !== "all" &&
      !pills.some(p => p.toLowerCase() === selectedLeadSource.toLowerCase())
    ) {
      pills.push(selectedLeadSource)
    }
    return pills
  }, [leadSourceStats.topSources, selectedLeadSource])

  // Combined lead sources including presets and all sources in active data (ensuring 'Other' is strictly unique at the end)
  const availableLeadSources = useMemo(() => {
    const set = new Set<string>(
      LEAD_SOURCE_PRESETS.filter(s => s.toLowerCase().trim() !== "other")
    )
    leadSourceStats.allSources.forEach(s => {
      const trimmed = s?.trim()
      if (trimmed && trimmed.toLowerCase() !== "other") {
        set.add(toTitleCase(trimmed))
      }
    })
    return [...Array.from(set).sort((a, b) => a.localeCompare(b)), "Other"]
  }, [leadSourceStats.allSources])

  // Filtered and sorted rows
  const filteredEntries = useMemo(() => {
    const list = entries.filter(e => {
      // 1. Status filter
      if (statusFilter === "pending" && e.gift_status !== "pending") return false
      if (statusFilter === "sent" && e.gift_status !== "sent") return false
      if (statusFilter === "needs_amount" && (e.amount !== null && e.amount > 0)) return false

      // 2. Office filter
      if (selectedOffice !== "all") {
        const codes = getProducerOfficeCodes(e.producer)
        const matchOffice = codes.some(c => 
          c === selectedOffice || 
          (selectedOffice === "MC" && (c === "MCM" || c === "MC")) ||
          (selectedOffice === "CM" && (c === "CL" || c === "CM")) ||
          (selectedOffice === "CL" && (c === "CL" || c === "CM"))
        )
        if (!matchOffice) return false
      }

      // 3. Producer filter
      if (selectedProducer !== "all" && e.producer !== selectedProducer) return false

      // 4. Lead Source filter
      if (selectedLeadSource !== "all") {
        const src = (e.lead_source || "Direct").trim()
        if (src.toLowerCase() !== selectedLeadSource.toLowerCase()) return false
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = e.customer_name?.toLowerCase().includes(q)
        const matchProd = e.producer?.toLowerCase().includes(q)
        const matchOffice = getProducerOfficeCodes(e.producer).some(c => 
          c.toLowerCase().includes(q) || OFFICE_DICT[c]?.name.toLowerCase().includes(q)
        )
        const matchSrc = e.lead_source?.toLowerCase().includes(q)
        const matchPol = e.policy_type?.toLowerCase().includes(q)
        const matchCarrier = e.carrier?.toLowerCase().includes(q)
        if (!matchName && !matchProd && !matchOffice && !matchSrc && !matchPol && !matchCarrier) return false
      }

      return true
    })

    // Sort entries: default from recent date to first date of the month (descending)
    return [...list].sort((a, b) => {
      if (sortKey === "sold_date") {
        const dateA = parseSoldDate(a.sold_date)
        const dateB = parseSoldDate(b.sold_date)
        if (dateA !== dateB) {
          return sortDir === "desc" ? dateB - dateA : dateA - dateB
        }
      } else if (sortKey === "customer") {
        const cmp = (a.customer_name || "").localeCompare(b.customer_name || "")
        if (cmp !== 0) return sortDir === "desc" ? -cmp : cmp
      } else if (sortKey === "producer") {
        const cmp = (a.producer || "").localeCompare(b.producer || "")
        if (cmp !== 0) return sortDir === "desc" ? -cmp : cmp
      } else if (sortKey === "amount") {
        const valA = a.amount || 0
        const valB = b.amount || 0
        if (valA !== valB) return sortDir === "desc" ? valB - valA : valA - valB
      }
      // Tie breaker by sold_date descending
      return parseSoldDate(b.sold_date) - parseSoldDate(a.sold_date)
    })
  }, [entries, statusFilter, selectedOffice, selectedProducer, selectedLeadSource, searchQuery, sortKey, sortDir])

  // Inline update handlers
  const handleToggleStatus = async (entry: ReferralEntry) => {
    const nextStatus = entry.gift_status === "sent" ? "pending" : "sent"
    const today = new Date().toISOString().split("T")[0]
    const nextDate = nextStatus === "sent" ? (entry.date_sent || today) : null

    setSavingId(entry.id)
    try {
      const res = await updateReferralEntry(
        entry.id,
        {
          gift_status: nextStatus,
          date_sent: nextDate,
        },
        currentAgent?.name
      )

      if (res.success) {
        setEntries(prev =>
          prev.map(item =>
            item.id === entry.id
              ? {
                  ...item,
                  gift_status: nextStatus,
                  date_sent: nextDate,
                  updated_by: currentAgent?.name || "Manager",
                  updated_at: new Date().toISOString(),
                }
              : item
          )
        )
        // Refresh summary
        setSummary(prev => {
          const delta = nextStatus === "sent" ? 1 : -1
          const amt = Number(entry.amount) || 0
          return {
            ...prev,
            giftsSentCount: prev.giftsSentCount + delta,
            giftsPendingCount: prev.giftsPendingCount - delta,
            totalAmountSent: prev.totalAmountSent + (nextStatus === "sent" ? amt : -amt),
          }
        })
        showToast(
          nextStatus === "sent"
            ? `Marked ${entry.customer_name}'s gift as Sent!`
            : `Marked ${entry.customer_name}'s gift as Pending.`
        )
      }
    } catch (err) {
      showToast("Failed to update status", "error")
    } finally {
      setSavingId(null)
    }
  }

  const handleAmountChange = async (entry: ReferralEntry, newAmtStr: string) => {
    const num = parseFloat(newAmtStr)
    const val = isNaN(num) ? null : num

    setSavingId(entry.id)
    try {
      const res = await updateReferralEntry(entry.id, { amount: val }, currentAgent?.name)
      if (res.success) {
        setEntries(prev =>
          prev.map(item =>
            item.id === entry.id
              ? { ...item, amount: val, updated_by: currentAgent?.name || "Manager" }
              : item
          )
        )
        showToast(`Updated amount for ${entry.customer_name}`)
      }
    } catch {
      showToast("Failed to update amount", "error")
    } finally {
      setSavingId(null)
    }
  }

  const handleGiftTypeChange = async (entry: ReferralEntry, newType: string) => {
    setSavingId(entry.id)
    const val = newType || null
    try {
      const res = await updateReferralEntry(entry.id, { gift_type: val }, currentAgent?.name)
      if (res.success) {
        setEntries(prev =>
          prev.map(item =>
            item.id === entry.id
              ? { ...item, gift_type: val, updated_by: currentAgent?.name || "Manager" }
              : item
          )
        )
        if (val) {
          showToast(`Gift set to ${val}`)
        } else {
          showToast("Gift type cleared")
        }
      }
    } catch {
      showToast("Failed to update gift type", "error")
    } finally {
      setSavingId(null)
    }
  }

  const handleSaveNotes = async () => {
    if (!notesModalEntry) return
    setSavingId(notesModalEntry.id)
    try {
      const res = await updateReferralEntry(
        notesModalEntry.id,
        { recipient_notes: notesDraft.trim() || null },
        currentAgent?.name
      )
      if (res.success) {
        setEntries(prev =>
          prev.map(item =>
            item.id === notesModalEntry.id
              ? { ...item, recipient_notes: notesDraft.trim() || null }
              : item
          )
        )
        setNotesModalEntry(null)
        showToast("Recipient details saved")
      }
    } catch {
      showToast("Failed to save details", "error")
    } finally {
      setSavingId(null)
    }
  }

  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault()
    const producerVal = (newProducer === "__custom__" ? customProducer : newProducer).trim()
    const customerVal = newCustomer.trim()
    const sourceVal = (newSource === "Other" ? customSource : newSource).trim() || "Customer Referral"
    const policyVal = (newPolicy === "Other" ? customPolicy : newPolicy).trim() || "Standard Auto"
    const carrierVal = (newCarrier === "Other" ? customCarrier : newCarrier).trim() || "Allstate"
    const giftTypeVal = (newGiftType === "Other" ? customGiftType : newGiftType).trim() || null

    if (!customerVal || !producerVal) {
      showToast("Please enter Customer and select Producer agent", "error")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await addReferralEntry(
        {
          month_key: selectedMonth,
          customer_name: customerVal,
          producer: producerVal,
          lead_source: sourceVal,
          policy_type: policyVal,
          carrier: carrierVal,
          sold_date: newSoldDate.trim() || getTodaySoldDate(),
          is_referral: true,
          amount: parseFloat(newAmount) || 10.00,
          gift_type: giftTypeVal,
          gift_status: "pending",
          date_sent: null,
          recipient_notes: null,
        },
        currentAgent?.name
      )

      if (res.success && res.entry) {
        setEntries(prev => [res.entry!, ...prev])
        setSummary(prev => ({
          ...prev,
          totalReferrals: prev.totalReferrals + 1,
          giftsPendingCount: prev.giftsPendingCount + 1,
          allPoliciesCount: prev.allPoliciesCount + 1,
        }))
        setAddModalOpen(false)
        setNewCustomer("")
        setNewProducer("")
        setCustomProducer("")
        setCustomSource("")
        setCustomPolicy("")
        setCustomCarrier("")
        setNewGiftType("")
        setCustomGiftType("")
        showToast(`Added referral for ${customerVal}!`)
      } else {
        showToast("Failed to add referral", "error")
      }
    } catch {
      showToast("Failed to add referral", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQuickAdd = async () => {
    const cust = quickCustomer.trim()
    const prod = quickProducer.trim()

    if (!cust) {
      showToast("Please enter customer name", "error")
      return
    }
    if (!prod) {
      showToast("Please select a producer agent", "error")
      return
    }

    const finalSource = (quickSource === "Other" ? quickCustomSource : quickSource).trim() || "Customer Referral"
    const finalGift = (quickGiftType === "Other" ? quickCustomGiftType : quickGiftType).trim() || null

    setIsQuickSubmitting(true)
    try {
      const res = await addReferralEntry(
        {
          month_key: selectedMonth,
          customer_name: cust,
          producer: prod,
          lead_source: finalSource,
          policy_type: quickPolicy.trim() || "Standard Auto",
          carrier: quickCarrier.trim() || "Allstate",
          sold_date: quickSoldDate.trim() || getTodaySoldDate(),
          is_referral: true,
          amount: parseFloat(quickAmount) || 10.00,
          gift_type: finalGift,
          gift_status: "pending",
          date_sent: null,
          recipient_notes: null,
        },
        currentAgent?.name
      )

      if (res.success && res.entry) {
        setEntries(prev => [res.entry!, ...prev])
        setSummary(prev => ({
          ...prev,
          totalReferrals: prev.totalReferrals + 1,
          giftsPendingCount: prev.giftsPendingCount + 1,
          allPoliciesCount: prev.allPoliciesCount + 1,
        }))
        setQuickCustomer("")
        setQuickGiftType("")
        setQuickCustomGiftType("")
        setQuickCustomSource("")
        showToast(`Added referral for ${cust}!`)
      } else {
        showToast("Failed to add referral", "error")
      }
    } catch {
      showToast("Failed to add referral", "error")
    } finally {
      setIsQuickSubmitting(false)
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Producer",
      "Office",
      "Lead Source",
      "Policy Type",
      "Customer",
      "Sold Date",
      "Carrier",
      "Is Referral",
      "Amount$",
      "Gift Type",
      "Status",
      "Date Sent",
      "Notes"
    ]
    const rows = filteredEntries.map(e => [
      `"${e.producer || ""}"`,
      `"${getProducerOfficeDisplay(e.producer)}"`,
      `"${e.lead_source || ""}"`,
      `"${e.policy_type || ""}"`,
      `"${e.customer_name || ""}"`,
      `"${e.sold_date || ""}"`,
      `"${e.carrier || ""}"`,
      e.is_referral ? "Yes" : "No",
      e.amount || "",
      `"${e.gift_type || ""}"`,
      e.gift_status,
      `"${e.date_sent || ""}"`,
      `"${e.recipient_notes || ""}"`
    ])

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `alsop_referral_program_${selectedMonth}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Authorization check (if currentAgent loaded and not manager/admin)
  if (currentAgent && !isManagerOrAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-5">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Manager Access Required
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            The <strong>Alsop Referral Program</strong> dashboard is restricted to agency managers and administrators for gift disbursement tracking.
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors text-sm"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-white text-sm font-medium animate-in fade-in slide-in-from-bottom-5 duration-200 ${
            toastMsg.type === "success" ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {toastMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-rose-500 to-amber-500 text-white rounded-2xl shadow-md">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Alsop Referral Program
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                Manager Only
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Monthly customer & partner referral gift fulfillment tracker
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Month Selector */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="2026-09">September 2026</option>
              <option value="2026-10">October 2026</option>
              <option value="2026-11">November 2026</option>
            </select>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowQuickAddRow(prev => !prev)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors border ${
              showQuickAddRow
                ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
            }`}
            title="Toggle inline quick add row in table"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{showQuickAddRow ? "Hide Quick Row" : "Quick Add Row"}</span>
          </button>

          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Referral</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Referrals */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Referrals
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {summary.totalReferrals}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              in {selectedMonth === "2026-09" ? "September" : selectedMonth}
            </span>
          </div>
        </div>

        {/* Gifts Sent */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Gifts Sent
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {summary.giftsSentCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({summary.totalReferrals > 0 ? Math.round((summary.giftsSentCount / summary.totalReferrals) * 100) : 0}%)
            </span>
          </div>
        </div>

        {/* Pending Fulfillment */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Pending Gifts
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {summary.giftsPendingCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">needs delivery</span>
          </div>
        </div>

        {/* Total Disbursed */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Paid Out
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              ${summary.totalAmountSent.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">disbursed</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        {/* Top filter row: Heading & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Referrals & Sold Policies
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              {filteredEntries.length} Total
            </span>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customer, producer, source, carrier..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom filter row: Office, Status, Producer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
          <div className="flex flex-wrap items-center gap-4">
            {/* Office Filter (2-letter codes) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-0.5">
                Office:
              </span>
              <button
                onClick={() => {
                  setSelectedOffice("all")
                  setSelectedProducer("all")
                  setSelectedLeadSource("all")
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  selectedOffice === "all"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                All
              </button>
              {(["MC", "CH", "CM", "RC", "MB", "PQ"] as const).map(code => (
                <button
                  key={code}
                  onClick={() => {
                    setSelectedOffice(selectedOffice === code ? "all" : code)
                    setSelectedProducer("all")
                    setSelectedLeadSource("all")
                  }}
                  title={OFFICE_DICT[code].name}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    selectedOffice === code
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-0.5">
                Status:
              </span>
              {(["all", "pending", "sent", "needs_amount"] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    statusFilter === st
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                      : "bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  {st === "needs_amount" ? "Needs Amount" : st === "all" ? "All" : st === "pending" ? "Pending" : "Sent"}
                </button>
              ))}
            </div>
          </div>

          {/* Dropdown Filters (Producer & Lead Source) */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Producer filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Producer:
              </span>
              <select
                value={selectedProducer}
                onChange={e => setSelectedProducer(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">
                  {selectedOffice !== "all" ? `All in ${selectedOffice} (${producersList.length})` : `All Producers (${producersList.length})`}
                </option>
                {producersList.map(p => (
                  <option key={p} value={p}>
                    {toTitleCase(p)}
                  </option>
                ))}
              </select>
            </div>

            {/* Lead Source dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Lead Source:
              </span>
              <select
                value={selectedLeadSource}
                onChange={e => setSelectedLeadSource(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">
                  {selectedOffice !== "all"
                    ? `All Sources in ${selectedOffice} (${leadSourceStats.allSources.length})`
                    : `All Lead Sources (${leadSourceStats.allSources.length})`}
                </option>
                {leadSourceStats.allSources.map(src => (
                  <option key={src} value={src}>
                    {toTitleCase(src)} ({leadSourceStats.counts[src]})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-900/40 text-xs font-bold text-slate-600 dark:text-slate-300">
                <th
                  className="py-3 px-4 cursor-pointer select-none hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => {
                    if (sortKey === "customer") setSortDir(d => d === "asc" ? "desc" : "asc")
                    else { setSortKey("customer"); setSortDir("asc"); }
                  }}
                  title="Click to sort by Customer"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Customer</span>
                    {sortKey === "customer" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer select-none hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => {
                    if (sortKey === "producer") setSortDir(d => d === "asc" ? "desc" : "asc")
                    else { setSortKey("producer"); setSortDir("asc"); }
                  }}
                  title="Click to sort by Producer"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Producer</span>
                    {sortKey === "producer" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Policy / Carrier / Lead Source</th>
                <th
                  className="py-3 px-3 text-center whitespace-nowrap cursor-pointer select-none hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors bg-blue-50/50 dark:bg-blue-950/20"
                  onClick={() => {
                    if (sortKey === "sold_date") setSortDir(d => d === "desc" ? "asc" : "desc")
                    else { setSortKey("sold_date"); setSortDir("desc"); }
                  }}
                  title="Click to sort: Recent date to first date of the month"
                >
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>Sold Date</span>
                    {sortKey === "sold_date" ? (
                      sortDir === "desc" ? (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                </th>
                <th
                  className="py-3 px-3 text-center whitespace-nowrap cursor-pointer select-none hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => {
                    if (sortKey === "amount") setSortDir(d => d === "desc" ? "asc" : "desc")
                    else { setSortKey("amount"); setSortDir("desc"); }
                  }}
                  title="Click to sort by Amount"
                >
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>Amount ($)</span>
                    {sortKey === "amount" ? (
                      sortDir === "desc" ? <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> : <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">Gift Type</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Gift Status</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Date Sent</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>Loading referral list...</span>
                  </td>
                </tr>
              ) : (
                <>
                  {/* Quick Add Row (Inline Table Entry) */}
                  {showQuickAddRow && (
                    <tr className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-blue-50/80 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-blue-950/40 border-b-2 border-blue-200 dark:border-blue-800">
                      {/* Customer */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          placeholder="+ New Customer (Press Enter to Save)..."
                          value={quickCustomer}
                          onChange={e => setQuickCustomer(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") handleQuickAdd()
                          }}
                          className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-600 rounded-lg shadow-inner placeholder:text-blue-400/80 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                        />
                      </td>

                      {/* Producer */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <select
                          value={quickProducer}
                          onChange={e => setQuickProducer(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-600 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                        >
                          <option value="" className="text-slate-400">Select Producer...</option>
                          {allProducers.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </td>

                      {/* Policy / Carrier / Lead Source */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-1 min-w-[210px]">
                          <div className="grid grid-cols-2 gap-1">
                            <select
                              value={quickPolicy}
                              onChange={e => setQuickPolicy(e.target.value)}
                              className="w-full px-1.5 py-1 text-[11px] font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md cursor-pointer focus:outline-none text-slate-800 dark:text-slate-200"
                            >
                              {POLICY_PRESETS.map(pol => (
                                <option key={pol} value={pol}>{pol}</option>
                              ))}
                            </select>
                            <select
                              value={quickCarrier}
                              onChange={e => setQuickCarrier(e.target.value)}
                              className="w-full px-1.5 py-1 text-[11px] font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md cursor-pointer focus:outline-none text-slate-800 dark:text-slate-200"
                            >
                              {CARRIER_PRESETS.map(car => (
                                <option key={car} value={car}>{car}</option>
                              ))}
                            </select>
                          </div>
                          <select
                            value={quickSource}
                            onChange={e => setQuickSource(e.target.value)}
                            className="w-full px-1.5 py-1 text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-md cursor-pointer focus:outline-none"
                          >
                            {availableLeadSources.map((src, idx) => (
                              <option key={`quick-src-${src}-${idx}`} value={src}>{src}</option>
                            ))}
                          </select>
                          {quickSource === "Other" && (
                            <input
                              type="text"
                              autoFocus
                              placeholder="Type custom lead source..."
                              value={quickCustomSource}
                              onChange={e => setQuickCustomSource(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") handleQuickAdd()
                              }}
                              className="w-full px-1.5 py-1 text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-white dark:bg-slate-900 border border-purple-400 dark:border-purple-600 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder:text-purple-400/60 shadow-inner"
                            />
                          )}
                        </div>
                      </td>

                      {/* Sold Date */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <input
                          type="text"
                          value={quickSoldDate}
                          onChange={e => setQuickSoldDate(e.target.value)}
                          className="w-20 px-2 py-1 text-center text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none text-slate-800 dark:text-slate-200"
                        />
                      </td>

                      {/* Amount ($) */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="relative inline-flex items-center">
                          <span className="text-slate-400 text-xs absolute left-2 pointer-events-none">$</span>
                          <input
                            type="number"
                            step="5"
                            value={quickAmount}
                            onChange={e => setQuickAmount(e.target.value)}
                            className="w-16 pl-5 pr-2 py-1 text-center font-bold text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      </td>

                      {/* Gift Type */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 min-w-[150px]">
                          <select
                            value={quickGiftType}
                            onChange={e => setQuickGiftType(e.target.value)}
                            className={`w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer focus:outline-none ${
                              !quickGiftType ? "text-slate-400 italic text-[11px]" : "text-xs font-semibold text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            <option value="" className="text-slate-400 italic text-[11px]">
                              Click to choose Gift Type
                            </option>
                            {GIFT_PRESETS.map(g => (
                              <option key={g} value={g} className="text-slate-800 dark:text-slate-200 font-normal not-italic text-xs">
                                {g}
                              </option>
                            ))}
                          </select>
                          {quickGiftType === "Other" && (
                            <input
                              type="text"
                              autoFocus
                              placeholder="Type custom gift..."
                              value={quickCustomGiftType}
                              onChange={e => setQuickCustomGiftType(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") handleQuickAdd()
                              }}
                              className="w-full px-2 py-1 text-xs font-semibold bg-white dark:bg-slate-900 border border-blue-400 dark:border-blue-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal placeholder:italic shadow-xs text-slate-900 dark:text-white"
                            />
                          )}
                        </div>
                      </td>

                      {/* Gift Status */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-200/80">
                          <Clock className="w-3 h-3" />
                          <span>Pending</span>
                        </span>
                      </td>

                      {/* Date Sent */}
                      <td className="py-2.5 px-3 text-center text-slate-400 text-xs whitespace-nowrap font-medium">
                        —
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={handleQuickAdd}
                          disabled={isQuickSubmitting}
                          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                          title="Save new referral entry directly to table"
                        >
                          {isQuickSubmitting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          )}
                          <span>Add</span>
                        </button>
                      </td>
                    </tr>
                  )}

                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Gift className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="font-semibold text-slate-600 dark:text-slate-300">
                          No records match the current filter
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Try clearing search filters or add a referral using the top row
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map(entry => {
                  const isSent = entry.gift_status === "sent"
                  const isPending = entry.gift_status === "pending"

                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors ${
                        isSent ? "bg-emerald-50/20 dark:bg-emerald-950/10" : ""
                      }`}
                    >
                      {/* Customer */}
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                            {toTitleCase(entry.customer_name)}
                          </span>
                          {entry.city && (
                            <span className="text-[11px] text-slate-400 font-normal">
                              {toTitleCase(entry.city)}, {entry.state || "CA"}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Producer */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                            {toTitleCase(entry.producer)}
                          </span>
                          {getProducerOfficeDisplay(entry.producer) && (
                            <span className="text-[11px] text-slate-400 font-normal">
                              {getProducerOfficeDisplay(entry.producer)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Policy / Carrier / Lead Source */}
                      <td className="py-2.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                              {toTitleCase(entry.policy_type)}
                            </span>
                            {entry.policy_count && entry.policy_count > 1 ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                {entry.policy_count} policies
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-normal flex-wrap">
                            <span>{toTitleCase(entry.carrier || "Direct")}</span>
                            {entry.lead_source && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600 font-bold">•</span>
                                <span className="font-medium text-purple-600 dark:text-purple-400">
                                  {toTitleCase(entry.lead_source)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Sold Date */}
                      <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                        {entry.sold_date}
                      </td>

                      {/* Amount ($) - Inline editable */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="relative inline-flex items-center">
                          <span className="text-slate-400 text-xs absolute left-2 pointer-events-none">$</span>
                          <input
                            type="number"
                            step="5"
                            defaultValue={entry.amount !== null ? entry.amount : ""}
                            placeholder="0.00"
                            onBlur={e => handleAmountChange(entry, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                e.currentTarget.blur()
                              }
                            }}
                            className="w-16 pl-5 pr-2 py-1 text-center font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </td>

                      {/* Gift Type - Dropdown & Custom Type */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 min-w-[150px]">
                          <select
                            value={
                              !entry.gift_type || entry.gift_type === "$10.00 Visa Card" || entry.gift_type === "$10 Visa Card"
                                ? ""
                                : ["Zelle", "Target", "Visa Gift Card", "Cash / Check"].includes(entry.gift_type)
                                ? entry.gift_type
                                : "Other"
                            }
                            onChange={e => {
                              const val = e.target.value
                              if (val === "Other") {
                                setCustomGiftRows(prev => ({
                                  ...prev,
                                  [entry.id]: entry.gift_type === "Other" ? "" : (entry.gift_type || "")
                                }))
                                handleGiftTypeChange(entry, "Other")
                              } else {
                                setCustomGiftRows(prev => {
                                  const next = { ...prev }
                                  delete next[entry.id]
                                  return next
                                })
                                handleGiftTypeChange(entry, val)
                              }
                            }}
                            className={`px-2 py-1 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none cursor-pointer transition-colors ${
                              !entry.gift_type || entry.gift_type === "$10.00 Visa Card" || entry.gift_type === "$10 Visa Card"
                                ? "text-slate-400 dark:text-slate-500 italic text-[11px]"
                                : "text-xs font-semibold text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            <option value="" className="text-slate-400 italic text-[11px]">
                              Click to choose Gift Type
                            </option>
                            {GIFT_PRESETS.map(g => (
                              <option key={g} value={g} className="text-slate-800 dark:text-slate-200 font-normal not-italic text-xs">
                                {g}
                              </option>
                            ))}
                          </select>

                          {(entry.gift_type === "Other" ||
                            customGiftRows[entry.id] !== undefined ||
                            (entry.gift_type && !["Zelle", "Target", "Visa Gift Card", "Cash / Check", "$10.00 Visa Card", "$10 Visa Card"].includes(entry.gift_type))) && (
                            <input
                              type="text"
                              autoFocus={entry.gift_type === "Other" && !customGiftRows[entry.id]}
                              placeholder="Type custom gift..."
                              defaultValue={entry.gift_type === "Other" ? (customGiftRows[entry.id] || "") : entry.gift_type || ""}
                              onBlur={e => {
                                const customVal = e.target.value.trim()
                                if (customVal && customVal !== "Other") {
                                  handleGiftTypeChange(entry, customVal)
                                }
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  const customVal = e.currentTarget.value.trim()
                                  if (customVal && customVal !== "Other") {
                                    handleGiftTypeChange(entry, customVal)
                                  }
                                  e.currentTarget.blur()
                                }
                              }}
                              className="w-full px-2 py-1 text-xs font-semibold bg-white dark:bg-slate-900 border border-blue-400 dark:border-blue-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400 placeholder:font-normal placeholder:italic shadow-xs text-slate-900 dark:text-white"
                            />
                          )}
                        </div>
                      </td>

                      {/* Gift Status - 1-Click Interactive Toggle */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(entry)}
                          disabled={savingId === entry.id}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all shadow-xs ${
                            isSent
                              ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                              : isPending
                              ? "bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          }`}
                          title="Click to toggle Sent / Pending"
                        >
                          {savingId === entry.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isSent ? (
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          <span>{isSent ? "Sent" : isPending ? "Pending" : "N/A"}</span>
                        </button>
                      </td>

                      {/* Date Sent */}
                      <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300 text-xs whitespace-nowrap">
                        {entry.date_sent ? (
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {entry.date_sent}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Details / Notes button */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => {
                            setNotesModalEntry(entry)
                            setNotesDraft(entry.recipient_notes || "")
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                            entry.recipient_notes ? "text-blue-600 font-bold underline" : "text-slate-400 hover:text-slate-600"
                          }`}
                          title="Edit recipient details or delivery notes"
                        >
                          {entry.recipient_notes ? "Notes ✓" : "Notes"}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </>
          )}
        </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Showing <strong>{filteredEntries.length}</strong> of <strong>{entries.length}</strong> records for {selectedMonth}
          </span>
          <span className="text-[11px]">
            Changes save automatically in real-time.
          </span>
        </div>
      </div>

      {/* Add Referral Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Add New Referral
                </h3>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReferral} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={newCustomer}
                    onChange={e => setNewCustomer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Producer (Agent) *
                  </label>
                  <select
                    required
                    value={newProducer}
                    onChange={e => setNewProducer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="">Select Producer...</option>
                    {allProducers.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    <option value="__custom__">+ Other / Custom Agent...</option>
                  </select>
                  {newProducer === "__custom__" && (
                    <input
                      type="text"
                      required
                      placeholder="Enter agent name..."
                      value={customProducer}
                      onChange={e => setCustomProducer(e.target.value)}
                      className="mt-1.5 w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-blue-300 dark:border-blue-600 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Lead Source
                  </label>
                  <select
                    value={newSource}
                    onChange={e => setNewSource(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    {availableLeadSources.map((s, idx) => (
                      <option key={`modal-src-${s}-${idx}`} value={s}>{s}</option>
                    ))}
                  </select>
                  {newSource === "Other" && (
                    <input
                      type="text"
                      placeholder="Enter lead source..."
                      value={customSource}
                      onChange={e => setCustomSource(e.target.value)}
                      className="mt-1.5 w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-blue-300 dark:border-blue-600 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Policy Type
                  </label>
                  <select
                    value={newPolicy}
                    onChange={e => setNewPolicy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    {POLICY_PRESETS.map(pol => (
                      <option key={pol} value={pol}>{pol}</option>
                    ))}
                  </select>
                  {newPolicy === "Other" && (
                    <input
                      type="text"
                      placeholder="Enter policy type..."
                      value={customPolicy}
                      onChange={e => setCustomPolicy(e.target.value)}
                      className="mt-1.5 w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-blue-300 dark:border-blue-600 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Carrier
                  </label>
                  <select
                    value={newCarrier}
                    onChange={e => setNewCarrier(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    {CARRIER_PRESETS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {newCarrier === "Other" && (
                    <input
                      type="text"
                      placeholder="Enter carrier name..."
                      value={customCarrier}
                      onChange={e => setCustomCarrier(e.target.value)}
                      className="mt-1.5 w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-blue-300 dark:border-blue-600 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sold Date
                  </label>
                  <input
                    type="text"
                    value={newSoldDate}
                    onChange={e => setNewSoldDate(e.target.value)}
                    placeholder="e.g. 26-Oct-26"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    step="5"
                    value={newAmount}
                    onChange={e => setNewAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gift Type
                  </label>
                  <select
                    value={newGiftType}
                    onChange={e => setNewGiftType(e.target.value)}
                    className={`w-full px-2 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none cursor-pointer ${
                      !newGiftType ? "text-slate-400 italic text-[11px]" : "text-xs font-semibold text-slate-900 dark:text-white"
                    }`}
                  >
                    <option value="" className="text-slate-400 italic text-[11px]">
                      Click to choose Gift Type
                    </option>
                    {GIFT_PRESETS.map(g => (
                      <option key={g} value={g} className="text-slate-800 dark:text-slate-200 font-normal not-italic text-xs">
                        {g}
                      </option>
                    ))}
                  </select>
                  {newGiftType === "Other" && (
                    <input
                      type="text"
                      autoFocus
                      placeholder="Type custom gift..."
                      value={customGiftType}
                      onChange={e => setCustomGiftType(e.target.value)}
                      className="mt-1.5 w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-blue-300 dark:border-blue-600 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none shadow-xs"
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md transition-colors flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Referral</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipient Details & Notes Modal */}
      {notesModalEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Recipient Details & Notes
                </h3>
                <p className="text-xs text-slate-400">
                  {notesModalEntry.customer_name} ({notesModalEntry.producer})
                </p>
              </div>
              <button
                onClick={() => setNotesModalEntry(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Gift Delivery Address, Email, or Tracking Notes
              </label>
              <textarea
                rows={4}
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value)}
                placeholder="Enter email e-gift was sent to, tracking number, or mailing address..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setNotesModalEntry(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingId === notesModalEntry.id}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md transition-colors flex items-center gap-1.5"
              >
                {savingId === notesModalEntry.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Details</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
