import { query, useDb } from '@/db'
import type { SqlValue } from '@/db'

export interface DataAnomaly {
  /** Stable id for dedup. */
  signature: string
  kind: string
  title: string
  summary: string
  /** Natural-language note fed to the AI autocomplete prompt. */
  hint: string
  metrics: Record<string, string | number>
  sample: { columns: string[]; rows: SqlValue[][] }
}

// ── statistics ──────────────────────────────────────────────────────────────

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Iglewicz–Hoaglin modified z-score (median + MAD). Robust because the median
 * and MAD aren't dragged around by the very outlier we're hunting. Falls back to
 * mean-absolute-deviation when MAD is 0 (e.g. most groups are zero, one is huge).
 */
function outlierScore(x: number, xs: number[]): number {
  const med = median(xs)
  const mad = median(xs.map((v) => Math.abs(v - med)))
  if (mad > 0) return (0.6745 * (x - med)) / mad
  const meanAd = xs.reduce((s, v) => s + Math.abs(v - med), 0) / xs.length
  if (meanAd > 0) return (0.7979 * (x - med)) / meanAd
  return x > med ? Infinity : 0
}

const Z_THRESHOLD = 3.5

function esc(value: string): string {
  return value.replace(/'/g, "''")
}

interface Group {
  key: string
  value: number
}

function topOutlier(
  groups: Group[],
  floor: number,
  minGroups = 4,
): { group: Group; median: number; score: number } | null {
  if (groups.length < minGroups) return null
  const values = groups.map((g) => g.value)
  const med = median(values)
  const scored = groups
    .map((group) => ({ group, score: outlierScore(group.value, values) }))
    .filter((s) => s.score > Z_THRESHOLD && s.group.value >= floor)
    .sort((a, b) => b.group.value - a.group.value)
  return scored[0] ? { group: scored[0].group, median: med, score: scored[0].score } : null
}

// ── per-dimension detectors (MAD / modified z-score) ─────────────────────────

function detectErrorSpike(): DataAnomaly | null {
  const r = query(`
    SELECT path, count(*) AS total, sum(status >= 500) AS errors
    FROM requests GROUP BY path HAVING total >= 20
  `)
  const pi = r.columns.indexOf('path')
  const ti = r.columns.indexOf('total')
  const ei = r.columns.indexOf('errors')
  const groups: Group[] = r.rows.map((row) => ({ key: String(row[pi]), value: Number(row[ei]) }))
  const hit = topOutlier(groups, 15)
  if (!hit) return null
  const path = hit.group.key
  const errors = hit.group.value
  const total = Number(r.rows.find((row) => String(row[pi]) === path)?.[ti] ?? 0)
  const rate = total ? Math.round((1000 * errors) / total) / 10 : 0
  const sample = query(
    `SELECT ts, method, status, duration_ms, country FROM requests
     WHERE path = '${esc(path)}' AND status >= 500 ORDER BY ts DESC LIMIT 8`,
  )
  return {
    signature: `error-spike:${path}`,
    kind: 'error-spike',
    title: `5xx spike on ${path}`,
    summary: `${errors} server errors (${rate}% of ${total}) — a statistical outlier vs other endpoints (median ${hit.median}).`,
    hint: `elevated 5xx server errors on path '${path}' (status >= 500)`,
    metrics: { path, errors, total, error_rate_pct: rate },
    sample: { columns: sample.columns, rows: sample.rows },
  }
}

function detectLatency(): DataAnomaly | null {
  const r = query(`
    SELECT path, count(*) AS total, round(avg(duration_ms)) AS avg_ms, max(duration_ms) AS max_ms
    FROM requests GROUP BY path HAVING total >= 20
  `)
  const pi = r.columns.indexOf('path')
  const ai = r.columns.indexOf('avg_ms')
  const xi = r.columns.indexOf('max_ms')
  const groups: Group[] = r.rows.map((row) => ({ key: String(row[pi]), value: Number(row[ai]) }))
  const hit = topOutlier(groups, 1000)
  if (!hit) return null
  const path = hit.group.key
  const avg = hit.group.value
  const max = Number(r.rows.find((row) => String(row[pi]) === path)?.[xi] ?? 0)
  const sample = query(
    `SELECT ts, method, status, duration_ms, country FROM requests
     WHERE path = '${esc(path)}' ORDER BY duration_ms DESC LIMIT 8`,
  )
  return {
    signature: `latency:${path}`,
    kind: 'latency',
    title: `Latency outlier on ${path}`,
    summary: `Average ${avg}ms (max ${max}ms) vs a ~${hit.median}ms median across endpoints.`,
    hint: `unusually high duration_ms on path '${path}'`,
    metrics: { path, avg_ms: avg, max_ms: max, median_avg_ms: hit.median },
    sample: { columns: sample.columns, rows: sample.rows },
  }
}

function detectIpFlood(): DataAnomaly | null {
  const r = query(`
    SELECT ip, count(*) AS total, sum(status = 429) AS rate_limited
    FROM requests GROUP BY ip
  `)
  const ii = r.columns.indexOf('ip')
  const ti = r.columns.indexOf('total')
  const li = r.columns.indexOf('rate_limited')
  const groups: Group[] = r.rows.map((row) => ({ key: String(row[ii]), value: Number(row[ti]) }))
  const hit = topOutlier(groups, 50)
  if (!hit) return null
  const ip = hit.group.key
  const total = hit.group.value
  const limited = Number(r.rows.find((row) => String(row[ii]) === ip)?.[li] ?? 0)
  const sample = query(
    `SELECT ts, method, path, status, duration_ms FROM requests
     WHERE ip = '${esc(ip)}' ORDER BY ts DESC LIMIT 8`,
  )
  return {
    signature: `ip-flood:${ip}`,
    kind: 'ip-flood',
    title: `Abusive IP ${ip}`,
    summary: `${total} requests from one IP vs a ~${hit.median} per-IP median${limited ? `, with ${limited} rate-limited (429)` : ''}.`,
    hint: `ip '${ip}' has an outlier request volume${limited ? ' with many status=429' : ''}`,
    metrics: { ip, requests: total, rate_limited: limited, median_per_ip: hit.median },
    sample: { columns: sample.columns, rows: sample.rows },
  }
}

function detectAuthFailures(): DataAnomaly | null {
  const r = query(`
    SELECT path, count(*) AS total, sum(status = 401) AS unauth
    FROM requests GROUP BY path HAVING total >= 20
  `)
  const pi = r.columns.indexOf('path')
  const ti = r.columns.indexOf('total')
  const ui = r.columns.indexOf('unauth')
  const groups: Group[] = r.rows.map((row) => ({ key: String(row[pi]), value: Number(row[ui]) }))
  const hit = topOutlier(groups, 60)
  if (!hit) return null
  const path = hit.group.key
  const unauth = hit.group.value
  const total = Number(r.rows.find((row) => String(row[pi]) === path)?.[ti] ?? 0)
  const sample = query(
    `SELECT ts, ip, status, duration_ms, country FROM requests
     WHERE path = '${esc(path)}' AND status = 401 ORDER BY ts DESC LIMIT 8`,
  )
  return {
    signature: `auth:${path}`,
    kind: 'auth-failures',
    title: `Auth failure burst on ${path}`,
    summary: `${unauth} of ${total} requests returned 401 — a statistical outlier (median ${hit.median}).`,
    hint: `spike of status=401 (auth failures) on path '${path}'`,
    metrics: { path, unauthorized: unauth, total },
    sample: { columns: sample.columns, rows: sample.rows },
  }
}

function detectNotFoundScan(): DataAnomaly | null {
  const r = query(`
    SELECT ip, sum(status = 404) AS notfound,
           count(DISTINCT CASE WHEN status = 404 THEN path END) AS paths
    FROM requests GROUP BY ip
  `)
  const ii = r.columns.indexOf('ip')
  const ni = r.columns.indexOf('notfound')
  const xi = r.columns.indexOf('paths')
  const groups: Group[] = r.rows.map((row) => ({ key: String(row[ii]), value: Number(row[ni]) }))
  const hit = topOutlier(groups, 30)
  if (!hit) return null
  const ip = hit.group.key
  const notfound = hit.group.value
  const paths = Number(r.rows.find((row) => String(row[ii]) === ip)?.[xi] ?? 0)
  if (paths < 5) return null
  const sample = query(
    `SELECT ts, method, path, status FROM requests
     WHERE ip = '${esc(ip)}' AND status = 404 ORDER BY ts DESC LIMIT 8`,
  )
  return {
    signature: `scan:${ip}`,
    kind: 'notfound-scan',
    title: `404 path scan from ${ip}`,
    summary: `${notfound} 404s across ${paths} distinct paths from one IP — consistent with scanning.`,
    hint: `ip '${ip}' produced many status=404 across ${paths} distinct paths (scanning)`,
    metrics: { ip, notfound, distinct_paths: paths },
    sample: { columns: sample.columns, rows: sample.rows },
  }
}

// ── Benford's Law (distributional / "is this data natural?") ─────────────────

function benfordExpected(d: number): number {
  return Math.log10(1 + 1 / d)
}

function detectBenford(): DataAnomaly | null {
  // Leading digit of `bytes` (response sizes span orders of magnitude, so a
  // natural dataset should follow Benford's Law).
  const r = query(`
    SELECT CAST(substr(CAST(bytes AS TEXT), 1, 1) AS INTEGER) AS d, count(*) AS n
    FROM requests WHERE bytes > 0 GROUP BY d
  `)
  const di = r.columns.indexOf('d')
  const ni = r.columns.indexOf('n')
  const counts = new Array(10).fill(0)
  let total = 0
  for (const row of r.rows) {
    const d = Number(row[di])
    if (d >= 1 && d <= 9) {
      counts[d] = Number(row[ni])
      total += counts[d]
    }
  }
  if (total < 300) return null

  let chiSquare = 0
  const sampleRows: SqlValue[][] = []
  let worstDigit = 1
  let worstDelta = 0
  for (let d = 1; d <= 9; d++) {
    const expectedPct = benfordExpected(d)
    const expectedN = total * expectedPct
    const diff = counts[d] - expectedN
    chiSquare += (diff * diff) / expectedN
    const observedPct = Math.round((1000 * counts[d]) / total) / 10
    sampleRows.push([d, observedPct, Math.round(1000 * expectedPct) / 10])
    const delta = Math.abs(observedPct - expectedPct * 100)
    if (delta > worstDelta) {
      worstDelta = delta
      worstDigit = d
    }
  }
  // χ² with 8 dof: 15.5 (p=0.05), 20.1 (p=0.01). Flag a clear deviation.
  if (chiSquare < 24) return null
  const chi = Math.round(chiSquare * 10) / 10
  return {
    signature: 'benford:bytes',
    kind: 'benford',
    title: 'Response sizes deviate from Benford’s Law',
    summary: `Leading-digit χ² = ${chi} for bytes (≫ the ~20 significance bar) — leading digit ${worstDigit} is the most off. Suggests synthetic or manipulated response sizes.`,
    hint: `anomalous value distribution in the bytes column`,
    metrics: { chi_square: chi, samples: total, most_anomalous_digit: worstDigit },
    sample: { columns: ['leading_digit', 'observed_pct', 'benford_pct'], rows: sampleRows },
  }
}

const DETECTORS = [
  detectErrorSpike,
  detectLatency,
  detectIpFlood,
  detectAuthFailures,
  detectNotFoundScan,
  detectBenford,
]

/** Runs every detector over the current data. */
export function detectAnomalies(): DataAnomaly[] {
  const found: DataAnomaly[] = []
  for (const detector of DETECTORS) {
    try {
      const anomaly = detector()
      if (anomaly) found.push(anomaly)
    } catch {
      // a failing detector shouldn't break the rest
    }
  }
  // Benford detector is neutered for now — hidden from hints, UI, and analysis.
  return found.filter((a) => a.kind !== 'benford')
}

// Cache the (non-trivial) detection per data version so the autocomplete can
// call it on every keystroke cheaply.
let cache: { version: number; anomalies: DataAnomaly[] } | null = null

export function getDataAnomalies(): DataAnomaly[] {
  const { status, dataVersion } = useDb.getState()
  if (status !== 'ready') return []
  if (cache && cache.version === dataVersion) return cache.anomalies
  let anomalies: DataAnomaly[] = []
  try {
    anomalies = detectAnomalies()
  } catch {
    anomalies = []
  }
  cache = { version: dataVersion, anomalies }
  return anomalies
}
