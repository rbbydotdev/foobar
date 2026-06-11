import { faker } from '@faker-js/faker'
import type { Database } from '@sqlite.org/sqlite-wasm'

// Deterministic web-request analytics generator. Faker (seeded) builds the
// string pools; a tiny LCG drives every random pick so a given seed + count
// always yields the same data. Pattern adapted from the gnata playground.

export interface SeedOptions {
  count: number
  append?: boolean
  seed?: number
}

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // last 30 days
const BATCH = 2000

interface Route {
  path: string
  weight: number
  method: string
  baseMs: number
  baseBytes: number
}

const ROUTES: Route[] = [
  { path: '/', weight: 14, method: 'GET', baseMs: 40, baseBytes: 5200 },
  { path: '/api/products', weight: 12, method: 'GET', baseMs: 70, baseBytes: 8400 },
  { path: '/api/products/:id', weight: 10, method: 'GET', baseMs: 60, baseBytes: 3200 },
  { path: '/api/search', weight: 9, method: 'GET', baseMs: 130, baseBytes: 6100 },
  { path: '/assets/app.js', weight: 8, method: 'GET', baseMs: 20, baseBytes: 142000 },
  { path: '/api/cart', weight: 7, method: 'GET', baseMs: 55, baseBytes: 1500 },
  { path: '/api/checkout', weight: 6, method: 'POST', baseMs: 220, baseBytes: 900 },
  { path: '/api/users/:id', weight: 6, method: 'GET', baseMs: 50, baseBytes: 1800 },
  { path: '/api/orders', weight: 6, method: 'GET', baseMs: 90, baseBytes: 4300 },
  { path: '/assets/app.css', weight: 5, method: 'GET', baseMs: 18, baseBytes: 38000 },
  { path: '/api/orders/:id', weight: 5, method: 'GET', baseMs: 70, baseBytes: 2600 },
  { path: '/api/auth/login', weight: 5, method: 'POST', baseMs: 110, baseBytes: 700 },
  { path: '/health', weight: 3, method: 'GET', baseMs: 8, baseBytes: 120 },
  { path: '/api/auth/logout', weight: 2, method: 'POST', baseMs: 35, baseBytes: 300 },
  { path: '/metrics', weight: 2, method: 'GET', baseMs: 12, baseBytes: 5400 },
]

const STATUS_WEIGHTS: Array<[number, number]> = [
  [200, 760],
  [201, 40],
  [204, 28],
  [301, 16],
  [302, 18],
  [304, 40],
  [400, 18],
  [401, 14],
  [403, 8],
  [404, 26],
  [429, 8],
  [500, 8],
  [503, 4],
]

const COUNTRIES = [
  'US', 'GB', 'DE', 'FR', 'CA', 'BR', 'IN', 'JP', 'AU', 'NL',
  'ES', 'IT', 'SE', 'MX', 'PL', 'SG', 'ZA', 'NG', 'KR', 'IE',
]

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) Safari/17.4',
  'Mozilla/5.0 (X11; Linux x86_64) Firefox/125.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4) Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14) Chrome/124.0 Mobile Safari/537.36',
  'curl/8.4.0',
  'PostmanRuntime/7.37.0',
  'foobar-monitor/1.2 (+https://example.com/bot)',
]

const REFERRERS = [
  null,
  null,
  null,
  'https://www.google.com/',
  'https://duckduckgo.com/',
  'https://t.co/',
  'https://news.ycombinator.com/',
  'https://example.com/',
  'https://example.com/pricing',
]

const ANOMALY_PATH = '/api/checkout'

function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function weightedPicker<T>(entries: Array<[T, number]>, rng: () => number): () => T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  return () => {
    let r = rng() * total
    for (const [value, weight] of entries) {
      r -= weight
      if (r <= 0) return value
    }
    return entries[entries.length - 1][0]
  }
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** Skewed positive number around `base` (errors run slower). */
function latency(base: number, rng: () => number, errorish: boolean): number {
  const jitter = 0.4 + rng() * 1.8
  const spike = rng() < 0.05 ? 3 + rng() * 6 : 1
  const errMult = errorish ? 2 + rng() * 4 : 1
  return Math.max(1, Math.round(base * jitter * spike * errMult))
}

