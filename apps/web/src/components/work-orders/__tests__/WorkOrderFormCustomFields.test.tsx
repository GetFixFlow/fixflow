import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { customField } from '@/test/customFields'
import { WorkOrderForm } from '../WorkOrderForm'

const centre = customField({ label: 'Cost centre', required: true })
const budget = customField({ label: 'Budget', kind: 'number' })
const off = customField({ label: 'Retired', active: false })

function serve(fields = [centre, budget, off]) {
  server.use(http.get('/api/v1/custom_fields', () => HttpResponse.json({ custom_fields: fields })))
}

function renderForm(props: Partial<React.ComponentProps<typeof WorkOrderForm>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><WorkOrderForm onSubmit={onSubmit} lockedAssetId={7} {...props} /></MemoryRouter>
    </QueryClientProvider>,
  )
  return onSubmit
}

// The hours are filled in too: the form does not submit without them (a blank one is NaN to the schema; a separate fix).
async function fillTitle() {
  await userEvent.type(screen.getByPlaceholderText(/describe the issue/i), 'Pump is leaking')
  await userEvent.type(screen.getByPlaceholderText('e.g. 2.0'), '2')
}

beforeEach(() => serve())

describe('WorkOrderForm custom fields', () => {
  it('shows the fields that are on, and not those turned off', async () => {
    renderForm()

    expect(await screen.findByLabelText('Cost centre *')).toBeInTheDocument()
    expect(screen.getByLabelText('Budget')).toBeInTheDocument()
    expect(screen.queryByLabelText('Retired')).not.toBeInTheDocument()
  })

  it('shows no section when the company has none', async () => {
    serve([])
    renderForm()
    await screen.findByText('What needs fixing?')

    expect(screen.queryByText('More details')).not.toBeInTheDocument()
  })

  it('sends every field with a new work order, an empty one as an empty string', async () => {
    const onSubmit = renderForm()
    await userEvent.type(await screen.findByLabelText('Cost centre *'), ' CC-1 ')
    await fillTitle()
    await userEvent.click(screen.getByRole('button', { name: 'Create Work Order' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].custom_values).toEqual({ cost_centre: 'CC-1', budget: '' })
  })

  it('will not send a new work order without a required field, and says which', async () => {
    const onSubmit = renderForm()
    await screen.findByLabelText('Cost centre *')
    await fillTitle()
    await userEvent.click(screen.getByRole('button', { name: 'Create Work Order' }))

    expect(await screen.findByText('Cost centre is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not ask for a field that is turned off even if it is required', async () => {
    serve([{ ...centre, active: false }])
    const onSubmit = renderForm()
    await screen.findByText('What needs fixing?')
    await fillTitle()
    await userEvent.click(screen.getByRole('button', { name: 'Create Work Order' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].custom_values).toEqual({})
  })

  describe('editing', () => {
    const defaults = { title: 'Pump is leaking', priority: 'medium' as const, asset_id: 7, estimated_hours: 2, custom_values: { cost_centre: 'CC-1', budget: '5' } }

    it('starts with what is filled in', async () => {
      renderForm({ mode: 'edit', defaultValues: defaults })

      expect(await screen.findByLabelText('Cost centre *')).toHaveValue('CC-1')
      expect(screen.getByLabelText('Budget')).toHaveValue(5)
    })

    it('sends the custom fields when one was changed', async () => {
      const onSubmit = renderForm({ mode: 'edit', defaultValues: defaults })
      await userEvent.type(await screen.findByLabelText('Budget'), '0')
      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

      await waitFor(() => expect(onSubmit).toHaveBeenCalled())
      expect(onSubmit.mock.calls[0][0].custom_values).toEqual({ cost_centre: 'CC-1', budget: '50' })
    })

    it('does not send them when only something else was changed, so a required field added later is not demanded', async () => {
      const onSubmit = renderForm({ mode: 'edit', defaultValues: { ...defaults, custom_values: {} } })
      await screen.findByLabelText('Cost centre *')
      await userEvent.type(screen.getByPlaceholderText(/describe the issue/i), ' badly')
      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

      await waitFor(() => expect(onSubmit).toHaveBeenCalled())
      expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('custom_values')
      expect(screen.queryByText('Cost centre is required')).not.toBeInTheDocument()
    })

    it('does not let a required field be emptied', async () => {
      const onSubmit = renderForm({ mode: 'edit', defaultValues: defaults })
      await userEvent.clear(await screen.findByLabelText('Cost centre *'))
      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

      expect(await screen.findByText('Cost centre is required')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })
  })
})
