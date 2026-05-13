import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { AlertsFilter } from '@/components/alerts-filter'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

interface SearchMatch {
  id: string
  matched_at: string
  notification_status: 'pending' | 'sent' | 'failed'
  listings: {
    id: string
    title: string
    price: number | null
    location_text: string | null
    url: string
  } | null
  searches: {
    id: string
    query_text: string
  } | null
}

interface Search {
  id: string
  query_text: string
}

function StatusBadge({ status }: { status: 'pending' | 'sent' | 'failed' }) {
  if (status === 'sent') {
    return <Badge className="bg-green-600 text-white hover:bg-green-700">Notified</Badge>
  }
  if (status === 'pending') {
    return <Badge variant="secondary">Pending</Badge>
  }
  return <Badge variant="destructive">Failed</Badge>
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search_id?: string }>
}) {
  const sp = await searchParams
  const page = Number(sp.page ?? 1)
  const searchId = sp.search_id
  const from = (page - 1) * 20

  const supabase = await createClient()

  const { data: searches } = await supabase
    .from('searches')
    .select('id, query_text')
    .order('created_at', { ascending: false })

  let query = supabase
    .from('search_matches')
    .select(
      'id, matched_at, notification_status, listings(id, title, price, location_text, url, raw_json), searches(id, query_text)',
      { count: 'exact' }
    )
    .order('matched_at', { ascending: false })
    .range(from, from + 19)

  if (searchId) query = query.eq('search_id', searchId)

  const { data: matches, count } = await query

  const totalPages = Math.ceil((count ?? 0) / 20)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Alerts</h1>
        {count !== null && (
          <Badge variant="secondary">{count}</Badge>
        )}
      </div>

      {/* Filter */}
      <AlertsFilter
        searches={(searches as Search[] | null) ?? []}
        activeSearchId={searchId}
      />

      {/* Matches */}
      {!matches || matches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No alerts yet. The scraper will notify you when new listings match your searches.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(matches as unknown as SearchMatch[]).map((match) => {
            const listing = match.listings
            const search = match.searches
            return (
              <Card key={match.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {listing ? (
                        <Button asChild variant="link" size="sm" className="h-auto p-0 text-base font-semibold justify-start">
                          <a
                            href={listing.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {listing.title}
                          </a>
                        </Button>
                      ) : (
                        <span className="font-semibold text-muted-foreground">[Listing unavailable]</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {listing && (
                        <Badge variant="outline">
                          {listing.price != null ? `£${listing.price}` : 'POA'}
                        </Badge>
                      )}
                      <StatusBadge status={match.notification_status} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 pt-0">
                  {listing?.location_text && (
                    <p className="text-sm text-muted-foreground">{listing.location_text}</p>
                  )}
                  {listing && (listing as unknown as { raw_json?: { description?: string } }).raw_json?.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {(listing as unknown as { raw_json: { description: string } }).raw_json.description}
                    </p>
                  )}
                  {search && (
                    <p className="text-xs text-muted-foreground">
                      Matched via: {search.query_text}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(match.matched_at), { addSuffix: true })}
                    </p>
                    <Button asChild variant="ghost" size="sm" className="h-auto px-2 py-0 text-xs">
                      <Link href={`/alerts/${match.id}`}>
                        Details
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/alerts?page=${page - 1}${searchId ? `&search_id=${searchId}` : ''}`}>
                ← Previous
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/alerts?page=${page + 1}${searchId ? `&search_id=${searchId}` : ''}`}>
                Next →
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  )
}
