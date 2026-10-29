import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { AdvancedSettingsPage } from '../AdvancedSettingsPage'
import type { Role } from '@/types'

let patches: unknown[]

/** Like the real server: what is saved is what the next read returns. */
function serve(enabled: boolean | 'fail' = true) {
  let current = enabled
  server.use(
    http.get('/api/v1/organization_settings', () => (current === 'fail'
      ? HttpResponse.json({}, { status: 500 })
      : HttpResponse.json({ organization: { public_requests_enabled: current } }))),
    http.patch('/api/v1/organization_settings', async ({ request }) => {
      const body = (await request.json()) as { organization: { public_requests_enabled: boolean } }
      patches.push(body)
      current = body.organization.public_requests_enabled
      return HttpResponse.json({ organization: {} })
    }),
  )
}

function renderPage(role: Role = 'admin') {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role, organization_id: 1 } as never, token: 't', isAuthenticated: true })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><AdvancedSettingsPage /></MemoryRouter></QueryClientProvider>)
}

const SWITCH = { name: /accept requests from people with no account/i }

beforeEach(() => { patches = [] })

describe('AdvancedSettingsPage', () => {
  it('shows the public request form as on, with its real address', async () => {
    serve(true)
    renderPage()
    const toggle = await screen.findByRole('switch', SWITCH)
    await waitFor(() => expect(toggle).toBeEnabled())
    expect(toggle).toBeChecked()
    expect(screen.getByRole('status')).toHaveTextContent('On: the form takes requests.')
    expect(screen.getByText(`${window.location.origin}/request`)).toBeInTheDocument()
  })

  it('shows it as off, and what that means for people', async () => {
    serve(false)
    renderPage()
    const toggle = await screen.findByRole('switch', SWITCH)
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(screen.getByRole('status')).toHaveTextContent('Off: the form refuses new requests')
    expect(screen.getByRole('status')).toHaveTextContent('Links people already have still show')
  })

  it('turns the form off, and back on, by saving the company setting', async () => {
    const user = userEvent.setup()
    serve(true)
    renderPage()
    const toggle = await screen.findByRole('switch', SWITCH)
    await waitFor(() => expect(toggle).toBeEnabled())
    await user.click(toggle)
    await waitFor(() => expect(patches).toEqual([{ organization: { public_requests_enabled: false } }]))
    await waitFor(() => expect(screen.getByRole('switch', SWITCH)).not.toBeChecked())
    await user.click(screen.getByRole('switch', SWITCH))
    await waitFor(() => expect(patches).toHaveLength(2))
    expect(patches[1]).toEqual({ organization: { public_requests_enabled: true } })
  })

  it('does not let the switch be used when the setting could not be loaded', async () => {
    serve('fail')
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this setting')
    expect(screen.getByRole('switch', SWITCH)).toBeDisabled()
  })

  it('no longer has controls that were never connected to anything', async () => {
    serve(true)
    renderPage()
    await screen.findByRole('switch', SWITCH)
    for (const gone of [/Self-Registration/i, /Maintenance Mode/i, /Delete Organization/i, /Reset Demo Data/i, /Danger Zone/i,
      /Save Application Settings/i, /fixflow\.io/i]) {
      expect(screen.queryByText(gone)).toBeNull()
    }
  })

  it('no longer shows made-up system information or an update check that always says you are up to date', async () => {
    serve(true)
    renderPage()
    await screen.findByRole('switch', SWITCH)
    for (const invented of [/Session 15/, /Rails Version/, /PostgreSQL Version/, /Redis Version/, /Node Version/, /Check for Updates/,
      /running the latest version/]) {
      expect(screen.queryByText(invented)).toBeNull()
    }
  })

  it('points to the real System Health page', async () => {
    serve(true)
    renderPage()
    expect(await screen.findByRole('link', { name: /Open System Health/ })).toHaveAttribute('href', '/settings/system-health')
  })

  describe('requiring two-factor sign-in', () => {
    const REQUIRE = { name: /require two-factor sign-in for everyone/i }

    /** A server that remembers what was saved. */
    function serveTwoFactor(required: boolean) {
      let current = required
      server.use(
        http.get('/api/v1/organization_settings', () =>
          HttpResponse.json({ organization: { public_requests_enabled: true, require_two_factor: current } })),
        http.patch('/api/v1/organization_settings', async ({ request }) => {
          const body = (await request.json()) as { organization: { require_two_factor: boolean } }
          patches.push(body)
          current = body.organization.require_two_factor
          return HttpResponse.json({ organization: {} })
        }),
      )
    }

    it('shows it as off by default, and turns it on by saving the company setting', async () => {
      serveTwoFactor(false)
      renderPage()
      const toggle = await screen.findByRole('switch', REQUIRE)
      await waitFor(() => expect(toggle).toBeEnabled())
      expect(toggle).not.toBeChecked()
      expect(screen.getByText('Off: each person chooses whether to use it.')).toBeInTheDocument()

      await userEvent.click(toggle)

      await waitFor(() => expect(toggle).toBeChecked())
      expect(patches).toEqual([{ organization: { require_two_factor: true } }])
      expect(screen.getByText(/On: everyone needs an authenticator app/)).toBeInTheDocument()
    })

    it('shows it as on, and turns it off', async () => {
      serveTwoFactor(true)
      renderPage()
      const toggle = await screen.findByRole('switch', REQUIRE)
      await waitFor(() => expect(toggle).toBeChecked())

      await userEvent.click(toggle)

      await waitFor(() => expect(toggle).not.toBeChecked())
      expect(patches).toEqual([{ organization: { require_two_factor: false } }])
    })
  })

  it('is for administrators only', () => {
    serve(true)
    renderPage('manager')
    expect(screen.getByText(/Only administrators can change advanced settings/)).toBeInTheDocument()
    expect(screen.queryByRole('switch')).toBeNull()
  })
})
