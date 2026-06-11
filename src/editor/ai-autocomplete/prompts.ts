import type { TableSchema } from '@/db'
import type { InlineAutocompleteContext, InlineEditContext } from './types'

export function schemaText(schema: TableSchema[]): string {
  return schema
    .map((t) => `${t.name}(${t.columns.map((c) => `${c.name} ${c.type || 'ANY'}`).join(', ')})`)
    .join('\n')
}

const COMPLETION_SYSTEM = `You are an inline autocomplete engine for SQLite SQL inside a query editor.
Continue the statement at the <CURSOR> marker, completing it as fully as is useful — finish the
current clause and, when it makes sense, the rest of the statement, across multiple lines.
Output ONLY the raw text to insert at the cursor.
Rules:
- No explanations, no markdown, no code fences, no backticks.
- Do not repeat any text that already appears before the cursor.
- Use only the tables and columns in the provided schema.
- Prefer a complete, runnable statement over a tiny fragment.
- If nothing useful should be inserted, output nothing.`

function datasetNotes(hints: string[]): string {
  if (hints.length === 0) return ''
  return `\n\nDataset notes (the user is likely investigating these — bias completions toward relevant queries):\n${hints.map((h) => `- ${h}`).join('\n')}`
}

export function buildCompletionPrompt(
  context: InlineAutocompleteContext,
  schema: TableSchema[],
  hints: string[] = [],
): { system: string; prompt: string } {
  const prompt = `SQLite schema:
${schemaText(schema)}${datasetNotes(hints)}

Complete the SQL at <CURSOR>:
${context.prefix}<CURSOR>${context.suffix}`
  return { system: COMPLETION_SYSTEM, prompt }
}

const EDIT_SYSTEM = `You are a SQL copilot for SQLite. Follow the user's instruction to write or edit SQL.
Return ONLY the SQL that should replace the selected section (or be inserted at the cursor if nothing is selected).
No markdown, no backticks, no commentary. When asked to write a query, produce a complete, runnable statement.
Use only the tables and columns in the provided schema.`

export function buildEditPrompt(
  context: InlineEditContext,
  schema: TableSchema[],
  hints: string[] = [],
): { system: string; prompt: string } {
  const prompt = `SQLite schema:
${schemaText(schema)}${datasetNotes(hints)}

Code before selection:
${context.codeBefore}

Selected section:
${context.selectedText || '(empty — insert at the cursor)'}

Code after selection:
${context.codeAfter}

Instruction: ${context.instruction}

Replacement for the selected section:`
  return { system: EDIT_SYSTEM, prompt }
}
