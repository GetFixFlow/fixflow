import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { ApprovalNotice } from '../ApprovalNotice'
import type { WorkOrder } from '@/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const needing = {
  id: 5, work_order_number: 'WO-000005', title: 'Rebuild gearbox', status: 'assigned', priority: 'high', organization_id: 1,
  assignee_id: 3, approval_needed: true, expected_cost: '1250.00', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
} as WorkOrder

function renderNotice(wo: WorkOrder, userId: number, isManager: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ApprovalNotice wo={wo} userId={userId} isManager={isManager} /></QueryClientProvider>)
}

describe('the approval notice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows nothing for work that needs no approval and has none', () => {
    renderNotice({ ...needing, approval_needed: false }, 1, true)

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('tells a manager what it is expected to cost, and lets them approve it', async () => {
    const approved: string[] = []
    server.use(http.patch('/api/v1/work_orders/:id/approve', ({ params }) => { approved.push(String(params.id)); return HttpResponse.json({ data: needing }) }))
    renderNotice(needing, 1, true)

    expect(screen.getByRole('status')).toHaveTextContent(/needs a manager's approval before it can be started/i)
    expect(screen.getByRole('status')).toHaveTextContent('1,250.00')
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))

    await waitFor(() => expect(approved).toEqual(['5']))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Approved.'))
  })

  it('says to complete it, not start it, once it is under way', () => {
    renderNotice({ ...needing, status: 'in_progress' }, 1, true)

    expect(screen.getByRole('status')).toHaveTextContent(/before it can be completed/i)
  })

  it('does not let a manager approve work they are doing themselves, and says another has to', () => {
    renderNotice(needing, 3, true)

    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(/another manager has to approve work you are doing yourself/i)
  })

  it('does not tell a technician what it costs, and lets the one doing it ask the managers', async () => {
    const asked: string[] = []
    server.use(http.patch('/api/v1/work_orders/:id/request_approval', ({ params }) => { asked.push(String(params.id)); return HttpResponse.json({ data: needing }) }))
    renderNotice({ ...needing, expected_cost: null }, 3, false)

    expect(screen.getByRole('status')).not.toHaveTextContent(/expected/i)
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Ask a manager' }))

    await waitFor(() => expect(asked).toEqual(['5']))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('The managers have been asked.'))
  })

  it('says when the managers were asked, and does not offer to ask again', () => {
    renderNotice({ ...needing, approval_requested_at: '2026-02-03T10:00:00Z' }, 3, false)

    expect(screen.getByRole('status')).toHaveTextContent(/the managers were asked on/i)
    expect(screen.queryByRole('button', { name: 'Ask a manager' })).toBeNull()
  })

  it('offers someone else\'s work order no button at all', () => {
    renderNotice(needing, 9, false)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('says who approved it, when, and up to what cost, once it is approved', () => {
    renderNotice({ ...needing, approval_needed: false, approved_by: { id: 1, full_name: 'Alice Admin' }, approved_at: '2026-02-03T10:00:00Z', approved_cost: '1250.00' }, 3, false)

    expect(screen.getByText(/approved by alice admin on/i)).toHaveTextContent('1,250.00')
  })

  it('shows the server\'s reason when approving fails', async () => {
    server.use(http.patch('/api/v1/work_orders/:id/approve', () => HttpResponse.json({ error: { message: 'You cannot approve work you are doing yourself.' } }, { status: 403 })))
    renderNotice(needing, 1, true)

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('You cannot approve work you are doing yourself.'))
  })
})
