export interface OpenRouterModel {
  id: string
  name?: string
  contextLength?: number
  /** Prompt price per token (USD), if known. */
  promptPrice?: number
  /** Whether the model advertises tool/function-calling support. */
  tools?: boolean
}

interface RawModel {
  id?: string
  name?: string
  context_length?: number
  pricing?: { prompt?: string }
  supported_parameters?: string[]
}

// Surface mainstream providers first, then alphabetical.
const VENDOR_RANK = ['anthropic/', 'openai/', 'google/', 'meta-llama/', 'mistralai/', 'deepseek/', 'x-ai/', 'qwen/']

function vendorRank(id: string): number {
  const i = VENDOR_RANK.findIndex((prefix) => id.startsWith(prefix))
  return i === -1 ? VENDOR_RANK.length : i
}

export function sortModels(models: OpenRouterModel[]): OpenRouterModel[] {
  return [...models].sort((a, b) => {
    const ra = vendorRank(a.id)
    const rb = vendorRank(b.id)
    if (ra !== rb) return ra - rb
    return a.id.localeCompare(b.id)
  })
}

/** Public endpoint — no API key required to list models. */
export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models')
  if (!res.ok) throw new Error(`OpenRouter /models ${res.status}`)
  const body = (await res.json()) as { data?: RawModel[] }
  const models: OpenRouterModel[] = (body.data ?? [])
    .filter((m): m is RawModel & { id: string } => typeof m.id === 'string')
    .map((m) => ({
      id: m.id,
      name: m.name,
      contextLength: typeof m.context_length === 'number' ? m.context_length : undefined,
      promptPrice: m.pricing?.prompt ? Number(m.pricing.prompt) : undefined,
      tools: Array.isArray(m.supported_parameters)
        ? m.supported_parameters.includes('tools')
        : undefined,
    }))
  return sortModels(models)
}
