import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

/** Editor chrome, wired to the shadcn theme tokens so it follows light/dark. */
const editorChrome = EditorView.theme({
  '&': {
    color: 'var(--foreground)',
    backgroundColor: 'transparent',
    fontSize: '13px',
    minHeight: '120px',
    maxHeight: '42vh',
  },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    padding: '10px 0',
    caretColor: 'var(--foreground)',
  },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6', overflow: 'auto' },
  '&.cm-focused': { outline: 'none' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'color-mix(in oklch, var(--muted-foreground) 80%, transparent)',
    border: 'none',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--foreground)' },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in oklch, var(--foreground) 4%, transparent)',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in oklch, var(--primary) 22%, transparent)',
  },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'color-mix(in oklch, var(--primary) 22%, transparent)',
    outline: '1px solid color-mix(in oklch, var(--primary) 40%, transparent)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: '0 8px 24px color-mix(in oklch, var(--foreground) 14%, transparent)',
    overflow: 'hidden',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    maxHeight: '16rem',
  },
  '.cm-tooltip-autocomplete > ul > li': { padding: '2px 8px' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-foreground)',
  },
  '.cm-completionLabel': { fontFamily: 'var(--font-mono)' },
  '.cm-completionDetail': { color: 'var(--muted-foreground)', fontStyle: 'normal', fontFamily: 'var(--font-mono)' },
  '.cm-completionIcon': { opacity: '0.6', paddingRight: '0.6em' },

  // Squiggly underlines painted as a repeating SVG so they render crisply
  // (the default lint underline looks fuzzy at small sizes).
  '.cm-lintRange-error': {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 2.5 L1.5 0.5 L3 2.5 L4.5 0.5 L6 2.5' fill='none' stroke='%23ef4444' stroke-width='0.9'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat-x',
    backgroundPosition: 'bottom left',
    backgroundSize: '6px 3px',
    paddingBottom: '1px',
  },
  '.cm-lintRange-warning': {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 2.5 L1.5 0.5 L3 2.5 L4.5 0.5 L6 2.5' fill='none' stroke='%23e5a700' stroke-width='0.9'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat-x',
    backgroundPosition: 'bottom left',
    backgroundSize: '6px 3px',
    paddingBottom: '1px',
  },
  '.cm-tooltip.cm-tooltip-lint': { padding: '0', maxWidth: '24rem' },
  '.cm-diagnostic': {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    padding: '4px 8px',
    borderLeftWidth: '3px',
  },
  '.cm-diagnostic-error': { borderLeftColor: 'var(--destructive)' },
  '.cm-diagnostic-warning': { borderLeftColor: '#e5a700' },

  // Schema field hover tooltip.
  '.cm-schema-tip': {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    padding: '6px 8px',
    minWidth: '12rem',
    maxWidth: '22rem',
  },
  '.cm-schema-tip-head': {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    paddingBottom: '2px',
  },
  '.cm-schema-tip-kind': {
    textTransform: 'uppercase',
    fontSize: '9px',
    letterSpacing: '0.1em',
    color: 'var(--muted-foreground)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '0 4px',
  },
  '.cm-schema-tip-name': { fontWeight: '600', color: 'var(--cm-function)' },
  '.cm-schema-tip-type': { marginLeft: 'auto', color: 'var(--cm-type)' },
  '.cm-schema-tip-badge': {
    fontSize: '9px',
    color: 'var(--primary)',
    border: '1px solid color-mix(in oklch, var(--primary) 40%, transparent)',
    borderRadius: '4px',
    padding: '0 4px',
  },
  '.cm-schema-tip-cols': {
    marginTop: '4px',
    borderTop: '1px solid var(--border)',
    paddingTop: '4px',
    display: 'grid',
    gap: '1px',
  },
  '.cm-schema-tip-col': { display: 'flex', alignItems: 'center', gap: '8px' },
  '.cm-schema-tip-colname': { color: 'var(--cm-property)' },
})

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--cm-keyword)', fontWeight: '500' },
  { tag: [t.string, t.special(t.string)], color: 'var(--cm-string)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--cm-number)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--cm-function)' },
  { tag: t.operator, color: 'var(--cm-operator)' },
  { tag: [t.lineComment, t.blockComment], color: 'var(--cm-comment)', fontStyle: 'italic' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--cm-property)' },
  { tag: t.typeName, color: 'var(--cm-type)' },
  { tag: t.variableName, color: 'var(--foreground)' },
  { tag: [t.punctuation, t.separator, t.bracket], color: 'var(--muted-foreground)' },
])

export const sqlEditorTheme: Extension = [editorChrome, syntaxHighlighting(highlight)]
