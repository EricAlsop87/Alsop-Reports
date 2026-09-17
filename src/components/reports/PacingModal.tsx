import { useState, useMemo, useRef, useCallback } from "react"
import { X, Copy, Check, Download, Image as ImageIcon, Search, Calendar, Award } from "lucide-react"

export interface PacingModalProps {
  isOpen: boolean
  onClose: () => void
  data: any[]
  elapsedBizDays: number
  totalBizDays: number
  goals?: any[]
}

export function PacingModal({ isOpen, onClose, data, elapsedBizDays, totalBizDays, goals }: PacingModalProps) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const tableRef = useRef<HTMLDivElement>(null)

  // Helper to get agent monthly items goal (default to 40)
  const getAgentMonthlyItemsGoal = (m: any) => {
    if (!goals) return 40
    const matching = goals.filter((g: any) => g.metric_name === "items" && g.timeframe === "monthly")
    if (!matching.length) return 40
    const agentOffice = m.agents?.office
    const agentTeam = m.agents?.team

    const exactMatch = matching.find((g: any) => g.team === agentTeam && g.office === agentOffice)
    if (exactMatch) return exactMatch.target_value

    const teamMatch = matching.find((g: any) => g.team === agentTeam && !g.office)
    if (teamMatch) return teamMatch.target_value

    const officeMatch = matching.find((g: any) => !g.team && g.office === agentOffice)
    if (officeMatch) return officeMatch.target_value

    const defaultMatch = matching.find((g: any) => !g.team && !g.office)
    return defaultMatch ? defaultMatch.target_value : 40
  }

  // Process data to calculate Daily Avg and On Pace for everyone, and sort by On Pace or MTD
  const sortedData = useMemo(() => {
    return data
      .filter((m) => (m.items_mtd || 0) > 0)
      .map((m) => {
        const mtd = m.items_mtd || 0
        const dailyAvg = elapsedBizDays > 0 ? mtd / elapsedBizDays : 0
        const onPace = elapsedBizDays > 0 ? Math.round(dailyAvg * totalBizDays) : 0
        const goal = getAgentMonthlyItemsGoal(m)
        return {
          agentName: (m.agents?.name || "Unknown").trim(),
          office: m.agents?.office || "",
          mtd,
          dailyAvg,
          onPace,
          goal,
          isGoalMet: mtd >= goal,
          pctGoal: goal > 0 ? Math.min(100, Math.round((mtd / goal) * 100)) : 0
        }
      })
      .sort((a, b) => b.mtd - a.mtd || b.onPace - a.onPace)
  }, [data, elapsedBizDays, totalBizDays, goals])

  // Filtered by search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return sortedData
    const q = searchQuery.toLowerCase()
    return sortedData.filter(r => 
      r.agentName.toLowerCase().includes(q) || 
      r.office.toLowerCase().includes(q)
    )
  }, [sortedData, searchQuery])

  // Calculations for Grand Total
  const totalItems = useMemo(() => sortedData.reduce((sum, r) => sum + r.mtd, 0), [sortedData])
  const totalDailyAvg = elapsedBizDays > 0 ? totalItems / elapsedBizDays : 0
  const totalOnPace = elapsedBizDays > 0 ? Math.round(totalDailyAvg * totalBizDays) : 0
  const pctElapsed = totalBizDays > 0 ? Math.round((elapsedBizDays / totalBizDays) * 100) : 0

  // Helper to format export timestamp (small font)
  const getExportTimestamp = useCallback(() => {
    const now = new Date()
    return now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ' \u2022 ' + now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }, [])

  /**
   * Generates clean, modern, formal HTML table formatted for email clients (Outlook, Gmail, etc.)
   */
  const getModernEmailHtml = useCallback(() => {
    const exportTime = getExportTimestamp()
    return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
  <!-- Header Banner -->
  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 12px 16px; color: #ffffff;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #38bdf8;">Alsop Agency &bull; Performance Pacing</div>
      <div style="font-size: 9px; color: #94a3b8;">${exportTime}</div>
    </div>
    <div style="font-size: 16px; font-weight: 800; margin-top: 2px; color: #ffffff;">Allstate Auto Items MTD Ranking</div>
    <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
      Day <strong>${elapsedBizDays}</strong> of <strong>${totalBizDays}</strong> Business Days (${pctElapsed}% Elapsed)
    </div>
  </div>

  <!-- Summary KPI Bar -->
  <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
    <tr>
      <td style="padding: 8px 10px; text-align: center; border-right: 1px solid #e2e8f0;">
        <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.03em;">Total Items MTD</div>
        <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 1px;">${totalItems}</div>
      </td>
      <td style="padding: 8px 10px; text-align: center; border-right: 1px solid #e2e8f0;">
        <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.03em;">Daily Run Rate</div>
        <div style="font-size: 17px; font-weight: 800; color: #0284c7; margin-top: 1px;">${totalDailyAvg.toFixed(2)}<span style="font-size: 10px; font-weight: normal; color: #64748b;"> /day</span></div>
      </td>
      <td style="padding: 8px 10px; text-align: center;">
        <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.03em;">Projected Finish</div>
        <div style="font-size: 17px; font-weight: 800; color: #16a34a; margin-top: 1px;">${totalOnPace}</div>
      </td>
    </tr>
  </table>

  <!-- Main Table -->
  <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
    <thead>
      <tr style="background: #f1f5f9; color: #475569; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">
        <th style="padding: 7px 12px; text-align: left;">Rank &amp; Agent</th>
        <th style="padding: 7px 12px; text-align: center;">Items MTD</th>
        <th style="padding: 7px 12px; text-align: center;">Daily Run Rate</th>
        <th style="padding: 7px 12px; text-align: right;">On Pace MTD</th>
      </tr>
    </thead>
    <tbody>
      ${sortedData.map((row, idx) => {
        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
        const onPaceColor = row.onPace >= row.goal ? '#16a34a' : '#0f172a'
        return `
        <tr style="background: ${bg}; border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 6px 12px; font-weight: 600; color: #0f172a;">
            <span style="color: #64748b; font-size: 11px; font-weight: 700; margin-right: 6px; font-family: monospace;">#${idx + 1}</span>
            <span>${row.agentName}</span>
            ${row.office ? `<span style="font-size: 9px; font-weight: 700; background: #e2e8f0; color: #475569; padding: 1px 5px; border-radius: 3px; margin-left: 6px;">${row.office}</span>` : ''}
          </td>
          <td style="padding: 6px 12px; text-align: center; font-weight: 700; font-size: 13px; color: ${row.isGoalMet ? '#16a34a' : '#0f172a'};">
            ${row.mtd}
          </td>
          <td style="padding: 6px 12px; text-align: center; font-family: monospace; font-size: 12px; color: #475569;">
            ${row.dailyAvg.toFixed(2)}
          </td>
          <td style="padding: 6px 12px; text-align: right; font-weight: 700; font-size: 13px; color: ${onPaceColor};">
            ${row.onPace}
          </td>
        </tr>`
      }).join('')}
      <!-- Grand Total Row -->
      <tr style="background: #0f172a; color: #ffffff; font-weight: 700; font-size: 12px;">
        <td style="padding: 8px 12px; color: #ffffff;">GRAND TOTAL (AGENCY)</td>
        <td style="padding: 8px 12px; text-align: center; color: #ffffff; font-size: 14px;">${totalItems}</td>
        <td style="padding: 8px 12px; text-align: center; color: #38bdf8; font-family: monospace; font-size: 13px;">${totalDailyAvg.toFixed(2)}</td>
        <td style="padding: 8px 12px; text-align: right; color: #4ade80; font-size: 14px;">${totalOnPace}</td>
      </tr>
    </tbody>
  </table>

  <!-- Footer with Export Date -->
  <div style="padding: 6px 12px; background: #f8fafc; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0;">
    Exported: ${exportTime} &bull; Alsop Reports Dashboard &bull; Pacing excludes weekends and holidays
  </div>
</div>`
  }, [sortedData, totalItems, totalDailyAvg, totalOnPace, elapsedBizDays, totalBizDays, pctElapsed, getExportTimestamp])

  /**
   * 1-Click Copy Modern HTML Table
   */
  const handleCopyHtml = async () => {
    try {
      const htmlTable = getModernEmailHtml()
      const exportTime = getExportTimestamp()
      const plainText = [
        `Allstate Auto Items MTD Ranking (${exportTime})`,
        `Day ${elapsedBizDays} of ${totalBizDays} Business Days (${pctElapsed}% Elapsed)`,
        '',
        ['Rank', 'Agent', 'Office', 'Items MTD', 'Daily Avg', 'On Pace MTD'].join('\t'),
        ...sortedData.map((r, i) => [i + 1, r.agentName, r.office, r.mtd, r.dailyAvg.toFixed(2), r.onPace].join('\t')),
        ['Total', 'Grand Total', '', totalItems, totalDailyAvg.toFixed(2), totalOnPace].join('\t')
      ].join('\n')

      if (navigator.clipboard && window.ClipboardItem) {
        const htmlBlob = new Blob([htmlTable], { type: 'text/html' })
        const textBlob = new Blob([plainText], { type: 'text/plain' })
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob,
          })
        ])
      } else {
        await navigator.clipboard.writeText(plainText)
      }

      setCopyStatus('html')
      setTimeout(() => setCopyStatus(null), 3000)
    } catch (err) {
      console.error('Failed to copy HTML table:', err)
      const exportTime = getExportTimestamp()
      const plainText = [
        `Allstate Auto Items MTD Ranking (${exportTime})`,
        `Day ${elapsedBizDays} of ${totalBizDays} Business Days (${pctElapsed}% Elapsed)`,
        '',
        ['Rank', 'Agent', 'Office', 'Items MTD', 'Daily Avg', 'On Pace MTD'].join('\t'),
        ...sortedData.map((r, i) => [i + 1, r.agentName, r.office, r.mtd, r.dailyAvg.toFixed(2), r.onPace].join('\t')),
        ['Total', 'Grand Total', '', totalItems, totalDailyAvg.toFixed(2), totalOnPace].join('\t')
      ].join('\n')
      await navigator.clipboard.writeText(plainText)
      setCopyStatus('html')
      setTimeout(() => setCopyStatus(null), 3000)
    }
  }

  /**
   * Modern Formal High-DPI Canvas Renderer for Screenshot & Image Copying
   */
  const renderModernCanvas = useCallback((): HTMLCanvasElement => {
    const dpr = 2
    const totalW = 560
    const headerH = 68
    const kpiH = 44
    const tableHeaderH = 26
    const rowH = 28
    const footerH = 32
    const subFooterH = 18
    const totalH = headerH + kpiH + tableHeaderH + (sortedData.length * rowH) + footerH + subFooterH

    const canvas = document.createElement('canvas')
    canvas.width = totalW * dpr
    canvas.height = totalH * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    // Base background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, totalW, totalH)

    // 1. Header Gradient Banner
    const grad = ctx.createLinearGradient(0, 0, totalW, headerH)
    grad.addColorStop(0, '#0f172a') // Slate 900
    grad.addColorStop(1, '#1e293b') // Slate 800
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, totalW, headerH)

    // Subtitle Top Pill + Export date on right
    ctx.fillStyle = '#38bdf8'
    ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('ALSOP AGENCY • PERFORMANCE PACING', 20, 20)

    const exportTime = getExportTimestamp()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '8px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(exportTime, totalW - 20, 20)

    // Title
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Allstate Auto Items MTD Ranking', 20, 40)

    // Date & Progress Badge
    ctx.fillStyle = '#94a3b8'
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(`Day ${elapsedBizDays} of ${totalBizDays} Business Days (${pctElapsed}% Elapsed)`, 20, 56)

    // 2. Summary KPI Bar
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, headerH, totalW, kpiH)
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.strokeRect(0, headerH, totalW, kpiH)

    // KPI 1: Total Items
    const kpiW = totalW / 3
    ctx.fillStyle = '#64748b'
    ctx.font = 'bold 8px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('TOTAL ITEMS MTD', kpiW * 0.5, headerH + 15)
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(totalItems.toString(), kpiW * 0.5, headerH + 34)

    // Divider 1
    ctx.beginPath()
    ctx.moveTo(kpiW, headerH + 6)
    ctx.lineTo(kpiW, headerH + kpiH - 6)
    ctx.stroke()

    // KPI 2: Daily Run Rate
    ctx.fillStyle = '#64748b'
    ctx.font = 'bold 8px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText('DAILY RUN RATE', kpiW * 1.5, headerH + 15)
    ctx.fillStyle = '#0284c7'
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(`${totalDailyAvg.toFixed(2)}/day`, kpiW * 1.5, headerH + 34)

    // Divider 2
    ctx.beginPath()
    ctx.moveTo(kpiW * 2, headerH + 6)
    ctx.lineTo(kpiW * 2, headerH + kpiH - 6)
    ctx.stroke()

    // KPI 3: Projected Finish
    ctx.fillStyle = '#64748b'
    ctx.font = 'bold 8px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText('PROJECTED FINISH', kpiW * 2.5, headerH + 15)
    ctx.fillStyle = '#16a34a'
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(totalOnPace.toString(), kpiW * 2.5, headerH + 34)

    // 3. Table Header
    let curY = headerH + kpiH
    ctx.fillStyle = '#f1f5f9'
    ctx.fillRect(0, curY, totalW, tableHeaderH)
    ctx.strokeStyle = '#e2e8f0'
    ctx.strokeRect(0, curY, totalW, tableHeaderH)

    ctx.fillStyle = '#475569'
    ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.textBaseline = 'middle'

    // Col headers
    ctx.textAlign = 'left'
    ctx.fillText('RANK & AGENT', 20, curY + tableHeaderH / 2)
    ctx.textAlign = 'center'
    ctx.fillText('ITEMS MTD', 320, curY + tableHeaderH / 2)
    ctx.fillText('DAILY RUN RATE', 415, curY + tableHeaderH / 2)
    ctx.textAlign = 'right'
    ctx.fillText('ON PACE MTD', totalW - 20, curY + tableHeaderH / 2)

    // 4. Data Rows
    curY += tableHeaderH

    sortedData.forEach((row, idx) => {
      // Row background
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
      ctx.fillRect(0, curY, totalW, rowH)

      // Row separator
      ctx.strokeStyle = '#f1f5f9'
      ctx.beginPath()
      ctx.moveTo(12, curY + rowH)
      ctx.lineTo(totalW - 12, curY + rowH)
      ctx.stroke()

      const midY = curY + rowH / 2

      // Formal Rank Number (No Medals)
      ctx.textAlign = 'left'
      ctx.fillStyle = '#64748b'
      ctx.font = 'bold 10px "SFMono-Regular", Consolas, monospace'
      ctx.fillText(`#${idx + 1}`, 20, midY)

      // Agent Name
      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText(row.agentName, 48, midY)

      // Office Tag
      if (row.office) {
        const nameW = ctx.measureText(row.agentName).width
        const tagX = 48 + nameW + 6
        ctx.fillStyle = '#e2e8f0'
        ctx.beginPath()
        ctx.roundRect(tagX, midY - 7, 24, 14, 3)
        ctx.fill()
        ctx.fillStyle = '#475569'
        ctx.font = 'bold 8px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(row.office, tagX + 12, midY)
      }

      // Items MTD (No Stars)
      ctx.textAlign = 'center'
      ctx.fillStyle = row.isGoalMet ? '#16a34a' : '#0f172a'
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText(row.mtd.toString(), 320, midY)

      // Daily Run Rate
      ctx.fillStyle = '#475569'
      ctx.font = '11px "SFMono-Regular", Consolas, monospace'
      ctx.fillText(row.dailyAvg.toFixed(2), 415, midY)

      // On Pace MTD
      ctx.textAlign = 'right'
      ctx.fillStyle = row.onPace >= row.goal ? '#16a34a' : '#0f172a'
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText(row.onPace.toString(), totalW - 20, midY)

      curY += rowH
    })

    // 5. Grand Total Footer Banner
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, curY, totalW, footerH)

    const footMidY = curY + footerH / 2
    ctx.textAlign = 'left'
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText('GRAND TOTAL (AGENCY)', 20, footMidY)

    ctx.textAlign = 'center'
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(totalItems.toString(), 320, footMidY)

    ctx.fillStyle = '#38bdf8'
    ctx.font = 'bold 12px "SFMono-Regular", Consolas, monospace'
    ctx.fillText(`${totalDailyAvg.toFixed(2)}/day`, 415, footMidY)

    ctx.fillStyle = '#4ade80'
    ctx.textAlign = 'right'
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(totalOnPace.toString(), totalW - 20, footMidY)

    // 6. Sub-footer with Export Date (small font)
    curY += footerH
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, curY, totalW, subFooterH)
    ctx.strokeStyle = '#e2e8f0'
    ctx.strokeRect(0, curY, totalW, subFooterH)

    ctx.fillStyle = '#94a3b8'
    ctx.font = '8px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`Exported: ${exportTime} • Alsop Reports Dashboard`, totalW / 2, curY + subFooterH / 2)

    return canvas
  }, [sortedData, totalItems, totalDailyAvg, totalOnPace, elapsedBizDays, totalBizDays, pctElapsed, getExportTimestamp])

  /**
   * 1-Click Copy Modern Image to Clipboard
   */
  const handleCopyImage = async () => {
    setIsGeneratingImage(true)
    try {
      const canvas = renderModernCanvas()
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsGeneratingImage(false)
          return
        }
        try {
          if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ])
            setCopyStatus('image')
            setTimeout(() => setCopyStatus(null), 3000)
          }
        } catch (err) {
          console.error('Failed to copy image to clipboard:', err)
          handleDownloadImage()
        } finally {
          setIsGeneratingImage(false)
        }
      }, 'image/png')
    } catch (err) {
      console.error('Image render error:', err)
      setIsGeneratingImage(false)
    }
  }

  /**
   * 1-Click Download PNG
   */
  const handleDownloadImage = () => {
    const canvas = renderModernCanvas()
    const url = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `Alsop-Auto-Items-Pacing-${new Date().toISOString().slice(0, 10)}.png`
    link.href = url
    link.click()
    setCopyStatus('download')
    setTimeout(() => setCopyStatus(null), 3000)
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  const currentExportTime = getExportTimestamp()

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-150"
      onPointerDown={handleBackdropClick}
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Compressed Executive Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-3 text-white flex flex-col gap-2 relative shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-sky-400 bg-sky-950/80 border border-sky-800/60 px-1.5 py-0.5 rounded">
                  Allstate Performance
                </span>
                <span className="text-[10px] font-medium text-slate-300 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-sky-400" />
                  Day {elapsedBizDays} of {totalBizDays} ({pctElapsed}% Elapsed)
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
                Auto Items MTD Pacing
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-400 font-mono hidden sm:inline-block">
                {currentExportTime}
              </span>
              <button 
                onClick={onClose} 
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Compressed Top 3 KPI Summary Cards */}
          <div className="grid grid-cols-3 gap-2 bg-slate-950/60 rounded-lg p-2 border border-slate-700/50 backdrop-blur-sm">
            <div className="text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Items MTD</span>
              <span className="text-lg sm:text-xl font-extrabold text-white">{totalItems}</span>
            </div>
            <div className="text-center border-x border-slate-800">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Daily Run Rate</span>
              <span className="text-lg sm:text-xl font-extrabold text-sky-400 font-mono">
                {totalDailyAvg.toFixed(2)}
                <span className="text-[9px] font-normal text-slate-400 font-sans ml-0.5">/day</span>
              </span>
            </div>
            <div className="text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Projected Finish</span>
              <span className="text-lg sm:text-xl font-extrabold text-emerald-400">{totalOnPace}</span>
            </div>
          </div>
        </div>

        {/* Action Toolbar & Search */}
        <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap shrink-0">
          {/* Quick Search Filter */}
          <div className="relative w-44 sm:w-52">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text"
              placeholder="Filter agent or office..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* 1-Click Export Tools */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Copy Formal Image */}
            <button
              onClick={handleCopyImage}
              disabled={isGeneratingImage}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-xs hover:shadow transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Copy modern report image directly to clipboard"
            >
              {copyStatus === 'image' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span>Copy Image</span>
                </>
              )}
            </button>

            {/* Copy Table for Email */}
            <button
              onClick={handleCopyHtml}
              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
              title="Copy formatted table for Outlook / Gmail"
            >
              {copyStatus === 'html' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Table</span>
                </>
              )}
            </button>

            {/* Download PNG */}
            <button
              onClick={handleDownloadImage}
              className="p-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 rounded-md transition-all active:scale-95 cursor-pointer"
              title="Download high-resolution image"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Copy Notification Toast */}
        {copyStatus && (
          <div className="bg-emerald-600 text-white text-[11px] font-medium px-3 py-1 flex items-center justify-center gap-1.5 animate-in slide-in-from-top-1 duration-150 shrink-0">
            <Check className="w-3.5 h-3.5" />
            <span>
              {copyStatus === 'image' && "Report graphic copied to clipboard! Ready to paste into email or chat."}
              {copyStatus === 'html' && "Table copied! Ready to paste (Ctrl+V) into Outlook or Gmail."}
              {copyStatus === 'download' && "Image downloaded successfully!"}
            </span>
          </div>
        )}

        {/* Formal Compressed Table Body */}
        <div ref={tableRef} className="flex-1 overflow-y-auto">
          {filteredData.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              {searchQuery ? `No agents found matching "${searchQuery}"` : "No auto items data available."}
            </div>
          ) : (
            <table className="w-full text-left border-collapse select-text">
              <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-md z-10 border-b border-slate-200 shadow-2xs">
                <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2 px-3.5 text-left">Rank &amp; Agent</th>
                  <th className="py-2 px-3.5 text-center">Items MTD</th>
                  <th className="py-2 px-3.5 text-center">Daily Run Rate</th>
                  <th className="py-2 px-3.5 text-right">On Pace MTD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredData.map((row, idx) => {
                  return (
                    <tr 
                      key={idx} 
                      className={`transition-colors hover:bg-slate-100/70 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      {/* Rank & Agent Name */}
                      <td className="py-1.5 px-3.5 flex items-center gap-2">
                        <span className="w-5 text-[11px] font-bold text-slate-400 font-mono shrink-0">
                          #{idx + 1}
                        </span>

                        <div className="min-w-0 flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 truncate">{row.agentName}</span>
                          {row.office && (
                            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded">
                              {row.office}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Items MTD (No Stars, Formal Number) */}
                      <td className="py-1.5 px-3.5 text-center">
                        <span className={`text-xs font-bold font-mono ${
                          row.isGoalMet ? 'text-emerald-700' : 'text-slate-800'
                        }`}>
                          {row.mtd}
                        </span>
                      </td>

                      {/* Daily Run Rate */}
                      <td className="py-1.5 px-3.5 text-center">
                        <span className="text-[11px] font-mono font-medium text-slate-600">
                          {row.dailyAvg.toFixed(2)}
                        </span>
                      </td>

                      {/* On Pace MTD */}
                      <td className="py-1.5 px-3.5 text-right">
                        <span className={`text-xs font-bold font-mono ${
                          row.onPace >= row.goal ? 'text-emerald-600' : 'text-slate-800'
                        }`}>
                          {row.onPace}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Grand Total Sticky Footer */}
        <div className="bg-slate-900 text-white px-4 py-2 border-t border-slate-800 flex items-center justify-between shrink-0 shadow-lg">
          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-xs font-bold uppercase tracking-wider">Grand Total (Agency)</span>
          </div>

          <div className="flex items-center gap-5 sm:gap-7 font-mono">
            <div className="text-center">
              <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-sans">Total MTD</span>
              <span className="text-sm sm:text-base font-extrabold text-white">{totalItems}</span>
            </div>
            <div className="text-center">
              <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-sans">Daily Run Rate</span>
              <span className="text-sm sm:text-base font-extrabold text-sky-400">{totalDailyAvg.toFixed(2)}</span>
            </div>
            <div className="text-right">
              <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-sans">Projected Finish</span>
              <span className="text-sm sm:text-base font-extrabold text-emerald-400">{totalOnPace}</span>
            </div>
          </div>
        </div>

        {/* Sub-footer Date of Export (Small font) */}
        <div className="bg-slate-950 text-slate-400 text-[9px] px-3.5 py-1 text-center border-t border-slate-800/80 flex items-center justify-between">
          <span>Alsop Reports &bull; Pacing excludes weekends &amp; holidays</span>
          <span className="font-mono text-slate-400">Exported: {currentExportTime}</span>
        </div>

      </div>
    </div>
  )
}


