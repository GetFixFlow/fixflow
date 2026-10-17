import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { fixtures } from '@/test/reportFixtures'
import { useAuthStore } from '@/stores/authStore'
import { formatUptime } from '@/lib/uptime'
import { SystemHealthPage } from '../SystemHealthPage'
import type { SystemHealth } from '@/types/system'
import type { Role } from '@/types'

// The real page, fed what the server really sends (src/test/fixtures/reports/system_health.json), and variations of it.

let asked: number
let patches: unknown[]

function serve(answer: unknown = fixtures.systemHealth, status = 200) {
  server.use(
    http.get('/api/v1/system_health', () => {
      asked += 1
      return HttpResponse.json(answer as Record<string, unknown>, { status })
    }),
    http.patch('/api/v1/organization_settings', async ({ request }) => {
      patches.push(await request.json())
      return HttpResponse.json({ organization: {} })
    }),
  )
}

function renderPage(role: Role = 'admin') {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role, organization_id: 1 } as never, token: 't', isAuthenticated: true })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><SystemHealthPage /></MemoryRouter></QueryClientProvider>)
}

/** The card with this title, once the page has loaded. */
async function card(title: string): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { name: title })
  return heading.closest('div[class*="p-5"]') as HTMLElement
}

function fact(from: HTMLElement, label: string) {
  return within(from).getByText(label).nextElementSibling?.textContent
}

const health = fixtures.systemHealth
const changed = (patch: Partial<SystemHealth>): SystemHealth => ({ ...health, ...patch })

beforeEach(() => {
  asked = 0
  patches = []
  serve()
})

describe('SystemHealthPage', () => {
  it('shows the version, how long it has been up and the services it depends on', async () => {
    renderPage()
    expect(await screen.findByText(`Version ${health.app.version}, running in ${health.app.environment} mode.`)).toBeInTheDocument()
    expect(fact(await card('FixFlow'), 'Up for')).toBe(formatUptime(health.app.uptime_seconds))
    const database = await card('Database')
    expect(fact(database, 'PostgreSQL')).toBe(health.database.server)
    expect(fact(database, 'Response time')).toBe(`${health.database.latency_ms} ms`)
    expect(fact(await card('Redis'), 'Version')).toBe(health.redis.server)
    expect(fact(await card('Background jobs'), 'Workers running')).toBe(String(health.background_jobs.workers))
    expect(fact(await card('Email'), 'Mail server')).toBe(`${health.email.host}:${health.email.port}`)
    expect(fact(await card('IoT over MQTT'), 'Broker')).toBe(health.mqtt.broker)
    expect(fact(await card('File storage'), 'Service')).toBe(health.storage.service)
  })

  it('says everything is working when it is', async () => {
    renderPage()
    expect(await screen.findByRole('status')).toHaveTextContent('Everything is working.')
  })

  it('says plainly what is down, with the server\'s explanation, and what needs attention', async () => {
    serve(changed({
      status: 'error',
      background_jobs: { ...health.background_jobs, status: 'error', workers: 0, message: 'No background worker is running, so emails stop.' },
      email: { ...health.email, status: 'warning', message: 'Email is not set up, so invitations are not sent.' },
    }))
    renderPage()
    expect(await screen.findByRole('status')).toHaveTextContent('Something that FixFlow needs is down.')
    const jobs = await card('Background jobs')
    expect(within(jobs).getByText('Down')).toBeInTheDocument()
    expect(within(jobs).getByText('No background worker is running, so emails stop.')).toBeInTheDocument()
    expect(within(await card('Email')).getByText('Needs attention')).toBeInTheDocument()
    expect(within(await card('Database')).getByText('Working')).toBeInTheDocument()
  })

  it('says "not set up" for IoT over MQTT when there is no broker, without inventing figures', async () => {
    serve(changed({ mqtt: { status: 'off', message: 'IoT over MQTT is not set up.', configured: false, broker: null, reachable: null,
      connected: null, last_message_at: null } }))
    renderPage()
    const mqtt = await card('IoT over MQTT')
    expect(within(mqtt).getByText('IoT over MQTT is not set up.')).toBeInTheDocument()
    expect(within(mqtt).getByText('Not set up')).toBeInTheDocument()
    expect(within(mqtt).queryByText('Broker')).toBeNull()
    expect(within(mqtt).queryByText('Last message')).toBeNull()
  })

  it('does not show a response time for a database that did not answer', async () => {
    serve(changed({ status: 'error', database: { status: 'error', message: 'The database did not answer.', latency_ms: null, server: null,
      pending_migrations: null } }))
    renderPage()
    const database = await card('Database')
    expect(within(database).getByText('The database did not answer.')).toBeInTheDocument()
    expect(within(database).queryByText('Response time')).toBeNull()
  })

  it('tells the administrator when a newer release exists, and links to it', async () => {
    renderPage()
    const updates = await card('Updates')
    expect(within(updates).getByText(health.update.message)).toBeInTheDocument()
    expect(fact(updates, 'You have')).toBe(health.update.current)
    expect(fact(updates, 'Latest release')).toBe(health.update.latest)
    const link = within(updates).getByRole('link', { name: /See what is new/ })
    expect(link).toHaveAttribute('href', health.update.url)
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('does not call a failed lookup "up to date"', async () => {
    serve(changed({ update: { ...health.update, status: 'unknown', message: 'Could not look up the latest release (timeout).',
      latest: null, url: null } }))
    renderPage()
    const updates = await card('Updates')
    expect(within(updates).getByText('Could not look up the latest release (timeout).')).toBeInTheDocument()
    expect(within(updates).queryByText(/latest version/)).toBeNull()
    expect(within(updates).getByText('Needs attention')).toBeInTheDocument()
    expect(within(updates).queryByText('Working')).toBeNull()
    expect(within(updates).queryByRole('link')).toBeNull()
  })

  it('turns the update check off from the page, and asks the server again', async () => {
    const user = userEvent.setup()
    renderPage()
    const checkbox = within(await card('Updates')).getByRole('checkbox', { name: /Look for new releases on GitHub/ })
    expect(checkbox).toBeChecked()
    await user.click(checkbox)
    await waitFor(() => expect(patches).toEqual([{ organization: { update_check: false } }]))
    await waitFor(() => expect(asked).toBeGreaterThan(1))
  })

  it('shows the check as off, and cannot be switched on, when the server\'s environment turned it off', async () => {
    serve(changed({ update: { ...health.update, enabled: false, locked: true, status: 'off',
      message: "The update check is turned off in the server's settings (FIXFLOW_UPDATE_CHECK=false).", latest: null, url: null } }))
    renderPage()
    const checkbox = within(await card('Updates')).getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
    expect(checkbox).toBeDisabled()
  })

  it('tells people who are not administrators that it is not for them, and asks the server nothing', async () => {
    renderPage('manager')
    expect(await screen.findByText(/Only administrators/)).toBeInTheDocument()
    expect(asked).toBe(0)
  })

  it('says the check itself failed, rather than showing nothing, when the server does not answer', async () => {
    serve({ error: { message: 'boom' } }, 500)
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('The server did not answer the health check')
    expect(screen.queryByRole('status')).toBeNull()
  })
})
