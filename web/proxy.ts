import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[proxy] Missing Supabase env vars — skipping auth')
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieEncoding: 'base64url',
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value)
          response.cookies.set({ name, value, ...options })
        }
        if (headers) {
          for (const [k, v] of Object.entries(headers)) {
            response.headers.set(k, v)
          }
        }
      },
    },
  })

  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  } catch (err) {
    console.warn('[proxy] Auth error:', err)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
