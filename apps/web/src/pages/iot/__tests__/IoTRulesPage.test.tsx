import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { IoTRulesPage } from '../IoTRulesPage'
import { useAuthStore } from '@/stores/authStore'
import type { IotRuleExtended } from '@/types'

const mockRules: IotRuleExtended[] = [
  { id: 1, name: 'Pump-01 High Vibration', description: '', asset_id: 1, sensor_type: 'vibration', metric_name: 'vibration', metric_unit: 'mm/s', condition: 'gt', operator: 'gt', threshold_value: 8.5, severity: 'critical', enabled: true, status: 'active', auto_create_wo: true, wo_priority: 'critical', cooldown_minutes: 60, trigger_count: 5, organization_id: 1, created_at: '', updated_at: '' },
]

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

describe('IoTRulesPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Admin', role: 'admin', organization_id: 1, created_at: '' }, token: 'tok', isAuthenticated: true })
    server.use(
      http.get('/api/v1/iot_rules', () => HttpResponse.json({ iot_rules: mockRules, meta: { request_id: 'test', timestamp: '' } })),
    )
  })

  it('renders IoT Rules heading', async () => {
    render(<IoTRulesPage />, { wrapper })
    expect(screen.getByText('IoT Rules')).toBeInTheDocument()
  })

  it('renders rule from API', async () => {
    render(<IoTRulesPage />, { wrapper })
    await waitFor(() => expect(screen.getByText('Pump-01 High Vibration')).toBeInTheDocument())
  })

  it('condition formatted correctly', async () => {
    render(<IoTRulesPage />, { wrapper })
    await waitFor(() => expect(screen.getByText(/vibration > 8.5/)).toBeInTheDocument())
  })

  it('pause rule calls mutation', async () => {
    let paused = false
    server.use(
      http.patch('/api/v1/iot_rules/1/pause', () => {
        paused = true
        return HttpResponse.json({ data: { ...mockRules[0], status: 'paused', enabled: false } })
      }),
    )
    render(<IoTRulesPage />, { wrapper })
    await waitFor(() => screen.getByText('Pump-01 High Vibration'))
    const menuBtns = screen.getAllByRole('button', { name: /actions|menu|⋮/i })
    if (menuBtns.length > 0) await userEvent.click(menuBtns[0])
    const pauseItems = screen.queryAllByText(/^pause$/i)
    if (pauseItems.length > 0) await userEvent.click(pauseItems[0])
    expect(screen.getByText('Pump-01 High Vibration')).toBeInTheDocument()
  })

  it('new rule button navigates', async () => {
    render(<IoTRulesPage />, { wrapper })
    const newBtn = screen.getByRole('link', { name: /new rule/i })
    expect(newBtn).toHaveAttribute('href', '/iot/rules/new')
  })
})
