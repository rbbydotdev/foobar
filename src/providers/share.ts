import type { ProviderRecord, SharePayload } from './types'

const PARAM = 'provider'

function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Builds a shareable link that embeds the provider's model + API key. */
export function buildShareLink(provider: ProviderRecord): string {
  const payload: SharePayload = {
    label: provider.label,
    apiKey: provider.apiKey,
    model: provider.model,
  }
  const url = new URL(window.location.href)
  url.searchParams.set(PARAM, base64UrlEncode(JSON.stringify(payload)))
  return url.toString()
}

/** Reads and validates a ?provider= payload from a query string. */
export function decodeProviderParam(search: string): SharePayload | null {
  const raw = new URLSearchParams(search).get(PARAM)
  if (!raw) return null
  try {
    const parsed = JSON.parse(base64UrlDecode(raw)) as Partial<SharePayload>
    if (typeof parsed.apiKey === 'string' && typeof parsed.model === 'string') {
      return {
        label: typeof parsed.label === 'string' ? parsed.label : 'Shared provider',
        apiKey: parsed.apiKey,
        model: parsed.model,
      }
    }
  } catch {
    // malformed param — ignore
  }
  return null
}

/** Removes the ?provider= param from the address bar after import. */
export function stripProviderParam(): void {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(PARAM)) return
  url.searchParams.delete(PARAM)
  window.history.replaceState(null, '', url.toString())
}
