import { useEffect, useState } from 'react'
import { SAMPLE_QUERY, useDb } from '@/db'
import { useSqlRunner } from '@/query/useSqlRunner'
import { ResultsTable } from '@/query/ResultsTable'
import { SqlEditor } from '@/editor/SqlEditor'
import { AiSettings } from '@/providers/components/AiSettings'
import { useImportSharedProvider } from '@/providers/useImportSharedProvider'
import { Button } from '@/components/ui/button'

export default function App() {
  const status = useDb((s) => s.status)
  const dbError = useDb((s) => s.error)
  const rowCount = useDb((s) => s.rowCount)
  const schema = useDb((s) => s.schema)
  const busy = useDb((s) => s.busy)
  const init = useDb((s) => s.init)
  const reset = useDb((s) => s.reset)
  const seedMore = useDb((s) => s.seedMore)

  const [sql, setSql] = useState(SAMPLE_QUERY)
  const runner = useSqlRunner(sql)

  useImportSharedProvider()

  useEffect(() => {
    void init()
  }, [init])

  const pendingWrite = runner.kind === 'write' && !runner.result && !runner.error

  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <h1 className="font-mono text-sm font-semibold tracking-tight">foobar</h1>
          <span className="text-xs text-muted-foreground">
            SQLite analytics · AI autocomplete
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span data-testid="db-status" className="hidden sm:inline">
            db: {status}
            {status === 'ready' && (
              <>
                {' · '}
                <span data-testid="row-count">{rowCount.toLocaleString()}</span> rows ·{' '}
                {schema.length} table{schema.length === 1 ? '' : 's'}
              </>
            )}
          </span>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void reset(5000)}>
            Reset
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void seedMore(2000)}>
            Seed +2k
          </Button>
          <AiSettings />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        {dbError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {dbError}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="overflow-hidden rounded-md border bg-card focus-within:ring-[3px] focus-within:ring-ring/50">
            <SqlEditor
              value={sql}
              onChange={setSql}
              onRun={runner.runExplicit}
              schema={schema}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {pendingWrite ? (
                <span className="text-amber-600 dark:text-amber-500">
                  This statement writes data — press ⌘↵ to run.
                </span>
              ) : runner.kind === 'read' ? (
                'Read-only queries run as you type.'
              ) : (
                'Press ⌘↵ to run.'
              )}
            </span>
            <Button size="sm" onClick={runner.runExplicit} disabled={status !== 'ready'}>
              Run ⌘↵
            </Button>
          </div>
        </div>

        {runner.error && (
          <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {runner.error}
          </pre>
        )}

        <div className="min-h-0 flex-1">
          <ResultsTable result={runner.result} isFetching={runner.isFetching} />
        </div>
      </main>
    </div>
  )
}
