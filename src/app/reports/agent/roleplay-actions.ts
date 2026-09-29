"use server"

import { createSupabaseAdmin } from "@/lib/supabaseServer"
import { unstable_noStore as noStore } from "next/cache"

// ── Types ────────────────────────────────────────────────────────────────────

export interface RoleplayModule {
  id: string
  name: string
  category: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface RoleplayScore {
  id: string
  module_id: string
  agent_id: string
  tier: "Beginner" | "Intermediate" | "Advanced"
  score: number
  completed_at: string // ISO date string YYYY-MM-DD
  entered_by: string | null
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getAllAgents() {
  noStore()
  try {
    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from("agents")
      .select("id, name, is_active")
      .eq("is_active", true)
      .order("name")
    
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Fetch all active modules in display order.
 */
export async function getRoleplayModules(): Promise<{
  success: boolean
  data?: RoleplayModule[]
  error?: string
}> {
  noStore()
  try {
    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from("roleplay_modules")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    if (error) throw error
    return { success: true, data: data ?? [] }
  } catch (err: any) {
    console.error("[roleplay] getRoleplayModules error:", err)
    return { success: false, error: err.message }
  }
}

/**
 * Fetch all roleplay scores for a given agent.
 */
export async function getAgentRoleplayScores(agentId: string): Promise<{
  success: boolean
  data?: RoleplayScore[]
  error?: string
}> {
  noStore()
  try {
    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from("roleplay_scores")
      .select("*")
      .eq("agent_id", agentId)

    if (error) throw error
    return { success: true, data: data ?? [] }
  } catch (err: any) {
    console.error("[roleplay] getAgentRoleplayScores error:", err)
    return { success: false, error: err.message }
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Upsert a score for a module/agent/tier. Only saves if the new score is
 * HIGHER than the existing one. Returns { updated: true } if saved,
 * { updated: false } if the existing score was already better.
 */
export async function upsertRoleplayScore(input: {
  moduleId: string
  agentId: string
  tier: "Beginner" | "Intermediate" | "Advanced"
  score: number
  completedAt: string // YYYY-MM-DD
  enteredBy?: string
}): Promise<{ success: boolean; updated: boolean; error?: string }> {
  try {
    const supabase = createSupabaseAdmin()

    // Check existing score
    const { data: existing } = await supabase
      .from("roleplay_scores")
      .select("score")
      .eq("module_id", input.moduleId)
      .eq("agent_id", input.agentId)
      .eq("tier", input.tier)
      .maybeSingle()

    // Best-score rule: skip if existing is already higher or equal
    if (existing && existing.score >= input.score) {
      return { success: true, updated: false }
    }

    const { error } = await supabase
      .from("roleplay_scores")
      .upsert(
        {
          module_id: input.moduleId,
          agent_id: input.agentId,
          tier: input.tier,
          score: input.score,
          completed_at: input.completedAt,
          entered_by: input.enteredBy ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "module_id,agent_id,tier" }
      )

    if (error) throw error
    return { success: true, updated: true }
  } catch (err: any) {
    console.error("[roleplay] upsertRoleplayScore error:", err)
    return { success: false, updated: false, error: err.message }
  }
}

// ── Module Management (managers/admins only) ──────────────────────────────────

/**
 * Create a new module. Appended to the end (max sort_order + 1).
 */
export async function createRoleplayModule(
  name: string,
  category: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = createSupabaseAdmin()

    // Find current max sort_order
    const { data: maxRow } = await supabase
      .from("roleplay_modules")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = (maxRow?.sort_order ?? -1) + 1

    const { data, error } = await supabase
      .from("roleplay_modules")
      .insert({ name: name.trim(), category: category.trim(), sort_order: nextOrder })
      .select("id")
      .single()

    if (error) throw error
    return { success: true, id: data.id }
  } catch (err: any) {
    console.error("[roleplay] createRoleplayModule error:", err)
    return { success: false, error: err.message }
  }
}

/**
 * Batch-update sort_order for all modules (after drag-and-drop reorder).
 */
export async function updateModuleOrder(
  modules: { id: string; sort_order: number }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createSupabaseAdmin()

    // Upsert each row individually — Supabase doesn't support batch UPDATE
    const updates = modules.map(({ id, sort_order }) =>
      supabase
        .from("roleplay_modules")
        .update({ sort_order, updated_at: new Date().toISOString() })
        .eq("id", id)
    )

    await Promise.all(updates)
    return { success: true }
  } catch (err: any) {
    console.error("[roleplay] updateModuleOrder error:", err)
    return { success: false, error: err.message }
  }
}

/**
 * Rename a module and/or change its category.
 */
export async function updateModule(
  id: string,
  name: string,
  category: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createSupabaseAdmin()
    const { error } = await supabase
      .from("roleplay_modules")
      .update({ name: name.trim(), category: category.trim(), updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) throw error
    return { success: true }
  } catch (err: any) {
    console.error("[roleplay] updateModule error:", err)
    return { success: false, error: err.message }
  }
}

/**
 * Soft-delete a module (sets is_active = false).
 * All agent scores for this module are preserved but hidden.
 */
export async function deleteRoleplayModule(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createSupabaseAdmin()
    const { error } = await supabase
      .from("roleplay_modules")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) throw error
    return { success: true }
  } catch (err: any) {
    console.error("[roleplay] deleteRoleplayModule error:", err)
    return { success: false, error: err.message }
  }
}
