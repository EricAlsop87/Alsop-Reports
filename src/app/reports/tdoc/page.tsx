'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  FileCheck,
  Search,
  Upload,
  Copy,
  Check,
  Building2,
  ShieldAlert,
  BarChart3,
  Calendar,
  AlertTriangle,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChat } from '@/lib/chat/chatContext'
import {
  fetchTDOCRecords,
  saveTDOCRecord,
  DEFAULT_MANAGERS,
  computeTDOCStatus,
  type TDOCRecord,
} from '@/lib/reports/tdocStore'
import TDOCUploadModal from '@/components/reports/TDOCUploadModal'

// Column Keys mapping directly to the Google Sheet structure
type ColumnKey =
  | 'index'
  | 'office'
  | 'sub_producer'
  | 'producer_name'
  | 'bind_id'
  | 'policy_number'
  | 'customer_name'
  | 'issue_date'
  | 'product'
  | 'transaction_type'
  | 'missing_admin'
  | 'missing_legal'
  | 'missing_brp'
  | 'comments'
  | 'tagged_manager'
  | 'month_period'
  | 'status'

const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  index: 55,
  office: 85,
  sub_producer: 90,
  producer_name: 165,
  bind_id: 110,
  policy_number: 140,
  customer_name: 185,
  issue_date: 105,
  product: 130,
  transaction_type: 145,
  missing_admin: 160,
  missing_legal: 160,
  missing_brp: 160,
  comments: 260,
  tagged_manager: 125,
  month_period: 100,
  status: 135,
}

const CALENDAR_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

// Helper to extract year from record
function getRecordYear(r: TDOCRecord): string {
  const match = (r.issue_date || r.effective_date || r.month_period || '').match(/202\d/)
  return match ? match[0] : '2025'
}

// Helper to determine background color for missing document cells
function getDocFieldStyle(val: string) {
  const v = (val || '').trim().toLowerCase()
  if (v === 'good' || v === 'complete') {
    return 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/90 dark:text-emerald-300 dark:border-emerald-800 font-bold'
  }
  if (v.includes('review')) {
    return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/90 dark:text-amber-300 dark:border-amber-800 font-bold'
  }
  return 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/90 dark:text-rose-300 dark:border-rose-800 font-bold'
}

