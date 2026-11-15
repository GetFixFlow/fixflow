import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { setLanguage } from '@/i18n'
import { useAuthStore } from '@/stores/authStore'
import type { SensorAnomaly } from '@/api/ai'
import { UnusualReadings } from '../UnusualReadings'

const anomaly = (over: Partial<SensorAnomaly> = {}): SensorAnomaly => ({
  id: 1, status: 'open', metric_name: 'temperature', unit: '°C', value: 91.2, usual_low: 62, usual_high: 74.25, usual_middle: 68,
  score: 9.5, baseline_count: 300, recorded_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), created_at: new Date().toISOString(),
  acknowledged_at: null, notes: null, asset_id: 5, message: 'temperature reads 91.2 °C', asset: { id: 5, name: 'Pump 3', asset_tag: 'P-3' },
  location_path: null, acknowledged_by: null, ...over,
})

function renderIt(role = 'manager') {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role, organization_id: 1 } as never, token: 't', isAuthenticated: true })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><UnusualReadings /></MemoryRouter>
    </QueryClientProvider>,
  )
}

/** The server's side: the flags it has, by status, and a record of who was told what. */
function serve(open: SensorAnomaly[], acknowledged: SensorAnomaly[] = []) {
  const answered: string[] = []
  server.use(
    http.get('/api/v1/sensor_anomalies', ({ request }) => {
      const status = new URL(request.url).searchParams.get('status')
      return HttpResponse.json({ sensor_anomalies: status === 'open' ? open : status === 'acknowledged' ? acknowledged : [] })
    }),
    http.patch('/api/v1/sensor_anomalies/:id/:action', ({ params }) => {
      answered.push(`${params.id}:${params.action}`)
      return HttpResponse.json({ data: anomaly() })
    }),
  )
  return answered
}

const config = (features: Record<string, boolean>, enabled = true) =>
  http.get('/api/v1/ai/config', () => HttpResponse.json({ success: true, data: { enabled, model: 'm', provider: 'local', source: 'app', features }, meta: {} }))

beforeEach(async () => {
  await setLanguage('en', false)
})

describe('UnusualReadings', () => {
  it('lists what is unusual, with what was usual for that sensor', async () => {
    serve([anomaly()])
    renderIt()

    expect(await screen.findByRole('link', { name: 'Pump 3' })).toHaveAttribute('href', '/assets/5')
    expect(screen.getByRole('heading', { name: 'Unusual readings' })).toBeInTheDocument()
    expect(screen.getByText(/temperature reads 91.2 °C/)).toBeInTheDocument()
    expect(screen.getByText(/Usually 62 to 74.25 °C, from 300 readings/)).toBeInTheDocument()
    expect(screen.getByText(/10 minutes ago/)).toBeInTheDocument()
  })

  it('says so when nothing is unusual', async () => {
    serve([])
    renderIt()

    expect(await screen.findByText('Nothing unusual right now.')).toBeInTheDocument()
  })

  it('keeps the ones someone is looking into on the list, without the button that says they are real', async () => {
    serve([], [anomaly({ id: 2, status: 'acknowledged' })])
    renderIt()

    expect(await screen.findByText(/temperature reads/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "It's real" })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: "It's nothing" })).toBeInTheDocument()
  })

  it('lets a manager say it is real, or nothing', async () => {
    const answered = serve([anomaly({ id: 1 }), anomaly({ id: 2 })])
    renderIt('manager')
    const real = await screen.findAllByRole('button', { name: "It's real" })

    await userEvent.click(real[0])
    await userEvent.click(screen.getAllByRole('button', { name: "It's nothing" })[1])

    await waitFor(() => expect(answered).toEqual(['1:acknowledge', '2:dismiss']))
  })

  it('shows a technician the list but no buttons', async () => {
    serve([anomaly()])
    renderIt('technician')

    expect(await screen.findByText(/temperature reads/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows nothing, and asks for nothing, when an administrator switched it off or AI is off', async () => {
    let asked = 0
    server.use(config({ priority: true, anomalies: false }), http.get('/api/v1/sensor_anomalies', () => { asked += 1; return HttpResponse.json({ sensor_anomalies: [] }) }))
    renderIt()
    await new Promise((resolve) => setTimeout(resolve, 150))

    expect(screen.queryByRole('heading', { name: 'Unusual readings' })).not.toBeInTheDocument()
    expect(asked).toBe(0)
  })

  it('reads in Spanish', async () => {
    await setLanguage('es', false)
    serve([anomaly()])
    renderIt()

    expect(await screen.findByText(/temperature marca 91.2 °C/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lecturas inusuales' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Es real' })).toBeInTheDocument()
  })
})
