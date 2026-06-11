import { useMemo } from 'react'
import type { Extension } from '@codemirror/state'
import { useDb } from '@/db'
import { useActiveProvider, useProviders } from '@/providers/store'
import { aiAutocomplete, createOpenRouterCompletionProvider } from './ai-autocomplete'

/**
 * Builds the ghost-text AI extension from the active OpenRouter provider and
 * autocomplete settings. Returns undefined when AI autocomplete is off or no
 * provider/model is configured (the editor then runs schema completions only).
 */
export function useAiAutocompleteExtension(): Extension | undefined {
  const enabled = useProviders((s) => s.autocompleteEnabled)
  const debounceMs = useProviders((s) => s.debounceMs)
  const active = useActiveProvider()

  const apiKey = active?.apiKey
  const model = active?.model
  const providerId = active?.id

  return useMemo(() => {
    if (!enabled || !apiKey || !model) return undefined
    const provider = createOpenRouterCompletionProvider({
      apiKey,
      model,
      getSchema: () => useDb.getState().schema,
    })
    return aiAutocomplete({
      provider,
      providerId,
      modelId: model,
      path: 'query.sql',
      languageId: 'sql',
      debounceMs,
      maxPrefixChars: 2000,
      maxSuffixChars: 800,
      // ⇧⌘I opens the "ask AI to write/edit SQL" instruction popover.
      manualEditKey: 'Mod-Shift-i',
      onError: (error) => console.warn('[ai-autocomplete]', error),
    })
  }, [enabled, apiKey, model, providerId, debounceMs])
}
