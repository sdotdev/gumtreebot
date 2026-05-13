import { supabase } from './supabase.js'

export async function cleanupExpiredListings(daysOld = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString()

  console.log(`[cleanup] Removing listings older than ${daysOld} days (before ${cutoffDate})`)

  try {
    // Get listings to delete
    const { data: toDelete, error: fetchError } = await supabase
      .from('listings')
      .select('id')
      .lt('first_seen_at', cutoffDate)

    if (fetchError) throw fetchError

    if (!toDelete || toDelete.length === 0) {
      console.log('[cleanup] No expired listings found')
      return { deleted: 0, matchesRemoved: 0 }
    }

    const listingIds = toDelete.map(l => l.id)
    console.log(`[cleanup] Found ${listingIds.length} listings to remove`)

    // Delete associated search_matches first (due to foreign key)
    const { error: matchError } = await supabase
      .from('search_matches')
      .delete()
      .in('listing_id', listingIds)

    if (matchError) throw matchError

    // Delete associated notification_logs
    const { error: notifError } = await supabase
      .from('notification_logs')
      .delete()
      .in('match_id', (await supabase.from('search_matches').select('id').in('listing_id', listingIds)).data?.map(m => m.id) || [])

    if (notifError) console.warn('[cleanup] Warning deleting notification logs:', notifError.message)

    // Delete listings
    const { error: deleteError, count } = await supabase
      .from('listings')
      .delete()
      .lt('first_seen_at', cutoffDate)

    if (deleteError) throw deleteError

    console.log(`[cleanup] Deleted ${count} expired listings`)
    return { deleted: count || 0, matchesRemoved: listingIds.length }
  } catch (err) {
    console.error('[cleanup] Error:', err.message)
    throw err
  }
}
