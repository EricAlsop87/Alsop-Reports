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
 * Checks if a lead source represents general non-referral sales channels
 * (internet leads, cross-sales, winbacks, rewrites, internal campaigns)
 * that should not be tracked as customer/partner referrals.
 */
export function isNonReferralLeadSource(source: string | null | undefined): boolean {
  if (!source) return false
  const s = source.toLowerCase().trim()

  if (s === "quinstreet" || s.startsWith("quinstreet")) return true
  if (s === "datalot" || s === "data lot" || s.startsWith("datalot")) return true
  if (s === "cross-sale" || s === "cross sale") return true
  if (s === "m3") return true
  if (s === "surequote pro" || s === "surequote" || s.startsWith("surequote")) return true
  if (s === "goal") return true
  if (s === "personal referral") return true
  if (s === "smartfinancial" || s === "smart financial") return true
  if (s === "winback" || s.startsWith("winback")) return true
  if (s === "#pivot" || s === "pivot") return true
  if (s.includes("allstate auto to natgen") || s.includes("natgen auto to allstate") || s.includes("allstae auto natgen") || s.includes("natgen")) return true
  if (s.includes("builders risk") || s === "builders") return true
  if (s.includes("burke - digital") || s.includes("burke digital")) return true
  if (s.includes("cfp to ivantage") || s.includes("cft to ivantage")) return true
  if (s.includes("dp to ho3") || s.includes("ho3 to dp") || s.includes("change dp to ho") || s.includes("change ho3")) return true
  if (s === "gmb") return true
  if (s === "media alpha" || s.startsWith("media alpha")) return true
  if (s.includes("mwi - cross-sale") || s.includes("mwi cross sale")) return true
  if (s.includes("call in existing customer / cross-sale") || s.includes("yelp / cross-sale")) return true
  if (s === "call in existing customer" || s.includes("existing customer")) return true

  return false
}
