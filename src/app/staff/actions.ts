"use server"

import { createSupabaseAdmin } from "@/lib/supabaseServer"
import { syncAgentChannels } from "@/app/admin/users/actions"
import { revalidatePath } from "next/cache"

const OFFICE_MAP: Record<string, string> = {
  Rancho: "RC",
  "Rancho Cucamonga": "RC",
  Chino: "CH",
  Claremont: "MB",
  Montclair: "MCM",
  Montebello: "MB",
}

export interface SaveDirectoryEntryInput {
  id?: string
  group_id: string
  name: string
  position?: string | null
  role?: string | null
  email?: string | null
  ring_central_phone?: string | null
  ricochet_phone?: string | null
  notes?: string | null
}

export async function saveDirectoryEntry(input: SaveDirectoryEntryInput) {
  try {
    const supabase = createSupabaseAdmin()

    // 1. Fetch group details to know the target office name
    const { data: group } = await supabase
      .from("directory_groups")
      .select("name, group_type")
      .eq("id", input.group_id)
      .single()

    const targetOfficeCode = group?.name ? OFFICE_MAP[group.name] : null

    // 2. Insert or update directory_entries
    const payload = {
      group_id: input.group_id,
      name: input.name.trim(),
      position: input.position?.trim() || null,
      role: input.role?.trim() || null,
      email: input.email?.trim() || null,
      ring_central_phone: input.ring_central_phone?.trim() || null,
      ricochet_phone: input.ricochet_phone?.trim() || null,
      notes: input.notes?.trim() || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    }

    let entryId = input.id
    if (entryId) {
      const { error } = await supabase
        .from("directory_entries")
        .update(payload)
        .eq("id", entryId)
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from("directory_entries")
        .insert({ ...payload, display_order: 999 })
        .select("id")
        .single()
      if (error) throw error
      entryId = data.id
    }

    // 3. If target office is mapped (e.g. RC, CH, MB, MCM), also update matching agent in `agents` table
    if (targetOfficeCode) {
      // Find matching agent by email or name
      let agentMatch = null
      if (input.email) {
        const { data } = await supabase
          .from("agents")
          .select("id, name, office")
          .ilike("email", input.email.trim())
          .maybeSingle()
        agentMatch = data
      }
      if (!agentMatch && input.name) {
        // Try exact name or first name match
        const { data } = await supabase
          .from("agents")
          .select("id, name, office")
          .ilike("name", input.name.trim())
          .maybeSingle()
        agentMatch = data
      }

      if (agentMatch && agentMatch.office !== targetOfficeCode) {
        await supabase
          .from("agents")
          .update({ office: targetOfficeCode, updated_at: new Date().toISOString() })
          .eq("id", agentMatch.id)

        try {
          await syncAgentChannels(agentMatch.id)
        } catch (e) {
          console.warn("Could not sync agent channels:", e)
        }
      }
    }

    revalidatePath("/staff")
    return { success: true, id: entryId }
  } catch (err: any) {
    console.error("saveDirectoryEntry error:", err)
    return { success: false, error: err.message || "Failed to save entry" }
  }
}

export async function deleteDirectoryEntry(id: string) {
  try {
    const supabase = createSupabaseAdmin()
    const { error } = await supabase
      .from("directory_entries")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) throw error
    revalidatePath("/staff")
    return { success: true }
  } catch (err: any) {
    console.error("deleteDirectoryEntry error:", err)
    return { success: false, error: err.message || "Failed to delete entry" }
  }
}
