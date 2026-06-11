import { faker } from '@faker-js/faker'
import type { Database } from '@sqlite.org/sqlite-wasm'

// Row generators for each anomaly scenario. Loaded on demand (faker is heavy).

type Row = [
  number, string, string, string, number, number, number, string, string, string, string | null, string,
]

const COUNTRIES = ['US', 'GB', 'DE', 'BR', 'IN', 'RU', 'CN', 'NG', 'FR', 'NL']
const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36'
const UA_BOT = 'python-requests/2.31.0'

function rint(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function insertRows(db: Database, rows: Row[]): number {
  const stmt = db.prepare(
    `INSERT INTO requests
       (id, ts, method, path, status, duration_ms, bytes, ip, country, user_agent, referrer, session_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  )
  try {
    db.exec('BEGIN')
    for (const row of rows) {
      stmt.bind(row).step()
      stmt.reset(true)
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
  return rows.length
}

function nextId(db: Database): number {
  return Number(db.selectValue('SELECT coalesce(max(id), 0) FROM requests') ?? 0) + 1
}

/** Random timestamp within a window that ends `endAgoH` hours before `anchor`. */
function tsIn(anchor: number, endAgoH: number, windowMin: number): string {
  const end = anchor - endAgoH * 3_600_000
  const start = end - windowMin * 60_000
  return new Date(start + Math.random() * (end - start)).toISOString()
}

export type Injector = (db: Database, anchor: number) => number

const injectServerErrors: Injector = (db, anchor) => {
  let id = nextId(db)
  const session = faker.string.alphanumeric(12)
  const rows: Row[] = Array.from({ length: 240 }, () => {
    const status = Math.random() < 0.78 ? 500 : 503
    return [
      id++, tsIn(anchor, 3, 120), 'POST', '/api/checkout', status,
      rint(900, 4200), rint(200, 1400), faker.internet.ipv4(), pick(COUNTRIES),
      UA_BROWSER, 'https://example.com/cart', session,
    ]
  })
  return insertRows(db, rows)
}

const injectLatency: Injector = (db, anchor) => {
  let id = nextId(db)
  const rows: Row[] = Array.from({ length: 200 }, () => [
    id++, tsIn(anchor, 6, 90), 'GET', '/api/search', 200,
    rint(4000, 15000), rint(4000, 9000), faker.internet.ipv4(), pick(COUNTRIES),
    UA_BROWSER, null, faker.string.alphanumeric(12),
  ])
  return insertRows(db, rows)
}

const injectIpFlood: Injector = (db, anchor) => {
  let id = nextId(db)
  const ip = faker.internet.ipv4()
  const country = pick(COUNTRIES)
  const session = faker.string.alphanumeric(12)
  const paths = ['/api/products', '/api/products/:id', '/api/search', '/api/cart', '/']
  const rows: Row[] = Array.from({ length: 480 }, () => {
    const limited = Math.random() < 0.32
    return [
      id++, tsIn(anchor, 2, 30), 'GET', pick(paths), limited ? 429 : 200,
      rint(5, 120), limited ? 80 : rint(1500, 9000), ip, country, UA_BOT, null, session,
    ]
  })
  return insertRows(db, rows)
}

const injectAuthFailures: Injector = (db, anchor) => {
  let id = nextId(db)
  const ips = Array.from({ length: 6 }, () => faker.internet.ipv4())
  const rows: Row[] = Array.from({ length: 180 }, () => {
    const ok = Math.random() < 0.08
    return [
      id++, tsIn(anchor, 5, 60), 'POST', '/api/auth/login', ok ? 200 : 401,
      rint(60, 320), ok ? 700 : 240, pick(ips), pick(COUNTRIES),
      UA_BOT, null, faker.string.alphanumeric(12),
    ]
  })
  return insertRows(db, rows)
}

const SCAN_PATHS = [
  '/.env', '/wp-admin', '/wp-login.php', '/admin', '/phpmyadmin', '/.git/config',
  '/config.json', '/backup.zip', '/server-status', '/api/v1/users', '/.aws/credentials',
  '/vendor/phpunit', '/xmlrpc.php', '/.ssh/id_rsa', '/actuator/health',
]

const injectNotFoundScan: Injector = (db, anchor) => {
  let id = nextId(db)
  const ip = faker.internet.ipv4()
  const country = pick(COUNTRIES)
  const rows: Row[] = Array.from({ length: 220 }, () => [
    id++, tsIn(anchor, 4, 20), 'GET', pick(SCAN_PATHS), 404,
    rint(3, 40), rint(120, 600), ip, country, UA_BOT, null, faker.string.alphanumeric(12),
  ])
  return insertRows(db, rows)
}

export const INJECTORS: Record<string, Injector> = {
  'server-errors': injectServerErrors,
  latency: injectLatency,
  'ip-flood': injectIpFlood,
  'auth-failures': injectAuthFailures,
  'notfound-scan': injectNotFoundScan,
}
