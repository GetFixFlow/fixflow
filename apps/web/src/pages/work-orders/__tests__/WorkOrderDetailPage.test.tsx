import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { WorkOrderDetailPage } from '../WorkOrderDetailPage'
import { useAuthStore } from '@/stores/authStore'
import type { WorkOrder } from '@/types'

const mockWO: WorkOrder = {
  id: 1,
  work_order_number: 'WO-000001',
  title: 'Fix Pump-01',
  description: 'The pump is making noise.',
  status: 'in_progress',
  priority: 'high',
  work_order_type: 'corrective',
  source: 'manual',
  organization_id: 1,
  assignee: { id: 2, email: '', full_name: 'Carlos Tech', role: 'technician', organization_id: 1, created_at: '' },
  assignee_id: 2,
  requester: { id: 1, email: '', full_name: 'Alice Admin', role: 'admin', organization_id: 1, created_at: '' },
  requester_id: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const completedWO: WorkOrder = { ...mockWO, id: 2, status: 'completed', completed_at: '2026-01-02T00:00:00Z' }

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/work-orders/1']}>
        <Routes>
          <Route path="/work-orders/:id" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function completedWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/work-orders/2']}>
        <Routes>
          <Route path="/work-orders/:id" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function setupHandlers(wo = mockWO) {
  server.use(
    http.get(`/api/v1/work_orders/${wo.id}`, () =>
      HttpResponse.json({ data: wo, meta: { request_id: 'test', timestamp: '' } }),
    ),
    http.get(`/api/v1/work_orders/${wo.id}/comments`, () =>
      HttpResponse.json({ comments: [] }),
    ),
    http.get(`/api/v1/work_orders/${wo.id}/attachments`, () =>
      HttpResponse.json({ attachments: [] }),
    ),
    http.get(`/api/v1/work_orders/${wo.id}/parts`, () =>
      HttpResponse.json({ parts: [] }),
    ),
  )
}

describe('WorkOrderDetailPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 1, email: '', full_name: 'Admin', role: 'admin', organization_id: 1 },
      token: 'token',
      isAuthenticated: true,
    })
  })

  it('renders all sections correctly', async () => {
    setupHandlers()
    render(<WorkOrderDetailPage />, { wrapper })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Fix Pump-01' })).toBeInTheDocument())
    expect(screen.getByText('WO-000001')).toBeInTheDocument()
    expect(screen.getByText('The pump is making noise.')).toBeInTheDocument()
  })

  it('shows tabs', async () => {
    setupHandlers()
    render(<WorkOrderDetailPage />, { wrapper })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Fix Pump-01' })).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: /comments/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /attachments/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /parts/i })).toBeInTheDocument()
  })

  it('technician sees Start Work button when assigned to them', async () => {
    setupHandlers({ ...mockWO, status: 'assigned', assignee_id: 3 })
    useAuthStore.setState({
      user: { id: 3, email: '', full_name: 'Carlos Tech', role: 'technician', organization_id: 1 },
      token: 'token',
      isAuthenticated: true,
    })
    server.use(
      http.get('/api/v1/work_orders/1', () =>
        HttpResponse.json({
          data: { ...mockWO, status: 'assigned', assignee_id: 3 },
          meta: { request_id: 'test', timestamp: '' },
        }),
      ),
    )
    render(<WorkOrderDetailPage />, { wrapper })
    await waitFor(() =>
      expect(screen.getByText(/start work/i)).toBeInTheDocument(),
    )
  })

  it('manager sees Verify button on completed WO', async () => {
    setupHandlers(completedWO)
    server.use(
      http.get('/api/v1/work_orders/2', () =>
        HttpResponse.json({
          data: completedWO,
          meta: { request_id: 'test', timestamp: '' },
        }),
      ),
      http.get('/api/v1/work_orders/2/comments', () => HttpResponse.json({ comments: [] })),
      http.get('/api/v1/work_orders/2/attachments', () => HttpResponse.json({ attachments: [] })),
      http.get('/api/v1/work_orders/2/parts', () => HttpResponse.json({ parts: [] })),
    )
    render(<WorkOrderDetailPage />, { wrapper: completedWrapper })
    await waitFor(() =>
      expect(screen.getByText(/verify/i)).toBeInTheDocument(),
    )
  })

  it('technician does not see Verify button', async () => {
    setupHandlers(completedWO)
    useAuthStore.setState({
      user: { id: 3, email: '', full_name: 'Tech', role: 'technician', organization_id: 1 },
      token: 'token',
      isAuthenticated: true,
    })
    server.use(
      http.get('/api/v1/work_orders/2', () =>
        HttpResponse.json({
          data: completedWO,
          meta: { request_id: 'test', timestamp: '' },
        }),
      ),
      http.get('/api/v1/work_orders/2/comments', () => HttpResponse.json({ comments: [] })),
      http.get('/api/v1/work_orders/2/attachments', () => HttpResponse.json({ attachments: [] })),
      http.get('/api/v1/work_orders/2/parts', () => HttpResponse.json({ parts: [] })),
    )
    render(<WorkOrderDetailPage />, { wrapper: completedWrapper })
    await waitFor(() =>
      expect(screen.getByText('Fix Pump-01')).toBeInTheDocument(),
    )
    expect(screen.queryByText(/verify/i)).not.toBeInTheDocument()
  })

  it('shows not found for missing WO', async () => {
    server.use(
      http.get('/api/v1/work_orders/1', () =>
        HttpResponse.json({ error: 'not found' }, { status: 404 }),
      ),
    )
    render(<WorkOrderDetailPage />, { wrapper })
    await waitFor(() =>
      expect(screen.getByText(/not found or you don't have access/i)).toBeInTheDocument(),
    )
  })
})
