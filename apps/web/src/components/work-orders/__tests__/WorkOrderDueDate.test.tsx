import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorkOrderDueDate } from '../WorkOrderDueDate'

describe('WorkOrderDueDate', () => {
  it('shows "No due date" when dueDate is null', () => {
    render(<WorkOrderDueDate dueDate={null} />)
    expect(screen.getByText(/no due date/i)).toBeInTheDocument()
  })

  it('shows "Today" for today\'s date', () => {
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    render(<WorkOrderDueDate dueDate={today.toISOString()} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('shows "X days overdue" for past dates (red)', () => {
    const past = new Date(Date.now() - 3 * 86400000) // 3 days ago
    render(<WorkOrderDueDate dueDate={past.toISOString()} />)
    expect(screen.getByText(/3 days overdue/i)).toBeInTheDocument()
  })

  it('shows "1 day overdue" for yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000)
    render(<WorkOrderDueDate dueDate={yesterday.toISOString()} />)
    expect(screen.getByText(/1 day overdue/i)).toBeInTheDocument()
  })

  it('shows "In X days" for near future (yellow)', () => {
    const soon = new Date(Date.now() + 2 * 86400000) // 2 days from now
    render(<WorkOrderDueDate dueDate={soon.toISOString()} />)
    expect(screen.getByText(/in 2 days/i)).toBeInTheDocument()
  })

  it('shows formatted date for far future (>3 days)', () => {
    const future = new Date(Date.now() + 10 * 86400000) // 10 days from now
    const { container } = render(<WorkOrderDueDate dueDate={future.toISOString()} />)
    // Should not show "overdue" or "Today"
    expect(container.textContent).not.toMatch(/overdue/i)
    expect(container.textContent).not.toMatch(/today/i)
    expect(container.textContent?.length).toBeGreaterThan(0)
  })
})
