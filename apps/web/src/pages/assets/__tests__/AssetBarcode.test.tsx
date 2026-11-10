import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { AssetCreatePage } from '../AssetCreatePage'
import { AssetEditPage } from '../AssetEditPage'
import { AssetDetailPage } from '../AssetDetailPage'
import { AssetsListPage } from '../AssetsListPage'
import type { Asset } from '@/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const pump: Asset = {
  id: 1, name: 'Pump-01', asset_tag: 'FF-000001', status: 'operational', serial_number: 'SN-001', barcode: '5012345678900',
  organization_id: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}
const fan: Asset = { ...pump, id: 2, name: 'Fan-02', asset_tag: 'FF-000002', barcode: null }

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderAt(url: string, routes: { path: string; element: React.ReactNode }[]) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          {routes.map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function signInAs(role: string) {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Test', role, organization_id: 1 } as never, token: 't', isAuthenticated: true })
}

beforeEach(() => {
  vi.clearAllMocks()
  signInAs('admin')
  server.use(
    http.get('/api/v1/locations', () => HttpResponse.json({ locations: [] })),
    http.get('/api/v1/assets/1', () => HttpResponse.json({ data: pump })),
    http.get('/api/v1/work_orders', () => HttpResponse.json({ work_orders: [] })),
    http.get('/api/v1/assets', () => HttpResponse.json({ assets: [pump, fan], meta: {} })),
  )
})

describe('the barcode on the asset page', () => {
  it('is shown with the other details, and a dash when there is none', async () => {
    renderAt('/assets/1', [{ path: '/assets/:id', element: <AssetDetailPage /> }])
    await screen.findByRole('heading', { name: 'Pump-01' })

    expect(screen.getAllByText('Barcode').length).toBeGreaterThan(0)
    expect(screen.getAllByText('5012345678900').length).toBeGreaterThan(0)
  })
})

describe('the barcode when changing an asset', () => {
  async function openEditor() {
    renderAt('/assets/1/edit', [{ path: '/assets/:id/edit', element: <AssetEditPage /> }])
    return screen.findByLabelText('Barcode')
  }

  it('starts with the barcode the asset has', async () => {
    expect(await openEditor()).toHaveValue('5012345678900')
  })

  it('sends the new barcode, and an empty one to clear it', async () => {
    const bodies: { asset: Record<string, unknown> }[] = []
    server.use(http.patch('/api/v1/assets/1', async ({ request }) => {
      bodies.push((await request.json()) as never)
      return HttpResponse.json({ data: pump })
    }))
    const input = await openEditor()
    await userEvent.clear(input)
    await userEvent.type(input, 'NEW-77')
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0].asset.barcode).toBe('NEW-77')
  })

  it('clears it when emptied', async () => {
    const bodies: { asset: Record<string, unknown> }[] = []
    server.use(http.patch('/api/v1/assets/1', async ({ request }) => {
      bodies.push((await request.json()) as never)
      return HttpResponse.json({ data: pump })
    }))
    await userEvent.clear(await openEditor())
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0].asset.barcode).toBe('')
  })

  it('refuses one that is too long before asking the server', async () => {
    let asked = false
    server.use(http.patch('/api/v1/assets/1', () => { asked = true; return HttpResponse.json({ data: pump }) }))
    const input = await openEditor()
    await userEvent.clear(input)
    await userEvent.type(input, 'x'.repeat(65))
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText(/64 characters/i)).toBeInTheDocument()
    expect(asked).toBe(false)
  })

  it('shows the server\'s reason when another asset has the barcode', async () => {
    server.use(http.patch('/api/v1/assets/1', () =>
      HttpResponse.json({ error: { message: 'Barcode is already on another asset' } }, { status: 422 })))
    const input = await openEditor()
    await userEvent.clear(input)
    await userEvent.type(input, 'TAKEN')
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Barcode is already on another asset'))
    expect(screen.queryByTestId('where')).not.toBeInTheDocument() // still on the form, so it can be changed
    expect(screen.getByLabelText('Barcode')).toHaveValue('TAKEN')
  })
})

