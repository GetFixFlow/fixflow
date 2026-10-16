import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { SessionsCard } from '../SessionsCard'
import type { UserSession } from '@/api/settings'

const now = new Date().toISOString()
const laptop: UserSession = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001', device: 'Chrome on macOS', ip_address: '203.0.113.7',
  created_at: now, last_active_at: now, current: true,
}
const phone: UserSession = {
  id: 'bbbbbbbb-0000-0000-0000-000000000002', device: 'Safari on iOS', ip_address: '198.51.100.2',
  created_at: now, last_active_at: new Date(Date.now() - 3 * 3600_000).toISOString(), current: false,
}

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SessionsCard />
    </QueryClientProvider>,
  )
}

/** Serves these sessions; ending one removes it, as the server does. */
function serve(initial: UserSession[]) {
  let sessions = initial
  const calls: string[] = []
  server.use(
    http.get('/api/v1/sessions', () => HttpResponse.json({ sessions })),
    http.delete('/api/v1/sessions/all', () => {
      calls.push('all')
      const revoked = sessions.filter((s) => !s.current).length
      sessions = sessions.filter((s) => s.current)
      return HttpResponse.json({ revoked })
    }),
    http.delete('/api/v1/sessions/:id', ({ params }) => {
      calls.push(String(params.id))
      sessions = sessions.filter((s) => s.id !== params.id)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

describe('SessionsCard', () => {
  it('lists where the person is signed in, with the device and address of each', async () => {
    serve([laptop, phone])
    renderCard()

    expect(await screen.findByText('Chrome on macOS')).toBeInTheDocument()
    expect(screen.getByText('Safari on iOS')).toBeInTheDocument()
    expect(screen.getByText('203.0.113.7')).toBeInTheDocument()
    expect(screen.getByText('198.51.100.2')).toBeInTheDocument()
    expect(screen.getByText('Now')).toBeInTheDocument()
    expect(screen.getByText(/3 hours ago/)).toBeInTheDocument()
  })

  it('offers to end the other sessions but not the one being used', async () => {
    serve([laptop, phone])
    renderCard()

    const rows = await screen.findAllByRole('row')
    const laptopRow = rows.find((r) => within(r).queryByText('Chrome on macOS'))!
    const phoneRow = rows.find((r) => within(r).queryByText('Safari on iOS'))!
    expect(within(laptopRow).getByText('Current')).toBeInTheDocument()
    expect(within(laptopRow).queryByRole('button')).not.toBeInTheDocument()
    expect(within(phoneRow).getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('ends one session and shows the list without it', async () => {
    const user = userEvent.setup()
    const calls = serve([laptop, phone])
    renderCard()

    const phoneRow = (await screen.findAllByRole('row')).find((r) => within(r).queryByText('Safari on iOS'))!
    await user.click(within(phoneRow).getByRole('button', { name: /sign out/i }))

    await waitFor(() => expect(screen.queryByText('Safari on iOS')).not.toBeInTheDocument())
    expect(calls).toEqual([phone.id])
    expect(screen.getByText('Chrome on macOS')).toBeInTheDocument()
  })

  it('ends all the others at once, and keeps this one', async () => {
    const user = userEvent.setup()
    const calls = serve([laptop, phone, { ...phone, id: 'cccccccc-0000-0000-0000-000000000003' }])
    renderCard()

    await user.click(await screen.findByRole('button', { name: /sign out of all other sessions/i }))

    await waitFor(() => expect(screen.queryByText('Safari on iOS')).not.toBeInTheDocument())
    expect(calls).toEqual(['all'])
    expect(screen.getByText('Chrome on macOS')).toBeInTheDocument()
  })

  it('has nothing to end when this is the only session', async () => {
    serve([laptop])
    renderCard()

    expect(await screen.findByRole('button', { name: /sign out of all other sessions/i })).toBeDisabled()
  })

  it('shows the list as it is when a session was already ended somewhere else', async () => {
    const user = userEvent.setup()
    serve([laptop, phone])
    server.use(
      http.delete('/api/v1/sessions/:id', () => HttpResponse.json({ error: { code: 'RESOURCE_NOT_FOUND' } }, { status: 404 })),
    )
    renderCard()
    const phoneRow = (await screen.findAllByRole('row')).find((r) => within(r).queryByText('Safari on iOS'))!

    server.use(http.get('/api/v1/sessions', () => HttpResponse.json({ sessions: [laptop] })))
    await user.click(within(phoneRow).getByRole('button', { name: /sign out/i }))

    await waitFor(() => expect(screen.queryByText('Safari on iOS')).not.toBeInTheDocument())
  })

  it('says so, and offers to retry, when the list cannot be loaded', async () => {
    server.use(http.get('/api/v1/sessions', () => HttpResponse.json({}, { status: 500 })))
    renderCard()

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i)
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('does not invent a location: there is an address column and no "Location"', async () => {
    serve([laptop])
    renderCard()

    await screen.findByText('Chrome on macOS')
    expect(screen.getByText('Address')).toBeInTheDocument()
    expect(screen.queryByText('Location')).not.toBeInTheDocument()
  })
})
