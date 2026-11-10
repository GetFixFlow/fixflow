import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { setLanguage } from '@/i18n'
import { timeAgo } from '@/lib/timeAgo'
import { WorkOrderDueDate } from '../WorkOrderDueDate'
import { WorkOrderStatusBadge } from '../WorkOrderStatusBadge'
import { WorkOrderPriorityBadge } from '../WorkOrderPriorityBadge'
import { WorkOrderTimeline } from '../WorkOrderTimeline'
import { WorkOrderFilters } from '../WorkOrderFilters'
import { WorkOrderCalendarView } from '../WorkOrderCalendarView'
import { WorkOrderChecklist } from '../WorkOrderChecklist'
import { WorkOrderKanbanBoard } from '../WorkOrderKanbanBoard'
import { CompleteModal } from '../modals/CompleteModal'
import { HoldModal } from '../modals/HoldModal'
import { ApprovalNotice } from '../ApprovalNotice'
import type { WorkOrder } from '@/types'

function renderIn(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>)
}

const wo = (over: Partial<WorkOrder> = {}): WorkOrder => ({
  id: 1, work_order_number: 'WO-000001', title: 'Bomba', status: 'open', priority: 'critical', work_order_type: 'corrective', source: 'manual',
  organization_id: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...over,
})

describe('work order parts in Spanish', () => {
  beforeEach(() => setLanguage('es', false))

  it('badges and the progress line use the Spanish words, and their labels for screen readers too', () => {
    renderIn(<><WorkOrderStatusBadge status="on_hold" /><WorkOrderPriorityBadge priority="critical" /><WorkOrderTimeline status="in_progress" /></>)

    expect(screen.getByLabelText('Estado: En espera')).toBeInTheDocument()
    expect(screen.getByLabelText('Prioridad: Crítica')).toBeInTheDocument()
    expect(screen.getByLabelText('Progreso de la orden de trabajo')).toBeInTheDocument()
    expect(screen.getByLabelText('En curso — actual')).toBeInTheDocument()
    expect(screen.getByLabelText('Abierta — completada')).toBeInTheDocument()
  })

  it('due dates say overdue, today and the days left in Spanish, with the plural right', () => {
    const days = (n: number) => new Date(Date.now() + n * 86400000).toISOString()
    const { unmount } = renderIn(<WorkOrderDueDate dueDate={days(-1)} />)
    expect(screen.getByText('1 día de retraso')).toBeInTheDocument()
    unmount()
    const second = renderIn(<WorkOrderDueDate dueDate={days(-3)} />)
    expect(screen.getByText('3 días de retraso')).toBeInTheDocument()
    second.unmount()
    renderIn(<WorkOrderDueDate dueDate={days(2)} />)
    expect(screen.getByText('En 2 días')).toBeInTheDocument()
  })

  it('says how long ago in Spanish', () => {
    expect(timeAgo(new Date(Date.now() - 2 * 3600 * 1000))).toBe('hace 2 horas')
  })

  it('filters, with their chips, are in Spanish', () => {
    renderIn(<WorkOrderFilters filters={{ search: '', statuses: ['in_progress'], priorities: ['high'], overdue_only: true }} onChange={() => {}} />)

    expect(screen.getByPlaceholderText('Buscar por título, n.º de orden, activo...')).toBeInTheDocument()
    expect(screen.getByText('Estado: En curso')).toBeInTheDocument()
    expect(screen.getByText('Prioridad: Alta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar el filtro Estado: En curso' })).toBeInTheDocument()
    expect(screen.getByText('Borrar todos los filtros')).toBeInTheDocument()
  })

  it('the calendar names the month and weekdays in Spanish', () => {
    renderIn(<WorkOrderCalendarView workOrders={[wo({ due_date: new Date().toISOString() })]} />)

    const month = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(new Date())
    expect(screen.getByRole('heading', { name: month })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeInTheDocument()
    expect(screen.getByText('Hoy')).toBeInTheDocument()
    expect(screen.getByText(/^lun\.?$/i)).toBeInTheDocument()
  })

  it('the kanban board names its columns in Spanish', () => {
    renderIn(<WorkOrderKanbanBoard workOrders={[]} />)

    expect(screen.getByRole('region', { name: 'Tablero kanban de órdenes de trabajo' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'En curso' })).toBeInTheDocument()
    expect(screen.getAllByText('Suelta aquí').length).toBe(5)
  })

  it('the checklist counts its steps in Spanish', () => {
    server.use(http.patch('/api/v1/work_orders/1/checklist/:step', () => HttpResponse.json({})))
    renderIn(<WorkOrderChecklist workOrderId={1} items={[
      { step: 1, instruction: 'Revisar el aceite', required: true, completed: false },
      { step: 2, instruction: 'Probar', required: true, completed: true, completed_by_name: 'Ana' },
    ]} />)

    expect(screen.getByText('1/2 pasos completados')).toBeInTheDocument()
    expect(screen.getByText('1 paso obligatorio sin completar:')).toBeInTheDocument()
    expect(screen.getByText('*obligatorio')).toBeInTheDocument()
    expect(screen.getByText(/Hecho por Ana/)).toBeInTheDocument()
  })

  it('the completion dialog is in Spanish and keeps its rules', async () => {
    renderIn(<CompleteModal workOrderId={1} open onClose={() => {}} checklistItems={[{ step: 1, instruction: 'Revisar', required: true, completed: false }]} />)

    expect(screen.getByText('Marcar como completada', { selector: 'h2' })).toBeInTheDocument()
    expect(screen.getByText('1 paso obligatorio sin marcar:')).toBeInTheDocument()
    expect(screen.getByLabelText('Resuelta por completo')).toBeChecked()
    expect(screen.getByRole('button', { name: 'Marcar como completada' })).toBeDisabled()
  })

  it('a hold sends the reason in the language it was chosen in', async () => {
    let sent: { work_order?: { hold_reason?: string } } = {}
    server.use(http.patch('/api/v1/work_orders/1/transition', async ({ request }) => { sent = (await request.json()) as typeof sent; return HttpResponse.json({ data: {} }) }))
    renderIn(<HoldModal workOrderId={1} open onClose={() => {}} />)
    const user = userEvent.setup()

    await user.selectOptions(screen.getByRole('combobox'), 'Esperando acceso')
    await user.click(screen.getByRole('button', { name: 'Poner en espera' }))
    await vi.waitFor(() => expect(sent.work_order?.hold_reason).toBe('Esperando acceso'))
  })

  it('the approval notice speaks Spanish to a manager', () => {
    renderIn(<ApprovalNotice wo={wo({ approval_needed: true, expected_cost: 120, assignee_id: 5 })} userId={9} isManager />)

    expect(screen.getByText('Necesita la aprobación de un gerente antes de poder iniciarse.')).toBeInTheDocument()
    expect(screen.getByText(/Cuesta más que el límite de aprobación de la empresa \(previsto: /)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeInTheDocument()
  })
})
