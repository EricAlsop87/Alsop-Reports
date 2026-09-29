import { ShieldX, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function DeactivatedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-rose-100/40 blur-3xl dark:bg-rose-900/10" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-slate-100/30 blur-3xl dark:bg-slate-900/10" />
      </div>

      <div className="relative w-full max-w-md px-4">
        {/* Icon */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/20 mb-4">
            <ShieldX className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-tight">
            Account Deactivated
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/60 dark:border-slate-800 p-8 text-center space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Your account has been deactivated and you no longer have access to this dashboard. 
            If you believe this is a mistake, please contact your manager or agency admin.
          </p>

          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
