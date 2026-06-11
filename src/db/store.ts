import { create } from 'zustand'
import * as db from './sqlite'
import type { TableSchema } from './types'

export type DbStatus = 'idle' | 'loading' | 'ready' | 'error'

interface DbStore {
  status: DbStatus
  error: string | null
  rowCount: number
  /** Bumped whenever data changes (reset/seed) so dependent queries refetch. */
  dataVersion: number
  busy: boolean
  schema: TableSchema[]
  init: () => Promise<void>
  reset: (count: number) => Promise<void>
  seedMore: (count: number) => Promise<void>
  /** Call after an imperative write so dependent queries refetch. */
  markChanged: () => void
}

export const useDb = create<DbStore>((set, get) => ({
  status: 'idle',
  error: null,
  rowCount: 0,
  dataVersion: 0,
  busy: false,
  schema: [],
  init: async () => {
    if (get().status !== 'idle') return
    set({ status: 'loading' })
    try {
      const result = await db.initDatabase()
      set({
        status: 'ready',
        rowCount: result.rowCount,
        schema: db.getSchema(),
        dataVersion: get().dataVersion + 1,
      })
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  },
  reset: async (count) => {
    set({ busy: true })
    try {
      const rowCount = await db.resetAndSeed(count)
      set({ rowCount, schema: db.getSchema(), dataVersion: get().dataVersion + 1 })
    } finally {
      set({ busy: false })
    }
  },
  seedMore: async (count) => {
    set({ busy: true })
    try {
      const rowCount = await db.seedMore(count)
      set({ rowCount, schema: db.getSchema(), dataVersion: get().dataVersion + 1 })
    } finally {
      set({ busy: false })
    }
  },
  markChanged: () =>
    set((s) => {
      let rowCount = s.rowCount
      let schema = s.schema
      try {
        rowCount = db.getRowCount()
      } catch {
        rowCount = 0
      }
      try {
        schema = db.getSchema()
      } catch {
        // table list unavailable (e.g. requests dropped); keep previous
      }
      return { dataVersion: s.dataVersion + 1, rowCount, schema }
    }),
}))
