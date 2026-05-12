import { Resend } from 'resend'
import { supabase } from './supabase.js'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.FROM_EMAIL ?? 'alerts@yourdomain.com'

export async function notifyMatch({ match, listing, search, userEmail }) {
  const priceStr = listing.price != null ? `£${listing.price}` : 'Price not listed'

  const { error: emailError } = await resend.emails.send({
    from: `Gumtree Alerts <${FROM_EMAIL}>`,
    to: userEmail,
    subject: `New match: ${listing.title} — ${priceStr}`,
    text: [
      `Your search for "${search.query_text}" has a new match:`,
      '',
      listing.title,
      priceStr,
      listing.location_text ?? '',
      '',
      `View listing: ${listing.url}`,
      '',
      '---',
      'You are receiving this because you have an active Gumtree deal alert.',
    ].join('\n'),
  })

  await supabase.from('notification_logs').insert({
    user_id: search.user_id,
    match_id: match.id,
    channel: 'email',
    status: emailError ? 'failed' : 'sent',
    sent_at: emailError ? null : new Date().toISOString(),
    error_message: emailError?.message ?? null,
  })

  if (!emailError) {
    await supabase.from('search_matches')
      .update({ notification_status: 'sent', notified_at: new Date().toISOString() })
      .eq('id', match.id)
  }

  return !emailError
}
