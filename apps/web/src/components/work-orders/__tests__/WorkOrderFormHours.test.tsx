import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WorkOrderForm } from '../WorkOrderForm'

function renderForm(props: Partial<React.ComponentProps<typeof WorkOrderForm>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><WorkOrderForm onSubmit={onSubmit} lockedAssetId={7} {...props} /></MemoryRouter>
    </QueryClientProvider>,
  )
  return onSubmit
}

describe('WorkOrderForm estimated hours', () => {
  it('sends a new work order without an estimate when the box is left empty', async () => {
    const onSubmit = renderForm()
    await userEvent.type(screen.getByPlaceholderText(/describe the issue/i), 'Pump is leaking')
    await userEvent.click(screen.getByRole('button', { name: 'Create Work Order' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].estimated_hours).toBeUndefined()
  })

  it('sends the estimate as a number when there is one', async () => {
    const onSubmit = renderForm()
    await userEvent.type(screen.getByPlaceholderText(/describe the issue/i), 'Pump is leaking')
    await userEvent.type(screen.getByPlaceholderText('e.g. 2.0'), '2.5')
    await userEvent.click(screen.getByRole('button', { name: 'Create Work Order' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].estimated_hours).toBe(2.5)
  })

  it('still refuses an estimate of nothing or less', async () => {
    const onSubmit = renderForm()
    await userEvent.type(screen.getByPlaceholderText(/describe the issue/i), 'Pump is leaking')
    await userEvent.type(screen.getByPlaceholderText('e.g. 2.0'), '0')
    await userEvent.click(screen.getByRole('button', { name: 'Create Work Order' }))

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('saves an edit when the estimate is cleared', async () => {
    const onSubmit = renderForm({
      mode: 'edit',
      defaultValues: { title: 'Pump is leaking', priority: 'medium', asset_id: 7, estimated_hours: 2 },
    })
    await userEvent.clear(screen.getByPlaceholderText('e.g. 2.0'))
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].estimated_hours).toBeUndefined()
  })
})
