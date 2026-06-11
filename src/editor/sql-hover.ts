import { hoverTooltip } from '@codemirror/view'
import type { ColumnInfo, TableSchema } from '@/db'

const IDENT = /[A-Za-z0-9_$]/

function wordAt(text: string, pos: number): { from: number; to: number; word: string } | null {
  let from = pos
  let to = pos
  while (from > 0 && IDENT.test(text[from - 1])) from--
  while (to < text.length && IDENT.test(text[to])) to++
  if (from === to) return null
  return { from, to, word: text.slice(from, to) }
}

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

function tableDom(table: TableSchema): HTMLElement {
  const root = el('div', 'cm-schema-tip')
  const head = el('div', 'cm-schema-tip-head')
  head.append(el('span', 'cm-schema-tip-kind', 'table'), el('span', 'cm-schema-tip-name', table.name))
  root.append(head)
  const list = el('div', 'cm-schema-tip-cols')
  for (const c of table.columns) {
    const row = el('div', 'cm-schema-tip-col')
    row.append(el('span', 'cm-schema-tip-colname', c.name), el('span', 'cm-schema-tip-type', c.type || 'ANY'))
    if (c.pk) row.append(el('span', 'cm-schema-tip-badge', 'PK'))
    list.append(row)
  }
  root.append(list)
  return root
}

function columnDom(matches: Array<{ table: string; col: ColumnInfo }>): HTMLElement {
  const root = el('div', 'cm-schema-tip')
  for (const m of matches) {
    const row = el('div', 'cm-schema-tip-head')
    row.append(
      el('span', 'cm-schema-tip-kind', 'column'),
      el('span', 'cm-schema-tip-name', `${m.table}.${m.col.name}`),
      el('span', 'cm-schema-tip-type', m.col.type || 'ANY'),
    )
    if (m.col.pk) row.append(el('span', 'cm-schema-tip-badge', 'PK'))
    if (m.col.notNull) row.append(el('span', 'cm-schema-tip-badge', 'NOT NULL'))
    root.append(row)
  }
  return root
}

/** Hovering a table/column name shows its definition from the live schema. */
export function sqlHover(getSchema: () => TableSchema[]) {
  return hoverTooltip(
    (view, pos) => {
      const text = view.state.doc.toString()
      const word = wordAt(text, pos)
      if (!word) return null
      const schema = getSchema()
      const lower = word.word.toLowerCase()

      const table = schema.find((t) => t.name.toLowerCase() === lower)
      if (table) {
        return { pos: word.from, end: word.to, above: true, create: () => ({ dom: tableDom(table) }) }
      }

      const matches = schema.flatMap((t) =>
        t.columns
          .filter((c) => c.name.toLowerCase() === lower)
          .map((col) => ({ table: t.name, col })),
      )
      if (matches.length) {
        return { pos: word.from, end: word.to, above: true, create: () => ({ dom: columnDom(matches) }) }
      }
      return null
    },
    { hoverTime: 250 },
  )
}
