"use server"

import { unstable_noStore as noStore } from "next/cache"
import { createSupabaseAdmin } from "@/lib/supabaseServer"
const supabase = createSupabaseAdmin()
import { REBEL_REWARDS_2026_SEED, RawRebelAgentRow } from "@/lib/rebelRewardsSeed"
import { calculateAgentRebelStatus, AgentRebelStandings, resolveContestAgentMatch } from "@/lib/rebelRewards"
import * as XLSX from "xlsx"

// In-memory / dynamic cache for uploaded snapshots in current server lifetime
let customUploadedRows: RawRebelAgentRow[] | null = null
let customPeriodLabel = "YTD July 2026"
let customLastUpdated = "2026-07-31"

export async function getRebelRewardsStandings(): Promise<{
  success: boolean
  standings: AgentRebelStandings[]
  periodLabel: string
  lastUpdated: string
  lastUpdatedBy?: string
  summary: {
    totalAgents: number
    prizeEarnersCount: number
    totalAgencyPayout: number
    anakinCount: number
    reyCount: number
    lukeCount: number
    obiwanCount: number
  }
  error?: string
}> {
  noStore()
  try {
    // 1. Fetch ALL agents from DB to match against Excel sheet
    const { data: dbAgents } = await supabase
      .from("agents")
      .select("id, name, office, team, active, report_visible, system_variants")

    const agentsList = dbAgents || []
    const sourceRows = customUploadedRows || REBEL_REWARDS_2026_SEED

    // 1b. Fetch live YTD auto items from period_summaries (pre-aggregated, updated on every upload)
    const { data: ytdSummaries } = await supabase
      .from("period_summaries")
      .select("agent_id, nb_auto_items")
      .eq("period_type", "ytd")
      .eq("period_key", "2026")

    const liveAutoMap = new Map<string, number>()
    if (ytdSummaries) {
      for (const row of ytdSummaries) {
        liveAutoMap.set(row.agent_id, row.nb_auto_items || 0)
      }
    }

    let latestTimestamp: string | null = null
    let latestUpdater: string | null = null

    // 2. Compute Rebel standings for each row
    const standings: AgentRebelStandings[] = sourceRows
      .filter(row => {
        const matchedAgent = resolveContestAgentMatch(row.name, agentsList)
        if (matchedAgent) {
          // Hide agent if they are inactive or hidden from the daily reports
          if (matchedAgent.active === false) return false
          if (matchedAgent.report_visible === false) return false
          if (["Other", "System", "Support"].includes(matchedAgent.team)) return false
          return true
        }
        // If not matched in DB, hide from standings
        return false
      })
      .map(row => {
        const matchedAgent = resolveContestAgentMatch(row.name, agentsList)
        const customRR = (matchedAgent?.system_variants as any)?.rebel_rewards

        // Use custom numbers if edited, otherwise fallback to live YTD or contest seed
        const liveAutoItems = matchedAgent?.id ? liveAutoMap.get(matchedAgent.id) : undefined
        const autoItems = customRR?.auto_items !== undefined
          ? Number(customRR.auto_items)
          : (liveAutoItems !== undefined ? liveAutoItems : row.autoItems)

        const ips = customRR?.ips !== undefined ? Number(customRR.ips) : row.ips
        const afsPc = customRR?.afs_pc !== undefined ? Number(customRR.afs_pc) : row.afsPc
        const ivanNlItems = customRR?.ivan_nl_items !== undefined ? Number(customRR.ivan_nl_items) : row.ivanNlItems
        const reyByJune30 = customRR?.rey_by_june_30 !== undefined ? !!customRR.rey_by_june_30 : row.reyByJune30
        const updatedAt = customRR?.updated_at || null
        const updatedByName = customRR?.updated_by_name || null

        if (updatedAt && (!latestTimestamp || new Date(updatedAt) > new Date(latestTimestamp))) {
          latestTimestamp = updatedAt
          latestUpdater = updatedByName
        }

        // Use the agent's clean display name from DB if matched (e.g. "Nancy G", "Rosie", "Ric Becerra")
        let displayName = matchedAgent?.name || row.name
        if (
          row.name?.toLowerCase() === "nancy g" ||
          matchedAgent?.name?.toLowerCase() === "nancy g" ||
          (matchedAgent?.team === "CSR" && matchedAgent?.name?.toLowerCase().includes("nancy"))
        ) {
          displayName = "Nancy G"
        }

        return calculateAgentRebelStatus(
          displayName,
          autoItems,
          ips,
          afsPc,
          ivanNlItems,
          {
            agentId: matchedAgent?.id || null,
            office: matchedAgent?.office || undefined,
            team: matchedAgent?.team || undefined,
            reyByJune30,
            updatedAt,
            updatedByName,
          }
        )
      })

    // 3. Sort by:
    // Highest Tier Rank (Obi-Wan > Luke > Rey > Anakin > None)
    // Then by Total Payout ($) descending
    // Then by Auto Items descending
    const tierWeights: Record<string, number> = {
      obiwan: 4,
      luke: 3,
      rey: 2,
      anakin: 1,
      none: 0,
    }

    standings.sort((a, b) => {
      const weightDiff = (tierWeights[b.highestTier] || 0) - (tierWeights[a.highestTier] || 0)
      if (weightDiff !== 0) return weightDiff
      if (b.totalPayout !== a.totalPayout) return b.totalPayout - a.totalPayout
      return b.autoItems - a.autoItems
    })

    // 4. Calculate Summary Statistics
    let totalAgencyPayout = 0
    let prizeEarnersCount = 0
    let anakinCount = 0
    let reyCount = 0
    let lukeCount = 0
    let obiwanCount = 0

    for (const s of standings) {
      if (s.totalPayout > 0) prizeEarnersCount++
      totalAgencyPayout += s.totalPayout
      if (s.anakin.earned) anakinCount++
      if (s.rey.earned) reyCount++
      if (s.luke.earned) lukeCount++
      if (s.obiwan.earned) obiwanCount++
    }

    return {
      success: true,
      standings,
      periodLabel: customPeriodLabel,
      lastUpdated: latestTimestamp || customLastUpdated,
      lastUpdatedBy: latestUpdater || undefined,
      summary: {
        totalAgents: standings.length,
        prizeEarnersCount,
        totalAgencyPayout,
        anakinCount,
        reyCount,
        lukeCount,
        obiwanCount,
      },
    }
  } catch (err: any) {
    console.error("Error fetching Rebel Rewards standings:", err)
    return {
      success: false,
      standings: [],
      periodLabel: customPeriodLabel,
      lastUpdated: customLastUpdated,
      summary: {
        totalAgents: 0,
        prizeEarnersCount: 0,
        totalAgencyPayout: 0,
        anakinCount: 0,
        reyCount: 0,
        lukeCount: 0,
        obiwanCount: 0,
      },
      error: err?.message || "Failed to calculate standings",
    }
  }
}

