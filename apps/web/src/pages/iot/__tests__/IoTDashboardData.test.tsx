import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { IoTDashboardPage } from '../IoTDashboardPage'
import { useAuthStore } from '@/stores/authStore'
import { useRealtimeStore } from '@/stores/realtimeStore'

const dashboard = {
  active_sensors: 24, monitored_assets: 18, readings_per_hour: 142, readings_per_hour_change: 12,
  open_alerts: 3, critical_alerts: 1, high_alerts: 2, medium_alerts: 0, active_rules: 21, triggered_rules: 2,
  recent_alerts: [], hourly_readings: [], asset_status: [],
}

const openAlert = {
  id: 9, status: 'open', severity: 'critical', message: 'temperature above 85 °C (reading 91 °C)', sensor_value: 91,
  rule_name: 'Pump too hot', metric_name: 'temperature', metric_unit: '°C', asset_id: 4, asset: { id: 4, name: 'Pump 3', asset_tag: 'FF-000004' },
  created_at: new Date().toISOString(),
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <IoTDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function serve({ dash = () => HttpResponse.json(dashboard) as Response | Promise<Response>, alerts = [openAlert] } = {}) {
  server.use(
    http.get('/api/v1/reports/iot/dashboard', () => dash()),
    http.get('/api/v1/iot_alerts', () => HttpResponse.json({ iot_alerts: alerts, meta: {} })),
  )
}

describe('IoT dashboard', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Admin', role: 'admin', organization_id: 1, created_at: '' }, token: 't', isAuthenticated: true })
    useRealtimeStore.setState({ connected: false, newAlerts: [] })
  })

  it("shows the server's figures", async () => {
    serve()
    renderPage()

    expect(await screen.findByText('24')).toBeInTheDocument()
    expect(screen.getByText('18 assets monitored')).toBeInTheDocument()
    expect(screen.getByText('142')).toBeInTheDocument()
    expect(screen.getByText('1 critical')).toBeInTheDocument()
    expect(screen.getByText('2 triggered today')).toBeInTheDocument()
    expect(screen.getByText('21')).toBeInTheDocument()
  })

  it('shows the count on each severity tab', async () => {
    serve()
    renderPage()

    await screen.findByText('24')
    const tab = (name: RegExp) => screen.getByRole('button', { name })
    expect(tab(/Critical/)).toHaveTextContent('1')
    expect(tab(/High/)).toHaveTextContent('2')
    expect(tab(/All/)).toHaveTextContent('3')
  })

  describe('when the figures cannot be loaded', () => {
    it('says so, and shows no invented figures ("All clear", zeros) or never-ending placeholders in their place', async () => {
      serve({ dash: () => HttpResponse.json({}, { status: 500 }) })
      const { container } = renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i)
      expect(container.querySelector('.animate-pulse')).toBeNull()
      expect(screen.queryByText('All clear')).not.toBeInTheDocument()
      expect(screen.queryByText('No triggers today')).not.toBeInTheDocument()
      expect(screen.queryByText('Active Sensors')).not.toBeInTheDocument()
      expect(screen.queryByText('Readings Activity')).not.toBeInTheDocument()
    })

    it('still shows the open alerts, which come from their own request', async () => {
      serve({ dash: () => HttpResponse.json({}, { status: 500 }) })
      renderPage()

      expect(await screen.findAllByText('Pump too hot')).not.toHaveLength(0)
    })

    it('shows the figures once "Try again" works', async () => {
      const user = userEvent.setup()
      let fail = true
      serve({ dash: () => (fail ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json(dashboard)) })
      renderPage()
      await screen.findByRole('alert')

      fail = false
      await user.click(screen.getByRole('button', { name: /try again/i }))

      expect(await screen.findByText('24')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('shows neither figures nor an error while loading, and says it is not loaded yet', async () => {
    serve({ dash: () => new Promise<Response>(() => {}) })
    renderPage()

    expect(screen.getByText(/Not loaded yet/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('All clear')).not.toBeInTheDocument()
  })

  it('says when the figures were fetched, from the fetch and not from how long the page has been open', async () => {
    serve()
    renderPage()

    await screen.findByText('24')

    await waitFor(() => expect(screen.getByText(/Updated 0s ago/)).toBeInTheDocument())
  })

  it('shows Live when the live connection is up and Offline when it is not', async () => {
    serve()
    renderPage()
    await screen.findByText('24')
    expect(screen.getByText(/Offline/)).toBeInTheDocument()

    useRealtimeStore.setState({ connected: true })

    await waitFor(() => expect(screen.getByText(/Live/)).toBeInTheDocument())
  })
})
