import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm'
import { DEFAULT_SEED_COUNT, SCHEMA_SQL } from './schema'
import { seedRequests } from './seed'
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
  seedRequests(db, { count: DEFAULT_SEED_COUNT })
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
  seedRequests(d, { count })
  await persist()
  return getRowCount()
}

export async function seedMore(count: number): Promise<number> {
  seedRequests(requireDb(), { count, append: true })
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
