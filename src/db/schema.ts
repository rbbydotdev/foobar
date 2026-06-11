/** The one analytics table this demo queries: a row per HTTP request. */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS requests (
  id          INTEGER PRIMARY KEY,
  ts          TEXT    NOT NULL,
  method      TEXT    NOT NULL,
  path        TEXT    NOT NULL,
  status      INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  bytes       INTEGER NOT NULL,
  ip          TEXT    NOT NULL,
  country     TEXT    NOT NULL,
  user_agent  TEXT    NOT NULL,
  referrer    TEXT,
  session_id  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_requests_ts ON requests(ts);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_path ON requests(path);
CREATE INDEX IF NOT EXISTS idx_requests_session ON requests(session_id);
`

export const DEFAULT_SEED_COUNT = 5000

/** Pre-filled into the editor on first load. */
export const SAMPLE_QUERY = `SELECT
  status,
  count(*)                AS hits,
  round(avg(duration_ms)) AS avg_ms
FROM requests
GROUP BY status
ORDER BY hits DESC;`
