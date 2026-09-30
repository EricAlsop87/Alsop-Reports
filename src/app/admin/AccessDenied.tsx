"use client"

import { useRouter } from "next/navigation"
import { ShieldAlert } from "lucide-react"

export default function AccessDenied() {
  const router = useRouter()
  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          You do not have permission to view the Admin Control Panel. 
          Only administrators are authorized to access this section.
        </p>
        <button
          onClick={() => router.push("/")}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  )
}
