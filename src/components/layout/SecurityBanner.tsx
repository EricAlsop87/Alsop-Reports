"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ShieldAlert, ArrowRight } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser"

export function SecurityBanner() {
  const [status, setStatus] = useState<{ needsPasswordReset: boolean; needsMFA: boolean } | null>(null)
  const [mounted, setMounted] = useState(false)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    setMounted(true)
    
    async function checkSecurityStatus() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Has the user updated their password since we enabled the strict policy?
      const needsPasswordReset = !user.user_metadata?.security_upgraded

      // Has the user enrolled in MFA?
      const { data, error } = await supabase.auth.mfa.listFactors()
      const userHasMfa = data?.totp && data.totp.length > 0
      const needsMFA = !error && !userHasMfa

      if (needsPasswordReset || needsMFA) {
        setStatus({ needsPasswordReset, needsMFA })
      }
    }

    checkSecurityStatus()
  }, [])

  // Don't show if they are compliant or we are still checking
  if (!mounted || !status) return null

  const actionText = 
    status.needsPasswordReset && status.needsMFA 
      ? "update your password and enroll in Two-Factor Authentication"
      : status.needsPasswordReset 
      ? "update your password"
      : "enroll in Two-Factor Authentication"

  return (
    <div className="bg-rose-50 border-b border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30">
      <div className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-1.5 bg-rose-100 rounded-md shrink-0 dark:bg-rose-900/50">
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-rose-900 dark:text-rose-200">
                Action Required: Account Security Update
              </p>
              <p className="text-xs text-rose-700 mt-0.5 dark:text-rose-300">
                To protect data privacy, it is highly urged that you visit your settings to {actionText}.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
            <Link 
              href="/settings"
              className="text-xs font-semibold bg-rose-600 text-white px-3 py-1.5 rounded-md hover:bg-rose-700 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              Go to Settings <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
