import { useEffect, useRef } from 'react'
import { EditorState, Annotation, Compartment, Prec } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { sql, SQLite } from '@codemirror/lang-sql'
import type { TableSchema } from '@/db'
import { sqlEditorTheme } from './theme'
import { defaultTableName, schemaToNamespace } from './sql-completions'
import { sqlLinter } from './sql-lint'
import { sqlHover } from './sql-hover'

const External = Annotation.define<boolean>()

function buildSqlExtension(schema: TableSchema[]): Extension {
  return sql({
    dialect: SQLite,
    schema: schemaToNamespace(schema),
    defaultTable: defaultTableName(schema),
    upperCaseKeywords: true,
  })
}

export interface SqlEditorProps {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  schema: TableSchema[]
  /** AI ghost-text extension, swapped in via a compartment (Phase 5). */
  aiExtension?: Extension
  placeholder?: string
  className?: string
}

export function SqlEditor({
  value,
  onChange,
  onRun,
  schema,
  aiExtension,
  placeholder = 'SELECT * FROM requests …',
  className,
}: SqlEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const sqlCompartment = useRef(new Compartment()).current
  const aiCompartment = useRef(new Compartment()).current

  // Keep latest callbacks/props reachable from the stable mount effect.
  const onChangeRef = useRef(onChange)
  const onRunRef = useRef(onRun)
  const schemaRef = useRef(schema)
  onChangeRef.current = onChange
  onRunRef.current = onRun
  schemaRef.current = schema

  // Mount the editor exactly once.
  useEffect(() => {
    const parent = containerRef.current
    if (!parent) return

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          EditorView.lineWrapping,
          cmPlaceholder(placeholder),
          sqlCompartment.of(buildSqlExtension(schema)),
          aiCompartment.of(aiExtension ?? []),
          sqlLinter(),
          sqlHover(() => schemaRef.current),
          sqlEditorTheme,
          Prec.highest(
            keymap.of([
              {
                key: 'Mod-Enter',
                run: () => {
                  onRunRef.current()
                  return true
                },
              },
            ]),
          ),
          EditorView.updateListener.of((update) => {
            if (
              update.docChanged &&
              !update.transactions.some((tr) => tr.annotation(External))
            ) {
              onChangeRef.current(update.state.doc.toString())
            }
          }),
        ],
      }),
    })
    viewRef.current = view
    if (import.meta.env.DEV) {
      ;(window as unknown as { __cmView?: EditorView }).__cmView = view
    }
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Mount-only: subsequent prop changes are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external value into the document without clobbering the cursor.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (value === current) return
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      annotations: External.of(true),
    })
  }, [value])

  // Reconfigure schema-aware completions when the schema changes.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: sqlCompartment.reconfigure(buildSqlExtension(schema)),
    })
  }, [schema, sqlCompartment])

  // Swap the AI ghost-text extension in/out.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: aiCompartment.reconfigure(aiExtension ?? []),
    })
  }, [aiExtension, aiCompartment])

  return (
    <div
      ref={containerRef}
      data-testid="sql-editor"
      className={className}
    />
  )
}
