import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { WorkOrdersListPage } from '../WorkOrdersListPage'
import { useAuthStore } from '@/stores/authStore'
import type { WorkOrder } from '@/types'

const mockWOs: WorkOrder[] = [
  {
    id: 1,
    work_order_number: 'WO-000001',
    title: 'Fix pump motor',
    status: 'open',
    priority: 'high',
    work_order_type: 'corrective',
    source: 'manual',
    organization_id: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    work_order_number: 'WO-000002',
    title: 'Replace filter',
    status: 'in_progress',
    priority: 'critical',
    work_order_type: 'preventive',
    source: 'pm',
    due_date: new Date(Date.now() - 86400000).toISOString(), // overdue
    organization_id: 1,
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
]

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function setupHandlers(wos = mockWOs) {
  server.use(
    http.get('/api/v1/work_orders', () =>
      HttpResponse.json({ work_orders: wos, meta: { request_id: 'test', timestamp: '' } }),
    ),
  )
}

describe('WorkOrdersListPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 1, email: '', full_name: 'Admin', role: 'admin', organization_id: 1 },
      token: 'token',
      isAuthenticated: true,
    })
  })

  it('renders list with mock data', async () => {
    setupHandlers()
    render(<WorkOrdersListPage />, { wrapper })
    await waitFor(() => expect(screen.getByText('Fix pump motor')).toBeInTheDocument())
    expect(screen.getByText('Replace filter')).toBeInTheDocument()
  })

  it('shows kanban view by default for managers', async () => {
    setupHandlers()
    render(<WorkOrdersListPage />, { wrapper })
    // Kanban columns should be visible
    await waitFor(() => expect(screen.getAllByRole('group').length).toBeGreaterThan(0))
  })

  it('can switch to table view', async () => {
    setupHandlers()
    render(<WorkOrdersListPage />, { wrapper })
    const tableBtn = screen.getByRole('button', { name: /table/i })
    await userEvent.click(tableBtn)
    await waitFor(() => expect(screen.getByText('WO #')).toBeInTheDocument())
  })

  it('overdue tab shows only overdue WOs', async () => {
    setupHandlers()
    render(<WorkOrdersListPage />, { wrapper })
    const overdueTab = screen.getByRole('tab', { name: /overdue/i })
    await userEvent.click(overdueTab)
    // Switch to table view to see rows
    const tableBtn = screen.getByRole('button', { name: /table/i })
    await userEvent.click(tableBtn)
    await waitFor(() => expect(screen.getByText('Replace filter')).toBeInTheDocument())
    expect(screen.queryByText('Fix pump motor')).not.toBeInTheDocument()
  })

  it('table rows show correct priority badges', async () => {
    setupHandlers()
    render(<WorkOrdersListPage />, { wrapper })
    const tableBtn = screen.getByRole('button', { name: /table/i })
    await userEvent.click(tableBtn)
    await waitFor(() =>
      expect(screen.getByRole('cell', { name: /priority: high/i })).toBeInTheDocument(),
    )
  })

  it('bulk selection triggers action bar', async () => {
    setupHandlers()
    render(<WorkOrdersListPage />, { wrapper })
    const tableBtn = screen.getByRole('button', { name: /table/i })
    await userEvent.click(tableBtn)
    await waitFor(() => expect(screen.getByLabelText(/select all/i)).toBeInTheDocument())
    await userEvent.click(screen.getByLabelText(/select all/i))
    // Multiple elements contain "selected" (bulk bar text + button labels + parent div)
    expect(screen.getAllByText(/selected/i).length).toBeGreaterThan(0)
  })
})
