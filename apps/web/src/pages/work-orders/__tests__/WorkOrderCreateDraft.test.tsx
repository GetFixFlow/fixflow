import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { WorkOrderCreatePage } from '../WorkOrderCreatePage'

const pump = { id: 7, name: 'Coolant pump', asset_tag: 'P-003', location_path: 'Line 3' }

function renderPage(path = '/work-orders/new') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}><WorkOrderCreatePage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('the new work order page, with a draft from a few words', () => {
  let created: Record<string, unknown> | undefined

  beforeEach(() => {
    created = undefined
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Tech', role: 'technician', organization_id: 1 } as never, token: 't', isAuthenticated: true })
    server.use(
      http.get('/api/v1/assets', () => HttpResponse.json({ assets: [], meta: {} })),
      http.get('/api/v1/assets/7', () => HttpResponse.json({ data: { id: 7, name: 'Coolant pump', asset_tag: 'P-003', status: 'operational' } })),
      http.post('/api/v1/ai/work_order_draft', () => HttpResponse.json({ data: {
        title: 'Coolant pump leaking oil', description: 'The pump on line 3 is leaking oil.', priority: 'high', asset: pump, asset_candidates: [pump],
      } })),
      http.post('/api/v1/work_orders', async ({ request }) => {
        created = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: { id: 99 } }, { status: 201 })
      }),
    )
  })

  it('fills the form in from the words, and creates the work order only when the person says so', async () => {
    renderPage()
    await userEvent.type(await screen.findByLabelText('What is wrong?'), 'pump on line 3 is leaking oil')

    await userEvent.click(screen.getByRole('button', { name: 'Make a draft' }))

    await waitFor(() => expect(screen.getByPlaceholderText(/describe the issue/i)).toHaveValue('Coolant pump leaking oil'))
    expect(screen.getByLabelText('Description')).toHaveValue('The pump on line 3 is leaking oil.')
    expect(created).toBeUndefined() // a draft is not a work order

    await userEvent.click(screen.getByRole('button', { name: 'Create Work Order' }))

    await waitFor(() => expect(created).toBeDefined())
    expect(created?.work_order).toMatchObject({ title: 'Coolant pump leaking oil', priority: 'high', asset_id: 7, source: 'manual' })
  })

  it('does not offer to choose an asset when the page was opened from an asset', async () => {
    server.use(http.post('/api/v1/ai/work_order_draft', () => HttpResponse.json({ data: {
      title: 'Something is leaking', description: '', priority: null, asset: null, asset_candidates: [pump],
    } })))
    renderPage('/work-orders/new?asset_id=3')
    await userEvent.type(await screen.findByLabelText('What is wrong?'), 'something is leaking here')

    await userEvent.click(screen.getByRole('button', { name: 'Make a draft' }))

    expect(await screen.findByText(/The draft is filled in below/)).toBeInTheDocument()
    expect(screen.queryByText('Which asset is it?')).not.toBeInTheDocument()
  })
})
