import { useQuery } from '@tanstack/react-query'
import { fetchOpenRouterModels } from './openrouter-models'
import type { OpenRouterModel } from './openrouter-models'

const CACHE_KEY = 'foobar.openrouter-models.v1'
const HOUR = 60 * 60 * 1000

interface Cached {
  models: OpenRouterModel[]
  fetchedAt: number
}

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Cached) : null
  } catch {
    return null
  }
}

function writeCache(models: OpenRouterModel[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ models, fetchedAt: Date.now() }))
  } catch {
    // storage full / unavailable — ignore
  }
}

/** OpenRouter model catalog, cached in localStorage and via TanStack Query. */
export function useOpenRouterModels(): { models: OpenRouterModel[]; loading: boolean } {
  const { data, isFetching } = useQuery({
    queryKey: ['openrouter-models'],
    queryFn: async () => {
      const models = await fetchOpenRouterModels()
      writeCache(models)
      return models
    },
    initialData: () => readCache()?.models,
    initialDataUpdatedAt: () => readCache()?.fetchedAt ?? 0,
    staleTime: HOUR,
    gcTime: 24 * HOUR,
    retry: 1,
  })

  return { models: data ?? [], loading: !data && isFetching }
}
