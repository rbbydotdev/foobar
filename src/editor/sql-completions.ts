import type { SQLNamespace } from '@codemirror/lang-sql'
import type { TableSchema } from '@/db'

/** Maps the introspected DB schema into lang-sql's completion namespace. */
export function schemaToNamespace(schema: TableSchema[]): SQLNamespace {
  const namespace: Record<string, string[]> = {}
  for (const table of schema) {
    namespace[table.name] = table.columns.map((c) => c.name)
  }
  return namespace
}

/** With a single table, offer its columns unqualified. */
export function defaultTableName(schema: TableSchema[]): string | undefined {
  return schema.length === 1 ? schema[0].name : undefined
}
