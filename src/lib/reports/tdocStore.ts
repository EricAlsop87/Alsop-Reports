// ============================================================================
// TDOC Report — Service Layer & Data Store (NB & Add Car Documentation Audit)
// ============================================================================

import { supabase } from '@/lib/supabaseClient'
import rawSeedRecords from './tdocData.json'

export interface TDOCRecord {
  id: string
  policy_number: string
  customer_name: string
  effective_date: string
  issue_date: string
  producer_name: string
  office: string
  sub_producer?: string
  bind_id?: string
  product?: string
  transaction_type: string // NB, Add Car, Add Item, New Policy Issued
  written_premium: number
  item_count: number
  tagged_manager: string // e.g. JP, RB, JM, EA, Unassigned
  missing_admin: string
  missing_legal: string
  missing_brp: string
  comment_category: string
  comments: string
  status: 'Good' | 'Action Needed' | 'Under Review' // Computed automatically
  month_period: string
  created_at: string
}

export const DEFAULT_MANAGERS = ['JP', 'RB', 'JM', 'PH', 'EA', 'CA', 'Unassigned']

/**
 * Compute status based on documentation fields and sheet tags.
 */
export function computeTDOCStatus(
  admin: string = '',
  legal: string = '',
  brp: string = '',
  currentStatus: string = ''
): 'Good' | 'Action Needed' | 'Under Review' {
  const s = currentStatus.trim().toLowerCase()
  if (s === 'complete' || s === 'good') return 'Good'
  if (s === 'needs review' || s === 'under review') return 'Under Review'

  const a = admin.trim().toLowerCase()
  const l = legal.trim().toLowerCase()
  const b = brp.trim().toLowerCase()

  const adminOk = a === 'good' || a.includes('good')
  const legalOk = l === 'good' || l.includes('good')
  const brpOk = b === 'good' || b.includes('good')

  if (adminOk && legalOk && brpOk) {
    if (a.includes('review') || l.includes('review') || b.includes('review')) {
      return 'Under Review'
    }
    return 'Good'
  }
  return 'Action Needed'
}

const INITIAL_TDOC_SEEDS: TDOCRecord[] = (rawSeedRecords as any[]).map((r) => ({
  ...r,
  status: computeTDOCStatus(r.missing_admin, r.missing_legal, r.missing_brp, r.status),
}))

const STORAGE_KEY = 'tdoc_records_store_v3'

export async function fetchTDOCRecords(): Promise<TDOCRecord[]> {
  try {
    const { data, error } = await supabase
      .from('tdoc_records')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data && data.length > 0) {
      return data.map((r: any) => ({
        ...r,
        status: computeTDOCStatus(r.missing_admin, r.missing_legal, r.missing_brp, r.status),
      }))
    }
  } catch (err) {
    console.warn('[TDOCStore] Supabase fetch fallback to local storage:', err)
  }

  // Fallback to localStorage / Google Sheet seeds
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      } catch {}
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TDOC_SEEDS))
    } catch (e) {
      console.warn('[TDOCStore] Storage quota reached, using memory cache:', e)
    }
  }

  return INITIAL_TDOC_SEEDS
}

export async function saveTDOCRecord(record: TDOCRecord): Promise<TDOCRecord> {
  const updatedStatus = computeTDOCStatus(
    record.missing_admin,
    record.missing_legal,
    record.missing_brp,
    record.status
  )
  const fullRecord: TDOCRecord = {
    ...record,
    status: updatedStatus,
  }

  try {
    const { error } = await supabase
      .from('tdoc_records')
      .upsert(fullRecord, { onConflict: 'id' })

    if (error) {
      console.warn('[TDOCStore] Supabase save warning:', error)
    }
  } catch (err) {
    console.warn('[TDOCStore] Supabase save error:', err)
  }

  if (typeof window !== 'undefined') {
    try {
      const current = await fetchTDOCRecords()
      const index = current.findIndex((r) => r.id === record.id)
      if (index >= 0) {
        current[index] = fullRecord
      } else {
        current.unshift(fullRecord)
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    } catch (e) {
      console.warn('[TDOCStore] Local storage update error:', e)
    }
  }

  return fullRecord
}

export async function importTDOCBatch(records: Partial<TDOCRecord>[]): Promise<TDOCRecord[]> {
  const created: TDOCRecord[] = records.map((r, i) => {
    const admin = r.missing_admin || 'Good'
    const legal = r.missing_legal || 'Good'
    const brp = r.missing_brp || 'Good'
    const status = computeTDOCStatus(admin, legal, brp, r.status)

    return {
      id: r.id || `tdoc-imp-${Date.now()}-${i}`,
      policy_number: r.policy_number || `8044${Math.floor(10000 + Math.random() * 90000)}`,
      customer_name: r.customer_name || 'Client Name',
      effective_date: r.effective_date || new Date().toLocaleDateString('en-US'),
      issue_date: r.issue_date || new Date().toLocaleDateString('en-US'),
      producer_name: r.producer_name || 'Agent',
      office: r.office || '094944',
      sub_producer: r.sub_producer || '',
      bind_id: r.bind_id || '',
      product: r.product || 'Standard Auto',
      transaction_type: r.transaction_type || 'New Policy Issued',
      written_premium: Number(r.written_premium) || 0,
      item_count: Number(r.item_count) || 1,
      tagged_manager: r.tagged_manager || 'Unassigned',
      missing_admin: admin,
      missing_legal: legal,
      missing_brp: brp,
      comment_category: r.comment_category || 'General',
      comments: r.comments || '',
      status: status,
      month_period: r.month_period || 'September',
      created_at: new Date().toISOString(),
    }
  })

  try {
    await supabase.from('tdoc_records').insert(created)
  } catch (err) {
    console.warn('[TDOCStore] Supabase batch import fallback:', err)
  }

  if (typeof window !== 'undefined') {
    try {
      const current = await fetchTDOCRecords()
      const combined = [...created, ...current]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(combined))
      return combined
    } catch (e) {
      console.warn('[TDOCStore] Storage update quota error:', e)
    }
  }

  return created
}
