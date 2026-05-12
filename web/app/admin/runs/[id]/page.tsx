import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'

type RunPageProps = {
  params: Promise<{ id: string }>
}

export default async function RunDetailPage({ params }: RunPageProps) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: run } = await supabase
    .from('scrape_runs')
    .select('*, searches(id, query_text)')
    .eq('id', id)
    .single()

  if (!run) redirect('/admin')

  const duration =
    run.finished_at
      ? `${((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)}s`
      : '—'

  return (
    <div className="max-w-2xl">
      <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
        ← All runs
      </a>
      <h2 className="text-lg font-semibold mt-4 mb-6">Run {run.id.slice(0, 8)}</h2>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
        <div>
          <dt className="text-muted-foreground mb-1">Status</dt>
          <dd>
            <Badge
              variant={
                run.status === 'completed'
                  ? 'default'
                  : run.status === 'running'
                  ? 'secondary'
                  : 'destructive'
              }
            >
              {run.status}
            </Badge>
          </dd>
        </div>

        <div>
          <dt className="text-muted-foreground mb-1">Listings found</dt>
          <dd>{run.listings_found ?? 0}</dd>
        </div>

        <div>
          <dt className="text-muted-foreground mb-1">Started</dt>
          <dd className="font-mono">{format(new Date(run.started_at), 'MMM d yyyy, HH:mm:ss')}</dd>
        </div>

        <div>
          <dt className="text-muted-foreground mb-1">Finished</dt>
          <dd className="font-mono">
            {run.finished_at ? format(new Date(run.finished_at), 'MMM d yyyy, HH:mm:ss') : '—'}
          </dd>
        </div>

        <div>
          <dt className="text-muted-foreground mb-1">Duration</dt>
          <dd>{duration}</dd>
        </div>

        <div>
          <dt className="text-muted-foreground mb-1">Search query</dt>
          <dd>
            {run.searches ? (
              <a
                href={`/dashboard/search/${run.searches.id}`}
                className="underline hover:text-foreground"
              >
                {run.searches.query_text}
              </a>
            ) : (
              '—'
            )}
          </dd>
        </div>
      </dl>

      {run.error_message && (
        <div className="mt-6 border border-red-200 rounded-md p-4">
          <p className="text-sm font-medium text-red-700 mb-2">Error</p>
          <pre className="text-sm text-red-600 whitespace-pre-wrap">{run.error_message}</pre>
        </div>
      )}
    </div>
  )
}
