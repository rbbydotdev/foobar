import type { TableSchema } from '@/db'
import type { InlineAutocompleteContext, InlineEditContext } from './types'

export function schemaText(schema: TableSchema[]): string {
  return schema
    .map((t) => `${t.name}(${t.columns.map((c) => `${c.name} ${c.type || 'ANY'}`).join(', ')})`)
    .join('\n')
}

const COMPLETION_SYSTEM = `You are an inline autocomplete engine for SQLite SQL inside a query editor.
Complete the statement at the <CURSOR> marker. Output ONLY the raw text to insert at the cursor.
Rules:
- No explanations, no markdown, no code fences, no backticks.
- Continue the existing statement naturally (finish the current clause or expression).
- Use only the tables and columns in the provided schema.
- Keep it short — usually the rest of the current clause, not the whole query.
- If nothing useful should be inserted, output nothing.`

export function buildCompletionPrompt(
  context: InlineAutocompleteContext,
  schema: TableSchema[],
): { system: string; prompt: string } {
  const prompt = `SQLite schema:
${schemaText(schema)}

Complete the SQL at <CURSOR>:
${context.prefix}<CURSOR>${context.suffix}`
  return { system: COMPLETION_SYSTEM, prompt }
}

const EDIT_SYSTEM = `You edit SQLite SQL. Apply the user's instruction and return ONLY the replacement SQL for the selected section.
No markdown, no backticks, no commentary. Keep it valid SQLite using only the provided schema.`

export function buildEditPrompt(
  context: InlineEditContext,
  schema: TableSchema[],
): { system: string; prompt: string } {
  const prompt = `SQLite schema:
${schemaText(schema)}

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
