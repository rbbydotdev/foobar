export type StatementKind = 'read' | 'write' | 'empty'

const READ_KEYWORDS = new Set(['SELECT', 'EXPLAIN', 'PRAGMA', 'VALUES'])
const WRITE_WORD = /\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|VACUUM|REINDEX|ATTACH|DETACH)\b/i

function stripComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()
}

/**
 * Classifies a statement so the editor can auto-run read-only queries as you
 * type while requiring an explicit run for anything that mutates data.
 * A `WITH` CTE is treated as a write if it wraps a mutating statement.
 */
export function classifyStatement(sql: string): StatementKind {
  const stripped = stripComments(sql)
  if (!stripped) return 'empty'

  const keyword = (stripped.match(/^[a-zA-Z]+/)?.[0] ?? '').toUpperCase()
  if (READ_KEYWORDS.has(keyword)) return 'read'
  if (keyword === 'WITH') return WRITE_WORD.test(stripped) ? 'write' : 'read'
  return 'write'
}