export default function TDOCReportPage() {
  const { currentAgent } = useChat()

  // Access Restriction Check
  const isManagerOrAdmin = useMemo(() => {
    if (!currentAgent) return false
    return (
      currentAgent.role === 'admin' ||
      currentAgent.team === 'Managers' ||
      currentAgent.team === 'Support'
    )
  }, [currentAgent])

  // State
  const [records, setRecords] = useState<TDOCRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'sheet' | 'dashboard'>('sheet')
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showColumnFilters, setShowColumnFilters] = useState(true)

  // Filters State
  const [selectedYear, setSelectedYear] = useState<string>('all') // 'all', '2026', '2025'
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [globalSearch, setGlobalSearch] = useState<string>('')

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(100) // 50, 100, 250, 500, 0 (All)

  // Resizable columns state
  const [colWidths, setColWidths] = useState<Record<ColumnKey, number>>(DEFAULT_COLUMN_WIDTHS)
  const [resizingCol, setResizingCol] = useState<ColumnKey | null>(null)
  const startXRef = useRef<number>(0)
  const startWidthRef = useRef<number>(0)

  // Top & Bottom Scrollbars Synchronization Refs
  const topScrollRef = useRef<HTMLDivElement>(null)
  const bottomScrollRef = useRef<HTMLDivElement>(null)
  const isSyncingScroll = useRef(false)

  // Per-Column Filter States
  const [colFilters, setColFilters] = useState<Record<ColumnKey, string>>({
    index: '',
    office: 'all',
    sub_producer: '',
    producer_name: '',
    bind_id: '',
    policy_number: '',
    customer_name: '',
    issue_date: '',
    product: 'all',
    transaction_type: 'all',
    missing_admin: 'all',
    missing_legal: 'all',
    missing_brp: 'all',
    comments: '',
    tagged_manager: 'all',
    month_period: 'all',
    status: 'all',
  })

  // Load records
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchTDOCRecords()
      setRecords(data)
    } catch (err) {
      console.error('Failed to load TDOC records:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Total width of table for Top Scrollbar
  const totalTableWidth = useMemo(() => {
    return Object.values(colWidths).reduce((sum, w) => sum + w, 0)
  }, [colWidths])

  // Synchronized Top/Bottom Horizontal Scroll Handlers
  const handleTopScroll = () => {
    if (isSyncingScroll.current) return
    isSyncingScroll.current = true
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false
    })
  }

  const handleBottomScroll = () => {
    if (isSyncingScroll.current) return
    isSyncingScroll.current = true
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false
    })
  }

  // Dynamic filter and dropdown options extracted from records
  const dynamicOptions = useMemo(() => {
    const offices = new Set<string>()
    const products = new Set<string>()
    const types = new Set<string>()
    const managers = new Set<string>()
    const admins = new Set<string>(['Good', 'Good+Review', 'Application', 'Missing Signature', 'Missing ID', 'Missing Proof of Prior', 'Missing Reg', 'Pending Admin'])
    const legals = new Set<string>(['Good', 'Good+Review', 'UM Form', 'Exclusion Form', 'Missing Legal Form', 'Missing Notice', 'Pending Legal'])
    const brps = new Set<string>(['Good', 'Good+Review', 'Aged Licensed', 'Mileage Wk/Sch', 'Rew Outstanding Balance', 'Widowed', 'Missing BRP Document', 'Pending BRP'])
    const months = new Set<string>()
    const years = new Set<string>(['2026', '2025'])

    records.forEach((r) => {
      if (r.office) offices.add(r.office)
      if (r.product) products.add(r.product)
      if (r.transaction_type) types.add(r.transaction_type)
      if (r.tagged_manager) managers.add(r.tagged_manager)
      if (r.missing_admin) admins.add(r.missing_admin)
      if (r.missing_legal) legals.add(r.missing_legal)
      if (r.missing_brp) brps.add(r.missing_brp)
      if (r.month_period) months.add(r.month_period)
      years.add(getRecordYear(r))
    })

    return {
      offices: Array.from(offices).sort(),
      products: Array.from(products).sort(),
      types: Array.from(types).sort(),
      managers: Array.from(new Set([...DEFAULT_MANAGERS, ...Array.from(managers)])).sort(),
      admins: Array.from(admins).sort(),
      legals: Array.from(legals).sort(),
      brps: Array.from(brps).sort(),
      months: CALENDAR_MONTHS.filter((cm) =>
        Array.from(months).some((m) => m.toLowerCase() === cm.toLowerCase())
      ),
      years: Array.from(years).sort().reverse(),
    }
  }, [records])

  // Column Resizing Handler
  const handleMouseDownResize = (colKey: ColumnKey, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingCol(colKey)
    startXRef.current = e.clientX
    startWidthRef.current = colWidths[colKey]

    const handleMouseMove = (moveEvt: MouseEvent) => {
      const deltaX = moveEvt.clientX - startXRef.current
      const newWidth = Math.max(50, startWidthRef.current + deltaX)
      setColWidths((prev) => ({
        ...prev,
        [colKey]: newWidth,
      }))
    }

    const handleMouseUp = () => {
      setResizingCol(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Toast notification trigger
  const triggerCopyToast = (text: string, label: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setToastMessage(`Copied ${label} to clipboard!`)
    setTimeout(() => {
      setToastMessage(null)
    }, 2000)
  }

  // Inline Cell Update Handler (Updates state and recalculates status/KPIs in real-time)
  const handleCellUpdate = async (
    recordId: string,
    field: keyof TDOCRecord,
    value: any
  ) => {
    const target = records.find((r) => r.id === recordId)
    if (!target) return

    const updated = { ...target, [field]: value }

    // Recompute status if missing document or status fields change
    if (field === 'missing_admin' || field === 'missing_legal' || field === 'missing_brp') {
      updated.status = computeTDOCStatus(updated.missing_admin, updated.missing_legal, updated.missing_brp, updated.status)
    }

    // Save record to store and update local React state
    const saved = await saveTDOCRecord(updated)
    setRecords((prev) => prev.map((r) => (r.id === recordId ? saved : r)))

    setToastMessage(`Updated ${field.replace('_', ' ')} for Policy #${target.policy_number}`)
    setTimeout(() => setToastMessage(null), 1800)
  }

  // Filtering Logic
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Year Filter
      if (selectedYear !== 'all') {
        const recordYr = getRecordYear(r)
        if (recordYr !== selectedYear) return false
      }

      // Month Filter
      if (selectedMonth !== 'all' && r.month_period.toLowerCase() !== selectedMonth.toLowerCase()) {
        return false
      }
      if (colFilters.month_period !== 'all' && r.month_period.toLowerCase() !== colFilters.month_period.toLowerCase()) {
        return false
      }

      // Global Search
      if (globalSearch.trim()) {
        const q = globalSearch.toLowerCase()
        const matchPol = r.policy_number.toLowerCase().includes(q)
        const matchCust = r.customer_name.toLowerCase().includes(q)
        const matchProd = r.producer_name.toLowerCase().includes(q)
        const matchComm = r.comments.toLowerCase().includes(q)
        const matchBind = (r.bind_id || '').toLowerCase().includes(q)
        if (!matchPol && !matchCust && !matchProd && !matchComm && !matchBind) return false
      }

      // Column Filters
      if (colFilters.office !== 'all' && r.office !== colFilters.office) return false
      if (colFilters.sub_producer && !(r.sub_producer || '').toLowerCase().includes(colFilters.sub_producer.toLowerCase())) return false
      if (colFilters.producer_name && !r.producer_name.toLowerCase().includes(colFilters.producer_name.toLowerCase())) return false
      if (colFilters.bind_id && !(r.bind_id || '').toLowerCase().includes(colFilters.bind_id.toLowerCase())) return false
      if (colFilters.policy_number && !r.policy_number.toLowerCase().includes(colFilters.policy_number.toLowerCase())) return false
      if (colFilters.customer_name && !r.customer_name.toLowerCase().includes(colFilters.customer_name.toLowerCase())) return false
      if (colFilters.issue_date && !r.issue_date.includes(colFilters.issue_date)) return false
      if (colFilters.product !== 'all' && r.product !== colFilters.product) return false
      if (colFilters.transaction_type !== 'all' && r.transaction_type !== colFilters.transaction_type) return false
      if (colFilters.missing_admin !== 'all' && r.missing_admin !== colFilters.missing_admin) return false
      if (colFilters.missing_legal !== 'all' && r.missing_legal !== colFilters.missing_legal) return false
      if (colFilters.missing_brp !== 'all' && r.missing_brp !== colFilters.missing_brp) return false
      if (colFilters.tagged_manager !== 'all' && r.tagged_manager !== colFilters.tagged_manager) return false
      if (colFilters.status !== 'all' && r.status !== colFilters.status) return false
      if (colFilters.comments && !r.comments.toLowerCase().includes(colFilters.comments.toLowerCase())) return false

      return true
    })
  }, [records, selectedYear, selectedMonth, globalSearch, colFilters])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [globalSearch, selectedYear, selectedMonth, colFilters])

  // Pagination calculation
  const totalPages = useMemo(() => {
    if (pageSize === 0) return 1
    return Math.ceil(filteredRecords.length / pageSize) || 1
  }, [filteredRecords.length, pageSize])

  const paginatedRecords = useMemo(() => {
    if (pageSize === 0) return filteredRecords
    const start = (currentPage - 1) * pageSize
    return filteredRecords.slice(start, start + pageSize)
  }, [filteredRecords, currentPage, pageSize])

  // Reset all filters
  const resetFilters = () => {
    setGlobalSearch('')
    setSelectedYear('all')
    setSelectedMonth('all')
    setColFilters({
      index: '',
      office: 'all',
      sub_producer: '',
      producer_name: '',
      bind_id: '',
      policy_number: '',
      customer_name: '',
      issue_date: '',
      product: 'all',
      transaction_type: 'all',
      missing_admin: 'all',
      missing_legal: 'all',
      missing_brp: 'all',
      comments: '',
      tagged_manager: 'all',
      month_period: 'all',
      status: 'all',
    })
  }

  // Working KPI Cards Metrics (Calculated dynamically from filteredRecords)
  const metrics = useMemo(() => {
    const total = filteredRecords.length
    const goodCount = filteredRecords.filter((r) => r.status === 'Good').length
    const reviewCount = filteredRecords.filter((r) => r.status === 'Under Review').length
    const actionCount = filteredRecords.filter((r) => r.status === 'Action Needed').length

    const adminIssues = filteredRecords.filter((r) => r.missing_admin && r.missing_admin.toLowerCase() !== 'good').length
    const legalIssues = filteredRecords.filter((r) => r.missing_legal && r.missing_legal.toLowerCase() !== 'good').length
    const brpIssues = filteredRecords.filter((r) => r.missing_brp && r.missing_brp.toLowerCase() !== 'good').length

    const completionRate = total > 0 ? Math.round((goodCount / total) * 100) : 0

    return {
      total,
      goodCount,
      reviewCount,
      actionCount,
      adminIssues,
      legalIssues,
      brpIssues,
      completionRate,
    }
  }, [filteredRecords])

  // Manager Breakdown Stats
  const managerStats = useMemo(() => {
    const map = new Map<string, { total: number; good: number; review: number; action: number }>()

    filteredRecords.forEach((r) => {
      const mgr = r.tagged_manager || 'Unassigned'
      const cur = map.get(mgr) || { total: 0, good: 0, review: 0, action: 0 }
      cur.total += 1
      if (r.status === 'Good') cur.good += 1
      else if (r.status === 'Under Review') cur.review += 1
      else cur.action += 1
      map.set(mgr, cur)
    })

    return Array.from(map.entries()).map(([manager, s]) => ({
      manager,
      ...s,
      rate: s.total > 0 ? Math.round((s.good / s.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total)
  }, [filteredRecords])

  // Restricted Access Screen
  if (!isManagerOrAdmin && currentAgent) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Access Restricted — Manager Approval Required
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
          The <strong>TDOC Report NB & Add Car</strong> audit page contains manager remarks, policy compliance flags, and documentation deficit tracking reserved exclusively for Agency Managers and Administrators.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-5 max-w-[1850px] mx-auto min-h-screen">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-4 py-2.5 rounded-xl shadow-2xl border border-slate-800 dark:border-slate-200 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-bottom-5 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
              <FileCheck className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              TDOC Report NB & Add Car
            </h1>
            <span className="text-[10px] font-extrabold uppercase bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md tracking-wider">
              Manager Audit ({records.length.toLocaleString()} Records)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Complete Google Sheet Trail Documentation deficit audit with Year filter, green status badges, dropdowns, top scrollbar, and manager tagging.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowColumnFilters((prev) => !prev)}
            className={cn(
              'px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer',
              showColumnFilters
                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300'
                : 'border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300'
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{showColumnFilters ? 'Hide Column Filters' : 'Show Column Filters'}</span>
          </button>

          <button
            onClick={resetFilters}
            className="px-3 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Reset Filters
          </button>

          <button
            onClick={loadData}
            title="Refresh records"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload File</span>
          </button>
        </div>
      </div>

      {/* WORKING KPI CARDS (Calculated dynamically from filtered records and edited values) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Audited
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {metrics.total.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Matching records</span>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
            Complete / Good
          </span>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
            {metrics.goodCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            {metrics.completionRate}% Completion Rate
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs">
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
            Needs Review
          </span>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">
            {metrics.reviewCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
            Under Manager Review
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/60 shadow-2xs">
          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">
            Action Needed
          </span>
          <div className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1">
            {metrics.actionCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
            Deficits pending
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Missing Admin
          </span>
          <div className="text-2xl font-black text-slate-800 dark:text-slate-200 mt-1">
            {metrics.adminIssues.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Admin Deficits</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Legal / BRP Deficits
          </span>
          <div className="text-2xl font-black text-slate-800 dark:text-slate-200 mt-1">
            {(metrics.legalIssues + metrics.brpIssues).toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            {metrics.legalIssues} Legal • {metrics.brpIssues} BRP
          </span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('sheet')}
          className={cn(
            'px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer',
            activeTab === 'sheet'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          )}
        >
          <FileCheck className="w-4 h-4" />
          <span>TDOC Data Sheet (Interactive Grid with Dropdowns)</span>
          <span className="ml-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
            {filteredRecords.length.toLocaleString()}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
          className={cn(
            'px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer',
            activeTab === 'dashboard'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          )}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Manager Monthly Dashboard</span>
        </button>
      </div>

      {/* TAB 1: GRID WITH DROPDOWNS & GREEN COLOR FOR GOOD */}
      {activeTab === 'sheet' && (
        <div className="space-y-3">
          {/* Top Bar (Search + YEAR FILTER + Month Selector + Pagination Controls) */}
          <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Global Search (Policy #, Customer, Agent, Bind ID, Remarks...)"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              {/* YEAR FILTER */}
              <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300">Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg px-2 py-1 text-xs font-black text-amber-900 dark:text-amber-100 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="all">All Years (2025 & 2026)</option>
                  <option value="2026">2026 Only</option>
                  <option value="2025">2025 Only</option>
                </select>
              </div>

              {/* Month Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500">Month:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">All Months</option>
                  {dynamicOptions.months.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Page Size Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                  <option value={250}>250 per page</option>
                  <option value={500}>500 per page</option>
                  <option value={0}>All Records</option>
                </select>
              </div>

              {/* Pagination Controls */}
              {pageSize > 0 && (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                    title="First page"
                  >
                    <ChevronsLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </button>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </button>

                  <span className="px-2 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                    title="Last page"
                  >
                    <ChevronsRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Table Container */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            {/* TOP MOVING HORIZONTAL SCROLLBAR */}
            <div
              ref={topScrollRef}
              onScroll={handleTopScroll}
              className="overflow-x-auto custom-scrollbar sticky top-0 z-30 bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 backdrop-blur-md"
            >
              <div
                style={{ width: `${totalTableWidth}px` }}
                className="h-3 flex items-center px-4"
              >
                <div className="w-full h-1 bg-blue-500/20 rounded-full" />
              </div>
            </div>

            {/* Bottom Table Scroll Container */}
            <div
              ref={bottomScrollRef}
              onScroll={handleBottomScroll}
              className="overflow-x-auto max-h-[720px] custom-scrollbar"
            >
              <table
                className="w-full text-left border-collapse"
                style={{ tableLayout: 'fixed' }}
              >
                {/* Column Width Definitions */}
                <colgroup>
                  <col style={{ width: `${colWidths.index}px` }} />
                  <col style={{ width: `${colWidths.office}px` }} />
                  <col style={{ width: `${colWidths.sub_producer}px` }} />
                  <col style={{ width: `${colWidths.producer_name}px` }} />
                  <col style={{ width: `${colWidths.bind_id}px` }} />
                  <col style={{ width: `${colWidths.policy_number}px` }} />
                  <col style={{ width: `${colWidths.customer_name}px` }} />
                  <col style={{ width: `${colWidths.issue_date}px` }} />
                  <col style={{ width: `${colWidths.product}px` }} />
                  <col style={{ width: `${colWidths.transaction_type}px` }} />
                  <col style={{ width: `${colWidths.missing_admin}px` }} />
                  <col style={{ width: `${colWidths.missing_legal}px` }} />
                  <col style={{ width: `${colWidths.missing_brp}px` }} />
                  <col style={{ width: `${colWidths.comments}px` }} />
                  <col style={{ width: `${colWidths.tagged_manager}px` }} />
                  <col style={{ width: `${colWidths.month_period}px` }} />
                  <col style={{ width: `${colWidths.status}px` }} />
                </colgroup>

                {/* Table Header with Drag Resizer Handles */}
                <thead className="bg-slate-100/95 dark:bg-slate-800/95 text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 sticky top-0 z-20 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 select-none">
                  {/* Title Row */}
                  <tr>
                    {[
                      { key: 'index', label: '#' },
                      { key: 'office', label: 'Office' },
                      { key: 'sub_producer', label: 'Sub Prod' },
                      { key: 'producer_name', label: 'Writing Agent' },
                      { key: 'bind_id', label: 'Bind ID' },
                      { key: 'policy_number', label: 'Policy No' },
                      { key: 'customer_name', label: 'Customer Name' },
                      { key: 'issue_date', label: 'Issued Date' },
                      { key: 'product', label: 'Product' },
                      { key: 'transaction_type', label: 'New Policy Issued' },
                      { key: 'missing_admin', label: 'Missing Admin' },
                      { key: 'missing_legal', label: 'Missing Legal' },
                      { key: 'missing_brp', label: 'BRP' },
                      { key: 'comments', label: 'Comments' },
                      { key: 'tagged_manager', label: 'Completed by' },
                      { key: 'month_period', label: 'Month' },
                      { key: 'status', label: 'Status' },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className="py-3 px-2 relative border-r border-slate-200/60 dark:border-slate-700/60 truncate group/th"
                        style={{ width: `${colWidths[col.key as ColumnKey]}px` }}
                        title={`Drag right border to resize ${col.label}`}
                      >
                        <div className="flex items-center justify-between min-w-0 pr-1">
                          <span className="truncate">{col.label}</span>
                        </div>

                        {/* Drag Handle */}
                        <div
                          onMouseDown={(e) => handleMouseDownResize(col.key as ColumnKey, e)}
                          className={cn(
                            'absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-30',
                            resizingCol === col.key && 'bg-blue-600'
                          )}
                          title="Drag to resize column width"
                        />
                      </th>
                    ))}
                  </tr>

                  {/* Per-Column Filter Row */}
                  {showColumnFilters && (
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200/80 dark:border-slate-700/80">
                      {/* Index */}
                      <th className="p-1 text-center font-normal">
                        <span className="text-[9px] text-slate-400">#</span>
                      </th>

                      {/* Office Filter */}
                      <th className="p-1">
                        <select
                          value={colFilters.office}
                          onChange={(e) => setColFilters((p) => ({ ...p, office: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-[10px] font-normal text-slate-800 dark:text-slate-200 outline-none"
                        >
                          <option value="all">All</option>
                          {dynamicOptions.offices.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </th>

                      {/* Sub Producer Filter */}
                      <th className="p-1">
                        <input
                          type="text"
                          placeholder="Sub..."
                          value={colFilters.sub_producer}
                          onChange={(e) => setColFilters((p) => ({ ...p, sub_producer: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-[10px] font-normal text-slate-800 dark:text-slate-200 outline-none"
                        />
                      </th>

                      {/* Writing Agent Filter */}
                      <th className="p-1">
                        <input
                          type="text"
                          placeholder="Agent name..."
                          value={colFilters.producer_name}
                          onChange={(e) => setColFilters((p) => ({ ...p, producer_name: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-normal text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                        />
                      </th>

                      {/* Bind ID Filter */}
                      <th className="p-1">
                        <input
                          type="text"
                          placeholder="Bind ID..."
                          value={colFilters.bind_id}
                          onChange={(e) => setColFilters((p) => ({ ...p, bind_id: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-[10px] font-normal text-slate-800 dark:text-slate-200 outline-none"
                        />
                      </th>

                      {/* Policy No Filter */}
                      <th className="p-1">
                        <input
                          type="text"
                          placeholder="Policy #..."
                          value={colFilters.policy_number}
                          onChange={(e) => setColFilters((p) => ({ ...p, policy_number: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-normal text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                        />
                      </th>

                      {/* Customer Name Filter */}
                      <th className="p-1">
                        <input
                          type="text"
                          placeholder="Customer..."
                          value={colFilters.customer_name}
                          onChange={(e) => setColFilters((p) => ({ ...p, customer_name: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-normal text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                        />
                      </th>

                      {/* Issued Date Filter */}
                      <th className="p-1">
                        <input
                          type="text"
                          placeholder="Date..."
                          value={colFilters.issue_date}
                          onChange={(e) => setColFilters((p) => ({ ...p, issue_date: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-[10px] font-normal text-slate-800 dark:text-slate-200 outline-none"
                        />
                      </th>

                      {/* Product Filter */}
                      <th className="p-1">
                        <select
                          value={colFilters.product}
                          onChange={(e) => setColFilters((p) => ({ ...p, product: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-[10px] font-normal text-slate-800 dark:text-slate-200 outline-none"
                        >
                          <option value="all">All Products</option>
                          {dynamicOptions.products.map((prd) => (
                            <option key={prd} value={prd}>{prd}</option>
                          ))}
                        </select>
                      </th>

                      {/* Transaction Type Filter */}
                      <th className="p-1">
                        <select
                          value={colFilters.transaction_type}
                          onChange={(e) => setColFilters((p) => ({ ...p, transaction_type: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-[10px] font-normal text-slate-800 dark:text-slate-200 outline-none"
                        >
                          <option value="all">All Types</option>
                          {dynamicOptions.types.map((tp) => (
                            <option key={tp} value={tp}>{tp}</option>
                          ))}
                        </select>
                      </th>

                      {/* Missing Admin Filter */}
                      <th className="p-1">
                        <select
                          value={colFilters.missing_admin}
                          onChange={(e) => setColFilters((p) => ({ ...p, missing_admin: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-[10px] font-normal text-slate-800 dark:text-slate-200 outline-none"
                        >
                          <option value="all">All Admin</option>
                          {dynamicOptions.admins.map((adm) => (
                            <option key={adm} value={adm}>{adm}</option>
                          ))}
                        </select>
                      </th>

                      {/* Missing Legal Filter */}
                      <th className="p-1">
                        <select
                          value={colFilters.missing_legal}
                          onChange={(e) => setColFilters((p) => ({ ...p, missing_legal: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-[10px] font-normal text-slate-800 dark:text-slate-200 outline-none"
                        >
                          <option value="all">All Legal</option>
                          {dynamicOptions.legals.map((leg) => (
                            <option key={leg} value={leg}>{leg}</option>
                          ))}
                        </select>
                      </th>

                      {/* BRP Filter */}
                      <th className="p-1">
                        <select
                          value={colFilters.missing_brp}
                          onChange={(e) => setColFilters((p) => ({ ...p, missing_brp: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-[10px] font-normal text-slate-800 dark:text-slate-200 outline-none"
                        >
                          <option value="all">All BRP</option>
                          {dynamicOptions.brps.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </th>

                      {/* Comments Filter */}
                      <th className="p-1">
                        <input
                          type="text"
                          placeholder="Filter comments..."
                          value={colFilters.comments}
                          onChange={(e) => setColFilters((p) => ({ ...p, comments: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-normal text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                        />
                      </th>

                      {/* Manager Tag Filter */}
                      <th className="p-1">
                        <select
                          value={colFilters.tagged_manager}
                          onChange={(e) => setColFilters((p) => ({ ...p, tagged_manager: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-[10px] font-normal text-slate-800 dark:text-slate-200 outline-none"
                        >
                          <option value="all">All Managers</option>
                          {dynamicOptions.managers.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </th>

                      {/* Month Filter */}
                      <th className="p-1">
                        <select
                          value={colFilters.month_period}
                          onChange={(e) => setColFilters((p) => ({ ...p, month_period: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-[10px] font-normal text-slate-800 dark:text-slate-200 outline-none"
                        >
                          <option value="all">All</option>
                          {dynamicOptions.months.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </th>

                      {/* Status Filter */}
                      <th className="p-1">
                        <select
                          value={colFilters.status}
                          onChange={(e) => setColFilters((p) => ({ ...p, status: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-[10px] font-normal text-slate-800 dark:text-slate-200 outline-none"
                        >
                          <option value="all">All Status</option>
                          <option value="Good">Good</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Action Needed">Action Needed</option>
                        </select>
                      </th>
                    </tr>
                  )}
                </thead>

                {/* TABLE BODY WITH DROPDOWNS & PROMINENT GREEN COLOR FOR GOOD */}
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="py-12 text-center text-slate-400">
                        No TDOC records match your current year and column filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((r, index) => {
                      const absoluteIndex = (currentPage - 1) * (pageSize || filteredRecords.length) + index + 1
                      const isGood = r.status === 'Good'
                      const isReview = r.status === 'Under Review'

                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group/tr"
                        >
                          {/* Row Index */}
                          <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[11px] truncate">
                            {absoluteIndex}
                          </td>

                          {/* Office (Editable) */}
                          <td className="py-1.5 px-1.5 truncate">
                            <input
                              type="text"
                              value={r.office}
                              onChange={(e) => handleCellUpdate(r.id, 'office', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 font-mono text-[11px] text-slate-700 dark:text-slate-300 outline-none py-0.5 transition-colors truncate"
                            />
                          </td>

                          {/* Sub Producer (Editable) */}
                          <td className="py-1.5 px-1.5 truncate">
                            <input
                              type="text"
                              value={r.sub_producer || ''}
                              onChange={(e) => handleCellUpdate(r.id, 'sub_producer', e.target.value)}
                              placeholder="Sub..."
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 font-mono text-[11px] text-slate-600 dark:text-slate-400 outline-none py-0.5 transition-colors truncate"
                            />
                          </td>

                          {/* Writing Agent (Editable) */}
                          <td className="py-1.5 px-1.5 truncate">
                            <input
                              type="text"
                              value={r.producer_name}
                              onChange={(e) => handleCellUpdate(r.id, 'producer_name', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 font-semibold text-slate-800 dark:text-slate-200 text-xs outline-none py-0.5 transition-colors truncate"
                            />
                          </td>

                          {/* Bind ID (Editable + Copy) */}
                          <td className="py-1.5 px-1.5 truncate">
                            <div className="flex items-center gap-1 min-w-0">
                              <input
                                type="text"
                                value={r.bind_id || ''}
                                onChange={(e) => handleCellUpdate(r.id, 'bind_id', e.target.value)}
                                placeholder="Bind ID"
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 font-mono text-[11px] text-slate-600 dark:text-slate-400 outline-none py-0.5 transition-colors truncate"
                              />
                              {r.bind_id && (
                                <button
                                  onClick={() => triggerCopyToast(r.bind_id || '', 'Bind ID')}
                                  className="opacity-0 group-hover/tr:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-opacity cursor-pointer shrink-0"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Policy No (Editable + Copy) */}
                          <td className="py-1.5 px-1.5 truncate">
                            <div className="flex items-center gap-1 min-w-0">
                              <input
                                type="text"
                                value={r.policy_number}
                                onChange={(e) => handleCellUpdate(r.id, 'policy_number', e.target.value)}
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 font-mono font-bold text-slate-900 dark:text-slate-100 text-xs outline-none py-0.5 transition-colors truncate"
                              />
                              <button
                                onClick={() => triggerCopyToast(r.policy_number, 'Policy #')}
                                className="opacity-0 group-hover/tr:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-opacity cursor-pointer shrink-0"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* Customer Name (Editable + Copy) */}
                          <td className="py-1.5 px-1.5 truncate">
                            <div className="flex items-center gap-1 min-w-0">
                              <input
                                type="text"
                                value={r.customer_name}
                                onChange={(e) => handleCellUpdate(r.id, 'customer_name', e.target.value)}
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 font-semibold text-slate-800 dark:text-slate-200 text-xs outline-none py-0.5 transition-colors truncate"
                              />
                              <button
                                onClick={() => triggerCopyToast(r.customer_name, 'Customer Name')}
                                className="opacity-0 group-hover/tr:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-opacity cursor-pointer shrink-0"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* Issued Date (Editable) */}
                          <td className="py-1.5 px-1.5 truncate">
                            <input
                              type="text"
                              value={r.issue_date}
                              onChange={(e) => handleCellUpdate(r.id, 'issue_date', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 text-slate-500 dark:text-slate-400 text-[11px] outline-none py-0.5 transition-colors truncate"
                            />
                          </td>

                          {/* Product (Editable) */}
                          <td className="py-1.5 px-1.5 truncate">
                            <input
                              type="text"
                              value={r.product || ''}
                              onChange={(e) => handleCellUpdate(r.id, 'product', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 text-slate-700 dark:text-slate-300 text-[11px] outline-none py-0.5 transition-colors truncate"
                            />
                          </td>

                          {/* New Policy Issued / Type (Editable) */}
                          <td className="py-1.5 px-1.5 truncate">
                            <input
                              type="text"
                              value={r.transaction_type}
                              onChange={(e) => handleCellUpdate(r.id, 'transaction_type', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 font-bold text-[11px] text-blue-700 dark:text-blue-300 outline-none py-0.5 transition-colors truncate"
                            />
                          </td>

                          {/* MISSING ADMIN (SELECT DROPDOWN WITH GREEN COLOR FOR GOOD) */}
                          <td className="py-1.5 px-1.5 truncate">
                            <select
                              value={r.missing_admin}
                              onChange={(e) => handleCellUpdate(r.id, 'missing_admin', e.target.value)}
                              className={cn(
                                'w-full border rounded-lg px-2 py-1 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer shadow-2xs',
                                getDocFieldStyle(r.missing_admin)
                              )}
                            >
                              {!dynamicOptions.admins.includes(r.missing_admin) && r.missing_admin && (
                                <option value={r.missing_admin}>{r.missing_admin}</option>
                              )}
                              {dynamicOptions.admins.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>

                          {/* MISSING LEGAL (SELECT DROPDOWN WITH GREEN COLOR FOR GOOD) */}
                          <td className="py-1.5 px-1.5 truncate">
                            <select
                              value={r.missing_legal}
                              onChange={(e) => handleCellUpdate(r.id, 'missing_legal', e.target.value)}
                              className={cn(
                                'w-full border rounded-lg px-2 py-1 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer shadow-2xs',
                                getDocFieldStyle(r.missing_legal)
                              )}
                            >
                              {!dynamicOptions.legals.includes(r.missing_legal) && r.missing_legal && (
                                <option value={r.missing_legal}>{r.missing_legal}</option>
                              )}
                              {dynamicOptions.legals.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>

                          {/* BRP (SELECT DROPDOWN WITH GREEN COLOR FOR GOOD) */}
                          <td className="py-1.5 px-1.5 truncate">
                            <select
                              value={r.missing_brp}
                              onChange={(e) => handleCellUpdate(r.id, 'missing_brp', e.target.value)}
                              className={cn(
                                'w-full border rounded-lg px-2 py-1 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer shadow-2xs',
                                getDocFieldStyle(r.missing_brp)
                              )}
                            >
                              {!dynamicOptions.brps.includes(r.missing_brp) && r.missing_brp && (
                                <option value={r.missing_brp}>{r.missing_brp}</option>
                              )}
                              {dynamicOptions.brps.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>

                          {/* Comments (Editable Input + Copy) */}
                          <td className="py-1.5 px-1.5 min-w-0" title={r.comments ? `Remarks: ${r.comments}` : 'No manager remarks'}>
                            <div className="flex items-center gap-1 min-w-0">
                              <input
                                type="text"
                                value={r.comments}
                                onChange={(e) => handleCellUpdate(r.id, 'comments', e.target.value)}
                                placeholder="Add remark..."
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 text-xs text-slate-800 dark:text-slate-200 outline-none py-0.5 transition-colors truncate"
                              />
                              {r.comments && (
                                <button
                                  onClick={() => triggerCopyToast(r.comments, 'Comments')}
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Completed by / Manager (Editable Dropdown) */}
                          <td className="py-1.5 px-1.5 truncate">
                            <select
                              value={r.tagged_manager}
                              onChange={(e) => handleCellUpdate(r.id, 'tagged_manager', e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                              {dynamicOptions.managers.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </td>

                          {/* Month (Editable) */}
                          <td className="py-1.5 px-1.5 truncate">
                            <input
                              type="text"
                              value={r.month_period}
                              onChange={(e) => handleCellUpdate(r.id, 'month_period', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 text-slate-600 dark:text-slate-400 text-[11px] font-medium outline-none py-0.5 transition-colors truncate"
                            />
                          </td>

                          {/* Computed Status (Editable Dropdown + Live KPI update) */}
                          <td className="py-1.5 px-1.5 truncate">
                            <select
                              value={r.status}
                              onChange={(e) => handleCellUpdate(r.id, 'status', e.target.value as any)}
                              className={cn(
                                'w-full text-[10px] font-extrabold px-2 py-1 rounded-lg border outline-none cursor-pointer transition-colors shadow-2xs',
                                isGood
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/90 dark:text-emerald-300 dark:border-emerald-800 font-bold'
                                  : isReview
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/90 dark:text-amber-300 dark:border-amber-800 font-bold'
                                  : 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/90 dark:text-rose-300 dark:border-rose-800 font-bold'
                              )}
                            >
                              <option value="Good">Good</option>
                              <option value="Under Review">Under Review</option>
                              <option value="Action Needed">Action Needed</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Pagination Info */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-medium">
              <div>
                Showing{' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {filteredRecords.length === 0 ? 0 : (currentPage - 1) * (pageSize || filteredRecords.length) + 1}
                </span>{' '}
                to{' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {pageSize === 0 ? filteredRecords.length : Math.min(currentPage * pageSize, filteredRecords.length)}
                </span>{' '}
                of <span className="font-bold text-slate-800 dark:text-slate-200">{filteredRecords.length.toLocaleString()}</span> filtered records (from {records.length.toLocaleString()} total)
              </div>

              {pageSize > 0 && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 cursor-pointer"
                  >
                    First
                  </button>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 cursor-pointer"
                  >
                    Prev
                  </button>
                  <span className="px-2 font-bold text-slate-700 dark:text-slate-300">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 cursor-pointer"
                  >
                    Last
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MANAGER MONTHLY DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Manager Leaderboard Matrix */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Manager Tagging & Documentation Completion Matrix
                </h3>
                <p className="text-xs text-slate-400">
                  Audit resolution performance grouped by Manager initials tagged in eAgent (JP, RB, JM, EA, etc.)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {managerStats.map((st) => (
                <div
                  key={st.manager}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-blue-600 dark:text-blue-400">
                      Manager {st.manager}
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                      {st.rate}% Complete
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Total Tagged:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{st.total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span>Good / Complete:</span>
                      <span>{st.good.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                      <span>Under Review:</span>
                      <span>{st.review.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-rose-600 dark:text-rose-400">
                      <span>Action Needed:</span>
                      <span>{st.action.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${st.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CSV Upload File Modal */}
      <TDOCUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onImportComplete={(updated) => {
          setRecords(updated)
          setToastMessage('TDOC data file processed and fed to report!')
          setTimeout(() => setToastMessage(null), 2500)
        }}
      />
    </div>
  )
}
