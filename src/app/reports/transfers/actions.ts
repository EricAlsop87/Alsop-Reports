"use server"

import fs from "fs"
import path from "path"
import xlsx from "xlsx"

export interface TransferRecord {
  id: string
  file: string
  date: string // YYYY-MM-DD
  lia: string  // Agent name
  tm: string   // Normalized Telemarketer name
  rawTm: string
  leadName: string
  message: string
  tryCount: number
}

export interface TransfersPayload {
  records: TransferRecord[]
  dates: string[]
  telemarketers: string[]
  agents: string[]
  totalTransfers: number
  avgPerDay: number
  topTm: { name: string; count: number }
  topAgent: { name: string; count: number }
  multitryRate: number
  byDate: Record<string, number>
  byTm: Record<string, number>
  byAgent: Record<string, number>
  routingMatrix: Record<string, Record<string, number>> // tm -> { agent -> count }
  byDayOfWeek: Record<string, { count: number; days: number; avg: number }>
}

function normalizeTM(name: string | undefined | null): string {
  if (!name) return "Unknown TM"
  const n = name.trim()
  const lower = n.toLowerCase()
  if (lower.includes("chareen") || lower.includes("shireen")) return "Chareen Delote"
  if (lower.includes("sophia")) return "Sophia Solatorio"
  if (lower.includes("jovelyn")) return "Jovelyn Cortez"
  if (lower.includes("mark")) return "Mark"
  if (lower.includes("tm 4") || lower.includes("tm4")) return "CA 07 TM 4"
  return n
}

function normalizeAgent(name: string | undefined | null): string {
  if (!name) return "Unassigned"
  let n = name.trim()
  // Clean prefixes/suffixes like "@", "(Mgr.)"
  n = n.replace(/^@/, "").replace(/\s*\(\s*Mgr\.?\s*\)/i, "").trim()
  const lower = n.toLowerCase()
  if (lower.includes("charmaine")) return "Charmaine"
  if (lower.includes("edwin")) return "Edwin Sernas"
  if (lower.includes("claudia")) return "Claudia Sambrano"
  if (lower.includes("eddie")) return "Eddie Sanchez"
  if (lower.includes("robert")) return "Robert Lewis"
  if (lower.includes("rosalba")) return "Rosalba Lozano"
  if (lower.includes("frank")) return "Frank Villalobos"
  if (lower.includes("chris")) return "Chris Elliott"
  if (lower.includes("jenna")) return "Jenna Zazueta"
  if (lower.includes("myles")) return "Myles Vinluan"
  if (lower.includes("christian")) return "Christian Reyes"
  if (lower.includes("roxana")) return "Roxana Topete"
  if (lower.includes("valerie")) return "Valerie Granados"
  if (lower.includes("suzanne")) return "Suzanne Yniguez"
  if (lower.includes("gilda")) return "Gilda Aquino"
  return n
}

function getReportDate(filename: string): string {
  const m = filename.match(/Slack Report ([A-Za-z]+)\s*(\d+)/i)
  if (m) {
    const monthMap: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    }
    const month = monthMap[m[1].toLowerCase().slice(0, 3)] || "11"
    const day = m[2].padStart(2, "0")
    return `2026-${month}-${day}`
  }
  return "2026-11-01"
}

export async function getTransfersData(): Promise<TransfersPayload> {
  const reportsDir = path.join(process.cwd(), "data", "slack_reports")
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true })
  }

  const files = fs.readdirSync(reportsDir).filter(f => f.endsWith(".xlsx"))
  const records: TransferRecord[] = []

  files.forEach((file, fIdx) => {
    try {
      const filePath = path.join(reportsDir, file)
      const wb = xlsx.readFile(filePath)
      const reportDate = getReportDate(file)

      const detailSheet = wb.Sheets["Detail by LIA"]
      if (detailSheet) {
        const rows: any[] = xlsx.utils.sheet_to_json(detailSheet)
        rows.forEach((r, rIdx) => {
          const msg = (r["Full Message"] || "").toString()
          let tryCount = 1
          if (/2nd try|2nd\s*attempt/i.test(msg)) tryCount = 2
          else if (/3rd try|3rd\s*attempt/i.test(msg)) tryCount = 3

          const rawTm = (r["TM"] || "").toString().trim()
          const rawLia = (r["LIA"] || "").toString().trim()
          const tm = normalizeTM(rawTm)
          const lia = normalizeAgent(rawLia)
          const leadName = (r["Lead Name"] || "").toString().trim()

          records.push({
            id: `trans-${fIdx}-${rIdx}`,
            file,
            date: reportDate,
            lia,
            tm,
            rawTm,
            leadName,
            message: msg,
            tryCount
          })
        })
      }
    } catch (e) {
      console.error(`Error reading slack report ${file}:`, e)
    }
  })

  // Sort descending by date
  records.sort((a, b) => b.date.localeCompare(a.date))

  const dates = [...new Set(records.map(r => r.date))].sort((a, b) => b.localeCompare(a))
  const telemarketers = [...new Set(records.map(r => r.tm))].sort()
  const agents = [...new Set(records.map(r => r.lia))].sort()

  const byDate: Record<string, number> = {}
  const byTm: Record<string, number> = {}
  const byAgent: Record<string, number> = {}
  const routingMatrix: Record<string, Record<string, number>> = {}

  let multiTryCount = 0

  records.forEach(r => {
    byDate[r.date] = (byDate[r.date] || 0) + 1
    byTm[r.tm] = (byTm[r.tm] || 0) + 1
    byAgent[r.lia] = (byAgent[r.lia] || 0) + 1

    routingMatrix[r.tm] = routingMatrix[r.tm] || {}
    routingMatrix[r.tm][r.lia] = (routingMatrix[r.tm][r.lia] || 0) + 1

    if (r.tryCount > 1) multiTryCount++
  })

  // Top TM
  const sortedTms = Object.entries(byTm).sort((a, b) => b[1] - a[1])
  const topTm = sortedTms.length ? { name: sortedTms[0][0], count: sortedTms[0][1] } : { name: "None", count: 0 }

  // Top Agent
  const sortedAgents = Object.entries(byAgent).sort((a, b) => b[1] - a[1])
  const topAgent = sortedAgents.length ? { name: sortedAgents[0][0], count: sortedAgents[0][1] } : { name: "None", count: 0 }

  const totalTransfers = records.length
  const avgPerDay = dates.length ? Math.round((totalTransfers / dates.length) * 10) / 10 : 0
  const multitryRate = totalTransfers ? Math.round((multiTryCount / totalTransfers) * 1000) / 10 : 0

  // Day of week analysis
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const byDayOfWeek: Record<string, { count: number; days: number; avg: number }> = {}

  dates.forEach(d => {
    const [y, m, day] = d.split("-").map(Number)
    const dow = dayNames[new Date(y, m - 1, day).getDay()]
    if (!byDayOfWeek[dow]) byDayOfWeek[dow] = { count: 0, days: 0, avg: 0 }
    byDayOfWeek[dow].count += byDate[d] || 0
    byDayOfWeek[dow].days += 1
  })

  Object.keys(byDayOfWeek).forEach(dow => {
    byDayOfWeek[dow].avg = Math.round((byDayOfWeek[dow].count / byDayOfWeek[dow].days) * 10) / 10
  })

  return {
    records,
    dates,
    telemarketers,
    agents,
    totalTransfers,
    avgPerDay,
    topTm,
    topAgent,
    multitryRate,
    byDate,
    byTm,
    byAgent,
    routingMatrix,
    byDayOfWeek
  }
}
