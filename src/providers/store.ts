import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { AnomalyMode, ProviderRecord } from './types'

interface ProvidersState {
  providers: ProviderRecord[]
  activeProviderId: string | null
  autocompleteEnabled: boolean
  debounceMs: number
  anomalyMode: AnomalyMode

  addProvider: (input: { label: string; apiKey: string; model: string }) => ProviderRecord
  updateProvider: (
    id: string,
    patch: Partial<Pick<ProviderRecord, 'label' | 'apiKey' | 'model'>>,
  ) => void
  removeProvider: (id: string) => void
  setActiveProvider: (id: string | null) => void
  /** Set the model on the currently active provider. */
  setActiveModel: (model: string) => void
  setAutocompleteEnabled: (enabled: boolean) => void
  setDebounceMs: (ms: number) => void
  setAnomalyMode: (mode: AnomalyMode) => void
  /** Add a shared provider unless an identical one (key+model) already exists. */
  importSharedProvider: (input: {
    label: string
    apiKey: string
    model: string
  }) => { added: boolean; id: string }
}

export const useProviders = create<ProvidersState>()(
  persist(
    (set, get) => ({
      providers: [],
      activeProviderId: null,
      autocompleteEnabled: false,
      debounceMs: 350,
      anomalyMode: 'off',

      addProvider: ({ label, apiKey, model }) => {
        const record: ProviderRecord = {
          id: nanoid(),
          label: label.trim() || 'OpenRouter',
          apiKey: apiKey.trim(),
          model: model.trim(),
          createdAt: Date.now(),
        }
        set((s) => ({
          providers: [...s.providers, record],
          activeProviderId: s.activeProviderId ?? record.id,
        }))
        return record
      },

      updateProvider: (id, patch) =>
        set((s) => ({
          providers: s.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      removeProvider: (id) =>
        set((s) => {
          const providers = s.providers.filter((p) => p.id !== id)
          const activeProviderId =
            s.activeProviderId === id ? (providers[0]?.id ?? null) : s.activeProviderId
          return { providers, activeProviderId }
        }),

      setActiveProvider: (id) => set({ activeProviderId: id }),

      setActiveModel: (model) =>
        set((s) => ({
          providers: s.providers.map((p) =>
            p.id === s.activeProviderId ? { ...p, model } : p,
          ),
        })),

      setAutocompleteEnabled: (autocompleteEnabled) => set({ autocompleteEnabled }),
      setDebounceMs: (debounceMs) => set({ debounceMs }),
      setAnomalyMode: (anomalyMode) => set({ anomalyMode }),

      importSharedProvider: ({ label, apiKey, model }) => {
        const existing = get().providers.find(
          (p) => p.apiKey === apiKey && p.model === model,
        )
        if (existing) {
          set({ activeProviderId: existing.id })
          return { added: false, id: existing.id }
        }
        const record: ProviderRecord = {
          id: nanoid(),
          label: label.trim() || 'Shared provider',
          apiKey: apiKey.trim(),
          model: model.trim(),
          createdAt: Date.now(),
        }
        set((s) => ({
          providers: [...s.providers, record],
          activeProviderId: record.id,
          autocompleteEnabled: true,
        }))
        return { added: true, id: record.id }
      },
    }),
    { name: 'foobar-providers' },
  ),
)

export function useActiveProvider(): ProviderRecord | null {
  return useProviders((s) => s.providers.find((p) => p.id === s.activeProviderId) ?? null)
}
