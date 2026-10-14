"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ShieldAlert, ArrowRight, X } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser"

export function SecurityBanner() {
  const [status, setStatus] = useState<{ needsPasswordReset: boolean; needsMFA: boolean } | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    setMounted(true)
    
    async function checkSecurityStatus() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // SSO users (Google/Azure) manage their own security and passwords via their provider
        const isEmailUser = user.app_metadata?.providers?.includes("email")
        if (!isEmailUser) return

        // Check if user has completed MFA compliance
        const [factorsRes, aalRes] = await Promise.all([
          supabase.auth.mfa.listFactors(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        ])

        const totpFactors = factorsRes.data?.totp || []
        const hasVerifiedTotp = totpFactors.some((f: any) => f.status === "verified") || totpFactors.length > 0
        const isAal2 = aalRes.data?.currentLevel === "aal2" || aalRes.data?.nextLevel === "aal2"
        const isMfaCompliant = hasVerifiedTotp || isAal2

        // If the user has already completed MFA compliance, remove banner completely
        if (isMfaCompliant) {
          setStatus(null)
          return
        }

        // Only prompt users who still need to complete MFA compliance
        setStatus({ needsPasswordReset: false, needsMFA: true })
      } catch {
        // Session may be expired or missing — silently skip
      }
    }

    checkSecurityStatus()
  }, [])

  // Don't show if they are MFA compliant, dismissed, or we are still checking
  if (!mounted || !status || dismissed) return null

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
                To protect data privacy, it is highly urged that you visit your settings to enroll in Two-Factor Authentication.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Link 
              href="/settings"
              className="text-xs font-semibold bg-rose-600 text-white px-3 py-1.5 rounded-md hover:bg-rose-700 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              Go to Settings <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={() => setDismissed(true)}
              className="p-1 text-rose-400 hover:text-rose-700 dark:hover:text-rose-200 transition-colors rounded-md"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
