import type { TableSchema } from '@/db'
import { loadAiSdk } from '@/lib/ai-sdk'
import { schemaText } from '@/editor/ai-autocomplete/prompts'
import type { DataAnomaly } from './detect'

const SYSTEM = `You are an SRE assistant analyzing web-request analytics stored in a SQLite table.
Given an anomaly and sample rows, respond concisely in markdown with:
1. The most likely cause(s).
2. 2-3 SQLite queries (against the given schema) to investigate further.
Keep it tight — no preamble.`

export interface AnalyzeOptions {
  apiKey: string
  model: string
  schema: TableSchema[]
}

export async function analyzeAnomaly(anomaly: DataAnomaly, options: AnalyzeOptions): Promise<string> {
  const { createOpenRouter, generateText } = await loadAiSdk()
  const client = createOpenRouter({ apiKey: options.apiKey })
  const metricsText = Object.entries(anomaly.metrics)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')
  const sampleText = [
    anomaly.sample.columns.join(' | '),
    ...anomaly.sample.rows.map((r) => r.map((c) => (c === null ? 'NULL' : String(c))).join(' | ')),
  ].join('\n')

  const result = await generateText({
    model: client.chat(options.model),
    system: SYSTEM,
    prompt: `SQLite schema:
${schemaText(options.schema)}

Anomaly: ${anomaly.title}
${anomaly.summary}

Metrics:
${metricsText}

Sample offending rows:
${sampleText}`,
    temperature: 0.3,
    maxOutputTokens: 600,
  })

  return result.text.trim()
}
