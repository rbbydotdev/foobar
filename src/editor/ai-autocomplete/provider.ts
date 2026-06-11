import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText } from 'ai'
import type { TableSchema } from '@/db'
import type { InlineAutocompleteProvider } from './types'
import { buildCompletionPrompt, buildEditPrompt } from './prompts'

export interface OpenRouterCompletionOptions {
  apiKey: string
  model: string
  /** Read lazily so completions always use the current schema. */
  getSchema: () => TableSchema[]
}

function sanitize(raw: string, maxLen: number): string {
  let text = raw
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/\n?```$/, '')
    .replace(/<CURSOR>/g, '')
    .replace(/[ \t\r\n]+$/, '')
  if (text.length > maxLen) text = text.slice(0, maxLen)
  return text
}

/** An InlineAutocompleteProvider backed by OpenRouter via the Vercel AI SDK. */
export function createOpenRouterCompletionProvider(
  options: OpenRouterCompletionOptions,
): InlineAutocompleteProvider {
  const client = createOpenRouter({ apiKey: options.apiKey })
  const model = client.chat(options.model)

  return {
    id: `openrouter:${options.model}`,

    async provideInlineCompletions(context, signal) {
      const { system, prompt } = buildCompletionPrompt(context, options.getSchema())
      const result = await generateText({
        model,
        system,
        prompt,
        abortSignal: signal,
        temperature: 0.1,
        maxOutputTokens: 160,
      })
      return sanitize(result.text, 400) || null
    },

    async provideInlineEdit(context, signal) {
      const { system, prompt } = buildEditPrompt(context, options.getSchema())
      const result = await generateText({
        model,
        system,
        prompt,
        abortSignal: signal,
        temperature: 0.2,
        maxOutputTokens: 600,
      })
      return sanitize(result.text, 4000) || null
    },
  }
}
