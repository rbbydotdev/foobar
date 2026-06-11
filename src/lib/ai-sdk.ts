// Lazily loads the Vercel AI SDK + OpenRouter provider so they stay out of the
// initial bundle and only download when AI features are actually used.

export interface AiSdk {
  createOpenRouter: typeof import('@openrouter/ai-sdk-provider').createOpenRouter
  generateText: typeof import('ai').generateText
}

let sdkPromise: Promise<AiSdk> | null = null

export function loadAiSdk(): Promise<AiSdk> {
  sdkPromise ??= Promise.all([import('@openrouter/ai-sdk-provider'), import('ai')]).then(
    ([openrouter, ai]) => ({
      createOpenRouter: openrouter.createOpenRouter,
      generateText: ai.generateText,
    }),
  )
  return sdkPromise
}
