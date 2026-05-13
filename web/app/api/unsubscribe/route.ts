import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    redirect('/login?error=Invalid unsubscribe link')
  }

  try {
    const supabase = createAdminClient()

    // Verify token (base64 encoded user_id:email for MVP)
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const [userId, email] = decoded.split(':')

    if (!userId || !email) {
      redirect('/login?error=Invalid unsubscribe link')
    }

    // Verify the email matches the user
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId)
    if (userError || !user || user.email !== email) {
      redirect('/login?error=Invalid unsubscribe link')
    }

    // Disable email notifications
    const { error: settingsError } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        email_enabled: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (settingsError) {
      redirect('/login?error=Failed to unsubscribe')
    }

    redirect('/login?message=You have been unsubscribed from email notifications')
  } catch (error) {
    redirect('/login?error=Failed to unsubscribe')
  }
}
