import { useEffect, useState } from 'react'
import { Database, Loader2, Play } from 'lucide-react'
import { SAMPLE_QUERY, useDb } from '@/db'
import { useSqlRunner } from '@/query/useSqlRunner'
import { ResultsTable } from '@/query/ResultsTable'
import { SqlEditor } from '@/editor/SqlEditor'
import { useAiAutocompleteExtension } from '@/editor/useAiAutocompleteExtension'
import { AiSettings } from '@/providers/components/AiSettings'
import { AnomalyWatcher } from '@/anomaly/AnomalyWatcher'
import { AnomalyScenarios } from '@/anomaly/AnomalyScenarios'
import { useScenarios } from '@/anomaly/scenario-store'
import { SharedProviderImporter } from '@/providers/components/SharedProviderImporter'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const EXAMPLES: Array<{ label: string; sql: string }> = [
  { label: 'Status mix', sql: SAMPLE_QUERY },
  {
    label: 'Error rate / hour',
    sql: `SELECT substr(ts, 1, 13) || ':00' AS hour,
       count(*)                                  AS requests,
       round(100.0 * sum(status >= 500) / count(*), 1) AS err_pct
FROM requests
GROUP BY hour
ORDER BY hour DESC
LIMIT 48;`,
  },
  {
    label: 'Slowest endpoints',
    sql: `SELECT path,
       count(*)                AS hits,
       round(avg(duration_ms)) AS avg_ms,
       max(duration_ms)        AS max_ms
FROM requests
GROUP BY path
ORDER BY avg_ms DESC;`,
  },
  {
    label: '5xx by path',
    sql: `SELECT path, count(*) AS errors
FROM requests
WHERE status >= 500
GROUP BY path
ORDER BY errors DESC;`,
  },
  {
    label: 'Traffic by country',
    sql: `SELECT country, count(*) AS hits
FROM requests
GROUP BY country
ORDER BY hits DESC
LIMIT 15;`,
  },
]

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/80">
      {children}
    </kbd>
  )
}

export default function App() {
  const status = useDb((s) => s.status)
  const dbError = useDb((s) => s.error)
  const rowCount = useDb((s) => s.rowCount)
  const schema = useDb((s) => s.schema)
  const busy = useDb((s) => s.busy)
  const init = useDb((s) => s.init)
  const reset = useDb((s) => s.reset)
  const seedMore = useDb((s) => s.seedMore)

  const [sql, setSql] = useState('')
  const runner = useSqlRunner(sql)
  const aiExtension = useAiAutocompleteExtension()

  useEffect(() => {
    void init()
  }, [init])

  const pendingWrite = runner.kind === 'write' && !runner.result && !runner.error

  return (
    <div className="app-surface flex h-svh flex-col text-foreground">
      <SharedProviderImporter />
      <header className="flex items-center justify-between gap-3 border-b border-border/80 bg-card/50 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md border border-primary/30 bg-primary/15 text-primary">
            <Database className="size-4" />
          </div>
          <div className="leading-tight">
            <div className="font-mono text-sm font-bold tracking-tight">foobar</div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              request analytics
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span data-testid="db-status" className="hidden font-mono text-[11px] text-muted-foreground md:inline">
            <span className={cn('mr-1.5 inline-block size-1.5 rounded-full align-middle', status === 'ready' ? 'bg-emerald-500' : status === 'error' ? 'bg-destructive' : 'bg-amber-500')} />
            {status === 'ready' ? (
              <>
                <span data-testid="row-count">{rowCount.toLocaleString()}</span> rows · {schema.length}{' '}
                table{schema.length === 1 ? '' : 's'}
              </>
            ) : (
              status
            )}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              useScenarios.getState().reset()
              void reset(5000)
            }}
          >
            Reset
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void seedMore(2000)}>
            Seed +2k
          </Button>
          <Separator orientation="vertical" className="mx-0.5 !h-5" />
          <AnomalyScenarios />
          <AnomalyWatcher />
          <AiSettings />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        {dbError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {dbError}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Examples
            </span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => setSql(ex.sql)}
                className="shrink-0 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {ex.label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border bg-card shadow-sm focus-within:border-primary/40 focus-within:ring-[3px] focus-within:ring-ring/30">
            <SqlEditor
              value={sql}
              onChange={setSql}
              onRun={runner.runExplicit}
              schema={schema}
              aiExtension={aiExtension}
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
            <Button size="sm" className="gap-1.5" onClick={runner.runExplicit} disabled={status !== 'ready'}>
              <Play className="size-3" />
              Run
              <span className="font-mono opacity-70">⌘↵</span>
            </Button>
          </div>
        </div>

        {runner.error && (
          <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {runner.error}
          </pre>
        )}

        <div className="min-h-0 flex-1">
          {status === 'ready' ? (
            <ResultsTable result={runner.result} isFetching={runner.isFetching} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
              {status === 'error' ? 'Database failed to load' : 'Booting SQLite + seeding sample data…'}
            </div>
          )}
        </div>
      </main>

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/80 bg-card/50 px-4 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
        <span className="flex items-center gap-1.5">
          <Kbd>⌘↵</Kbd> run
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Tab</Kbd> accept AI ghost text
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>⇧⌘I</Kbd> ask AI to write / edit SQL
        </span>
        <span className="hidden sm:inline">·</span>
        <span className="hidden sm:inline">all data is local — SQLite WASM in your browser</span>
      </footer>
    </div>
  )
}
