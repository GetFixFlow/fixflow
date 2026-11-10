import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { setLanguage } from '@/i18n'
import { useAuthStore } from '@/stores/authStore'
import { WorkOrdersListPage } from '../WorkOrdersListPage'
import { WorkOrderDetailPage } from '../WorkOrderDetailPage'
import { WorkOrderCreatePage } from '../WorkOrderCreatePage'
import { WorkRequestPortalPage } from '../WorkRequestPortalPage'
import { WorkRequestStatusPage } from '../WorkRequestStatusPage'
import type { WorkOrder } from '@/types'

// The same screens as in English, in Spanish. The English tests (next to this file) keep the English words honest.

const wo: WorkOrder = {
  id: 1, work_order_number: 'WO-000001', title: 'Bomba con ruido', description: 'Hace ruido.', status: 'in_progress', priority: 'high',
  work_order_type: 'corrective', source: 'manual', organization_id: 1,
  assignee: { id: 2, email: '', full_name: 'Carlos Tech', role: 'technician', organization_id: 1 }, assignee_id: 2,
  requester: { id: 1, email: '', full_name: 'Alice Admin', role: 'admin', organization_id: 1 }, requester_id: 1,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

function renderIn(ui: React.ReactNode, url = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/work-orders/:id" element={ui} />
          <Route path="/request/:token" element={ui} />
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('work order screens in Spanish', () => {
  beforeEach(() => {
    setLanguage('es', false)
    useAuthStore.setState({ user: { id: 2, email: '', full_name: 'Carlos Tech', role: 'admin', organization_id: 1 }, token: 't', isAuthenticated: true })
  })

  it('the list says its title, tabs, statuses and priorities in Spanish', async () => {
    server.use(http.get('/api/v1/work_orders', () => HttpResponse.json({ work_orders: [wo], meta: { request_id: 'x', timestamp: '' } })))
    localStorage.setItem('fixflow-wo-view', 'table')
    renderIn(<WorkOrdersListPage />)

    expect(await screen.findByRole('heading', { name: 'Órdenes de trabajo' })).toBeInTheDocument()
    expect(await screen.findByText('1 orden de trabajo abierta')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Mis órdenes de trabajo/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Nueva orden de trabajo/ }).length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.getByText('Bomba con ruido')).toBeInTheDocument())
    expect(screen.getAllByText('En curso').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Alta').length).toBeGreaterThan(0)
    expect(screen.queryByText('In Progress')).not.toBeInTheDocument()
    localStorage.removeItem('fixflow-wo-view')
  })

  it('the detail page says what can be done to the work order, in Spanish', async () => {
    server.use(
      http.get('/api/v1/work_orders/1', () => HttpResponse.json({ data: wo, meta: { request_id: 'x', timestamp: '' } })),
      http.get('/api/v1/work_orders/1/comments', () => HttpResponse.json({ comments: [] })),
      http.get('/api/v1/work_orders/1/attachments', () => HttpResponse.json({ attachments: [] })),
      http.get('/api/v1/work_orders/1/parts', () => HttpResponse.json({ parts: [] })),
    )
    renderIn(<WorkOrderDetailPage />, '/work-orders/1')

    expect(await screen.findByText('Volver a Órdenes de trabajo')).toBeInTheDocument()
    expect(screen.getByText('Progreso')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Poner en espera/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Completar/ })).toBeInTheDocument()
    expect(await screen.findByText('Aún no hay comentarios.')).toBeInTheDocument()
    expect(screen.getByText('Resumen de costos')).toBeInTheDocument()
    expect(screen.getByText('Sin fecha de vencimiento')).toBeInTheDocument()
    expect(screen.getByText('Fecha de vencimiento')).toBeInTheDocument()
  })

  it('the create form and its checks speak Spanish', async () => {
    server.use(http.get('/api/v1/assets', () => HttpResponse.json({ assets: [], meta: { pagination: { page: 1, per_page: 25, total: 0, total_pages: 1 } } })))
    renderIn(<WorkOrderCreatePage />)

    expect(await screen.findByText('Nueva orden de trabajo')).toBeInTheDocument()
    expect(screen.getByText('¿Qué hay que arreglar?')).toBeInTheDocument()
    expect(screen.getByText(/🔴 Crítica/)).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText('Describe el problema...'), 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'Crear orden de trabajo' }))
    expect(await screen.findByText('El título debe tener al menos 5 caracteres')).toBeInTheDocument()
  })

  it('the public request form can be filled in in Spanish, and says what went wrong in Spanish', async () => {
    server.use(
      http.get('/api/v1/public_request_form', () => HttpResponse.json({ data: { open: true } })),
      http.post('/api/v1/work_requests', () => HttpResponse.json({ error: { message: 'x' } }, { status: 429 })),
    )
    renderIn(<WorkRequestPortalPage />, '/request')
    const user = userEvent.setup()

    expect(await screen.findByText('Informar de un problema')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Idioma' })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/tu nombre/i), 'Kamal Perera')
    await user.type(screen.getByLabelText(/^ubicación/i), 'Bloque B, piso 2')
    await user.type(screen.getByLabelText(/cuál es el problema/i), 'La puerta no cierra bien')
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }))
    expect(await screen.findByText(/Demasiadas solicitudes desde este dispositivo/)).toBeInTheDocument()
  })

  it('the status page of a request is in Spanish', async () => {
    server.use(http.get('/api/v1/work_requests/:token', () => HttpResponse.json({ data: { status: 'assigned', title: 'Luz', description: 'No enciende', created_at: '2026-01-01T00:00:00Z' } })))
    renderIn(<WorkRequestStatusPage />, '/request/abcdefghijklmnopqrstuv')

    expect(await screen.findByText('Estado de la solicitud')).toBeInTheDocument()
    expect(screen.getByText('ASIGNADA')).toBeInTheDocument()
    expect(screen.getByText('Asignada a un técnico')).toBeInTheDocument()
    expect(screen.getByText('Tu solicitud:')).toBeInTheDocument()
  })
})
