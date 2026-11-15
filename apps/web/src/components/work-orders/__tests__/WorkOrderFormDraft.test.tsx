import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { WorkOrderForm } from '../WorkOrderForm'
import type { AppliedDraft } from '../DraftFromWords'

const draft = (over: Partial<AppliedDraft> = {}): AppliedDraft => ({
  nonce: 1, title: 'Coolant pump leaking oil', description: 'Leaking on line 3.', priority: 'high', asset_id: 7, ...over,
})

function renderForm(props: Partial<React.ComponentProps<typeof WorkOrderForm>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const ui = (extra: Partial<React.ComponentProps<typeof WorkOrderForm>>) => (
    <QueryClientProvider client={client}><MemoryRouter><WorkOrderForm onSubmit={onSubmit} {...props} {...extra} /></MemoryRouter></QueryClientProvider>
  )
  const view = render(ui({}))
  return { onSubmit, again: (extra: Partial<React.ComponentProps<typeof WorkOrderForm>>) => view.rerender(ui(extra)) }
}

const title = () => screen.getByPlaceholderText(/describe the issue/i)
const description = () => screen.getByLabelText('Description')
const pressed = () => screen.getAllByRole('button').filter((button) => button.getAttribute('aria-pressed') === 'true').map((button) => button.textContent?.trim())

describe('WorkOrderForm with a draft', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/v1/assets', () => HttpResponse.json({ assets: [], meta: {} })),
      http.get('/api/v1/assets/7', () => HttpResponse.json({ data: { id: 7, name: 'Coolant pump', asset_tag: 'P-003', status: 'operational' } })),
    )
  })

  it('is filled in with the title, description and priority of the draft', async () => {
    renderForm({ draft: draft() })

    await waitFor(() => expect(title()).toHaveValue('Coolant pump leaking oil'))
    expect(description()).toHaveValue('Leaking on line 3.')
    expect(pressed()).toEqual(['🟠 High'])
  })

  it('is sent as a work order, with the drafted asset, when the person creates it', async () => {
    server.use(http.get('/api/v1/assets/7', () => HttpResponse.json({ data: { id: 7, name: 'Coolant pump', asset_tag: 'P-003', status: 'operational' } })))
    const { onSubmit } = renderForm({ draft: draft() })
    await waitFor(() => expect(title()).toHaveValue('Coolant pump leaking oil'))

    await userEvent.click(screen.getByRole('button', { name: 'Create Work Order' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ title: 'Coolant pump leaking oil', description: 'Leaking on line 3.', priority: 'high', asset_id: 7 })
  })

  it('shows the drafted asset even when it is not among the first ones listed', async () => {
    server.use(
      http.get('/api/v1/assets', () => HttpResponse.json({ assets: [], meta: {} })),
      http.get('/api/v1/assets/7', () => HttpResponse.json({ data: { id: 7, name: 'Coolant pump', asset_tag: 'P-003', status: 'operational' } })),
    )
    renderForm({ draft: draft() })

    expect(await screen.findByText('Coolant pump')).toBeInTheDocument()
    expect(screen.getByText('P-003')).toBeInTheDocument()
  })

  it('leaves the priority as it was when the draft has none, and the asset when it has none', async () => {
    const { onSubmit } = renderForm({ draft: draft({ priority: null, asset_id: null }) })
    await waitFor(() => expect(title()).toHaveValue('Coolant pump leaking oil'))

    expect(pressed()).toEqual(['🟡 Medium'])
    await userEvent.click(screen.getByRole('button', { name: 'Create Work Order' }))
    await waitFor(() => expect(screen.getByText('Asset is required')).toBeInTheDocument())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not change the asset of a work order that is for one already', async () => {
    const { onSubmit } = renderForm({ draft: draft({ asset_id: 7 }), lockedAssetId: 3 })
    await waitFor(() => expect(title()).toHaveValue('Coolant pump leaking oil'))

    await userEvent.click(screen.getByRole('button', { name: 'Create Work Order' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].asset_id).toBe(3)
  })

  it('applies a new draft over what was changed by hand, and the same draft only once', async () => {
    const { again } = renderForm({ draft: draft() })
    await waitFor(() => expect(title()).toHaveValue('Coolant pump leaking oil'))
    await userEvent.clear(title())
    await userEvent.type(title(), 'My own title')

    again({ draft: draft() })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(title()).toHaveValue('My own title')

    again({ draft: draft({ nonce: 2, title: 'Second draft title' }) })
    await waitFor(() => expect(title()).toHaveValue('Second draft title'))
  })
})
