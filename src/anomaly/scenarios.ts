/** A common analytics "thing to look for" in web-request data. Checking it
 *  injects representative rows AND hints the AI autocomplete. */
export interface AnomalyScenario {
  id: string
  label: string
  description: string
  /** Appended to the AI prompt so completions bias toward investigating it. */
  hint: string
}

export const ANOMALY_SCENARIOS: AnomalyScenario[] = [
  {
    id: 'server-errors',
    label: '5xx error spike',
    description: 'A burst of 500/503s concentrated on /api/checkout.',
    hint: 'There is a spike of 5xx server errors concentrated on /api/checkout. The user is likely investigating server errors by endpoint, status code, or time bucket (e.g. error rate per hour).',
  },
  {
    id: 'latency',
    label: 'Latency spike',
    description: 'Unusually slow responses on /api/search.',
    hint: 'There is a latency spike on /api/search with unusually high duration_ms. The user is likely querying slow requests, average/percentile latency, or the slowest endpoints.',
  },
  {
    id: 'ip-flood',
    label: 'Abusive IP / rate limiting',
    description: 'One IP hammering the API, lots of 429s.',
    hint: 'A single IP address is making an unusually high number of requests and receiving many 429 Too Many Requests responses. The user is likely querying top IPs by request count or rate-limited (429) traffic.',
  },
  {
    id: 'auth-failures',
    label: 'Auth failure burst',
    description: 'Many 401s on /api/auth/login.',
    hint: 'There is a burst of 401 Unauthorized responses on /api/auth/login, suggesting failed logins or a brute-force attempt. The user is likely querying failed auth attempts grouped by IP or over time.',
  },
  {
    id: 'notfound-scan',
    label: '404 path scan',
    description: 'One IP probing many missing paths.',
    hint: 'A single IP is scanning many non-existent paths (e.g. /.env, /wp-admin), producing a surge of 404 responses. The user is likely querying 404s by path or by IP.',
  },
]

export function scenarioById(id: string): AnomalyScenario | undefined {
  return ANOMALY_SCENARIOS.find((s) => s.id === id)
}
