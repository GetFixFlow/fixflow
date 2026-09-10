import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { CompleteModal } from '../modals/CompleteModal'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CompleteModal', () => {
  it('shows the modal title', () => {
    render(<CompleteModal workOrderId={1} open onClose={() => {}} />, { wrapper })
    expect(screen.getByText('Mark as Complete')).toBeInTheDocument()
  })

  it('blocks submission with incomplete required checklist items', async () => {
    const items = [
      { id: '1', description: 'Check oil', required: true, completed: false },
      { id: '2', description: 'Test run', required: false, completed: false },
    ]
    render(
      <CompleteModal workOrderId={1} open checklistItems={items} onClose={() => {}} />,
      { wrapper },
    )
    expect(screen.getByText(/1 required step not checked/i)).toBeInTheDocument()
    const submitBtn = screen.getByRole('button', { name: /mark complete/i })
    expect(submitBtn).toBeDisabled()
  })

  it('requires completion notes with min 20 chars', async () => {
    render(<CompleteModal workOrderId={1} open onClose={() => {}} />, { wrapper })
    const notesTextarea = screen.getByPlaceholderText(/describe what was done/i)
    await userEvent.type(notesTextarea, 'Short note')
    const hoursInput = screen.getByPlaceholderText(/e\.g\. 1\.5/i)
    await userEvent.type(hoursInput, '2')
    expect(screen.getByRole('button', { name: /mark complete/i })).toBeDisabled()
  })

  it('requires actual_hours to be positive', async () => {
    render(<CompleteModal workOrderId={1} open onClose={() => {}} />, { wrapper })
    const notesTextarea = screen.getByPlaceholderText(/describe what was done/i)
    await userEvent.type(notesTextarea, 'This is a long enough completion note to pass.')
    const hoursInput = screen.getByPlaceholderText(/e\.g\. 1\.5/i)
    await userEvent.type(hoursInput, '0')
    expect(screen.getByRole('button', { name: /mark complete/i })).toBeDisabled()
  })

  it('enables submit when all conditions met', async () => {
    server.use(
      http.patch('/api/v1/work_orders/1/transition', () =>
        HttpResponse.json({ data: {}, meta: {} }),
      ),
      http.get('/api/v1/work_orders', () =>
        HttpResponse.json({ work_orders: [], meta: { request_id: 'test', timestamp: '' } }),
      ),
    )
    render(<CompleteModal workOrderId={1} open onClose={() => {}} />, { wrapper })
    const notesTextarea = screen.getByPlaceholderText(/describe what was done/i)
    await userEvent.type(notesTextarea, 'Completed all required maintenance steps successfully.')
    const hoursInput = screen.getByPlaceholderText(/e\.g\. 1\.5/i)
    await userEvent.type(hoursInput, '2.5')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /mark complete/i })).not.toBeDisabled(),
    )
  })
})
