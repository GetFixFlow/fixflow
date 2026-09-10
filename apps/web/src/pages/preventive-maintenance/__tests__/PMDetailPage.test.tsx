import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { PMDetailPage } from '../PMDetailPage'
import { useAuthStore } from '@/stores/authStore'
import type { PreventiveMaintenance } from '@/types'

const mockPM: PreventiveMaintenance = {
  id: 1, name: 'Monthly Pump Oil Change', title: 'Monthly Pump Oil Change',
  status: 'active', priority: 'medium',
  frequency_type: 'time_based', frequency_value: 30, frequency_unit: 'days',
  next_due_at: new Date(Date.now() + 2 * 86400000).toISOString(),
  compliance_rate: 87, completed_count: 12, skipped_count: 2, missed_count: 1,
  asset_id: 1, organization_id: 1, created_at: '', updated_at: '',
  description: 'Check oil level and replace if needed.',
  checklist_template: [
    { step: 1, instruction: 'Shut down pump', required: true },
    { step: 2, instruction: 'Check oil', required: true },
  ],
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/preventive-maintenance/1']}>
        <Routes>
          <Route path="/preventive-maintenance/:id" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('PMDetailPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Manager', role: 'manager', organization_id: 1 }, token: 'tok', isAuthenticated: true })
    server.use(
      http.get('/api/v1/preventive_maintenances/1', () =>
        HttpResponse.json({ data: mockPM, executions: [], meta: { request_id: 'test', timestamp: '' } }),
      ),
      http.get('/api/v1/preventive_maintenances/1/executions', () =>
        HttpResponse.json({ executions: [], meta: { request_id: 'test', timestamp: '' } }),
      ),
      http.get('/api/v1/preventive_maintenances/1/preview_schedule', () =>
        HttpResponse.json({ items: [], meta: { request_id: 'test', timestamp: '' } }),
      ),
      http.get('/api/v1/work_orders', () =>
        HttpResponse.json({ work_orders: [], meta: { request_id: 'test', timestamp: '' } }),
      ),
    )
  })

  it('renders PM name and status', async () => {
    render(<PMDetailPage />, { wrapper })
    // Use findByRole to find the h1 heading containing the PM name
    const heading = await screen.findByRole('heading', { level: 1 }, { timeout: 5000 })
    expect(heading).toHaveTextContent('Monthly Pump Oil Change')
    expect(screen.getByText('Active')).toBeInTheDocument()
  }, 10000)

  it('shows description', async () => {
    render(<PMDetailPage />, { wrapper })
    await waitFor(() => expect(screen.getByText('Check oil level and replace if needed.')).toBeInTheDocument())
  })

  it('manager sees Trigger Now and Edit buttons', async () => {
    render(<PMDetailPage />, { wrapper })
    await waitFor(() => expect(screen.getByRole('button', { name: /trigger now/i })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /edit/i })).toBeInTheDocument()
  })

  it('Trigger Now button opens modal', async () => {
    render(<PMDetailPage />, { wrapper })
    await waitFor(() => screen.getByRole('button', { name: /trigger now/i }))
    await userEvent.click(screen.getByRole('button', { name: /trigger now/i }))
    expect(screen.getByText('Trigger PM Now')).toBeInTheDocument()
  })

  it('Preview Schedule button opens modal', async () => {
    render(<PMDetailPage />, { wrapper })
    await waitFor(() => screen.getByRole('button', { name: /preview schedule/i }))
    await userEvent.click(screen.getByRole('button', { name: /preview schedule/i }))
    expect(screen.getByText('Schedule Preview')).toBeInTheDocument()
  })

  it('compliance stats render correctly', async () => {
    render(<PMDetailPage />, { wrapper })
    await waitFor(() => expect(screen.getByText('87%')).toBeInTheDocument())
  })
})
