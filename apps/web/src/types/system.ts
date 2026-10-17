// What GET /system_health sends (administrators only). The server's spec/contracts/report_shapes_spec.rb checks the
// answer against src/test/fixtures/reports/system_health.json, and the web tests load the same file into these types.

/** ok: working. warning: works but needs attention. error: something that matters is down. off: not set up, and that is fine. */
export type HealthStatus = 'ok' | 'warning' | 'error' | 'off'

interface Check { status: HealthStatus; message: string }

export interface SystemHealth {
  status: Exclude<HealthStatus, 'off'>
  checked_at: string
  app: { version: string; environment: string; ruby: string; rails: string; uptime_seconds: number }
  database: Check & { latency_ms: number | null; server: string | null; pending_migrations: number | null }
  redis: Check & { latency_ms: number | null; server: string | null; memory: string | null }
  background_jobs: Check & {
    workers: number | null
    busy: number | null
    queued: number | null
    scheduled: number | null
    retrying: number | null
    dead: number | null
    latency_seconds: number | null
  }
  email: Check & { source: string | null; host: string | null; port: number | null; reachable: boolean | null }
  mqtt: Check & {
    configured: boolean
    broker: string | null
    reachable: boolean | null
    connected: boolean | null
    last_message_at: string | null
  }
  storage: Check & { service: string }
  update: {
    enabled: boolean
    /** The server's environment turns the check off, whatever the company chose. */
    locked: boolean
    status: 'ok' | 'warning' | 'off' | 'unknown'
    message: string
    current: string
    latest: string | null
    url: string | null
  }
}
