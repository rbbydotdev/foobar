/** A saved OpenRouter provider: a named API key plus a chosen model. */
export interface ProviderRecord {
  id: string
  label: string
  apiKey: string
  model: string
  createdAt: number
}

/** Whether anomalous rows get sent to the model for explanation. */
export type AnomalyMode = 'off' | 'manual' | 'auto'

/** Shareable subset encoded into the ?provider= link. */
export interface SharePayload {
  label: string
  apiKey: string
  model: string
}
