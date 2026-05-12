import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { SearchCardActions } from '@/components/search-card-actions'

interface Search {
  id: string
  query_text: string
  location_text: string | null
  min_price: number | null
  max_price: number | null
  active: boolean
  created_at: string
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const [{ data: searches }, { data: matchRows }] = await Promise.all([
    supabase.from('searches').select('*').order('created_at', { ascending: false }),
    supabase.from('search_matches').select('search_id, id'),
  ])

  const list = (searches ?? []) as Search[]

  // Build a map of search_id → match count
  const matchCounts: Record<string, number> = {}
  for (const row of matchRows ?? []) {
    matchCounts[row.search_id] = (matchCounts[row.search_id] ?? 0) + 1
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Searches</h1>
        <Button asChild>
          <Link href="/dashboard/searches/new">New search</Link>
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <p className="text-muted-foreground">No saved searches yet</p>
          <Button asChild>
            <Link href="/dashboard/searches/new">New search</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((search) => {
            const count = matchCounts[search.id] ?? 0
            const priceRange =
              search.min_price != null || search.max_price != null
                ? [
                    search.min_price != null ? `£${search.min_price}` : null,
                    search.max_price != null ? `£${search.max_price}` : null,
                  ]
                    .filter(Boolean)
                    .join(' – ')
                : null

            return (
              <Card key={search.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{search.query_text}</CardTitle>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        search.active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {search.active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {search.location_text && <span>📍 {search.location_text}</span>}
                  {priceRange && <span>💰 {priceRange}</span>}
                  <span>Created {new Date(search.created_at).toLocaleDateString()}</span>
                </CardContent>
                <CardFooter className="gap-2 flex-wrap">
                  <SearchCardActions
                    id={search.id}
                    active={search.active}
                    queryText={search.query_text}
                    matchCount={count}
                  />
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
