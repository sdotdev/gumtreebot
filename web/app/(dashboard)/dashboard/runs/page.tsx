import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDistanceToNow, format } from 'date-fns'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface ScrapeRun {
  id: string
  started_at: string
  finished_at: string | null
  status: 'running' | 'completed' | 'failed'
  listings_found: number | null
  error_message: string | null
  searches: {
    id: string
    query_text: string
  } | null
}

export default async function RunsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Get user's searches
  const { data: searches } = await supabase
    .from('searches')
    .select('id')
    .eq('user_id', user.id)

  const searchIds = searches?.map(s => s.id) || []

  // Get recent scrape runs for user's searches
  let query = supabase
    .from('scrape_runs')
    .select('*, searches(id, query_text)')
    .order('started_at', { ascending: false })
    .limit(50)

  if (searchIds.length > 0) {
    query = query.in('search_id', searchIds)
  }

  const { data: runs } = await query

  const typedRuns = (runs ?? []) as ScrapeRun[]

  // Get matches from each run
  const runMatches: Record<string, number> = {}
  if (typedRuns.length > 0) {
    const runIds = typedRuns.map(r => r.id)
    const { data: matchData } = await supabase
      .from('search_matches')
      .select('id, search_id')
      .in('search_id', searchIds)
      .order('matched_at', { ascending: false })
      .limit(1000)

    for (const match of matchData || []) {
      runMatches[match.search_id] = (runMatches[match.search_id] || 0) + 1
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Scraper Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View when the scraper last ran and what listings were found
        </p>
      </div>

      {typedRuns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No scraper runs yet. The scraper runs every 15 minutes.</p>
            <p className="text-xs mt-2">Create a search to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {typedRuns.map((run) => {
            const duration = run.finished_at
              ? `${((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)}s`
              : 'in progress'

            const statusColor =
              run.status === 'completed'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : run.status === 'running'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'

            return (
              <Card key={run.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{run.searches?.query_text || 'Bulk run'}</p>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                          {run.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(run.started_at), 'MMM d, yyyy HH:mm:ss')} ({formatDistanceToNow(new Date(run.started_at), { addSuffix: true })})
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <p className="font-mono text-xs mt-0.5">{duration}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Listings found</p>
                      <p className="font-mono text-xs mt-0.5">{run.listings_found ?? 0}</p>
                    </div>
                  </div>

                  {run.error_message && (
                    <div className="mt-3 rounded-md bg-red-50 dark:bg-red-900/20 p-2 text-xs text-red-700 dark:text-red-400">
                      <p className="font-medium">Error:</p>
                      <p className="font-mono text-xs">{run.error_message}</p>
                    </div>
                  )}

                  {run.status === 'completed' && (
                    <Button asChild variant="ghost" size="sm" className="mt-3">
                      <Link href={`/alerts?page=1`}>
                        View matches →
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• The scraper runs every 15 minutes automatically</p>
          <p>• It searches Gumtree for each of your active searches</p>
          <p>• New listings matching your criteria appear in Alerts</p>
          <p>• You'll receive an email when matches are found (if enabled)</p>
        </CardContent>
      </Card>
    </div>
  )
}
