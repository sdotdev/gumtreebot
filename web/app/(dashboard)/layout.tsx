import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import Link from 'next/link'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="font-semibold text-foreground">
              Gumbotree
            </Link>
            <Link href="/alerts" className="text-sm text-muted-foreground hover:text-foreground">
              Alerts
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-muted-foreground">{user.email}</span>
            )}
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>
      <Toaster />
    </div>
  )
}
