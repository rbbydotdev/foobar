import { query } from '@/db'
import type { SqlValue } from '@/db'

export interface AnomalySample {
  columns: string[]
  rows: SqlValue[][]
}

export interface Anomaly {
  /** Stable id used to dedupe analysis across re-detection. */
  signature: string
  title: string
  summary: string
  metrics: Record<string, string | number>
  sample: AnomalySample
}

function esc(value: string): string {
  return value.replace(/'/g, "''")
}

/**
 * Scans the requests table for server-error (5xx) spikes — clusters of failures
 * concentrated on one endpoint. This is what the seed data intentionally plants.
 */
export function detectAnomalies(): Anomaly[] {
  const spikes = query(`
    SELECT path,
           count(*) AS total,
           sum(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS errors,
           round(100.0 * sum(CASE WHEN status >= 500 THEN 1 ELSE 0 END) / count(*), 1) AS error_pct
    FROM requests
    GROUP BY path
    HAVING errors >= 20 AND error_pct >= 20
    ORDER BY errors DESC
  `)

  const col = (name: string) => spikes.columns.indexOf(name)
  const anomalies: Anomaly[] = []

  for (const row of spikes.rows) {
    const path = String(row[col('path')])
    const total = Number(row[col('total')])
    const errors = Number(row[col('errors')])
    const pct = Number(row[col('error_pct')])

    const peak = query(`
      SELECT substr(ts, 1, 13) AS hour, count(*) AS errors
      FROM requests
      WHERE path = '${esc(path)}' AND status >= 500
      GROUP BY hour
      ORDER BY errors DESC
      LIMIT 1
    `)
    const peakHour = peak.rows[0] ? String(peak.rows[0][0]) : 'n/a'
    const peakErrors = peak.rows[0] ? Number(peak.rows[0][1]) : 0

    const sample = query(`
      SELECT ts, method, status, duration_ms, country
      FROM requests
      WHERE path = '${esc(path)}' AND status >= 500
      ORDER BY ts DESC
      LIMIT 8
    `)

    anomalies.push({
      signature: `error-spike:${path}`,
      title: `5xx spike on ${path}`,
      summary: `${errors} server errors (${pct}% of ${total} requests), peaking at ${peakErrors} during ${peakHour}:00Z.`,
      metrics: {
        path,
        total_requests: total,
        server_errors: errors,
        error_rate_pct: pct,
        peak_hour_utc: peakHour,
        peak_hour_errors: peakErrors,
      },
      sample: { columns: sample.columns, rows: sample.rows },
    })
  }

  return anomalies
}
