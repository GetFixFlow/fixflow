import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { PMListPage } from '../PMListPage'
import { useAuthStore } from '@/stores/authStore'
import type { PreventiveMaintenance } from '@/types'

const mockPMs: PreventiveMaintenance[] = [
  {
    id: 1, name: 'Monthly Pump Oil Change', title: 'Monthly Pump Oil Change',
    status: 'active', priority: 'medium',
    frequency_type: 'time_based', frequency_value: 30, frequency_unit: 'days',
    next_due_at: new Date(Date.now() + 2 * 86400000).toISOString(),
    compliance_rate: 87, completed_count: 12, skipped_count: 2, missed_count: 1,
    asset_id: 1, organization_id: 1, created_at: '', updated_at: '',
  },
  {
    id: 2, name: 'HVAC Filter Replace', title: 'HVAC Filter Replace',
    status: 'paused', priority: 'low',
    frequency_type: 'time_based', frequency_value: 90, frequency_unit: 'days',
    next_due_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    compliance_rate: 60,
    asset_id: 2, organization_id: 1, created_at: '', updated_at: '',
  },
]

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

describe('PMListPage', () => {
  beforeEach(() => {
    localStorage.removeItem('pm-view-mode')
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Manager', role: 'manager', organization_id: 1 }, token: 'tok', isAuthenticated: true })
    server.use(
      http.get('/api/v1/preventive_maintenances', () =>
        HttpResponse.json({ preventive_maintenances: mockPMs, meta: { request_id: 'test', timestamp: '' } }),
      ),
    )
  })

  it('renders PM cards from mock API', async () => {
    render(<PMListPage />, { wrapper })
    await waitFor(() => expect(screen.getByText('Monthly Pump Oil Change')).toBeInTheDocument())
    expect(screen.getByText('HVAC Filter Replace')).toBeInTheDocument()
  })

  it('paused tab filters correctly', async () => {
    render(<PMListPage />, { wrapper })
    await waitFor(() => screen.getByText('Monthly Pump Oil Change'))
    await userEvent.click(screen.getByRole('tab', { name: /paused/i }))
    await waitFor(() => {
      expect(screen.queryByText('Monthly Pump Oil Change')).not.toBeInTheDocument()
      expect(screen.getByText('HVAC Filter Replace')).toBeInTheDocument()
    })
  })

  it('overdue tab shows only overdue PMs', async () => {
    render(<PMListPage />, { wrapper })
    await waitFor(() => screen.getByText('Monthly Pump Oil Change'))
    await userEvent.click(screen.getByRole('tab', { name: /overdue/i }))
    // HVAC is overdue (due in past) but status is paused not active, so nothing shows
    await waitFor(() => expect(screen.queryByText('Monthly Pump Oil Change')).not.toBeInTheDocument())
  })

  it('search filters PM cards', async () => {
    render(<PMListPage />, { wrapper })
    await waitFor(() => screen.getByText('Monthly Pump Oil Change'))
    const searchInput = screen.getByPlaceholderText(/search pm schedules/i)
    await userEvent.type(searchInput, 'HVAC')
    expect(screen.queryByText('Monthly Pump Oil Change')).not.toBeInTheDocument()
    expect(screen.getByText('HVAC Filter Replace')).toBeInTheDocument()
  })

  it('view toggle switches to table view', async () => {
    render(<PMListPage />, { wrapper })
    await waitFor(() => screen.getByText('Monthly Pump Oil Change'))
    // Find table button (Table2 icon button) - title="table"
    const buttons = screen.getAllByRole('button')
    const tableBtn = buttons.find((b) => b.getAttribute('title') === 'table')
    if (tableBtn) await userEvent.click(tableBtn)
    // Table should show "Name" header
    await waitFor(() => expect(screen.getByText('Name')).toBeInTheDocument())
  })

  it('trigger now button opens TriggerPMModal', async () => {
    render(<PMListPage />, { wrapper })
    // Wait for PM cards to render - the Trigger Now buttons appear on cards for active PMs
    const triggerBtns = await screen.findAllByText('Trigger Now', undefined, { timeout: 5000 })
    await userEvent.click(triggerBtns[0])
    expect(screen.getByText('Trigger PM Now')).toBeInTheDocument()
  }, 10000)
})
