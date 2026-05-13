import { Resend } from 'resend'
import { supabase } from './supabase.js'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.FROM_EMAIL ?? 'alerts@yourdomain.com'

function formatListing(listing) {
  const priceStr = listing.price != null ? `£${listing.price}` : 'Price not listed'
  return [
    listing.title,
    priceStr,
    listing.location_text ?? '',
    `View: ${listing.url}`,
  ].join('\n')
}

export async function notifyMatches({ matches, search, userEmail }) {
  if (!matches.length) return { error: null, count: 0 }

  const listingLines = matches.map(({ listing }) => formatListing(listing))
  const listingsText = listingLines.join('\n\n---\n\n')

  const count = matches.length
  const countStr = count === 1 ? '1 new match' : `${count} new matches`

  const { error: emailError } = await resend.emails.send({
    from: `Gumbotree <${FROM_EMAIL}>`,
    to: userEmail,
    subject: `${countStr}: ${search.query_text}`,
    text: [
      `Your search for "${search.query_text}" has ${countStr}:`,
      '',
      listingsText,
      '',
      '---',
      'You are receiving this because you have an active Gumbotree alert.',
    ].join('\n'),
  })

  const now = new Date().toISOString()
  const notificationLogs = matches.map(({ match }) => ({
    user_id: search.user_id,
    match_id: match.id,
    channel: 'email',
    status: emailError ? 'failed' : 'sent',
    sent_at: emailError ? null : now,
    error_message: emailError?.message ?? null,
  }))

  await supabase.from('notification_logs').insert(notificationLogs)

  if (!emailError) {
    const matchIds = matches.map(({ match }) => match.id)
    await supabase.from('search_matches')
      .update({ notification_status: 'sent', notified_at: now })
      .in('id', matchIds)
  }

  return { error: emailError, count: emailError ? 0 : count }
}
