import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { NotificationsPage } from '../NotificationsPage'

const EVENTS = [
  'wo_assigned', 'wo_verified', 'wo_needs_verification', 'wo_new_request',
  'pm_generated', 'pm_due_soon', 'pm_overdue', 'part_low_stock',
]

function prefs(overrides: Record<string, boolean> = {}, emailEnabled = true) {
  return {
    email_enabled: emailEnabled,
    rules: Object.fromEntries(EVENTS.map((e) => [e, { email: overrides[e] ?? true }])),
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
    expect(sent.rules.part_low_stock).toEqual({ email: false })
    expect(sent.rules.wo_assigned).toEqual({ email: true })
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

  it('offers nothing the server cannot do: no push, digest, weekly report or in-app columns', async () => {
    serve()
    renderPage()

    await screen.findByLabelText(/a work order is assigned to me/i)
    for (const gone of [/push/i, /daily digest/i, /weekly report/i, /in-app/i]) {
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
})
