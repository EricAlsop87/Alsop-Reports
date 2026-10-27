export interface ReferralEntry {
  id: string
  month_key: string // e.g. "2026-09"
  producer: string
  lead_source: string
  policy_type: string
  policies?: string[]
  policy_count?: number
  customer_name: string
  sold_date: string
  carrier: string
  is_referral: boolean
  amount: number | null
  gift_type: string | null
  gift_status: "pending" | "sent" | "n/a"
  date_sent: string | null
  recipient_notes: string | null
  city?: string | null
  state?: string | null
  updated_by?: string | null
  updated_at?: string | null
}

export interface ReferralSummary {
  totalReferrals: number
  giftsSentCount: number
  giftsPendingCount: number
  totalAmountSent: number
  allPoliciesCount: number
}

/**
 * Exact list of company lead provider sources, internet aggregators,
 * cross-sales, rewrites, and internal call-ins that are tagged as "Remove"
 * in the Alsop Referral Program Google Sheet and must NOT be counted as referrals.
 */
export const REMOVED_COMPANY_LEAD_SOURCES = [
  "#pivot",
  "allstate auto to natgen",
  "bristol to allstate",
  "burke - digital auto",
  "burke - digital homes",
  "call in existing customer",
  "cfp to bamboo",
  "cfp to ivantage",
  "cross-sale",
  "datalot",
  "goal",
  "m3",
  "media alpha",
  "mwi - cross-sale",
  "quinstreet",
  "smartfinancial",
  "winback",
] as const

/**
 * Checks if a lead source represents general non-referral sales channels
 * (internet leads, cross-sales, winbacks, rewrites, internal campaigns)
 * that should not be tracked as customer/partner referrals.
 */
export function isNonReferralLeadSource(source: string | null | undefined): boolean {
  if (!source) return false
  const s = source.toLowerCase().trim()

  for (const rm of REMOVED_COMPANY_LEAD_SOURCES) {
    if (s === rm || s.startsWith(rm)) return true
  }

  // Common formatting variations
  if (s === "data lot" || s.startsWith("datalot")) return true
  if (s === "smart financial" || s.startsWith("smartfinancial")) return true
  if (s.includes("burke - digital") || s.includes("burke digital")) return true
  if (s.includes("existing customer")) return true
  if (s.includes("allstate auto to natgen") || s.includes("natgen auto to allstate")) return true
  if (s.includes("bristol to allstate")) return true
  if (s.includes("cfp to bamboo") || s.includes("cfp to ivantage") || s.includes("cft to ivantage")) return true
  if (s.includes("mwi - cross-sale") || s.includes("mwi cross sale")) return true
  if (s.includes("cross-sale") || s === "cross sale") return true

  return false
}