function currentMaxId(db: Database): number {
  return Number(db.selectValue('SELECT coalesce(max(id), 0) FROM requests') ?? 0)
}

type Row = [
  number, string, string, string, number, number, number, string, string, string, string | null, string,
]

/**
 * Generates and inserts `count` rows. Returns the number inserted.
 * Always appends a concentrated burst of 5xx errors on one endpoint so the
 * anomaly-detection feature has a clear signal to find.
 */
export function seedRequests(db: Database, options: SeedOptions): number {
  const { count, append = false, seed = 1337 } = options
  faker.seed(seed + (append ? currentMaxId(db) : 0))
  const rng = makeRng(seed + (append ? currentMaxId(db) : 0))

  const ipPool = Array.from({ length: 320 }, () => faker.internet.ipv4())
  const sessionPool = Array.from(
    { length: Math.min(1500, Math.max(40, Math.round(count / 9))) },
    () => faker.string.alphanumeric(12),
  )

  const pickRoute = weightedPicker(
    ROUTES.map((r) => [r, r.weight] as [Route, number]),
    rng,
  )
  const pickStatus = weightedPicker(STATUS_WEIGHTS, rng)

  const anchor = Date.now()
  // Anomaly window: a 2-hour spike roughly 19 hours ago.
  const anomalyEnd = anchor - 18 * 60 * 60 * 1000
  const anomalyStart = anomalyEnd - 2 * 60 * 60 * 1000

  const idStart = append ? currentMaxId(db) + 1 : 1
  const burst = Math.max(80, Math.round(count * 0.03))
  const total = count + burst

  const stmt = db.prepare(
    `INSERT INTO requests
       (id, ts, method, path, status, duration_ms, bytes, ip, country, user_agent, referrer, session_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  )

  let inserted = 0
  try {
    db.exec('BEGIN')
    for (let i = 0; i < total; i++) {
      const id = idStart + i
      const isBurst = i >= count

      let route: Route
      let tsMs: number
      let status: number

      if (isBurst) {
        route = ROUTES.find((r) => r.path === ANOMALY_PATH) ?? ROUTES[0]
        tsMs = anomalyStart + Math.floor(rng() * (anomalyEnd - anomalyStart))
        status = rng() < 0.75 ? 500 : 503
      } else {
        route = pickRoute()
        tsMs = anchor - Math.floor(rng() * WINDOW_MS)
        status = pickStatus()
        // Per-route nudges for realism.
        if (route.path.endsWith('login') && rng() < 0.1) status = 401
        if (route.method !== 'GET' && status === 200 && rng() < 0.12) status = 201
        // A milder elevated error rate on checkout inside the window.
        if (route.path === ANOMALY_PATH && tsMs >= anomalyStart && tsMs <= anomalyEnd && rng() < 0.5) {
          status = rng() < 0.7 ? 500 : 503
        }
      }

      const errorish = status >= 500
      const noContent = status === 204 || status === 304
      const row: Row = [
        id,
        new Date(tsMs).toISOString(),
        route.method,
        route.path,
        status,
        latency(route.baseMs, rng, errorish),
        noContent ? 0 : Math.max(0, Math.round(route.baseBytes * (0.6 + rng() * 0.9))),
        pick(ipPool, rng),
        pick(COUNTRIES, rng),
        pick(USER_AGENTS, rng),
        pick(REFERRERS, rng),
        pick(sessionPool, rng),
      ]

      stmt.bind(row).step()
      stmt.reset(true)
      inserted++

      if (inserted % BATCH === 0) {
        db.exec('COMMIT')
        db.exec('BEGIN')
      }
    }
    db.exec('COMMIT')
  } catch (err) {
    try {
      db.exec('ROLLBACK')
    } catch {
      // ignore
    }
    throw err
  } finally {
    stmt.finalize()
  }

  return inserted
}