/**
 * Server action to process an uploaded monthly Excel report
 */
export async function uploadRebelRewardsExcel(base64Data: string, fileName: string) {
  noStore()
  try {
    const buffer = Buffer.from(base64Data, "base64")
    const wb = XLSX.read(buffer, { type: "buffer" })
    const sheetName = wb.SheetNames[0]
    const ws = wb.Sheets[sheetName]
    const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

    if (rawRows.length < 7) {
      return { success: false, error: "The uploaded file does not contain enough data rows." }
    }

    const parsedAgents: RawRebelAgentRow[] = []

    // Read rows starting from row 7 (index 6)
    for (let i = 6; i < rawRows.length; i++) {
      const row = rawRows[i]
      if (row && typeof row[0] === "string" && row[0].trim() !== "") {
        const name = row[0].trim()
        const autoItems = Number(row[1]) || 0
        const ips = Number(row[2]) || 0
        const afsPc = Number(row[3]) || 0
        const ivanNlItems = Number(row[4]) || 0
        parsedAgents.push({ name, autoItems, ips, afsPc, ivanNlItems })
      }
    }

    if (parsedAgents.length === 0) {
      return { success: false, error: "No valid agent rows were found in the uploaded file." }
    }

    // Extract period label from header if present
    let detectedPeriod = fileName.replace(/\.[^/.]+$/, "")
    if (rawRows[2] && typeof rawRows[2][1] === "string") {
      detectedPeriod = rawRows[2][1]
    }

    customUploadedRows = parsedAgents
    customPeriodLabel = detectedPeriod || "Updated YTD Report"
    customLastUpdated = new Date().toISOString().split("T")[0]

    return {
      success: true,
      agentCount: parsedAgents.length,
      periodLabel: customPeriodLabel,
    }
  } catch (err: any) {
    console.error("Error parsing uploaded Rebel Rewards Excel file:", err)
    return { success: false, error: err?.message || "Failed to parse Excel file." }
  }
}

/**
 * Server action to update contest stats for a specific agent.
 * Saves directly to agent's system_variants.rebel_rewards so it persists permanently.
 */
export async function updateRebelRewardsAgentStats({
  agentId,
  agentName,
  autoItems,
  ips,
  afsPc,
  ivanNlItems,
  reyByJune30,
  updatedById,
  updatedByName,
}: {
  agentId?: string
  agentName?: string
  autoItems: number
  ips: number
  afsPc: number
  ivanNlItems: number
  reyByJune30?: boolean
  updatedById?: string
  updatedByName?: string
}): Promise<{ success: boolean; updatedAt?: string; updatedByName?: string; error?: string }> {
  noStore()
  try {
    let targetAgent: any = null

    if (agentId) {
      const { data } = await supabase
        .from("agents")
        .select("id, name, office, system_variants")
        .eq("id", agentId)
        .maybeSingle()
      targetAgent = data
    }

    if (!targetAgent && agentName) {
      const { data: allAgents } = await supabase
        .from("agents")
        .select("id, name, office, system_variants")
      targetAgent = resolveContestAgentMatch(agentName, allAgents || [])
    }

    if (!targetAgent) {
      return { success: false, error: "Agent not found in database" }
    }

    const nowIso = new Date().toISOString()
    const updater = updatedByName || "Manager"
    const existingVariants = (targetAgent.system_variants as Record<string, any>) || {}

    const updatedVariants = {
      ...existingVariants,
      rebel_rewards: {
        auto_items: Number(autoItems) || 0,
        ips: Number(ips) || 0,
        afs_pc: Number(afsPc) || 0,
        ivan_nl_items: Number(ivanNlItems) || 0,
        rey_by_june_30: !!reyByJune30,
        updated_at: nowIso,
        updated_by_id: updatedById || null,
        updated_by_name: updater,
      },
    }

    const { error: updateErr } = await supabase
      .from("agents")
      .update({
        system_variants: updatedVariants,
        updated_at: nowIso,
      })
      .eq("id", targetAgent.id)

    if (updateErr) {
      return { success: false, error: updateErr.message }
    }

    return { success: true, updatedAt: nowIso, updatedByName: updater }
  } catch (err: any) {
    console.error("Error updating Rebel Rewards agent stats:", err)
    return { success: false, error: err?.message || "Failed to update agent stats" }
  }
}

