import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm'
import { DEFAULT_SEED_COUNT, SCHEMA_SQL } from './schema'
import { introspectSchema } from './introspect'
import { clearSnapshot, loadSnapshot, saveSnapshot } from './persistence'
import type { QueryResult, SqlValue, TableSchema } from './types'

let sqlite3: Sqlite3Static | null = null
let db: Database | null = null

function requireDb(): Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export interface InitResult {
  restored: boolean
  seeded: boolean
  rowCount: number
}

// Faker is heavy and only needed when generating data, so load it on demand —
// returning visitors restore from the IndexedDB snapshot and never pull it in.
async function seed(
  db: Database,
  options: { count: number; append?: boolean },
): Promise<number> {
  const { seedRequests } = await import('./seed')
  return seedRequests(db, options)
}

export async function initDatabase(): Promise<InitResult> {
  if (db) return { restored: false, seeded: false, rowCount: getRowCount() }

  sqlite3 = await sqlite3InitModule()
  db = new sqlite3.oo1.DB(':memory:', 'c')

  const snapshot = await loadSnapshot()
  if (snapshot) {
    try {
      deserializeInto(snapshot)
      return { restored: true, seeded: false, rowCount: getRowCount() }
    } catch (err) {
      console.warn('[db] snapshot restore failed, reseeding', err)
    }
  }

  db.exec(SCHEMA_SQL)
  await seed(db, { count: DEFAULT_SEED_COUNT })
  await persist()
  return { restored: false, seeded: true, rowCount: getRowCount() }
}

function deserializeInto(bytes: Uint8Array): void {
  const s = sqlite3
  const d = requireDb()
  if (!s) throw new Error('sqlite3 not initialized')
  const p = s.wasm.allocFromTypedArray(bytes)
  const rc = s.capi.sqlite3_deserialize(
    d,
    'main',
    p,
    bytes.byteLength,
    bytes.byteLength,
    s.capi.SQLITE_DESERIALIZE_FREEONCLOSE | s.capi.SQLITE_DESERIALIZE_RESIZEABLE,
  )
  d.checkRc(rc)
}

/** Runs one statement and returns columns + rows (positional, collision-safe). */
export function query(sql: string): QueryResult {
  const d = requireDb()
  const columns: string[] = []
  const rows: SqlValue[][] = []
  const t0 = performance.now()
  d.exec({ sql, rowMode: 'array', resultRows: rows, columnNames: columns })
  const elapsedMs = performance.now() - t0
  return {
    columns,
    rows,
    rowCount: rows.length,
    elapsedMs,
    changes: Number(d.changes()),
  }
}

/** Runs one or more statements, ignoring any result rows (DDL/DML/scripts). */
export function run(sql: string): void {
  requireDb().exec(sql)
}

export interface SqlDiagnostic {
  from: number
  to: number
  severity: 'error' | 'warning'
  message: string
}

/** Strips SQLite's internal "SQLITE_ERROR: sqlite3 result code N:" prefix. */
export function cleanSqlMessage(message: string): string {
  return message
    .replace(/^SQLITE_[A-Z]+:\s*/, '')
    .replace(/^sqlite3 result code \d+:\s*/, '')
}

function rangeFromMessage(text: string, message: string): { from: number; to: number } | null {
  const near = /near "([^"]+)"/.exec(message)
  if (near) {
    const idx = text.indexOf(near[1])
    if (idx >= 0) return { from: idx, to: idx + near[1].length }
  }
  const noSuch = /no such (?:column|table|function|module): ([A-Za-z0-9_.]+)/.exec(message)
  if (noSuch) {
    const name = noSuch[1].split('.').pop() ?? noSuch[1]
    const idx = text.indexOf(name)
    if (idx >= 0) return { from: idx, to: idx + name.length }
  }
  return null
}

/**
 * Validates SQL against the real SQLite engine by compiling it with prepare()
 * (no execution). Returns a diagnostic with a precise range for syntax errors,
 * unknown tables/columns/functions, etc. "Incomplete input" (mid-typing) is
 * intentionally ignored so the editor doesn't flag every partial keystroke.
 */
export function validateSql(text: string): SqlDiagnostic[] {
  if (!db || !sqlite3) return []
  if (!text.trim()) return []

  let stmt: ReturnType<Database['prepare']> | undefined
  try {
    stmt = db.prepare(text)
    return []
  } catch (err) {
    const message = cleanSqlMessage(err instanceof Error ? err.message : String(err))
    if (/incomplete input/i.test(message)) return []

    const rawOffset = sqlite3.capi.sqlite3_error_offset(db)
    const offset = typeof rawOffset === 'number' ? rawOffset : -1

    let range: { from: number; to: number } | null = null
    if (offset >= 0 && offset <= text.length) {
      const token = /^[A-Za-z0-9_$]+/.exec(text.slice(offset))
      range = { from: offset, to: offset + (token ? token[0].length : 1) }
    }
    range ??= rangeFromMessage(text, message)
    if (!range) {
      const from = text.length - text.trimStart().length
      range = { from, to: Math.max(from + 1, text.trimEnd().length) }
    }

    return [{ ...range, severity: 'error', message }]
  } finally {
    stmt?.finalize()
  }
}

export function getRowCount(): number {
  return Number(requireDb().selectValue('SELECT count(*) FROM requests') ?? 0)
}

export function getSchema(): TableSchema[] {
  return introspectSchema(requireDb())
}

/** Serializes the DB to bytes and writes the snapshot to IndexedDB. */
export async function persist(): Promise<void> {
  const s = sqlite3
  if (!s) return
  const bytes = s.capi.sqlite3_js_db_export(requireDb())
  await saveSnapshot(bytes)
}

export async function resetAndSeed(count: number): Promise<number> {
  const d = requireDb()
  d.exec('DROP TABLE IF EXISTS requests;')
  d.exec(SCHEMA_SQL)
  await seed(d, { count })
  await persist()
  return getRowCount()
}

export async function seedMore(count: number): Promise<number> {
  await seed(requireDb(), { count, append: true })
  await persist()
  return getRowCount()
}

export async function clearAll(): Promise<number> {
  const d = requireDb()
  d.exec('DROP TABLE IF EXISTS requests;')
  d.exec(SCHEMA_SQL)
  await clearSnapshot()
  return getRowCount()
}
