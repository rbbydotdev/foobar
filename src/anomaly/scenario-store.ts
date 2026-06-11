import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { injectScenario, useDb } from '@/db'
import { ANOMALY_SCENARIOS } from './scenarios'

interface ScenarioState {
  /** Active scenario ids (injected + steering the AI autocomplete). */
  active: string[]
  /** Scenario id currently being injected, if any. */
  injecting: string | null
  enable: (id: string) => Promise<void>
  disable: (id: string) => void
  /** Clear all (e.g. after a data reset). */
  reset: () => void
  /** Hints for the active scenarios, fed to the AI prompt. */
  activeHints: () => string[]
}

export const useScenarios = create<ScenarioState>()(
  persist(
    (set, get) => ({
      active: [],
      injecting: null,

      enable: async (id) => {
        if (get().active.includes(id) || get().injecting) return
        set({ injecting: id })
        try {
          await injectScenario(id)
          set((s) => ({ active: [...s.active, id] }))
          useDb.getState().markChanged()
        } finally {
          set({ injecting: null })
        }
      },

      disable: (id) => set((s) => ({ active: s.active.filter((x) => x !== id) })),

      reset: () => set({ active: [] }),

      activeHints: () => {
        const active = get().active
        return ANOMALY_SCENARIOS.filter((s) => active.includes(s.id)).map((s) => s.hint)
      },
    }),
    { name: 'foobar-scenarios', partialize: (s) => ({ active: s.active }) },
  ),
)
