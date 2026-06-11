import type { LanguageModel } from 'ai'
import type { TableSchema } from '@/db'
import { loadAiSdk } from '@/lib/ai-sdk'
import type { InlineAutocompleteProvider } from './types'
import { buildCompletionPrompt, buildEditPrompt } from './prompts'

export interface OpenRouterCompletionOptions {
  apiKey: string
  model: string
  /** Read lazily so completions always use the current schema. */
  getSchema: () => TableSchema[]
  /** Active anomaly-scenario hints to steer completions, read lazily. */
  getAnomalyHints?: () => string[]
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
  let modelRef: LanguageModel | null = null

  async function resolve() {
    const sdk = await loadAiSdk()
    modelRef ??= sdk.createOpenRouter({ apiKey: options.apiKey }).chat(options.model)
    return { generateText: sdk.generateText, model: modelRef }
  }

  return {
    id: `openrouter:${options.model}`,

    async provideInlineCompletions(context, signal) {
      const { generateText, model } = await resolve()
      const { system, prompt } = buildCompletionPrompt(
        context,
        options.getSchema(),
        options.getAnomalyHints?.() ?? [],
      )
      const result = await generateText({
        model,
        system,
        prompt,
        abortSignal: signal,
        temperature: 0.1,
        maxOutputTokens: 400,
      })
      return sanitize(result.text, 2000) || null
    },

    async provideInlineEdit(context, signal) {
      const { generateText, model } = await resolve()
      const { system, prompt } = buildEditPrompt(
        context,
        options.getSchema(),
        options.getAnomalyHints?.() ?? [],
      )
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
