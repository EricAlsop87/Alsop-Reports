'use client'

import { useState } from 'react'
import { X, Upload, FileText, Check, AlertCircle, Loader2, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { importTDOCBatch, type TDOCRecord } from '@/lib/reports/tdocStore'

interface TDOCUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete: (records: TDOCRecord[]) => void
}

export default function TDOCUploadModal({
  isOpen,
  onClose,
  onImportComplete,
}: TDOCUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successCount, setSuccessCount] = useState<number | null>(null)

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setError(null)
      setSuccessCount(null)
    }
  }

  const downloadSampleTemplate = () => {
    const csvContent =
      'Policy Number,Customer Name,Effective Date,Producer,Office,Type,Written Premium,Manager,Missing Admin,Missing Legal,Missing BRP,Comments,Month Period\n' +
      '982341250,Carlos Rodriguez,2026-09-15,Carlos Paz,CH,NB,1850.00,JP,Good,Good,Good,All documents clear,2026-09\n' +
      '982341251,Amanda Lopez,2026-10-01,Phoebe Hernandez,MB,Add Car,920.00,RB,Missing Signature,Good,Good,Needs eAgent disclosure,2026-10\n' +
      '982341252,Robert Taylor,2026-11-05,John Paul Dizon,MCM,NB,2400.00,JM,Good+Review,Good,Good,Tagged Good+Review by JM,2026-11\n'

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'TDOC_Report_Template_Sep_Dec.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleProcessUpload = async () => {
    if (!file) return
    setIsParsing(true)
    setError(null)
    setSuccessCount(null)

    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)

      if (lines.length <= 1) {
        throw new Error('CSV file appears to be empty or missing data rows.')
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
      const records: Partial<TDOCRecord>[] = []

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^"(.*)"$/, '$1'))
        if (cols.length < 2) continue

        const policy_number = cols[0] || `98234${Math.floor(1000 + Math.random() * 9000)}`
        const customer_name = cols[1] || 'Customer'
        const effective_date = cols[2] || new Date().toISOString().split('T')[0]
        const producer_name = cols[3] || 'Agent'
        const office = (cols[4] as any) || 'CH'
        const transaction_type = (cols[5] || '').toLowerCase().includes('add') ? 'Add Car' : 'NB'
        const written_premium = parseFloat(cols[6]) || 1200
        const tagged_manager = cols[7] || 'JP'
        const missing_admin = cols[8] || 'Good'
        const missing_legal = cols[9] || 'Good'
        const missing_brp = cols[10] || 'Good'
        const comments = cols[11] || ''
        const month_period = cols[12] || '2026-09'

        records.push({
          policy_number,
          customer_name,
          effective_date,
          issue_date: effective_date,
          producer_name,
          office,
          transaction_type,
          written_premium,
          item_count: transaction_type === 'NB' ? 2 : 1,
          tagged_manager,
          missing_admin,
          missing_legal,
          missing_brp,
          comments,
          month_period,
        })
      }

      if (records.length === 0) {
        throw new Error('No valid records found in file.')
      }

      const updatedList = await importTDOCBatch(records)
      setSuccessCount(records.length)
      onImportComplete(updatedList)

      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err: any) {
      console.error('[TDOCUploadModal] Error uploading file:', err)
      setError(err.message || 'Failed to parse CSV file. Please verify column formatting.')
    } finally {
      setIsParsing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Upload TDOC Data File
              </h3>
              <p className="text-xs text-slate-400">
                Feed September – December NB & Add Car documentation records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/60 text-xs text-blue-800 dark:text-blue-300 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold mb-0.5">Need a formatted template?</p>
              <p className="text-[11px] text-blue-600 dark:text-blue-400">
                Download the CSV template with columns pre-configured for TDOC policy data.
              </p>
            </div>
            <button
              onClick={downloadSampleTemplate}
              className="px-2.5 py-1.5 bg-white dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg text-blue-700 dark:text-blue-200 font-bold text-[11px] flex items-center gap-1 hover:bg-blue-50 shrink-0 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Template
            </button>
          </div>

          {/* Upload Drop Area */}
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-6 text-center transition-colors bg-slate-50/50 dark:bg-slate-800/30">
            <input
              type="file"
              id="tdoc-file-input"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="tdoc-file-input"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <FileText className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              <div>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                  Click to choose file
                </span>{' '}
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  or drag and drop CSV here
                </span>
              </div>
              <span className="text-[11px] text-slate-400">CSV or TXT files up to 10MB</span>
            </label>
            {file && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 text-xs font-semibold">
                <FileText className="w-4 h-4" />
                <span>{file.name}</span>
                <span className="text-[10px] text-blue-600 dark:text-blue-300">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Successfully imported {successCount} records! Updating table...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleProcessUpload}
            disabled={!file || isParsing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            {isParsing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Process & Feed Data
          </button>
        </div>
      </div>
    </div>
  )
}
