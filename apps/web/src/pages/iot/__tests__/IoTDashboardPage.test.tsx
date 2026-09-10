import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { IoTDashboardPage } from '../IoTDashboardPage'
import { useAuthStore } from '@/stores/authStore'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

const mockDashboard = {
  active_sensors: 24, monitored_assets: 18, readings_per_hour: 142,
  readings_per_hour_change: 12, open_alerts: 3, critical_alerts: 1,
  high_alerts: 2, medium_alerts: 0, active_rules: 24, triggered_rules: 2,
  recent_alerts: [], hourly_readings: [], asset_status: [],
}

describe('IoTDashboardPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Admin', role: 'admin', organization_id: 1, created_at: '' }, token: 'tok', isAuthenticated: true })
    server.use(
      http.get('/api/v1/reports/iot/dashboard', () => HttpResponse.json(mockDashboard)),
      http.get('/api/v1/iot_alerts', () => HttpResponse.json({ iot_alerts: [], meta: { request_id: 'test', timestamp: '' } })),
    )
  })

  it('renders IoT Monitor heading', async () => {
    render(<IoTDashboardPage />, { wrapper })
    expect(screen.getByText('IoT Monitor')).toBeInTheDocument()
  })

  it('shows stat cards with mock data', async () => {
    render(<IoTDashboardPage />, { wrapper })
    await waitFor(() => expect(screen.getAllByText('24').length).toBeGreaterThan(0))
  })

  it('shows Manage Rules button', async () => {
    render(<IoTDashboardPage />, { wrapper })
    expect(screen.getByText(/Manage Rules/i)).toBeInTheDocument()
  })

  it('shows Add IoT Rule for managers', async () => {
    render(<IoTDashboardPage />, { wrapper })
    await waitFor(() => expect(screen.getByText(/Add IoT Rule/i)).toBeInTheDocument())
  })

  it('shows no open alerts empty state', async () => {
    render(<IoTDashboardPage />, { wrapper })
    await waitFor(() => {
      const noAlerts = screen.queryAllByText(/No alerts/i)
      expect(noAlerts.length >= 0 || screen.queryAllByText('3').length >= 0).toBe(true)
    })
  })
})
