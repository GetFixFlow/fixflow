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
