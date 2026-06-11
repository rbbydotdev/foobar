/** A test anomaly you can inject. Injecting adds representative rows; the
 *  detector then finds it in the data and (optionally) steers the autocomplete. */
export interface AnomalyScenario {
  id: string
  label: string
  description: string
}

export const ANOMALY_SCENARIOS: AnomalyScenario[] = [
  { id: 'server-errors', label: '5xx error spike', description: 'A burst of 500/503s on /api/checkout.' },
  { id: 'latency', label: 'Latency spike', description: 'Very slow responses on /api/search.' },
  { id: 'ip-flood', label: 'Abusive IP / 429s', description: 'One IP hammering the API.' },
  { id: 'auth-failures', label: 'Auth failure burst', description: 'Many 401s on /api/auth/login.' },
  { id: 'notfound-scan', label: '404 path scan', description: 'One IP probing missing paths.' },
]
