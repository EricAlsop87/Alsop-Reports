"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ShieldAlert, X, ArrowRight } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser"

const STORAGE_KEY = "dsr_security_banner_dismissed_v1"

export function SecurityBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [hasMfa, setHasMfa] = useState(true) // assume true until we know
  const [mounted, setMounted] = useState(false)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    setMounted(true)
    
    async function checkSecurityStatus() {
      const isDismissed = localStorage.getItem(STORAGE_KEY)
      if (isDismissed) return // Don't show if dismissed

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase.auth.mfa.listFactors()
      const userHasMfa = data?.totp && data.totp.length > 0

      if (!error) {
        setHasMfa(!!userHasMfa)
      }

      // Always show if not dismissed, so they know about the password requirement too
      setIsVisible(true)
    }

    checkSecurityStatus()
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, "true")
    } catch {
      // ignore storage errors
    }
  }

  if (!mounted || !isVisible) return null

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
                Please visit your settings to update your password and {!hasMfa && "enroll in"} Two-Factor Authentication.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
            <Link 
              href="/settings"
              className="text-xs font-semibold bg-rose-600 text-white px-3 py-1.5 rounded-md hover:bg-rose-700 transition-colors flex items-center gap-1.5 shadow-sm"
              onClick={() => setIsVisible(false)} // visually hide when clicking
            >
              Go to Settings <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-rose-500 hover:bg-rose-100 hover:text-rose-700 rounded-md transition-colors dark:hover:bg-rose-900/50"
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
