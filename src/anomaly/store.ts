import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { injectScenario, useDb } from '@/db'

interface AnomalyState {
  /** Whether detected anomalies steer the AI autocomplete. Default on. */
  steerAutocomplete: boolean
  /** Scenario id currently being injected, if any. */
  injecting: string | null
  setSteer: (value: boolean) => void
  inject: (id: string) => Promise<void>
}

export const useAnomaly = create<AnomalyState>()(
  persist(
    (set, get) => ({
      steerAutocomplete: true,
      injecting: null,
      setSteer: (steerAutocomplete) => set({ steerAutocomplete }),
      inject: async (id) => {
        if (get().injecting) return
        set({ injecting: id })
        try {
          await injectScenario(id)
          useDb.getState().markChanged()
        } finally {
          set({ injecting: null })
        }
      },
    }),
    { name: 'foobar-anomaly', partialize: (s) => ({ steerAutocomplete: s.steerAutocomplete }) },
  ),
)
