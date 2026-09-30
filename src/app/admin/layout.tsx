import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabaseServer"
import AccessDenied from "./AccessDenied"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("role")
    .eq("auth_user_id", user.id)
    .single()

  if (!agent || agent.role !== "admin") {
    return <AccessDenied />
  }

  return <>{children}</>
}
