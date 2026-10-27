"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseAdmin } from "@/lib/supabaseServer"
import { ReferralEntry, ReferralSummary, isNonReferralLeadSource } from "@/lib/referralTypes"
import {
  REFERRAL_PROGRAM_SEPTEMBER_2026_SEED,
  REFERRAL_PROGRAM_OCTOBER_2026_SEED
} from "@/lib/referralSeed"

// Fallback in-memory storage for local dev / when DB table is not yet created
let memoryStore: ReferralEntry[] = [
  ...REFERRAL_PROGRAM_OCTOBER_2026_SEED,
  ...REFERRAL_PROGRAM_SEPTEMBER_2026_SEED
]

export async function getReferralsData(monthKey: string = "2026-10"): Promise<{
  success: boolean
  entries: ReferralEntry[]
  summary: ReferralSummary
  availableMonths: string[]
  error?: string
}> {
  try {
    const supabase = createSupabaseAdmin()
    
    // Try querying Supabase
    const { data, error } = await supabase
      .from("referral_program_entries")
      .select("*")
      .eq("month_key", monthKey)
      .order("is_referral", { ascending: false })
      .order("sold_date", { ascending: false })

    let entries: ReferralEntry[] = []

    if (error || !data || data.length === 0) {
      // Table does not exist yet or no rows for this month: use memory store
      entries = memoryStore.filter(e => e.month_key === monthKey && !isNonReferralLeadSource(e.lead_source))
      if (entries.length === 0 && monthKey === "2026-09") {
        entries = memoryStore.filter(e => !isNonReferralLeadSource(e.lead_source))
      }
    } else {
      entries = (data as ReferralEntry[]).filter(e => !isNonReferralLeadSource(e.lead_source))
    }

    // Compute summary
    const giftsSent = entries.filter(e => e.gift_status === "sent")
    const giftsPending = entries.filter(e => e.gift_status === "pending")
    const totalAmount = giftsSent.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

    const summary: ReferralSummary = {
      totalReferrals: entries.length,
      giftsSentCount: giftsSent.length,
      giftsPendingCount: giftsPending.length,
      totalAmountSent: totalAmount,
      allPoliciesCount: entries.length,
    }

    const availableMonths = ["2026-09", "2026-10", "2026-11"]

    return {
      success: true,
      entries,
      summary,
      availableMonths,
    }
  } catch (err: any) {
    console.error("Error in getReferralsData:", err)
    // Fallback gracefully
    const entries = memoryStore.filter(e => e.month_key === monthKey && !isNonReferralLeadSource(e.lead_source))
    const giftsSent = entries.filter(e => e.gift_status === "sent")
    const giftsPending = entries.filter(e => e.gift_status === "pending")
    const totalAmount = giftsSent.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

    return {
      success: true,
      entries,
      summary: {
        totalReferrals: entries.length,
        giftsSentCount: giftsSent.length,
        giftsPendingCount: giftsPending.length,
        totalAmountSent: totalAmount,
        allPoliciesCount: entries.length,
      },
      availableMonths: ["2026-09", "2026-10"],
    }
  }
}

export async function updateReferralEntry(
  id: string,
  updates: Partial<ReferralEntry>,
  managerName?: string
): Promise<{ success: boolean; entry?: ReferralEntry; error?: string }> {
  try {
    const supabase = createSupabaseAdmin()
    const now = new Date().toISOString()

    const payload = {
      ...updates,
      updated_by: managerName || "Manager",
      updated_at: now,
    }

    // Try DB first
    const { data, error } = await supabase
      .from("referral_program_entries")
      .update(payload)
      .eq("id", id)
      .select()
      .maybeSingle()

    // Also update in-memory store
    const idx = memoryStore.findIndex(e => e.id === id)
    if (idx !== -1) {
      memoryStore[idx] = {
        ...memoryStore[idx],
        ...payload,
      }
    }

    revalidatePath("/referrals")
    return {
      success: true,
      entry: data ? (data as ReferralEntry) : (memoryStore[idx] || undefined),
    }
  } catch (err: any) {
    console.error("Error in updateReferralEntry:", err)
    const idx = memoryStore.findIndex(e => e.id === id)
    if (idx !== -1) {
      memoryStore[idx] = {
        ...memoryStore[idx],
        ...updates,
        updated_by: managerName || "Manager",
        updated_at: new Date().toISOString(),
      }
      return { success: true, entry: memoryStore[idx] }
    }
    return { success: false, error: err.message || "Failed to update" }
  }
}

export async function addReferralEntry(
  entry: Omit<ReferralEntry, "id">,
  managerName?: string
): Promise<{ success: boolean; entry?: ReferralEntry; error?: string }> {
  try {
    const supabase = createSupabaseAdmin()
    const id = `ref_${entry.month_key}_${Date.now()}`
    const now = new Date().toISOString()

    const newRecord: ReferralEntry = {
      ...entry,
      id,
      amount: entry.amount ? Number(entry.amount) : 10.00,
      gift_type: entry.gift_type || null,
      gift_status: entry.gift_status || "pending",
      updated_by: managerName || "Manager",
      updated_at: now,
    }

    // Try DB
    await supabase.from("referral_program_entries").insert(newRecord)

    // Update memory
    memoryStore.unshift(newRecord)

    revalidatePath("/referrals")
    return { success: true, entry: newRecord }
  } catch (err: any) {
    console.error("Error in addReferralEntry:", err)
    return { success: false, error: err.message }
  }
}

export async function deleteReferralEntry(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createSupabaseAdmin()
    await supabase.from("referral_program_entries").delete().eq("id", id)
    memoryStore = memoryStore.filter(e => e.id !== id)
    revalidatePath("/referrals")
    return { success: true }
  } catch (err: any) {
    console.error("Error in deleteReferralEntry:", err)
    memoryStore = memoryStore.filter(e => e.id !== id)
    return { success: true }
  }
}
