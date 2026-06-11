import { useCallback, useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { persist, query, useDb } from '@/db'
import type { QueryResult } from '@/db'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { classifyStatement } from './classify'
import type { StatementKind } from './classify'

export interface SqlRunnerState {
  result: QueryResult | null
  error: string | null
  isFetching: boolean
  /** Kind of the current (debounced) statement. */
  kind: StatementKind
  /** Run the current statement immediately, allowing writes (⌘↵). */
  runExplicit: () => void
}

/**
 * Read-only statements run automatically (debounced) as the user types.
 * Writes never auto-run — they execute only via `runExplicit`, then persist
 * and bump the data version so dependent reads refetch.
 */
export function useSqlRunner(sql: string, debounceMs = 300): SqlRunnerState {
  const status = useDb((s) => s.status)
  const dataVersion = useDb((s) => s.dataVersion)
  const markChanged = useDb((s) => s.markChanged)
  const queryClient = useQueryClient()

  const debounced = useDebouncedValue(sql, debounceMs)
  const kind = classifyStatement(debounced)
  const readEnabled = status === 'ready' && kind === 'read'

  const readQuery = useQuery({
    queryKey: ['sql', dataVersion, debounced],
    queryFn: () => query(debounced),
    enabled: readEnabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  const [writeState, setWriteState] = useState<{
    result: QueryResult | null
    error: string | null
  } | null>(null)

  // Drop a stale write result once the statement is no longer a write.
  useEffect(() => {
    if (kind !== 'write') setWriteState(null)
  }, [kind])

  const sqlRef = useRef(sql)
  sqlRef.current = sql

  const runExplicit = useCallback(() => {
    const current = sqlRef.current
    const currentKind = classifyStatement(current)
    if (currentKind === 'empty') return

    if (currentKind === 'write') {
      try {
        const result = query(current)
        setWriteState({ result, error: null })
        void persist()
        markChanged()
      } catch (e) {
        setWriteState({ result: null, error: e instanceof Error ? e.message : String(e) })
      }
      return
    }

    // Read: force a fresh run even if the debounced value hasn't settled.
    setWriteState(null)
    void queryClient.invalidateQueries({ queryKey: ['sql'] })
  }, [markChanged, queryClient])

  if (kind === 'write') {
    return {
      result: writeState?.result ?? null,
      error: writeState?.error ?? null,
      isFetching: false,
      kind,
      runExplicit,
    }
  }

  return {
    result: readQuery.data ?? null,
    error: readQuery.error ? (readQuery.error as Error).message : null,
    isFetching: readQuery.isFetching,
    kind,
    runExplicit,
  }
}
