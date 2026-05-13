import { Resend } from 'resend'
import { supabase } from './supabase.js'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.FROM_EMAIL ?? 'alerts@yourdomain.com'
const APP_URL = 'https://gumbotree.vercel.app'

function formatListing(listing) {
  const priceStr = listing.price != null ? `£${listing.price}` : 'Price not listed'
  return [
    listing.title,
    priceStr,
    listing.location_text ?? '',
    `View: ${listing.url}`,
  ].join('\n')
}

function generateUnsubscribeToken(userId, email) {
  return Buffer.from(`${userId}:${email}`).toString('base64')
}

async function isEmailEnabled(userId) {
  const { data } = await supabase
    .from('user_settings')
    .select('email_enabled')
    .eq('user_id', userId)
    .single()

  return data?.email_enabled !== false
}

async function sendWithRetry(emailData, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await resend.emails.send(emailData)
      if (result.error) {
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000
          console.log(`[notify] Send failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
      return result
    } catch (err) {
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        console.log(`[notify] Send error: ${err.message}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        throw err
      }
    }
  }
}


export async function notifyMatches({ matches, search, userEmail, userId }) {
  if (!matches.length) return { error: null, count: 0 }

  // Check if user has email notifications enabled
  const emailEnabled = await isEmailEnabled(userId)
  if (!emailEnabled) {
    console.log(`[notify] Email disabled for user ${userId}, skipping`)
    return { error: null, count: 0 }
  }

  const listingLines = matches.map(({ listing }) => formatListing(listing))
  const listingsText = listingLines.join('\n\n---\n\n')

  const count = matches.length
  const countStr = count === 1 ? '1 new match' : `${count} new matches`
  const unsubscribeToken = generateUnsubscribeToken(userId, userEmail)
  const unsubscribeUrl = `${APP_URL}/api/unsubscribe?token=${unsubscribeToken}`

  const emailData = {
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
      '',
      `Manage notifications: ${APP_URL}/dashboard/settings`,
      `Unsubscribe: ${unsubscribeUrl}`,
    ].join('\n'),
  }

  const { error: emailError } = await sendWithRetry(emailData)

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
