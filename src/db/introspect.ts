import type { Database } from '@sqlite.org/sqlite-wasm'
import type { ColumnInfo, SqlValue, TableSchema } from './types'

/** Reads tables + columns via sqlite_master and PRAGMA table_info. */
export function introspectSchema(db: Database): TableSchema[] {
  const tableRows: Array<Record<string, SqlValue>> = []
  db.exec({
    sql: `SELECT name FROM sqlite_master
          WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
          ORDER BY name`,
    rowMode: 'object',
    resultRows: tableRows,
  })

  const schema: TableSchema[] = []
  for (const t of tableRows) {
    const table = String(t.name)
    const colRows: Array<Record<string, SqlValue>> = []
    db.exec({
      sql: `PRAGMA table_info('${table.replace(/'/g, "''")}')`,
      rowMode: 'object',
      resultRows: colRows,
    })
    const columns: ColumnInfo[] = colRows.map((c) => ({
      name: String(c.name),
      type: String(c.type ?? ''),
      notNull: Number(c.notnull) === 1,
      pk: Number(c.pk) === 1,
    }))
    schema.push({ name: table, columns })
  }
  return schema
}
