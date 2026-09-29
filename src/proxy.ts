import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project-id')) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    // Ignore auth errors if Supabase is unreachable or unconfigured
  }

  const pathname = request.nextUrl.pathname

  // Allow these paths through without auth
  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/deactivated') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next')

  // If no user and not on a public page, redirect to login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user IS logged in, check if their account is still active
  if (user && !pathname.startsWith('/deactivated') && !pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
    try {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceKey) {
        const adminClient = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        })
        const { data: agent } = await adminClient
          .from('agents')
          .select('is_active')
          .eq('auth_user_id', user.id)
          .single()

        // If agent found and is deactivated, sign them out and redirect
        if (agent && agent.is_active === false) {
          // Clear the session cookies so they're fully signed out
          const url = request.nextUrl.clone()
          url.pathname = '/deactivated'
          const redirectResponse = NextResponse.redirect(url)

          // Delete all Supabase auth cookies
          const allCookies = request.cookies.getAll()
          for (const cookie of allCookies) {
            if (cookie.name.startsWith('sb-')) {
              redirectResponse.cookies.delete(cookie.name)
            }
          }

          return redirectResponse
        }
      }
    } catch {
      // If the active check fails, allow through — don't block legitimate users
    }
  }

  // If user is logged in and tries to access login page, redirect to home
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
