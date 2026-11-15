import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { IotPage } from '../IotPage'

function renderPage() {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role: 'manager', organization_id: 1 } as never, token: 't', isAuthenticated: true })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><IotPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('IotPage', () => {
  it('has the sensors heading for a limit above the unusual readings', async () => {
    server.use(
      http.get('/api/v1/iot_alerts', () => HttpResponse.json({ iot_alerts: [], meta: {} })),
      http.get('/api/v1/ai/forecasts/limits', () => HttpResponse.json({ data: [{
        rule: { id: 3, name: 'Pump too hot' }, asset: { id: 5, name: 'Pump 3', asset_tag: null, location_path: null }, metric_name: 'temperature', unit: '°C',
        limit: 85, current: 75, slope_per_day: 0.5, days_left: 20, days_soonest: 15, days_latest: 26, reaches_on: '2026-12-04', r2: 0.9, days_of_history: 29, points: 30,
      }] })),
    )
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Heading for a limit' })).toBeInTheDocument()
    expect(await screen.findByText(/temperature is 75 °C and rising by 0.5 °C a day/)).toBeInTheDocument()
  })

  it('lists the unusual readings on the page people reach from the menu, even when there are no alerts', async () => {
    server.use(
      http.get('/api/v1/iot_alerts', () => HttpResponse.json({ iot_alerts: [], meta: {} })),
      http.get('/api/v1/sensor_anomalies', ({ request }) => HttpResponse.json({
        sensor_anomalies: new URL(request.url).searchParams.get('status') === 'open'
          ? [{ id: 1, status: 'open', metric_name: 'temperature', unit: '°C', value: 91.2, usual_low: 62, usual_high: 74, usual_middle: 68, score: 9, baseline_count: 300, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), acknowledged_at: null, notes: null, asset_id: 5, message: '', asset: { id: 5, name: 'Pump 3', asset_tag: null }, location_path: null, acknowledged_by: null }]
          : [],
      })),
    )
    renderPage()

    expect(await screen.findByRole('link', { name: 'Pump 3' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Unusual readings' })).toBeInTheDocument()
    expect(await screen.findByText('No open alerts')).toBeInTheDocument()
  })
})
