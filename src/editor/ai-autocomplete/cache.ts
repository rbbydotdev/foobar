import type { InlineAutocompleteContext, InlineCompletionItem } from "./types";

interface CacheEntry {
  readonly key: string;
  readonly prefix: string;
  readonly suffix: string;
  readonly item: InlineCompletionItem;
  readonly createdAt: number;
}

export interface InlineCompletionCacheOptions {
  readonly maxEntries?: number;
  readonly ttlMs?: number;
}

const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_TTL_MS = 10_000;

function cacheKey(context: InlineAutocompleteContext): string {
  return [
    context.providerId ?? "",
    context.modelId ?? "",
    context.languageId ?? "",
    context.path ?? "",
    context.prefix,
    context.suffix,
  ].join("\u0000");
}

export class InlineCompletionCache {
  readonly #maxEntries: number;
  readonly #ttlMs: number;
  readonly #entries = new Map<string, CacheEntry>();

  constructor(options: InlineCompletionCacheOptions = {}) {
    this.#maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.#ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  get(context: InlineAutocompleteContext): InlineCompletionItem | null {
    const now = Date.now();
    const key = cacheKey(context);
    const exact = this.#entries.get(key);
    if (exact && now - exact.createdAt <= this.#ttlMs) {
      this.#entries.delete(key);
      this.#entries.set(key, exact);
      return exact.item;
    }

    if (exact) this.#entries.delete(key);

    for (const [entryKey, entry] of this.#entries) {
      if (now - entry.createdAt > this.#ttlMs) {
        this.#entries.delete(entryKey);
        continue;
      }
      if (entry.suffix !== context.suffix) continue;
      if (!context.prefix.startsWith(entry.prefix)) continue;
      const typedIntoSuggestion = context.prefix.slice(entry.prefix.length);
      if (!entry.item.insertText.startsWith(typedIntoSuggestion)) continue;
      const remaining = entry.item.insertText.slice(typedIntoSuggestion.length);
      if (!remaining) continue;
      return {
        ...entry.item,
        insertText: remaining,
        displayText: entry.item.displayText?.startsWith(typedIntoSuggestion)
          ? entry.item.displayText.slice(typedIntoSuggestion.length)
          : remaining,
        range: { from: context.position.offset, to: context.position.offset },
      };
    }

    return null;
  }

  set(context: InlineAutocompleteContext, item: InlineCompletionItem): void {
    const key = cacheKey(context);
    this.#entries.set(key, {
      key,
      prefix: context.prefix,
      suffix: context.suffix,
      item,
      createdAt: Date.now(),
    });
    while (this.#entries.size > this.#maxEntries) {
      const first = this.#entries.keys().next();
      if (first.done) return;
      this.#entries.delete(first.value);
    }
  }

  clear(): void {
    this.#entries.clear();
  }
}
