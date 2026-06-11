import type { SqlValue } from '@sqlite.org/sqlite-wasm'

export type { SqlValue }

/** Result of running a single SQL statement. */
export interface QueryResult {
  /** Column names, in order. Empty for non-SELECT statements. */
  columns: string[]
  /** Rows as positional arrays (collision-safe for duplicate column names). */
  rows: SqlValue[][]
  rowCount: number
  elapsedMs: number
  /** Rows affected by the last INSERT/UPDATE/DELETE. */
  changes: number
}

export interface ColumnInfo {
  name: string
  type: string
  notNull: boolean
  pk: boolean
}

export interface TableSchema {
  name: string
  columns: ColumnInfo[]
}
