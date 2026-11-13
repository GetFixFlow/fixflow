import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { setLanguage } from '@/i18n'
import { PluginsPage } from '../PluginsPage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const EVENTS = [
  { key: 'wo_assigned', label: 'A work order is assigned' },
  { key: 'iot_alert', label: 'A critical or high sensor alert is raised' },
]

const channel = (over: Record<string, unknown> = {}) => ({
  key: 'ntfy', title: 'ntfy topic', summary: 'Anyone who knows the topic name can read it.',
  fields: [
    { key: 'server', label: 'Server', kind: 'url', required: false, help: 'https://ntfy.sh, or your own.', default: 'https://ntfy.sh', options: [] },
    { key: 'topic', label: 'Topic', kind: 'text', required: true, help: '', default: null, options: [] },
    { key: 'token', label: 'Access token', kind: 'secret', required: false, help: '', default: null, options: [] },
    { key: 'priority', label: 'Priority', kind: 'select', required: false, help: '', default: 'default', options: ['default', 'high', 'urgent'] },
  ],
  enabled: false, events: ['wo_assigned', 'iot_alert'], values: { server: '', topic: '', priority: '' }, secrets_set: { token: false },
  last_sent_at: null, last_error: null, ...over,
})

const plugin = (over: Record<string, unknown> = {}) => ({
  key: 'ntfy', title: 'ntfy', version: '1.0.0', summary: 'Sends notifications to an ntfy topic.', author: 'FixFlow', folder: 'ntfy',
  enabled: true, reports: [], channels: [channel()], ...over,
})

const overdue = (over: Record<string, unknown> = {}) => ({
  key: 'overdue_work', title: 'Overdue work', version: '1.0.0', summary: 'Who is late.', author: null, folder: 'overdue_work', enabled: true,
  reports: [{ key: 'overdue_now', title: 'Overdue now', description: 'Open work past its due date.' }], channels: [], ...over,
})

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <PluginsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

type Sent = {
  enabled?: { key: string; enabled: boolean }
  channel?: { key: string; channel: string; body: { channel: { enabled: boolean; events: string[]; values: Record<string, string> } } }
  removed?: string
  tested?: Record<string, string>
}

