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
  gift_type: string
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
