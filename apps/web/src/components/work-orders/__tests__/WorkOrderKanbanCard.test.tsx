import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WorkOrderKanbanCard } from '../WorkOrderKanbanCard'
import type { WorkOrder } from '@/types'

const mockWO: WorkOrder = {
  id: 1,
  work_order_number: 'WO-000001',
  title: 'Fix the pump',
  status: 'in_progress',
  priority: 'critical',
  work_order_type: 'corrective',
  source: 'manual',
  organization_id: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe('WorkOrderKanbanCard', () => {
  it('renders priority and WO number', () => {
    render(<WorkOrderKanbanCard workOrder={mockWO} />, { wrapper })
    expect(screen.getByText('WO-000001')).toBeInTheDocument()
    expect(screen.getByText(/critical/i)).toBeInTheDocument()
  })

  it('renders critical priority border (red)', () => {
    const { container } = render(<WorkOrderKanbanCard workOrder={mockWO} />, { wrapper })
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('border-l-red-500')
  })

  it('renders high priority orange border', () => {
    const highWO = { ...mockWO, priority: 'high' as const }
    const { container } = render(<WorkOrderKanbanCard workOrder={highWO} />, { wrapper })
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('border-l-orange-500')
  })

  it('shows correct status badge', () => {
    render(<WorkOrderKanbanCard workOrder={mockWO} />, { wrapper })
    expect(screen.getByText(/in progress/i)).toBeInTheDocument()
  })

  it('shows comment count when provided', () => {
    render(<WorkOrderKanbanCard workOrder={mockWO} commentCount={3} />, { wrapper })
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows attachment count when provided', () => {
    render(<WorkOrderKanbanCard workOrder={mockWO} attachmentCount={2} />, { wrapper })
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows title', () => {
    render(<WorkOrderKanbanCard workOrder={mockWO} />, { wrapper })
    expect(screen.getByText('Fix the pump')).toBeInTheDocument()
  })
})
