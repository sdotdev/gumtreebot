import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { redirect } from 'next/navigation'

function StatusBadge({ status }: { status: 'pending' | 'sent' | 'failed' }) {
  if (status === 'sent') {
    return <Badge className="bg-green-600 text-white hover:bg-green-700">Notified</Badge>
  }
  if (status === 'pending') {
    return <Badge variant="secondary">Pending</Badge>
  }
  return <Badge variant="destructive">Failed</Badge>
}

export default async function AlertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: match } = await supabase
    .from('search_matches')
    .select('*, listings(*), searches(query_text)')
    .eq('id', id)
    .single()

  if (!match) redirect('/alerts')

  const listing = match.listings as {
    id: string
    title: string
    price: number | null
    location_text: string | null
    url: string
    first_seen_at: string | null
    raw_json: Record<string, unknown> | null
  } | null

  const search = match.searches as { query_text: string } | null

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button asChild variant="ghost" size="sm">
        <Link href="/alerts">
          ← Back to alerts
        </Link>
      </Button>

      {/* Title */}
      <h1 className="text-2xl font-bold">
        {listing?.title ?? '[Listing unavailable]'}
      </h1>

      {/* Details card */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-lg">Listing details</h2>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Price
              </dt>
              <dd className="mt-1">
                <Badge variant="outline">
                  {listing?.price != null ? `£${listing.price}` : 'POA'}
                </Badge>
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Location
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {listing?.location_text ?? '—'}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Listing URL
              </dt>
              <dd className="mt-1 text-sm">
                {listing?.url ? (
                  <Button asChild variant="link" size="sm" className="h-auto p-0 justify-start">
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all"
                    >
                      {listing.url}
                    </a>
                  </Button>
                ) : (
                  '—'
                )}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                First seen
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {listing?.first_seen_at
                  ? formatDistanceToNow(new Date(listing.first_seen_at), { addSuffix: true })
                  : '—'}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Matched via search
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {search?.query_text ?? '—'}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Matched
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {formatDistanceToNow(new Date(match.matched_at as string), { addSuffix: true })}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Notification status
              </dt>
              <dd className="mt-1">
                <StatusBadge status={match.notification_status as 'pending' | 'sent' | 'failed'} />
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Description */}
      {listing?.raw_json && (listing.raw_json as { description?: string }).description && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-lg">Description</h2>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
              {(listing.raw_json as { description: string }).description}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
