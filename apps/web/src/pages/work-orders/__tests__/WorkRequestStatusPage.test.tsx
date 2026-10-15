import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { WorkRequestStatusPage } from '../WorkRequestStatusPage'
import type { WorkRequestStatus } from '@/types'

const TOKEN = 'abcdefghijklmnopqrstuv'

function renderStatus() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/request/${TOKEN}`]}>
        <Routes>
          <Route path="/request/:token" element={<WorkRequestStatusPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function respondWith(status: WorkRequestStatus, extra: Record<string, unknown> = {}) {
  server.use(
    http.get(`/api/v1/work_requests/${TOKEN}`, () =>
      HttpResponse.json({
        data: {
          token: TOKEN,
          title: 'Pump leaking',
          description: 'Leak near the pump',
          status,
          created_at: '2026-10-10T08:00:00Z',
          ...extra,
        },
      }),
    ),
  )
}

describe('WorkRequestStatusPage', () => {
  it.each([
    ['received', 1],
    ['assigned', 2],
    ['in_progress', 3],
    ['completed', 4],
  ] as const)('shows %s with %i of 4 stages reached', async (status, reached) => {
    respondWith(status)
    renderStatus()

    expect(await screen.findByText('Pump leaking')).toBeInTheDocument()
    const stages = screen.getAllByRole('listitem')
    expect(stages).toHaveLength(4)
    // A stage that has been reached explains itself underneath; one that has not stays quiet.
    expect(stages.filter((li) => li.querySelector('p.text-xs'))).toHaveLength(reached)
  })

  it('says a cancelled request was closed without work, instead of showing progress', async () => {
    respondWith('cancelled')
    renderStatus()

    expect(await screen.findByText('CANCELLED')).toBeInTheDocument()
    expect(screen.getByText(/closed without work being done/i)).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('shows what the person typed as plain text, never as markup', async () => {
    respondWith('received', { description: '<img src=x onerror=alert(1)> <b>bold</b>' })
    const { container } = renderStatus()

    expect(await screen.findByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
  })

  it('does not show the link token on the page', async () => {
    respondWith('received')
    renderStatus()

    await screen.findByText('Pump leaking')
    expect(screen.queryByText(TOKEN)).not.toBeInTheDocument()
  })

  it.each([
    [404, /request not found/i],
    [429, /too many requests/i],
    [500, /could not load your request/i],
  ])('says what went wrong for a %i answer, not always "not found"', async (status, message) => {
    server.use(http.get(`/api/v1/work_requests/${TOKEN}`, () => HttpResponse.json({}, { status })))
    renderStatus()

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /submit a new request/i })).toHaveAttribute('href', '/request')
  })
})
