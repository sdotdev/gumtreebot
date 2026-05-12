import { supabase } from './supabase.js'

export async function dedupeAndStore(listings) {
  if (!listings.length) return []

  try {
    const { data, error } = await supabase
      .from('listings')
      .upsert(
        listings.map(l => ({ ...l, last_seen_at: new Date().toISOString() })),
        { onConflict: 'source,source_listing_id', ignoreDuplicates: false }
      )
      .select('id, source_listing_id, first_seen_at, last_seen_at, title, price, location_text, url')

    if (error) throw error

    return (data ?? []).filter(row => {
      const firstSeen = new Date(row.first_seen_at).getTime()
      const lastSeen = new Date(row.last_seen_at).getTime()
      return Math.abs(lastSeen - firstSeen) < 5000
    })
  } catch (err) {
    console.error('Error in dedupeAndStore:', err.message, err.stack)
    throw err
  }
}
