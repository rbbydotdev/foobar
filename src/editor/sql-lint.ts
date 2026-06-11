import { linter } from '@codemirror/lint'
import type { Diagnostic } from '@codemirror/lint'
import { validateSql } from '@/db'

/** Debounced linter that surfaces real SQLite compile errors as squigglies. */
export function sqlLinter() {
  return linter(
    (view) =>
      validateSql(view.state.doc.toString()).map(
        (d): Diagnostic => ({
          from: d.from,
          to: d.to,
          severity: d.severity,
          message: d.message,
        }),
      ),
    { delay: 350 },
  )
}
