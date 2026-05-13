import { createAdminClient } from '@/lib/supabase/admin'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

type ScrapeRun = {
  id: string
  started_at: string
  finished_at: string | null
  status: 'running' | 'completed' | 'failed'
  listings_found: number | null
  searches: { query_text: string } | null
}

export default async function AdminRunsPage() {
  const supabase = createAdminClient()
  const { data: runs } = await supabase
    .from('scrape_runs')
    .select('*, searches(query_text)')
    .order('started_at', { ascending: false })
    .limit(50)

  const typedRuns = (runs ?? []) as ScrapeRun[]

  return (
    <div>
      <h2 className="text-lg font-semibold mb-6">Scrape Runs</h2>
      {typedRuns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scrape runs found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Search</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Listings</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {typedRuns.map((run) => {
              const duration =
                run.finished_at
                  ? `${((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)}s`
                  : '—'
              return (
                <TableRow key={run.id}>
                  <TableCell className="font-mono text-xs">
                    {format(new Date(run.started_at), 'MMM d, HH:mm:ss')}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {run.searches?.query_text ?? '—'}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>{duration}</TableCell>
                  <TableCell>{run.listings_found ?? 0}</TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/runs/${run.id}`}>
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
