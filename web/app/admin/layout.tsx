import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
          <a href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← App</a>
          <h1 className="font-semibold">Admin</h1>
        </div>
        <nav className="flex gap-4 text-sm">
          <a href="/admin" className="hover:text-foreground text-muted-foreground">Runs</a>
          <a href="/admin/parser" className="hover:text-foreground text-muted-foreground">Parser</a>
        </nav>
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  )
}
