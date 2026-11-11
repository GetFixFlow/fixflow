import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { setLanguage } from '@/i18n'
import { WebhooksPage } from '../WebhooksPage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const EVENTS = [
  { key: 'work_order.completed', label: 'Work is finished' },
  { key: 'asset.created', label: 'An asset is added' },
]

const hook = (over: Record<string, unknown> = {}) => ({
  id: 1, name: 'n8n', url: 'https://hooks.example.test/in/abc', events: ['work_order.completed'], active: true, enabled: true,
  consecutive_failures: 0, disabled_at: null, disabled_reason: null, last_delivery_at: null, created_at: '2026-11-01T10:00:00Z', ...over,
})

const delivery = (over: Record<string, unknown> = {}) => ({
  id: 7, webhook_id: 1, event: 'work_order.completed', event_id: 'evt_1', status: 'delivered', attempts: 1, response_code: 200,
  response_excerpt: 'ok', error: null, next_attempt_at: null, delivered_at: '2026-11-11T10:31:00Z', created_at: '2026-11-11T10:30:00Z', ...over,
})

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <WebhooksPage />
    </QueryClientProvider>,
  )
}

/** The server's side: the webhooks it has, and a record of what the page sent it. */
function serve(webhooks: object[], deliveries: object[] = []) {
  const sent: { created?: Record<string, unknown>; updated?: Record<string, unknown>; enabled?: boolean; rotated?: boolean; deleted?: boolean; tested?: boolean; again?: string } = {}
  server.use(
    http.get('/api/v1/webhooks', () => HttpResponse.json({ webhooks, events: EVENTS })),
    http.get('/api/v1/webhooks/:id', () => HttpResponse.json({ webhook: webhooks[0], deliveries })),
    http.post('/api/v1/webhooks', async ({ request }) => {
      sent.created = ((await request.json()) as { webhook: Record<string, unknown> }).webhook
      return HttpResponse.json({ webhook: hook({ id: 2, name: sent.created.name }), secret: 'whsec_first_and_only' }, { status: 201 })
    }),
    http.patch('/api/v1/webhooks/:id', async ({ request }) => {
      sent.updated = ((await request.json()) as { webhook: Record<string, unknown> }).webhook
      return HttpResponse.json({ webhook: hook() })
    }),
    http.delete('/api/v1/webhooks/:id', () => {
      sent.deleted = true
      return new HttpResponse(null, { status: 204 })
    }),
    http.post('/api/v1/webhooks/:id/rotate_secret', () => {
      sent.rotated = true
      return HttpResponse.json({ webhook: hook(), secret: 'whsec_renewed_once' })
    }),
    http.post('/api/v1/webhooks/:id/enable', () => {
      sent.enabled = true
      return HttpResponse.json({ webhook: hook() })
    }),
    http.post('/api/v1/webhooks/deliveries/:id/redeliver', ({ params }) => {
      sent.again = String(params.id)
      return HttpResponse.json({ delivery: delivery({ id: 99, status: 'pending', attempts: 0 }) }, { status: 201 })
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

describe('WebhooksPage', () => {
  it('says there are none yet, and offers to add one', async () => {
    serve([])
    renderPage()

    expect(await screen.findByText('No webhooks yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add webhook' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Webhooks' })).toBeInTheDocument()
  })

  it('lists each webhook with its address, events and status, including one FixFlow switched off', async () => {
    serve([
      hook({ last_delivery_at: new Date().toISOString() }),
      hook({ id: 2, name: 'Zapier', url: 'https://hooks.zapier.test/x', events: ['asset.created'], active: false, enabled: false }),
      hook({ id: 3, name: 'Broken', url: 'https://hooks.example.test/in/broken', enabled: false, disabled_at: '2026-11-10T10:00:00Z', disabled_reason: '10 messages in a row could not be delivered, so FixFlow stopped sending to it.', consecutive_failures: 10 }),
    ])
    renderPage()

    expect(await screen.findByRole('heading', { level: 2, name: 'n8n' })).toBeInTheDocument()
    expect(screen.getByText('https://hooks.example.test/in/abc')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Switched off')).toBeInTheDocument()
    expect(screen.getByText('Switched off by FixFlow')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('10 messages in a row could not be delivered, so FixFlow stopped sending to it.')
    expect(screen.getByText('10 messages in a row could not be delivered')).toBeInTheDocument()
    expect(screen.getByText(/Last message/)).toBeInTheDocument()
  })

  it('switches a webhook on again when FixFlow had switched it off', async () => {
    const sent = serve([hook({ enabled: false, disabled_at: '2026-11-10T10:00:00Z', disabled_reason: 'The receiver answered 410 Gone, so FixFlow stopped sending to it.' })])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Switch on again' }))

    await waitFor(() => expect(sent.enabled).toBe(true))
  })

  it('adds a webhook, shows the signing secret once, and never again', async () => {
    const sent = serve([])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Add webhook' }))
    const form = await screen.findByRole('dialog')
    await userEvent.type(within(form).getByLabelText('Name'), ' Zapier ')
    await userEvent.type(within(form).getByLabelText('Address to send to'), 'https://hooks.zapier.test/in/1')
    expect(within(form).getByRole('button', { name: 'Save' })).toBeDisabled() // no event chosen yet
    await userEvent.click(within(form).getByLabelText(/Work is finished/))
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(sent.created).toEqual({ name: 'Zapier', url: 'https://hooks.zapier.test/in/1', events: ['work_order.completed'] }))
    const dialog = await screen.findByRole('dialog', { name: 'Signing secret' })
    expect(within(dialog).getByLabelText('Secret')).toHaveValue('whsec_first_and_only')
    expect(within(dialog).getByRole('alert')).toHaveTextContent('shown only once')

    await userEvent.click(within(dialog).getByRole('button', { name: 'I have copied it' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.body.innerHTML).not.toContain('whsec_first_and_only')
  })

  it('selects all events or none', async () => {
    serve([])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Add webhook' }))
    const form = await screen.findByRole('dialog')
    await userEvent.click(within(form).getByRole('button', { name: 'Select all' }))
    expect(within(form).getAllByRole('checkbox').every((box) => (box as HTMLInputElement).checked)).toBe(true)
    await userEvent.click(within(form).getByRole('button', { name: 'Select none' }))
    expect(within(form).getAllByRole('checkbox').some((box) => (box as HTMLInputElement).checked)).toBe(false)
  })

  it('shows the words the server gives when it refuses an address', async () => {
    serve([])
    server.use(http.post('/api/v1/webhooks', () => HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Url points at this server or a link-local address' } }, { status: 422 })))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Add webhook' }))
    const form = await screen.findByRole('dialog')
    await userEvent.type(within(form).getByLabelText('Name'), 'Bad')
    await userEvent.type(within(form).getByLabelText('Address to send to'), 'http://127.0.0.1/x')
    await userEvent.click(within(form).getByLabelText(/Work is finished/))
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await within(form).findByText('Url points at this server or a link-local address')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Signing secret' })).not.toBeInTheDocument()
  })

  it('edits a webhook, including switching it off', async () => {
    const sent = serve([hook()])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Edit n8n' }))
    const form = await screen.findByRole('dialog', { name: 'Edit webhook' })
    expect(within(form).getByLabelText('Name')).toHaveValue('n8n')
    expect(within(form).getByLabelText(/Work is finished/)).toBeChecked()
    await userEvent.click(within(form).getByLabelText(/An asset is added/))
    await userEvent.click(within(form).getByLabelText('Switched on'))
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(sent.updated).toEqual({ name: 'n8n', url: 'https://hooks.example.test/in/abc', events: ['work_order.completed', 'asset.created'], active: false }))
  })

  it('sends a test message and says it was delivered, with the receiver\'s answer code', async () => {
    serve([hook()])
    server.use(http.post('/api/v1/webhooks/:id/test', () => HttpResponse.json({ delivery: delivery({ event: 'ping', response_code: 200, response_excerpt: 'got it' }) })))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Send a test message to n8n' }))

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Delivered: the receiver answered 200.')
    expect(status).toHaveTextContent('It said: got it')
  })

  it('says why a test message was not delivered', async () => {
    serve([hook()])
    server.use(http.post('/api/v1/webhooks/:id/test', () => HttpResponse.json({ delivery: delivery({ event: 'ping', status: 'pending', response_code: 404, error: 'The receiver answered 404.', response_excerpt: 'not found' }) })))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Send a test message to n8n' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Not delivered. The receiver answered 404. 404')
    expect(alert).toHaveTextContent('It said: not found')
  })

  it('renews the secret after asking, and shows the new one once', async () => {
    const sent = serve([hook()])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Renew secret of n8n' }))

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('old one stops working'))
    const dialog = await screen.findByRole('dialog', { name: 'New signing secret' })
    expect(sent.rotated).toBe(true)
    expect(within(dialog).getByLabelText('Secret')).toHaveValue('whsec_renewed_once')
    await userEvent.click(within(dialog).getByRole('button', { name: 'I have copied it' }))
    await waitFor(() => expect(document.body.innerHTML).not.toContain('whsec_renewed_once'))
  })

  it('does not renew or delete when the confirmation is refused', async () => {
    const sent = serve([hook()])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Renew secret of n8n' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete n8n' }))

    expect(sent.rotated).toBeUndefined()
    expect(sent.deleted).toBeUndefined()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('deletes a webhook after asking', async () => {
    const sent = serve([hook()])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Delete n8n' }))

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Delete this webhook'))
    await waitFor(() => expect(sent.deleted).toBe(true))
  })

  it('shows the recent messages with their status, and sends one again', async () => {
    const sent = serve([hook()], [
      delivery({ id: 8, status: 'pending', attempts: 2, response_code: 503, error: 'The receiver answered 503.', next_attempt_at: '2026-11-11T11:00:00Z' }),
      delivery({ id: 7, status: 'delivered' }),
      delivery({ id: 6, status: 'failed', attempts: 6, response_code: null, error: 'Could not reach the receiver (Timeout).' }),
    ])
    renderPage()

    const toggle = await screen.findByRole('button', { name: 'Recent messages of n8n' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const table = await screen.findByRole('table')
    expect(within(table).getByText('Delivered')).toBeInTheDocument()
    expect(within(table).getByText('Waiting')).toBeInTheDocument()
    expect(within(table).getByText('Gave up')).toBeInTheDocument()
    expect(within(table).getByText('The receiver answered 503.')).toBeInTheDocument()
    expect(within(table).getByText('Could not reach the receiver (Timeout).')).toBeInTheDocument()
    expect(within(table).getByText('No answer')).toBeInTheDocument()

    await userEvent.click(within(table).getAllByRole('button', { name: 'Send again: work_order.completed' })[0])
    await waitFor(() => expect(sent.again).toBe('8'))
  })

  it('says nothing was sent yet when the log is empty', async () => {
    serve([hook()], [])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Recent messages of n8n' }))

    expect(await screen.findByText('Nothing has been sent to this webhook yet.')).toBeInTheDocument()
  })

  it('explains what a message looks like, with the headers and a sample', async () => {
    serve([])
    renderPage()

    await screen.findByText('No webhooks yet')
    const section = screen.getByText('What a message looks like').closest('details') as HTMLElement
    expect(section).toHaveTextContent('X-FixFlow-Signature')
    expect(section).toHaveTextContent('X-FixFlow-Event')
    expect(section).toHaveTextContent('X-FixFlow-Delivery')
    expect(section).toHaveTextContent('"event": "work_order.completed"')
  })

  it('says so when the webhooks cannot be loaded, and tries again', async () => {
    server.use(http.get('/api/v1/webhooks', () => HttpResponse.json({}, { status: 500 })))
    renderPage()

    expect(await screen.findByText('The webhooks could not be loaded.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('speaks Spanish', async () => {
    await setLanguage('es', false)
    serve([hook()])
    renderPage()

    expect(await screen.findByRole('button', { name: 'Añadir webhook' })).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar un mensaje de prueba a n8n' })).toBeInTheDocument()
    expect(screen.getByText('Cómo es un mensaje')).toBeInTheDocument()
  })
})