describe('the barcode when making an asset', () => {
  it('is sent with the new asset', async () => {
    let body: { asset: Record<string, unknown> } | undefined
    server.use(http.post('/api/v1/assets', async ({ request }) => {
      body = (await request.json()) as never
      return HttpResponse.json({ data: { id: 5 } }, { status: 201 })
    }))
    renderAt('/assets/new', [{ path: '/assets/new', element: <AssetCreatePage /> }])
    await userEvent.type(screen.getByLabelText(/asset name/i), 'Press')
    await userEvent.type(screen.getByLabelText('Barcode'), '  ABC-1 ')
    await userEvent.click(screen.getByText('Continue →'))
    await userEvent.click(await screen.findByText('Continue →'))
    await userEvent.click(await screen.findByRole('button', { name: 'Create Asset' }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body!.asset).toMatchObject({ name: 'Press', barcode: '  ABC-1 ' })
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/assets/5'))
  })

  it('is left out when there is none', async () => {
    let body: { asset: Record<string, unknown> } | undefined
    server.use(http.post('/api/v1/assets', async ({ request }) => {
      body = (await request.json()) as never
      return HttpResponse.json({ data: { id: 5 } }, { status: 201 })
    }))
    renderAt('/assets/new', [{ path: '/assets/new', element: <AssetCreatePage /> }])
    await userEvent.type(screen.getByLabelText(/asset name/i), 'Press')
    await userEvent.click(screen.getByText('Continue →'))
    await userEvent.click(await screen.findByText('Continue →'))
    await userEvent.click(await screen.findByRole('button', { name: 'Create Asset' }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body!.asset).not.toHaveProperty('barcode')
  })

  it('shows the server\'s reason when another asset has the barcode', async () => {
    server.use(http.post('/api/v1/assets', () =>
      HttpResponse.json({ error: { message: 'Barcode is already on another asset' } }, { status: 422 })))
    renderAt('/assets/new', [{ path: '/assets/new', element: <AssetCreatePage /> }])
    await userEvent.type(screen.getByLabelText(/asset name/i), 'Press')
    await userEvent.type(screen.getByLabelText('Barcode'), 'TAKEN')
    await userEvent.click(screen.getByText('Continue →'))
    await userEvent.click(await screen.findByText('Continue →'))
    await userEvent.click(await screen.findByRole('button', { name: 'Create Asset' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Barcode is already on another asset'))
  })
})

describe('printing labels from the Assets list', () => {
  const list = [{ path: '/assets', element: <AssetsListPage /> }]

  it('is offered to managers for what the filters show, carrying the filters', async () => {
    signInAs('manager')
    renderAt('/assets?search=pump', list)
    await screen.findByText('Pump-01')
    await userEvent.click(screen.getByRole('button', { name: 'Print labels' }))

    expect(screen.getByTestId('where')).toHaveTextContent('/assets/print-labels?search=pump')
  })

  it('is not offered to technicians', async () => {
    signInAs('technician')
    renderAt('/assets', list)
    await screen.findByText('Pump-01')

    expect(screen.queryByRole('button', { name: 'Print labels' })).not.toBeInTheDocument()
  })

  it('selects a row when its checkbox is clicked, and lets go when it is clicked again (it used to do neither)', async () => {
    signInAs('manager')
    renderAt('/assets', list)
    await screen.findByText('Pump-01')
    const box = screen.getByLabelText('Select Pump-01')

    await userEvent.click(box)
    expect(box).toBeChecked()
    expect(screen.getByText('1 asset selected')).toBeInTheDocument()

    await userEvent.click(box)
    expect(box).not.toBeChecked()
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument()
  })

  it('is not offered to a technician for the assets ticked either', async () => {
    signInAs('technician')
    renderAt('/assets', list)
    await screen.findByText('Pump-01')
    await userEvent.click(screen.getByLabelText('Select Pump-01'))

    const bar = screen.getByText('1 asset selected').parentElement!
    expect(within(bar).queryByRole('button', { name: 'Print labels' })).not.toBeInTheDocument()
  })

  it('is offered for the assets ticked, which are the ones printed', async () => {
    signInAs('manager')
    renderAt('/assets', list)
    await screen.findByText('Pump-01')
    await userEvent.click(screen.getByLabelText('Select Pump-01'))
    await userEvent.click(screen.getByLabelText('Select Fan-02'))

    const bar = screen.getByText('2 assets selected').parentElement!
    await userEvent.click(within(bar).getByRole('button', { name: 'Print labels' }))

    expect(screen.getByTestId('where')).toHaveTextContent('/assets/print-labels?ids=1,2')
  })
})
