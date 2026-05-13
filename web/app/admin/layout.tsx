import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">
              ← App
            </Link>
          </Button>
          <h1 className="font-semibold">Admin</h1>
        </div>
        <nav className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">
              Runs
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/parser">
              Parser
            </Link>
          </Button>
        </nav>
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  )
}
