import type { SQLNamespace } from '@codemirror/lang-sql'
import type { Completion } from '@codemirror/autocomplete'
import type { TableSchema } from '@/db'

/** Maps the introspected DB schema into lang-sql's completion namespace,
 *  attaching column types so they show in the dropdown. */
export function schemaToNamespace(schema: TableSchema[]): SQLNamespace {
  const namespace: Record<string, Completion[]> = {}
  for (const table of schema) {
    namespace[table.name] = table.columns.map((c) => ({
      label: c.name,
      type: 'property',
      detail: c.type || undefined,
    }))
  }
  return namespace
}

/** With a single table, offer its columns unqualified. */
export function defaultTableName(schema: TableSchema[]): string | undefined {
  return schema.length === 1 ? schema[0].name : undefined
}
