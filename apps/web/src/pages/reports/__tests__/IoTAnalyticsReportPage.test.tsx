import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { IoTAnalyticsReportPage } from '../IoTAnalyticsReportPage'

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <IoTAnalyticsReportPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('IoT analytics report', () => {
  it("shows the server's figures, and calls the resolved share what it is (nothing here resolves alerts by itself)", async () => {
    server.use(
      http.get('/api/v1/reports/iot/alerts', () => HttpResponse.json({
        total_alerts: 37, critical_count: 5, resolved_rate: 62.5, open_count: 14, work_orders_created: 9, trend: [], sensor_series: [],
      })),
      http.get('/api/v1/reports/iot/rule_effectiveness', () => HttpResponse.json({
        active_count: 6,
        rules: [{ rule_id: 1, rule_name: 'Pump too hot', asset_name: 'Pump 3', trigger_count: 12, wo_created: 4, resolve_rate: 75, avg_resolution_hours: 3.5 }],
      })),
    )
    renderPage()

    expect(await screen.findByText('37')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('62.5%')).toBeInTheDocument()
    expect(screen.getByText('Resolved Rate')).toBeInTheDocument()
    expect(screen.queryByText(/auto-resolved/i)).not.toBeInTheDocument()
    expect(await screen.findByText('Pump too hot')).toBeInTheDocument()
    expect(screen.getByText('Resolved %')).toBeInTheDocument()
    expect(screen.getByText('75.0%')).toBeInTheDocument()
    expect(screen.getByText('3.5h')).toBeInTheDocument()
  })
})
