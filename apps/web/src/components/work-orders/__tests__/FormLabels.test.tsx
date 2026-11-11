import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { WorkOrderForm } from '../WorkOrderForm'
import { CompleteModal } from '../modals/CompleteModal'
import { HoldModal } from '../modals/HoldModal'
import { AssignModal } from '../modals/AssignModal'
import { RejectModal } from '../modals/RejectModal'
import { CancelModal } from '../modals/CancelModal'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

describe('WorkOrderForm: what a screen reader announces for each control', () => {
  it('names the title, description, due date, estimate and first comment, and the priority choices as a group', () => {
    render(<WorkOrderForm onSubmit={vi.fn()} lockedAssetId={7} />, { wrapper })

    expect(screen.getByLabelText('Title *')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    const due = screen.getByLabelText('Due Date')
    expect(due).toHaveAttribute('type', 'datetime-local')
    expect(screen.getByLabelText('Estimated Hours')).toHaveAttribute('type', 'number')
    expect(screen.getByLabelText('Initial Comment')).toBeInTheDocument()

    const priority = screen.getByRole('group', { name: 'Priority *' })
    expect(within(priority).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
  })

  it('says which priority is chosen, and moves the mark when another is picked', async () => {
    render(<WorkOrderForm onSubmit={vi.fn()} lockedAssetId={7} />, { wrapper })
    const priority = screen.getByRole('group', { name: 'Priority *' })
    const critical = within(priority).getByRole('button', { name: /critical/i })

    expect(critical).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(critical)
    expect(critical).toHaveAttribute('aria-pressed', 'true')
    expect(within(priority).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
  })

  it('names the asset picker when the asset is not already chosen', async () => {
    server.use(http.get('/api/v1/assets', () => HttpResponse.json({ assets: [], meta: { request_id: 't', timestamp: '' } })))
    render(<WorkOrderForm onSubmit={vi.fn()} />, { wrapper })

    expect(screen.getByLabelText('Asset *')).toBeInTheDocument()
  })
})

describe('work order modals: what a screen reader announces for each control', () => {
  it('Complete: names the notes and hours, and the resolution as a group of choices', () => {
    render(<CompleteModal workOrderId={1} open onClose={() => {}} />, { wrapper })

    expect(screen.getByLabelText(/Completion Notes \*/)).toBeInTheDocument()
    expect(screen.getByLabelText('Actual Hours *')).toBeInTheDocument()
    const resolution = screen.getByRole('radiogroup', { name: 'Resolution Type' })
    expect(within(resolution).getAllByRole('radio')).toHaveLength(3)
    expect(within(resolution).getByRole('radio', { name: 'Fully resolved' })).toBeChecked()
  })

  it('Hold: names the reason, the detail that "other" asks for, and the date', async () => {
    render(<HoldModal workOrderId={1} open onClose={() => {}} />, { wrapper })

    expect(screen.getByLabelText('Reason for hold *')).toBeInTheDocument()
    expect(screen.getByLabelText('Expected resume date')).toHaveAttribute('type', 'date')
    await userEvent.selectOptions(screen.getByLabelText('Reason for hold *'), 'Other')
    expect(screen.getByLabelText('Specify reason *')).toBeInTheDocument()
  })

  it('Assign, Reject and Cancel: name every field', () => {
    const { unmount } = render(<AssignModal workOrderId={1} open onClose={() => {}} />, { wrapper })
    expect(screen.getByLabelText('Assignee *')).toBeInTheDocument()
    expect(screen.getByLabelText('Note to assignee')).toBeInTheDocument()
    unmount()

    const reject = render(<RejectModal workOrderId={1} open onClose={() => {}} />, { wrapper })
    expect(screen.getByLabelText(/Rejection Reason \*/)).toBeInTheDocument()
    expect(screen.getByLabelText('Re-assign to')).toBeInTheDocument()
    reject.unmount()

    render(<CancelModal workOrderId={1} open onClose={() => {}} />, { wrapper })
    expect(screen.getByLabelText('Cancellation reason *')).toBeInTheDocument()
  })
})
