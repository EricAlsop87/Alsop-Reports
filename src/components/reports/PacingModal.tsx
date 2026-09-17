import { useState, useMemo, useRef, useCallback } from "react"
import { X, Copy, Check, Download, Image as ImageIcon, LayoutList, Table, Sparkles } from "lucide-react"

export interface PacingModalProps {
  isOpen: boolean
  onClose: () => void
  data: any[]
  elapsedBizDays: number
  totalBizDays: number
  goals?: any[]
}

export function PacingModal({ isOpen, onClose, data, elapsedBizDays, totalBizDays, goals }: PacingModalProps) {
  const [activeTab, setActiveTab] = useState<'email' | 'dashboard'>('email')
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const tableRef = useRef<HTMLTableElement>(null)

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
          isGoalMet: mtd >= goal
        }
      })
      .sort((a, b) => b.mtd - a.mtd || b.onPace - a.onPace)
  }, [data, elapsedBizDays, totalBizDays, goals])

  // Calculations for Grand Total
  const totalItems = useMemo(() => sortedData.reduce((sum, r) => sum + r.mtd, 0), [sortedData])
  const totalDailyAvg = elapsedBizDays > 0 ? totalItems / elapsedBizDays : 0
  const totalOnPace = elapsedBizDays > 0 ? Math.round(totalDailyAvg * totalBizDays) : 0

  /**
   * Generates a clean HTML string formatted for email clients (Outlook, Gmail, etc.)
   */
  const getEmailHtmlTable = useCallback(() => {
    return `
<table style="border-collapse: collapse; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #000000; border: 1px solid #95b3d7; width: 100%; max-width: 520px;">
  <thead>
    <tr style="background-color: #366092; color: #ffffff; font-weight: bold; height: 26px;">
      <th style="border: 1px solid #95b3d7; padding: 4px 10px; text-align: left; background-color: #366092; color: #ffffff; font-size: 13px;">Row Labels</th>
      <th style="border: 1px solid #95b3d7; padding: 4px 10px; text-align: right; background-color: #366092; color: #ffffff; font-size: 13px;">Sum of Item Count</th>
      <th style="border: 1px solid #95b3d7; padding: 4px 10px; text-align: right; background-color: #366092; color: #ffffff; font-size: 13px;">Daily Avg</th>
      <th style="border: 1px solid #95b3d7; padding: 4px 10px; text-align: right; background-color: #366092; color: #ffffff; font-size: 13px;">On Pace <span style="background-color: #ffff00; color: #000000; padding: 1px 4px; font-weight: bold; border-radius: 2px;">MTD</span></th>
    </tr>
  </thead>
  <tbody>
    ${sortedData.map((row, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#dce6f1' : '#ffffff'}; height: 22px;">
        <td style="border: 1px solid #b8cce4; padding: 3px 10px; text-align: left; font-weight: normal; font-size: 12.5px;">${row.agentName.toUpperCase()}</td>
        <td style="border: 1px solid #b8cce4; padding: 3px 10px; text-align: right; font-size: 12.5px;">${row.mtd}</td>
        <td style="border: 1px solid #b8cce4; padding: 3px 10px; text-align: right; font-size: 12.5px;">${row.dailyAvg.toFixed(2)}</td>
        <td style="border: 1px solid #b8cce4; padding: 3px 10px; text-align: right; font-weight: bold; font-size: 12.5px;">${row.onPace}</td>
      </tr>
    `).join('')}
    <tr style="background-color: #dce6f1; font-weight: bold; height: 24px; border-top: 2px solid #366092;">
      <td style="border: 1px solid #95b3d7; padding: 4px 10px; text-align: left; font-weight: bold; font-size: 13px;">Grand Total</td>
      <td style="border: 1px solid #95b3d7; padding: 4px 10px; text-align: right; font-weight: bold; font-size: 13px;">${totalItems}</td>
      <td style="border: 1px solid #95b3d7; padding: 4px 10px; text-align: right; font-weight: bold; font-size: 13px;">${totalDailyAvg.toFixed(2)}</td>
      <td style="border: 1px solid #95b3d7; padding: 4px 10px; text-align: right; font-weight: bold; font-size: 13px;">${totalOnPace}</td>
    </tr>
  </tbody>
