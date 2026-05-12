'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Search {
  id: string
  query_text: string
}

interface Props {
  searches: Search[]
  activeSearchId: string | undefined
}

export function AlertsFilter({ searches, activeSearchId }: Props) {
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    if (value) {
      router.push(`/alerts?search_id=${value}&page=1`)
    } else {
      router.push('/alerts')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="search_id" className="text-sm text-muted-foreground">
        Filter by search:
      </label>
      <select
        id="search_id"
        value={activeSearchId ?? ''}
        onChange={handleChange}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All searches</option>
        {searches.map((s) => (
          <option key={s.id} value={s.id}>
            {s.query_text}
          </option>
        ))}
      </select>
      {activeSearchId && (
        <Link
          href="/alerts"
          className="text-sm text-muted-foreground underline underline-offset-2"
        >
          Clear
        </Link>
      )}
    </div>
  )
}
