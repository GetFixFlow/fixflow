import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { ChatSettingsPage } from '../ChatSettingsPage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const EVENTS = [
  { key: 'wo_new_request', label: 'Someone reports a problem from a QR label' },
  { key: 'wo_assigned', label: 'A work order is assigned' },
  { key: 'wo_needs_verification', label: 'Work is finished and needs verifying' },
  { key: 'iot_alert', label: 'A critical or high sensor alert is raised' },
  { key: 'part_low_stock', label: 'A part is running low or out' },
  { key: 'po_requested', label: 'Someone asks for parts to be bought' },
  { key: 'warranty_expiring', label: 'A warranty ends within 30 days' },
]
const empty = { kind: 'slack', enabled: false, events: EVENTS.map((e) => e.key), url_set: false, url_hint: null, last_sent_at: null, last_error: null, available_events: EVENTS }
const saved = { ...empty, enabled: true, url_set: true, url_hint: 'hooks.slack.com', last_sent_at: '2026-10-30T08:00:00Z' }

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChatSettingsPage />
    </QueryClientProvider>,
  )
}

/** The server's side: what it has saved, and a record of what it was sent. */
function serve(status: object) {
  const sent: { patch?: { chat: Record<string, unknown> }; test?: { chat: Record<string, unknown> }; deleted?: boolean } = {}
  server.use(
    http.get('/api/v1/chat_settings', () => HttpResponse.json({ chat: status })),
    http.patch('/api/v1/chat_settings', async ({ request }) => {
      sent.patch = (await request.json()) as { chat: Record<string, unknown> }
      return HttpResponse.json({ chat: status })
    }),
    http.post('/api/v1/chat_settings/test', async ({ request }) => {
      sent.test = (await request.json()) as { chat: Record<string, unknown> }
      return HttpResponse.json({ success: true, message: 'Test message sent. Look for it in the channel.' })
    }),
    http.delete('/api/v1/chat_settings', () => {
      sent.deleted = true
      return HttpResponse.json({ chat: empty })
    }),
  )
  return sent
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('ChatSettingsPage', () => {
  it('starts off, with every event ticked and nothing to post to', async () => {
    serve(empty)
    renderPage()

    expect(await screen.findByText(/chat messages are off/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/a work order is assigned/i)).toBeChecked()
    expect(screen.getByLabelText(/post these messages/i)).not.toBeChecked()
    expect(screen.getByRole('button', { name: /send a test message/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /^remove$/i })).not.toBeInTheDocument()
  })

  it('never shows the webhook address, only the name of its host, and says a saved one is kept when left blank', async () => {
    serve(saved)
    renderPage()

    expect(await screen.findByText(/messages are going to hooks\.slack\.com/i)).toBeInTheDocument()
    const field = screen.getByLabelText(/webhook address/i)
    expect(field).toHaveValue('')
    expect(field).toHaveAttribute('type', 'password')
    expect(field).toHaveAttribute('placeholder', expect.stringMatching(/saved \(hooks\.slack\.com\).*leave blank/i))
  })

  it('saves the kind, the address, the events that are ticked and the switch', async () => {
    const user = userEvent.setup()
    const sent = serve(empty)
    renderPage()

    await user.selectOptions(await screen.findByLabelText(/where to post/i), 'teams')
    await user.type(screen.getByLabelText(/webhook address/i), 'https://prod-1.logic.azure.com/workflows/abc')
    await user.click(screen.getByLabelText(/a part is running low/i))
    await user.click(screen.getByLabelText(/post these messages/i))
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(sent.patch).toBeDefined())
    expect(sent.patch!.chat).toEqual({
      kind: 'teams',
      enabled: true,
      url: 'https://prod-1.logic.azure.com/workflows/abc',
      events: ['wo_new_request', 'wo_assigned', 'wo_needs_verification', 'iot_alert', 'po_requested', 'warranty_expiring'],
    })
  })

  it('does not offer to turn messages on without an address', async () => {
    const user = userEvent.setup()
    serve(empty)
    renderPage()

    await user.click(await screen.findByLabelText(/post these messages/i))

    expect(screen.getByRole('alert')).toHaveTextContent(/paste the webhook address/i)
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('sends a test message through the address typed, and says it worked', async () => {
    const user = userEvent.setup()
    const sent = serve(empty)
    renderPage()

    await user.type(await screen.findByLabelText(/webhook address/i), 'https://hooks.slack.com/services/T/B/X')
    await user.click(screen.getByRole('button', { name: /send a test message/i }))

    expect(await screen.findByText(/test message sent/i)).toBeInTheDocument()
    expect(sent.test!.chat).toEqual({ kind: 'slack', url: 'https://hooks.slack.com/services/T/B/X' })
  })

  it('can test the saved address without typing it again', async () => {
    const user = userEvent.setup()
    const sent = serve(saved)
    renderPage()

    await user.click(await screen.findByRole('button', { name: /send a test message/i }))

    await screen.findByText(/test message sent/i)
    expect(sent.test!.chat).toEqual({ kind: 'slack', url: '' })
  })

  it('shows why a test failed, in the chat service\'s own terms', async () => {
    const user = userEvent.setup()
    serve(saved)
    server.use(
      http.post('/api/v1/chat_settings/test', () =>
        HttpResponse.json({ success: false, error: { code: 'CHAT_TEST_FAILED', message: 'The chat service does not know that webhook address (404). Check it, or make a new one.' } }, { status: 422 }),
      ),
    )
    renderPage()

    await user.click(await screen.findByRole('button', { name: /send a test message/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/does not know that webhook address/i)
  })

  it('tells the administrator when the last real message did not get through', async () => {
    serve({ ...saved, last_error: 'The chat service refused the webhook (403). It may have been revoked: make a new one.' })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/last message did not get through.*may have been revoked/i)
  })

  it('removes the settings after asking', async () => {
    const user = userEvent.setup()
    const sent = serve(saved)
    renderPage()

    await user.click(await screen.findByRole('button', { name: /^remove$/i }))

    await waitFor(() => expect(sent.deleted).toBe(true))
    expect(window.confirm).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Chat settings removed.')
  })

  it('says so, and offers to try again, when the settings cannot be loaded', async () => {
    server.use(http.get('/api/v1/chat_settings', () => HttpResponse.json({ error: { message: 'x' } }, { status: 403 })))
    renderPage()

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