</table>`
  }, [sortedData, totalItems, totalDailyAvg, totalOnPace])

  /**
   * 1-Click Copy formatted Rich HTML table to clipboard
   */
  const handleCopyHtml = async () => {
    try {
      const htmlTable = getEmailHtmlTable()
      const plainText = [
        ['Row Labels', 'Sum of Item Count', 'Daily Avg', 'On Pace MTD'].join('\t'),
        ...sortedData.map(r => [r.agentName.toUpperCase(), r.mtd, r.dailyAvg.toFixed(2), r.onPace].join('\t')),
        ['Grand Total', totalItems, totalDailyAvg.toFixed(2), totalOnPace].join('\t')
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
      // Fallback to text
      const plainText = [
        ['Row Labels', 'Sum of Item Count', 'Daily Avg', 'On Pace MTD'].join('\t'),
        ...sortedData.map(r => [r.agentName.toUpperCase(), r.mtd, r.dailyAvg.toFixed(2), r.onPace].join('\t')),
        ['Grand Total', totalItems, totalDailyAvg.toFixed(2), totalOnPace].join('\t')
      ].join('\n')
      await navigator.clipboard.writeText(plainText)
      setCopyStatus('html')
      setTimeout(() => setCopyStatus(null), 3000)
    }
  }

  /**
   * Renders the Excel table onto a high-DPI HTML5 canvas
   */
  const renderTableToCanvas = useCallback((): HTMLCanvasElement => {
    const dpr = 2 // 2x scale for crisp Retina rendering
    const colWidths = [190, 110, 85, 105] // Total width: 490px
    const totalW = colWidths.reduce((a, b) => a + b, 0)
    const headerH = 26
    const rowH = 21
    const footerH = 24
    const totalH = headerH + (sortedData.length * rowH) + footerH

    const canvas = document.createElement('canvas')
    canvas.width = totalW * dpr
    canvas.height = totalH * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, totalW, totalH)

    // 1. Draw Header
    ctx.fillStyle = '#366092'
    ctx.fillRect(0, 0, totalW, headerH)

    ctx.font = 'bold 12px "Segoe UI", Calibri, Arial, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'middle'

    // Col 1: Row Labels
    ctx.textAlign = 'left'
    ctx.fillText('Row Labels', 8, headerH / 2)

    // Col 2: Sum of Item Count
    ctx.textAlign = 'right'
    ctx.fillText('Sum of Item Count', colWidths[0] + colWidths[1] - 8, headerH / 2)

    // Col 3: Daily Avg
    ctx.fillText('Daily Avg', colWidths[0] + colWidths[1] + colWidths[2] - 8, headerH / 2)

    // Col 4: On Pace MTD
    const col4Right = totalW - 8
    // Yellow highlight box for "MTD"
    const mtdTextW = ctx.measureText('MTD').width
    const mtdBoxW = mtdTextW + 8
    const mtdBoxH = 16
    const mtdBoxX = col4Right - mtdBoxW
    const mtdBoxY = (headerH - mtdBoxH) / 2

    ctx.fillStyle = '#ffff00'
    ctx.fillRect(mtdBoxX, mtdBoxY, mtdBoxW, mtdBoxH)

    ctx.fillStyle = '#000000'
    ctx.textAlign = 'center'
    ctx.fillText('MTD', mtdBoxX + mtdBoxW / 2, headerH / 2)

    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'right'
    ctx.fillText('On Pace ', mtdBoxX - 2, headerH / 2)

    // Header gridlines
    ctx.strokeStyle = '#95b3d7'
    ctx.lineWidth = 1
    let curX = 0
    for (let c = 0; c < colWidths.length; c++) {
      curX += colWidths[c]
      ctx.beginPath()
      ctx.moveTo(curX - 0.5, 0)
      ctx.lineTo(curX - 0.5, headerH)
      ctx.stroke()
    }

    // 2. Draw Rows
    let curY = headerH
    ctx.textBaseline = 'middle'

    sortedData.forEach((row, idx) => {
      // Row Background
      ctx.fillStyle = idx % 2 === 0 ? '#dce6f1' : '#ffffff'
      ctx.fillRect(0, curY, totalW, rowH)

      // Cell Borders
      ctx.strokeStyle = '#b8cce4'
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, curY + 0.5, totalW - 1, rowH)

      let xPos = 0
      for (let c = 0; c < colWidths.length - 1; c++) {
        xPos += colWidths[c]
        ctx.beginPath()
        ctx.moveTo(xPos - 0.5, curY)
        ctx.lineTo(xPos - 0.5, curY + rowH)
        ctx.stroke()
      }

      // Text Content
      const midY = curY + rowH / 2
      ctx.font = '11.5px "Segoe UI", Calibri, Arial, sans-serif'
      ctx.fillStyle = '#000000'

      // Col 1: Agent Name
      ctx.textAlign = 'left'
      ctx.fillText(row.agentName.toUpperCase(), 8, midY)

      // Col 2: Sum of Item Count
      ctx.textAlign = 'right'
      ctx.fillText(row.mtd.toString(), colWidths[0] + colWidths[1] - 8, midY)

      // Col 3: Daily Avg
      ctx.fillText(row.dailyAvg.toFixed(2), colWidths[0] + colWidths[1] + colWidths[2] - 8, midY)

      // Col 4: On Pace MTD
      ctx.font = 'bold 11.5px "Segoe UI", Calibri, Arial, sans-serif'
      ctx.fillText(row.onPace.toString(), totalW - 8, midY)

      curY += rowH
    })

    // 3. Draw Grand Total Footer
    ctx.fillStyle = '#dce6f1'
    ctx.fillRect(0, curY, totalW, footerH)

    // Outer border & top line
    ctx.strokeStyle = '#366092'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, curY)
    ctx.lineTo(totalW, curY)
    ctx.stroke()

    // Bottom double line effect
    ctx.strokeStyle = '#366092'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, curY + footerH)
    ctx.lineTo(totalW, curY + footerH)
    ctx.stroke()

    ctx.strokeStyle = '#95b3d7'
    ctx.lineWidth = 1
    let footX = 0
    for (let c = 0; c < colWidths.length - 1; c++) {
      footX += colWidths[c]
      ctx.beginPath()
      ctx.moveTo(footX - 0.5, curY)
      ctx.lineTo(footX - 0.5, curY + footerH)
      ctx.stroke()
    }

    const footMidY = curY + footerH / 2
    ctx.font = 'bold 12px "Segoe UI", Calibri, Arial, sans-serif'
    ctx.fillStyle = '#000000'

    ctx.textAlign = 'left'
    ctx.fillText('Grand Total', 8, footMidY)

    ctx.textAlign = 'right'
    ctx.fillText(totalItems.toString(), colWidths[0] + colWidths[1] - 8, footMidY)
    ctx.fillText(totalDailyAvg.toFixed(2), colWidths[0] + colWidths[1] + colWidths[2] - 8, footMidY)
    ctx.fillText(totalOnPace.toString(), totalW - 8, footMidY)

    return canvas
  }, [sortedData, totalItems, totalDailyAvg, totalOnPace])

  /**
   * 1-Click Copy table image to clipboard
   */
  const handleCopyImage = async () => {
    setIsGeneratingImage(true)
    try {
      const canvas = renderTableToCanvas()
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
          // Download fallback
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
    const canvas = renderTableToCanvas()
    const url = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `Allstate-Auto-Items-MTD-Pacing-${new Date().toISOString().slice(0, 10)}.png`
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

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200"
      onPointerDown={handleBackdropClick}
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/90 gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                MTD Auto Item Pacing
              </h2>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                {elapsedBizDays}/{totalBizDays} Days
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Allstate Auto Items MTD &bull; Ready for email copy & screenshot
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* View Switcher Tabs */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300/60">
              <button
                onClick={() => setActiveTab('email')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  activeTab === 'email'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Exact Email Excel Snapshot"
              >
                <Table className="w-3.5 h-3.5" />
                <span>Email View</span>
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Interactive Dashboard Cards"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
            </div>

            <button 
              onClick={onClose} 
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Toolbar (Copy for Email, Copy Image, Download PNG) */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-blue-50/70 border-b border-blue-100/80 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-blue-900 font-medium">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Click below to copy formatted table or image directly into your email:</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* 1-Click Copy HTML */}
            <button
              onClick={handleCopyHtml}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow transition-all active:scale-95 cursor-pointer"
              title="Copy rich HTML table to paste into Outlook, Gmail, Word, etc."
            >
              {copyStatus === 'html' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-emerald-100">Copied HTML!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy for Email</span>
                </>
              )}
            </button>

            {/* 1-Click Copy Image */}
            <button
              onClick={handleCopyImage}
              disabled={isGeneratingImage}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-xs hover:shadow transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Copy image directly to clipboard (paste as picture)"
            >
              {copyStatus === 'image' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied Image!</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Image</span>
                </>
              )}
            </button>

            {/* Download Image */}
            <button
              onClick={handleDownloadImage}
              className="flex items-center justify-center p-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 rounded-lg transition-all active:scale-95 cursor-pointer"
              title="Download PNG snapshot"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Copy Toast Banner */}
        {copyStatus && (
          <div className="bg-emerald-500 text-white text-xs font-semibold px-4 py-1.5 flex items-center justify-center gap-1.5 animate-in slide-in-from-top-1 duration-150">
            <Check className="w-4 h-4" />
            <span>
              {copyStatus === 'html' && "Table copied to clipboard! Paste (Ctrl+V) directly into Outlook or Gmail."}
              {copyStatus === 'image' && "Image copied to clipboard! Paste (Ctrl+V) directly into email, Slack, or Teams."}
              {copyStatus === 'download' && "Image downloaded successfully!"}
            </span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/50 flex justify-center">
          {sortedData.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">No auto item data available for this period.</div>
          ) : activeTab === 'email' ? (
            /* ── Email Snapshot Excel-Styled Table ── */
            <div className="w-full max-w-[520px] bg-white rounded-lg shadow-md border border-[#95b3d7] overflow-hidden self-start">
              <table ref={tableRef} className="w-full text-left border-collapse select-text">
                {/* Excel Blue Header */}
                <thead>
                  <tr className="bg-[#366092] text-white font-bold text-[13px] tracking-tight">
                    <th className="py-2 px-3 border border-[#95b3d7] font-bold text-left">
                      Row Labels
                    </th>
                    <th className="py-2 px-3 border border-[#95b3d7] font-bold text-right whitespace-nowrap">
                      Sum of Item Count
                    </th>
                    <th className="py-2 px-3 border border-[#95b3d7] font-bold text-right whitespace-nowrap">
                      Daily Avg
                    </th>
                    <th className="py-2 px-3 border border-[#95b3d7] font-bold text-right whitespace-nowrap">
                      On Pace <span className="bg-[#FFFF00] text-black font-extrabold px-1 py-0.5 rounded-xs ml-0.5 shadow-2xs">MTD</span>
                    </th>
                  </tr>
                </thead>

                {/* Alternating Rows */}
                <tbody className="text-[12.5px] font-sans">
                  {sortedData.map((row, idx) => (
                    <tr 
                      key={idx} 
                      className={`${idx % 2 === 0 ? 'bg-[#dce6f1]' : 'bg-white'} hover:bg-amber-50/60 transition-colors`}
                    >
                      <td className="py-1.5 px-3 border border-[#b8cce4] text-slate-900 font-medium">
                        {row.agentName.toUpperCase()}
                      </td>
                      <td className="py-1.5 px-3 border border-[#b8cce4] text-right font-medium text-slate-900 font-mono">
                        {row.mtd}
                      </td>
                      <td className="py-1.5 px-3 border border-[#b8cce4] text-right text-slate-900 font-mono">
                        {row.dailyAvg.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-3 border border-[#b8cce4] text-right font-bold text-slate-900 font-mono">
                        {row.onPace}
                      </td>
                    </tr>
                  ))}

                  {/* Grand Total Summary Row */}
                  <tr className="bg-[#dce6f1] font-bold text-[13px] border-t-2 border-[#366092] border-b-2 border-b-[#366092]">
                    <td className="py-2 px-3 border border-[#95b3d7] text-slate-950 font-extrabold">
                      Grand Total
                    </td>
                    <td className="py-2 px-3 border border-[#95b3d7] text-right font-extrabold text-slate-950 font-mono">
                      {totalItems}
                    </td>
                    <td className="py-2 px-3 border border-[#95b3d7] text-right font-extrabold text-slate-950 font-mono">
                      {totalDailyAvg.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 border border-[#95b3d7] text-right font-extrabold text-slate-950 font-mono">
                      {totalOnPace}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            /* ── Interactive Dashboard View ── */
            <div className="w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm self-start">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-100/90 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Agent</th>
                    <th className="py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Items MTD</th>
                    <th className="py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Daily Avg</th>
                    <th className="py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">On Pace MTD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {sortedData.map((row, idx) => (
                    <tr key={idx} className="even:bg-slate-50/50 hover:bg-blue-50/50 transition-colors">
                      <td className="py-2 px-4 flex items-center gap-2.5">
                        <div className="w-5 text-center text-xs font-bold text-slate-400">{idx + 1}</div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{row.agentName}</div>
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{row.office}</div>
                        </div>
                      </td>
                      <td className="py-2 px-4 text-center">
                        {row.isGoalMet ? (
                          <span className="inline-flex items-center justify-center min-w-[3rem] px-2 py-0.5 rounded text-sm font-black border shadow-sm bg-emerald-100 text-emerald-800 border-emerald-200">
                            {row.mtd}
                          </span>
                        ) : (
                          <span className="text-base font-black text-slate-700">
                            {row.mtd}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-center">
                        <span className="text-sm font-mono font-bold text-slate-700">{row.dailyAvg.toFixed(2)}</span>
                      </td>
                      <td className="py-2 px-4 text-center">
                        <span className={`text-base font-black ${row.onPace >= row.goal ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {row.onPace}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Dashboard Total Row */}
                  <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300">
                    <td className="py-3 px-4 text-slate-900 font-black">Grand Total</td>
                    <td className="py-3 px-4 text-center text-base font-black text-slate-900">{totalItems}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">{totalDailyAvg.toFixed(2)}</td>
                    <td className="py-3 px-4 text-center text-base font-black text-emerald-600">{totalOnPace}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-[11px] text-slate-400">
          <p className="italic">
            *Pacing strictly excludes weekends and holidays ({elapsedBizDays}/{totalBizDays} Business Days).
          </p>
          <span className="font-semibold text-slate-500">
            {sortedData.length} Agents Ranked
          </span>
        </div>

      </div>
    </div>
  )
}