/** The server's side: the plugins it has, and a record of what the page sent. */
function serve(plugins: object[], failures: object[] = [], overrides: { test?: () => Response } = {}) {
  const sent: Sent = {}
  server.use(
    http.get('/api/v1/plugins', () => HttpResponse.json({ plugins, failures, api_version: 1, available_events: EVENTS })),
    http.patch('/api/v1/plugins/:key', async ({ request, params }) => {
      const body = (await request.json()) as { plugin: { enabled: boolean } }
      sent.enabled = { key: String(params.key), enabled: body.plugin.enabled }
      return HttpResponse.json({ plugin: plugin({ enabled: body.plugin.enabled }) })
    }),
    http.put('/api/v1/plugins/:key/channels/:channel', async ({ request, params }) => {
      sent.channel = { key: String(params.key), channel: String(params.channel), body: (await request.json()) as never }
      return HttpResponse.json({ plugin: plugin() })
    }),
    http.delete('/api/v1/plugins/:key/channels/:channel', ({ params }) => {
      sent.removed = `${params.key}/${params.channel}`
      return HttpResponse.json({ plugin: plugin() })
    }),
    http.post('/api/v1/plugins/:key/channels/:channel/test', async ({ request }) => {
      if (overrides.test) return overrides.test()
      sent.tested = ((await request.json()) as { channel: { values: Record<string, string> } }).channel.values
      return HttpResponse.json({ success: true, message: 'Test message sent.' })
    }),
  )
  return sent
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(async () => {
  await setLanguage('en', false)
})

describe('PluginsPage', () => {
  it('says how to add a plugin when none is installed', async () => {
    serve([])
    renderPage()

    expect(await screen.findByText('No plugins installed')).toBeInTheDocument()
    expect(screen.getByText(/put its folder in the plugins folder on the server/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Plugins' })).toBeInTheDocument()
  })

  it('warns that a plugin is code that runs with the rights of the server', async () => {
    serve([])
    renderPage()

    expect(await screen.findByText(/runs with the server's rights/)).toBeInTheDocument()
  })

  it('lists each plugin with what it adds, and where a switched-off one is not set up', async () => {
    serve([overdue(), plugin({ enabled: false })])
    renderPage()

    expect(await screen.findByRole('heading', { level: 2, name: 'Overdue work' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Overdue now' })).toHaveAttribute('href', '/reports/plugins/overdue_work/overdue_now')
    expect(screen.getByText(/Open work past its due date/)).toBeInTheDocument()
    expect(screen.getByText('Version 1.0.0 · In the folder overdue_work')).toBeInTheDocument()
    expect(screen.getByText('On')).toBeInTheDocument()

    expect(screen.getByRole('heading', { level: 2, name: 'ntfy' })).toBeInTheDocument()
    expect(screen.getByText('Off')).toBeInTheDocument()
    expect(screen.getByText(/Switched off for your company/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'ntfy topic' })).not.toBeInTheDocument() // no channel form until it is on
  })

  it('shows the plugins that did not load, and why', async () => {
    serve([], [{ folder: 'broken', message: 'SyntaxError: unexpected end-of-input' }])
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Some plugins did not load')
    expect(alert).toHaveTextContent('Folder broken: SyntaxError: unexpected end-of-input')
    expect(screen.queryByText('No plugins installed')).not.toBeInTheDocument()
  })

  it('switches a plugin on and off', async () => {
    const sent = serve([plugin({ enabled: false })])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Switch on ntfy' }))

    await waitFor(() => expect(sent.enabled).toEqual({ key: 'ntfy', enabled: true }))
  })

  it('switches an enabled plugin off', async () => {
    const sent = serve([plugin()])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Switch off ntfy' }))

    await waitFor(() => expect(sent.enabled).toEqual({ key: 'ntfy', enabled: false }))
  })

  describe('a channel', () => {
    it('is drawn from the fields the plugin declared', async () => {
      serve([plugin()])
      renderPage()

      const form = await screen.findByRole('region', { name: 'ntfy topic' })
      expect(within(form).getByLabelText('Server')).toHaveAttribute('placeholder', 'https://ntfy.sh')
      expect(within(form).getByLabelText('Topic')).toHaveValue('')
      expect(within(form).getByLabelText('Access token')).toHaveAttribute('type', 'password')
      expect(within(form).getByLabelText('Priority')).toHaveDisplayValue('default')
      expect(within(form).getByText(/Kept encrypted and never shown again/)).toBeInTheDocument()
      expect(within(form).getByLabelText('A work order is assigned')).toBeChecked()
      expect(within(form).getByText('This channel is off.')).toBeInTheDocument()
    })

    it('saves what was typed, the events ticked and the priority chosen', async () => {
      const sent = serve([plugin()])
      renderPage()

      const form = await screen.findByRole('region', { name: 'ntfy topic' })
      await userEvent.type(within(form).getByLabelText('Topic'), 'workshop-7f3a')
      await userEvent.type(within(form).getByLabelText('Access token'), 'tk_secret')
      await userEvent.selectOptions(within(form).getByLabelText('Priority'), 'urgent')
      await userEvent.click(within(form).getByLabelText('A critical or high sensor alert is raised'))
      await userEvent.click(within(form).getByLabelText('Send these messages'))
      await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(sent.channel).toBeDefined())
      expect(sent.channel).toMatchObject({ key: 'ntfy', channel: 'ntfy' })
      expect(sent.channel?.body.channel).toEqual({
        enabled: true, events: ['wo_assigned'],
        values: { server: '', topic: 'workshop-7f3a', token: 'tk_secret', priority: 'urgent' },
      })
    })

    it('never shows a saved secret, only that it is set, and keeps it when the box is left blank', async () => {
      const sent = serve([plugin({ channels: [channel({ enabled: true, values: { server: 'https://ntfy.example.test', topic: 'workshop', priority: '' }, secrets_set: { token: true } })] })])
      renderPage()

      const form = await screen.findByRole('region', { name: 'ntfy topic' })
      const token = within(form).getByLabelText('Access token')
      expect(token).toHaveValue('')
      expect(token).toHaveAttribute('placeholder', 'Saved. Leave blank to keep it.')
      expect(within(form).getByLabelText('Server')).toHaveValue('https://ntfy.example.test')
      expect(within(form).getByText('Messages are going out through this channel.')).toBeInTheDocument()

      await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(sent.channel?.body.channel.values.token).toBe(''))
    })

    it('asks for a required field before it can be switched on', async () => {
      serve([plugin()])
      renderPage()

      const form = await screen.findByRole('region', { name: 'ntfy topic' })
      await userEvent.click(within(form).getByLabelText('Send these messages'))

      expect(within(form).getByRole('alert')).toHaveTextContent('Topic is needed to turn messages on.')
      expect(within(form).getByRole('button', { name: 'Save' })).toBeDisabled()
      await userEvent.type(within(form).getByLabelText('Topic'), 'workshop')
      expect(within(form).getByRole('button', { name: 'Save' })).toBeEnabled()
    })

    it('shows when the last message went out, and why the last one did not', async () => {
      serve([plugin({ channels: [channel({ enabled: true, values: { server: '', topic: 'workshop', priority: '' }, last_sent_at: '2026-11-11T10:30:00Z', last_error: 'The service answered 503.' })] })])
      renderPage()

      const form = await screen.findByRole('region', { name: 'ntfy topic' })
      expect(within(form).getByText(/Last message sent/)).toBeInTheDocument()
      expect(within(form).getByRole('alert')).toHaveTextContent('The last message did not get through: The service answered 503.')
    })

    it('sends a test message with what is typed, and says what happened', async () => {
      const sent = serve([plugin()])
      renderPage()

      const form = await screen.findByRole('region', { name: 'ntfy topic' })
      await userEvent.type(within(form).getByLabelText('Topic'), 'workshop')
      await userEvent.click(within(form).getByRole('button', { name: 'Send a test message' }))

      expect(await within(form).findByRole('status')).toHaveTextContent('Test message sent.')
      expect(sent.tested).toMatchObject({ topic: 'workshop' })
    })

    it('shows the reason, in words, when the test message fails', async () => {
      serve([plugin()], [], {
        test: () => HttpResponse.json({ success: false, error: { code: 'PLUGIN_TEST_FAILED', message: 'The service refused the message (403): the login or token was not accepted.' } }, { status: 422 }) as unknown as Response,
      })
      renderPage()

      const form = await screen.findByRole('region', { name: 'ntfy topic' })
      await userEvent.click(within(form).getByRole('button', { name: 'Send a test message' }))

      expect(await within(form).findByRole('alert')).toHaveTextContent('The service refused the message (403): the login or token was not accepted.')
    })

    it('forgets the settings after asking', async () => {
      const sent = serve([plugin()])
      renderPage()

      await userEvent.click(await screen.findByRole('button', { name: 'Remove the settings of ntfy topic' }))

      await waitFor(() => expect(sent.removed).toBe('ntfy/ntfy'))
      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('forget its secrets'))
    })

    it('does not forget anything when the person says no', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const sent = serve([plugin()])
      renderPage()

      await userEvent.click(await screen.findByRole('button', { name: 'Remove the settings of ntfy topic' }))

      expect(sent.removed).toBeUndefined()
    })
  })

  it('says so, and offers to try again, when the plugins cannot be loaded', async () => {
    server.use(http.get('/api/v1/plugins', () => new HttpResponse(null, { status: 500 })))
    renderPage()

    expect(await screen.findByText('The plugins could not be loaded.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('reads in Spanish', async () => {
    await setLanguage('es', false)
    serve([overdue()])
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Complementos' })).toBeInTheDocument()
    expect(await screen.findByText('Informes que añade')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desactivar Overdue work' })).toBeInTheDocument()
  })
})
