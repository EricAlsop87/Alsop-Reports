import { useState, useMemo } from "react"
import { X, Trophy, Car } from "lucide-react"

export interface PacingModalProps {
  isOpen: boolean
  onClose: () => void
  data: any[]
  elapsedBizDays: number
  totalBizDays: number
  goals?: any[]
}

export function PacingModal({ isOpen, onClose, data, elapsedBizDays, totalBizDays, goals }: PacingModalProps) {
  if (!isOpen) return null

  // Helper to get agent monthly items goal (default to 40)
  const getAgentMonthlyItemsGoal = (m: any) => {
    if (!goals) return 40;
    const matching = goals.filter((g: any) => g.metric_name === "items" && g.timeframe === "monthly");
    if (!matching.length) return 40;
    const agentOffice = m.agents?.office;
    const agentTeam = m.agents?.team;

    const exactMatch = matching.find((g: any) => g.team === agentTeam && g.office === agentOffice);
    if (exactMatch) return exactMatch.target_value;

    const teamMatch = matching.find((g: any) => g.team === agentTeam && !g.office);
    if (teamMatch) return teamMatch.target_value;

    const officeMatch = matching.find((g: any) => !g.team && g.office === agentOffice);
    if (officeMatch) return officeMatch.target_value;

    const defaultMatch = matching.find((g: any) => !g.team && !g.office);
    return defaultMatch ? defaultMatch.target_value : 40;
  };

  // Process data to calculate Daily Avg and On Pace for everyone, and sort by On Pace or MTD
  const sortedData = useMemo(() => {
    return data
      .filter((m) => m.items_mtd > 0)
      .map((m) => {
        const mtd = m.items_mtd || 0
        const dailyAvg = elapsedBizDays > 0 ? mtd / elapsedBizDays : 0
        const onPace = elapsedBizDays > 0 ? Math.round(dailyAvg * totalBizDays) : 0
        const goal = getAgentMonthlyItemsGoal(m)
        return {
          agentName: m.agents?.name || "Unknown",
          office: m.agents?.office || "",
          mtd,
          dailyAvg,
          onPace,
          goal,
          isGoalMet: mtd >= goal
        }
      })
      .sort((a, b) => b.mtd - a.mtd || b.onPace - a.onPace) // Sort exactly like the top-3 ties
  }, [data, elapsedBizDays, totalBizDays, goals])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if the user clicked directly on the backdrop (not inside the modal)
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200"
      onPointerDown={handleBackdropClick}
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50 gap-2">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">MTD Auto Item Pacing</h2>
              <div className="flex flex-col mt-0.5">
                <p className="text-xs text-slate-600 font-bold">Allstate Auto Items MTD &bull; {elapsedBizDays}/{totalBizDays} Business Days</p>
                <p className="text-[10px] text-slate-500 italic mt-0.5">
                  *Pacing strictly excludes weekends and holidays for a truer representation of daily performance.
                </p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-full transition-colors self-end sm:self-auto -mt-10 sm:mt-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto">
          {sortedData.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No data available for this period.</div>
          ) : (
            <table className="w-full text-left whitespace-nowrap">
              <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm">
                <tr>
                  <th className="py-2.5 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Agent</th>
                  <th className="py-2.5 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Items MTD</th>
                  <th className="py-2.5 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Daily Avg</th>
                  <th className="py-2.5 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">On Pace MTD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedData.map((row, idx) => (
                  <tr key={idx} className="even:bg-slate-50/50 hover:bg-blue-50/50 transition-colors">
                    <td className="py-2 px-4 flex items-center gap-2">
                      <div className="w-5 text-center text-xs font-bold text-slate-400">{idx + 1}</div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{row.agentName}</div>
                        <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{row.office}</div>
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
                      <span className="text-base font-mono font-black text-slate-700">{row.dailyAvg.toFixed(2)}</span>
                    </td>
                    <td className="py-2 px-4 text-center">
                      <span className={`text-base font-black ${row.onPace >= row.goal ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {row.onPace}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
