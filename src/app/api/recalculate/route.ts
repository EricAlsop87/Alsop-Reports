import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabaseServer"
import { recalculateSummaries } from "@/lib/pipeline/recalculate-summaries"

/**
 * POST /api/recalculate
 *
 * Triggers a recalculation of period_summaries for a given year.
 * Accepts optional `months` array to limit scope.
 *
 * Body: { year: number, months?: number[] }
 *
 * 🔒 Requires: Authenticated admin user
 */
export async function POST(request: NextRequest) {
  // ── Auth check: require logged-in admin ──
  try {
    const supabaseSession = await createSupabaseServerClient()
    const { data: { user } } = await supabaseSession.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized — please log in" },
        { status: 401 }
      )
    }

    // Verify the user is an admin
    const supabaseAdmin = createSupabaseAdmin()
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("role, team")
      .eq("auth_user_id", user.id)
      .single()

    const isAdmin = agent?.role === "admin" || agent?.team === "Managers"
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden — admin access required" },
        { status: 403 }
      )
    }
  } catch {
    return NextResponse.json(
      { success: false, error: "Authentication failed" },
      { status: 401 }
    )
  }

  // ── Perform recalculation ──
  try {
    const body = await request.json()
    const year = body.year || new Date().getFullYear()
    const months = body.months as number[] | undefined

    const supabase = createSupabaseAdmin()

    const logs = await recalculateSummaries(supabase, year, {
      months,
      weekly: true,
      ytd: true,
    })

    return NextResponse.json({ success: true, logs })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Recalculate error:", message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
