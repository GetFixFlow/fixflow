import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { NotificationsPage } from '../NotificationsPage'
import { ENDPOINT, SERVER_KEY, installPushBrowser, removePushBrowser } from '@/test/pushBrowser'

const PUSH_EVENTS = ['wo_assigned', 'wo_verified', 'wo_needs_verification', 'wo_new_request', 'pm_generated', 'part_low_stock']
const EVENTS = [
  'wo_assigned', 'wo_verified', 'wo_needs_verification', 'wo_new_request',
  'pm_generated', 'pm_due_soon', 'pm_overdue', 'part_low_stock',
]

function prefs(overrides: Record<string, boolean> = {}, emailEnabled = true, pushOverrides: Record<string, boolean> = {}, pushEnabled = true) {
  return {
    email_enabled: emailEnabled,
    push_enabled: pushEnabled,
    rules: Object.fromEntries(
      EVENTS.map((e) => [e, PUSH_EVENTS.includes(e) ? { email: overrides[e] ?? true, push: pushOverrides[e] ?? true } : { email: overrides[e] ?? true }]),
    ),
  }
}

function signInAs(role: 'admin' | 'manager' | 'technician') {
  useAuthStore.setState({
    user: { id: 1, email: 'a@test.com', full_name: 'Test', role, organization_id: 1 },
    token: 'token',
    isAuthenticated: true,
  })
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Serves these preferences and keeps what is saved. */
function serve(initial = prefs()) {
  const saved: { body?: { preferences: Record<string, unknown> } } = {}
  let current = initial
  server.use(
    http.get('/api/v1/notification_preferences', () => HttpResponse.json({ preferences: current })),
    http.patch('/api/v1/notification_preferences', async ({ request }) => {
      saved.body = (await request.json()) as { preferences: Record<string, unknown> }
      current = saved.body.preferences as typeof current
      return HttpResponse.json({ preferences: current })
    }),
  )
  return saved
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    signInAs('admin')
  })

  afterEach(() => removePushBrowser())

  it('shows what the server has: a switched-off email is unticked', async () => {
    serve(prefs({ wo_assigned: false }))
    renderPage()

    expect(await screen.findByLabelText(/a work order is assigned to me/i)).not.toBeChecked()
    expect(screen.getByLabelText(/maintenance is overdue/i)).toBeChecked()
    expect(screen.getByRole('switch', { name: /email notifications/i })).toBeChecked()
  })

  it('saves a changed email choice, and only then', async () => {
    const user = userEvent.setup()
    const saved = serve()
    renderPage()

    const save = await screen.findByRole('button', { name: /save preferences/i })
    expect(save).toBeDisabled() // nothing changed yet

    await user.click(screen.getByLabelText(/a part is running low or out/i))
    expect(save).toBeEnabled()
    await user.click(save)

    await waitFor(() => expect(saved.body).toBeDefined())
    const sent = saved.body!.preferences as ReturnType<typeof prefs>
    expect(sent.rules.part_low_stock).toEqual({ email: false, push: true })
    expect(sent.rules.wo_assigned).toEqual({ email: true, push: true })
    expect(sent.email_enabled).toBe(true)
    await waitFor(() => expect(screen.getByRole('button', { name: /save preferences/i })).toBeDisabled())
  })

  it('switches every email off with the master switch and greys out the rows, keeping their choices', async () => {
    const user = userEvent.setup()
    const saved = serve(prefs({ pm_overdue: false }))
    renderPage()

    await user.click(await screen.findByRole('switch', { name: /email notifications/i }))

    expect(screen.getByLabelText(/a work order is assigned to me/i)).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /save preferences/i }))
    await waitFor(() => expect(saved.body).toBeDefined())
    const sent = saved.body!.preferences as ReturnType<typeof prefs>
    expect(sent.email_enabled).toBe(false)
    expect(sent.rules.pm_overdue).toEqual({ email: false })
    expect(sent.push_enabled).toBe(true) // the email switch does not touch push
  })

  it.each([
    ['technician', false],
    ['manager', true],
    ['admin', true],
  ] as const)('shows the manager emails to a %s: %s', async (role, shown) => {
    signInAs(role)
    serve()
    renderPage()

    await screen.findByLabelText(/a work order is assigned to me/i)
    expect(!!screen.queryByLabelText(/maintenance is overdue/i)).toBe(shown)
    expect(!!screen.queryByLabelText(/a part is running low or out/i)).toBe(shown)
    expect(!!screen.queryByLabelText(/someone reports a problem/i)).toBe(shown)
    // What everyone gets, everyone sees.
    expect(screen.getByLabelText(/a scheduled work order is created for me/i)).toBeInTheDocument()
  })

  it('offers nothing the server cannot do: no digest, weekly report or in-app columns', async () => {
    serve()
    renderPage()

    await screen.findByLabelText(/a work order is assigned to me/i)
    for (const gone of [/daily digest/i, /weekly report/i, /in-app/i]) {
      expect(screen.queryByText(gone, { selector: 'h3, th, label, span' })).not.toBeInTheDocument()
    }
    expect(screen.getByText(/not available yet/i)).toBeInTheDocument()
    expect(screen.getByText(/invitations and password reset links are always sent/i)).toBeInTheDocument()
  })

  it('does not show a form that could overwrite preferences it could not load', async () => {
    server.use(http.get('/api/v1/notification_preferences', () => HttpResponse.json({}, { status: 500 })))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i)
    expect(screen.queryByRole('button', { name: /save preferences/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('shows what the server kept after saving, not what was sent', async () => {
    const user = userEvent.setup()
    serve()
    // The server answers with its own record: it kept this one on whatever was sent.
    server.use(
      http.patch('/api/v1/notification_preferences', () => HttpResponse.json({ preferences: prefs() })),
    )
    renderPage()

    const box = await screen.findByLabelText(/a part is running low or out/i)
    await user.click(box)
    expect(box).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: /save preferences/i }))

    await waitFor(() => expect(screen.getByLabelText(/a part is running low or out/i)).toBeChecked())
  })

  it('keeps the form and the changes when saving fails', async () => {
    const user = userEvent.setup()
    serve()
    server.use(
      http.patch('/api/v1/notification_preferences', () =>
        HttpResponse.json({ error: { message: 'Notification preferences can only be switched on or off' } }, { status: 422 }),
      ),
    )
    renderPage()

    await user.click(await screen.findByLabelText(/maintenance is due this week/i))
    await user.click(screen.getByRole('button', { name: /save preferences/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /save preferences/i })).toBeEnabled())
    expect(screen.getByLabelText(/maintenance is due this week/i)).not.toBeChecked()
  })

  describe('alert sound on this device', () => {
    it('is on unless this browser was told otherwise', async () => {
      serve()
      renderPage()

      expect(await screen.findByRole('switch', { name: /alert sound/i })).toBeChecked()
    })

    it('is remembered where the alerts read it, without saving anything to the server', async () => {
      const user = userEvent.setup()
      const saved = serve()
      renderPage()

      await user.click(await screen.findByRole('switch', { name: /alert sound/i }))

      expect(localStorage.getItem('fixflow-alert-sound')).toBe('false')
      expect(screen.getByRole('switch', { name: /alert sound/i })).not.toBeChecked()
      expect(saved.body).toBeUndefined()
    })

    it('shows as off when this browser was told so', async () => {
      localStorage.setItem('fixflow-alert-sound', 'false')
      serve()
      renderPage()

      expect(await screen.findByRole('switch', { name: /alert sound/i })).not.toBeChecked()
    })
  })

  describe('push choices', () => {
    it('shows a Push box for the events that can be pushed, and a dash for the summaries that cannot', async () => {
      serve(prefs({}, true, { wo_assigned: false }))
      renderPage()

      expect(await screen.findByLabelText('Push for an assignment')).not.toBeChecked()
      expect(screen.getByLabelText('Push for a scheduled work order')).toBeChecked()
      expect(screen.getByLabelText('Push for a part running low')).toBeChecked()
      // maintenance due / overdue are summaries, email only
      expect(screen.queryByLabelText(/push for.*(due|overdue)/i)).not.toBeInTheDocument()
    })

    it('saves a push choice apart from the email one', async () => {
      const user = userEvent.setup()
      const saved = serve()
      renderPage()

      await user.click(await screen.findByLabelText('Push for an assignment'))
      await user.click(screen.getByRole('button', { name: /save preferences/i }))

      await waitFor(() => expect(saved.body).toBeDefined())
      const sent = saved.body!.preferences as ReturnType<typeof prefs>
      expect(sent.rules.wo_assigned).toEqual({ email: true, push: false })
      expect(sent.rules.wo_verified).toEqual({ email: true, push: true })
    })

    it('switches every push off with its master switch and greys out the Push boxes, keeping the emails', async () => {
      const user = userEvent.setup()
      const saved = serve()
      renderPage()

      await user.click(await screen.findByRole('switch', { name: /^push notifications$/i }))

      expect(screen.getByLabelText('Push for an assignment')).toBeDisabled()
      expect(screen.getByLabelText(/a work order is assigned to me/i)).toBeEnabled()
      await user.click(screen.getByRole('button', { name: /save preferences/i }))
      await waitFor(() => expect(saved.body).toBeDefined())
      expect((saved.body!.preferences as ReturnType<typeof prefs>).push_enabled).toBe(false)
    })
  })

  describe('push on this device', () => {
    function serveDevices(devices: string[] = [], testResult = { sent: 1, removed: 0, failed: 0 }) {
      const told: string[] = []
      server.use(
        http.get('/api/v1/push_subscriptions', () =>
          HttpResponse.json({ public_key: SERVER_KEY, subscriptions: devices.map((endpoint, id) => ({ id, endpoint, device: 'Chrome', created_at: '', last_sent_at: null })) }),
        ),
        http.post('/api/v1/push_subscriptions/test', () => HttpResponse.json(testResult)),
        http.post('/api/v1/push_subscriptions', () => {
          told.push('subscribe')
          return HttpResponse.json({ subscription: {} }, { status: 201 })
        }),
        http.delete('/api/v1/push_subscriptions', () => {
          told.push('unsubscribe')
          return new HttpResponse(null, { status: 204 })
        }),
      )
      return told
    }

    it('says a browser with no push cannot, with the iPhone way round it, and offers no switch', async () => {
      serve()
      renderPage()

      expect(await screen.findByText(/cannot receive push notifications/i)).toBeInTheDocument()
      expect(screen.getByText(/add FixFlow to the Home Screen/i)).toBeInTheDocument()
      expect(screen.queryByRole('switch', { name: /on this device/i })).not.toBeInTheDocument()
    })

    it('says push needs https on a plain http address, and offers no switch', async () => {
      installPushBrowser({ secure: false })
      serve()
      renderPage()

      expect(await screen.findByText(/need a secure address \(https/i)).toBeInTheDocument()
      expect(screen.queryByRole('switch', { name: /on this device/i })).not.toBeInTheDocument()
    })

    it('turns on for this device when the person allows it, and then offers a test', async () => {
      const user = userEvent.setup()
      installPushBrowser()
      const told = serveDevices()
      serve()
      renderPage()

      const device = await screen.findByRole('switch', { name: /on this device/i })
      expect(device).not.toBeChecked()
      expect(screen.queryByRole('button', { name: /send a test/i })).not.toBeInTheDocument()

      await user.click(device)

      await waitFor(() => expect(screen.getByRole('switch', { name: /on this device/i })).toBeChecked())
      expect(told).toEqual(['subscribe'])
      await user.click(screen.getByRole('button', { name: /send a test/i }))
      expect(await screen.findByText(/it should appear on your devices/i)).toBeInTheDocument()
    })

    it('shows it already on when this browser is subscribed and the server knows it, and turns it off', async () => {
      const user = userEvent.setup()
      installPushBrowser({ subscribedWith: new Uint8Array([4, 1, 2]) })
      const told = serveDevices([ENDPOINT])
      serve()
      renderPage()

      const device = await screen.findByRole('switch', { name: /on this device/i })
      await waitFor(() => expect(device).toBeChecked())
      await user.click(device)

      await waitFor(() => expect(screen.getByRole('switch', { name: /on this device/i })).not.toBeChecked())
      expect(told).toEqual(['unsubscribe'])
    })

    it('says so, and does not turn on, when notifications are blocked in the browser', async () => {
      const user = userEvent.setup()
      installPushBrowser({ permission: 'denied', answer: 'denied' })
      const told = serveDevices()
      serve()
      renderPage()

      expect(await screen.findByText(/blocked for this site/i)).toBeInTheDocument()
      await user.click(screen.getByRole('switch', { name: /on this device/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/blocked/i)
      expect(screen.getByRole('switch', { name: /on this device/i })).not.toBeChecked()
      expect(told).toEqual([])
    })
  })
})
