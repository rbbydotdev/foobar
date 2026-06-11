import { useEffect, useState } from 'react'
import { SAMPLE_QUERY, query, useDb } from '@/db'
import type { QueryResult } from '@/db'
import { Button } from '@/components/ui/button'

export default function App() {
  const status = useDb((s) => s.status)
  const error = useDb((s) => s.error)
  const rowCount = useDb((s) => s.rowCount)
  const schema = useDb((s) => s.schema)
  const busy = useDb((s) => s.busy)
  const init = useDb((s) => s.init)
  const reset = useDb((s) => s.reset)
  const seedMore = useDb((s) => s.seedMore)

  const [result, setResult] = useState<QueryResult | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)

  useEffect(() => {
    void init()
  }, [init])

  function runSample() {
    try {
      setQueryError(null)
      setResult(query(SAMPLE_QUERY))
    } catch (e) {
      setResult(null)
      setQueryError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <h1 className="font-mono text-sm font-semibold tracking-tight">foobar</h1>
          <span className="text-xs text-muted-foreground">
            SQLite analytics · AI autocomplete
          </span>
        </div>
        <div data-testid="db-status" className="text-xs text-muted-foreground">
          db: {status}
          {status === 'ready' && (
            <>
              {' · '}
              <span data-testid="row-count">{rowCount.toLocaleString()}</span> rows ·{' '}
              {schema.length} tables
            </>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={runSample} disabled={status !== 'ready'}>
            Run sample query
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void reset(5000)}>
            Reset (5k)
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void seedMore(2000)}>
            Seed +2k
          </Button>
        </div>

        {queryError && (
          <pre className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {queryError}
          </pre>
        )}

        {result && (
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {result.columns.map((c) => (
                    <th key={c} className="px-3 py-1.5 text-left font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className="border-t">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-1.5 font-mono">
                        {cell === null ? '∅' : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
