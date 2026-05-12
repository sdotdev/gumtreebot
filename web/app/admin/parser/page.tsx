'use client'
import { useState, useTransition } from 'react'
import { parseHtmlAction } from '@/app/actions/admin'

export default function ParserPage() {
  const [html, setHtml] = useState('')
  const [result, setResult] = useState<object[] | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleParse() {
    startTransition(async () => {
      const listings = await parseHtmlAction(html)
      setResult(listings)
    })
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Parser Diagnostic</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Paste raw Gumtree search page HTML to test selector extraction.
      </p>
      <div className="grid grid-cols-2 gap-6 h-[600px]">
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">HTML input</label>
          <textarea
            className="flex-1 border rounded-md p-3 font-mono text-xs resize-none bg-muted"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="Paste Gumtree search results HTML here..."
          />
          <button
            onClick={handleParse}
            disabled={isPending || !html}
            className="px-4 py-2 bg-foreground text-background rounded-md text-sm disabled:opacity-50"
          >
            {isPending ? 'Parsing...' : 'Parse listings'}
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Extracted listings {result ? `(${result.length})` : ''}
          </label>
          <pre className="flex-1 border rounded-md p-3 text-xs overflow-auto bg-muted">
            {result === null ? 'Results will appear here...' : JSON.stringify(result, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
