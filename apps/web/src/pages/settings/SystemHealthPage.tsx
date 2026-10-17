import { useQueryClient } from '@tanstack/react-query'
import { Activity, AlertTriangle, CheckCircle2, ExternalLink, MinusCircle, RefreshCw, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { useSystemHealth } from '@/hooks/useSystemHealth'
import { useUpdateOrgSettings } from '@/hooks/useSettings'
import { formatDateTime } from '@/lib/localeFormat'
import { formatUptime } from '@/lib/uptime'
import { cn } from '@/lib/utils'
import type { HealthStatus, SystemHealth } from '@/types/system'

const STATUS: Record<HealthStatus, { label: string; icon: React.ElementType; className: string }> = {
  ok: { label: 'Working', icon: CheckCircle2, className: 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/20' },
  warning: { label: 'Needs attention', icon: AlertTriangle, className: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/20' },
  error: { label: 'Down', icon: XCircle, className: 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/20' },
  off: { label: 'Not set up', icon: MinusCircle, className: 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-800' },
}

const BANNER: Record<SystemHealth['status'], string> = {
  ok: 'Everything is working.',
  warning: 'FixFlow is running, but something needs attention.',
  error: 'Something that FixFlow needs is down.',
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const { label, icon: Icon, className } = STATUS[status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
    </span>
  )
}

function Facts({ facts }: { facts: [string, React.ReactNode][] }) {
  const shown = facts.filter(([, value]) => value !== null && value !== undefined && value !== '')
  if (shown.length === 0) return null
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      {shown.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-gray-500">{label}</dt>
          <dd className="text-right font-mono text-gray-800 dark:text-gray-200">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function HealthCard({ title, status, message, facts, children }: {
  title: string
  status: HealthStatus
  message: string
  facts?: [string, React.ReactNode][]
  children?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <StatusBadge status={status} />
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</p>
        {facts && <Facts facts={facts} />}
        {children}
      </CardContent>
    </Card>
  )
}

function ms(value: number | null) { return value === null ? null : `${value} ms` }

function UpdateCard({ update }: { update: SystemHealth['update'] }) {
  const queryClient = useQueryClient()
  const save = useUpdateOrgSettings()
  const status: HealthStatus = update.status === 'unknown' ? 'warning' : update.status
  const checked = update.enabled && !update.locked

  return (
    <HealthCard title="Updates" status={status} message={update.message}
      facts={[['You have', update.current], ['Latest release', update.latest]]}>
      {update.status === 'warning' && update.url && (
        <a href={update.url} target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
          See what is new <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
      <label className={cn('mt-4 flex items-start gap-2 text-sm', update.locked && 'opacity-60')}>
        <input type="checkbox" className="mt-0.5" checked={checked} disabled={update.locked || save.isPending}
          onChange={(event) => save.mutate({ update_check: event.target.checked }, {
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['system_health'] }),
          })} />
        <span>
          Look for new releases on GitHub
          <span className="block text-xs text-gray-500">
            When this is on, opening this page asks GitHub for the latest FixFlow release (at most twice a day). Nothing about
            your install is sent except the version, in the request&apos;s user agent.
            {update.locked && ' The server\'s environment has turned it off (FIXFLOW_UPDATE_CHECK=false).'}
          </span>
        </span>
      </label>
    </HealthCard>
  )
}

export function SystemHealthPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const { data: health, isLoading, isError, isFetching, refetch } = useSystemHealth(isAdmin)

  if (!isAdmin) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="System Health" />
        <Card><CardContent className="p-8 text-center text-gray-500">Only administrators can see the system's health.</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="System Health"
        description="Whether this install is working. Checked live each time you open this page, and again every 30 seconds."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-1.5 h-4 w-4', isFetching && 'animate-spin')} aria-hidden="true" /> Check now
          </Button>
        }
      />

      {isLoading && <p className="text-sm text-gray-500">Checking…</p>}

      {isError && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          The server did not answer the health check, so nothing below can be trusted. If you can read this, the web app is up
          but the API is not responding properly: look at the API server&apos;s log.
        </p>
      )}

      {health && <HealthReport health={health} />}
    </div>
  )
}

function HealthReport({ health }: { health: SystemHealth }) {
  const { app, database, redis, background_jobs: jobs, email, mqtt, storage } = health
  return (
    <>
      <div role="status" className={cn('flex items-center gap-2 rounded-lg p-4 text-sm font-medium', STATUS[health.status].className)}>
        <Activity className="h-4 w-4" aria-hidden="true" />
        {BANNER[health.status]}
        <span className="ml-auto text-xs font-normal opacity-80">Checked {formatDateTime(health.checked_at)}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <HealthCard title="FixFlow" status="ok" message={`Version ${app.version}, running in ${app.environment} mode.`}
          facts={[['Up for', formatUptime(app.uptime_seconds)], ['Ruby', app.ruby], ['Rails', app.rails]]} />

        <HealthCard title="Database" status={database.status} message={database.message}
          facts={[['PostgreSQL', database.server], ['Response time', ms(database.latency_ms)],
            ['Migrations to run', database.pending_migrations]]} />

        <HealthCard title="Redis" status={redis.status} message={redis.message}
          facts={[['Version', redis.server], ['Response time', ms(redis.latency_ms)], ['Memory used', redis.memory]]} />

        <HealthCard title="Background jobs" status={jobs.status} message={jobs.message}
          facts={[['Workers running', jobs.workers], ['Busy now', jobs.busy], ['Waiting', jobs.queued], ['Scheduled for later', jobs.scheduled],
            ['Being retried', jobs.retrying], ['Failed for good', jobs.dead],
            ['Longest wait', jobs.latency_seconds === null ? null : `${jobs.latency_seconds} s`]]} />

        <HealthCard title="Email" status={email.status} message={email.message}
          facts={[['Mail server', email.host ? `${email.host}:${email.port}` : null],
            ['Set up in', email.source === 'settings' ? 'Settings, Email' : email.source === 'environment' ? 'Server environment' : null]]} />

        <HealthCard title="IoT over MQTT" status={mqtt.status} message={mqtt.message}
          facts={[['Broker', mqtt.broker], ['Connected', mqtt.connected === null ? null : mqtt.connected ? 'Yes' : 'No'],
            ['Last message', mqtt.last_message_at ? formatDateTime(mqtt.last_message_at) : null]]} />

        <HealthCard title="File storage" status={storage.status} message={storage.message} facts={[['Service', storage.service]]} />

        <UpdateCard update={health.update} />
      </div>
    </>
  )
}
