import { fetchActiveSearches } from './lib/fetch-searches.js'
import { buildGumtreeUrl } from './lib/build-url.js'
import { fetchPage } from './lib/fetch-page.js'
import { parseListings } from './lib/parse-listings.js'
import { dedupeAndStore } from './lib/dedupe.js'
import { matchesSearch } from './lib/match.js'
import { notifyMatches } from './lib/notify.js'
import { startRun, finishRun, failRun } from './lib/log-run.js'
import { supabase } from './lib/supabase.js'

async function getUserEmail(userId) {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error) throw error
  return data.user.email
}

async function run() {
  console.log(`[${new Date().toISOString()}] Scrape job started`)

  const searches = await fetchActiveSearches()
  if (!searches.length) {
    console.log('No active searches — exiting')
    return
  }
  console.log(`Loaded ${searches.length} active search(es)`)

  const byUrl = new Map()
  for (const s of searches) {
    const url = buildGumtreeUrl(s)
    if (!byUrl.has(url)) byUrl.set(url, [])
    byUrl.get(url).push(s)
  }

  for (const [url, group] of byUrl) {
    const runId = await startRun(group[0].id)
    console.log(`Scraping: ${url}`)

    try {
      const html = await fetchPage(url)
      const parsed = parseListings(html)
      console.log(`  Parsed ${parsed.length} listings from page`)

      const newListings = await dedupeAndStore(parsed)
      console.log(`  ${newListings.length} new listing(s)`)

      const searchMatches = new Map()
      for (const listing of newListings) {
        for (const search of group) {
          if (!matchesSearch(listing, search)) continue

          const { data: match, error: matchErr } = await supabase
            .from('search_matches')
            .upsert(
              { search_id: search.id, listing_id: listing.id },
              { onConflict: 'search_id,listing_id', ignoreDuplicates: false }
            )
            .select('id, notification_status')
            .maybeSingle()

           if (matchErr) { console.error('Match upsert error:', matchErr.message, matchErr.stack); continue }
          if (!match || match.notification_status !== 'pending') continue

          if (!searchMatches.has(search.id)) {
            searchMatches.set(search.id, { search, matches: [] })
          }
          searchMatches.get(search.id).matches.push({ match, listing })
        }
      }

      let matchCount = 0
      for (const { search, matches } of searchMatches.values()) {
        try {
          const userEmail = await getUserEmail(search.user_id)
          const { error, count } = await notifyMatches({ matches, search, userEmail })
          if (!error) matchCount += count
        } catch (notifyErr) {
          console.error('Notify error:', notifyErr.message)
        }
      }

      await finishRun(runId, newListings.length)
      console.log(`  Run complete — ${matchCount} notification(s) sent`)
    } catch (err) {
      console.error(`  Run failed: ${err.message}`)
      await failRun(runId, err.message)
    }
  }

  console.log(`[${new Date().toISOString()}] Scrape job finished`)
}

run().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
