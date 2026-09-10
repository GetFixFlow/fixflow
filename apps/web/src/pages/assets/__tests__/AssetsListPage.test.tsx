import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { AssetsListPage } from '../AssetsListPage'
import type { Asset } from '@/types'
import { useAuthStore } from '@/stores/authStore'

const mockAssets: Asset[] = [
  {
    id: 1, name: 'Pump-01', asset_tag: 'FF-000001', status: 'operational',
    organization_id: 1, created_at: '2026-01-01', updated_at: '2026-01-01',
  },
  {
    id: 2, name: 'Compressor-01', asset_tag: 'FF-000002', status: 'degraded',
    organization_id: 1, created_at: '2026-01-01', updated_at: '2026-01-01',
  },
]

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function setupHandlers(assets = mockAssets) {
  server.use(
    http.get('/api/v1/assets', () =>
      HttpResponse.json({
        assets,
        meta: { request_id: 'test', timestamp: new Date().toISOString() },
      }),
    ),
    http.get('/api/v1/locations', () =>
      HttpResponse.json({ locations: [], meta: { request_id: 'test', timestamp: new Date().toISOString() } }),
    ),
  )
}

describe('AssetsListPage', () => {
  it('renders asset list from mock API', async () => {
    setupHandlers()
    useAuthStore.setState({ user: { id: 1, email: 'test@test.com', full_name: 'Test', role: 'admin', organization_id: 1 }, token: 'token', isAuthenticated: true })
    render(<AssetsListPage />, { wrapper })
    await waitFor(() => expect(screen.getByText('Pump-01')).toBeInTheDocument())
    expect(screen.getByText('Compressor-01')).toBeInTheDocument()
  })

  it('shows empty state when no assets', async () => {
    setupHandlers([])
    render(<AssetsListPage />, { wrapper })
    await waitFor(() => expect(screen.getByText(/no assets yet/i)).toBeInTheDocument())
  })

  it('hides New Asset button for technician role', async () => {
    setupHandlers()
    useAuthStore.setState({ user: { id: 2, email: 'tech@test.com', full_name: 'Tech', role: 'technician', organization_id: 1 }, token: 'token', isAuthenticated: true })
    render(<AssetsListPage />, { wrapper })
    await waitFor(() => expect(screen.queryByText('New Asset')).not.toBeInTheDocument())
  })

  it('shows New Asset button for admin role', async () => {
    setupHandlers()
    useAuthStore.setState({ user: { id: 1, email: 'admin@test.com', full_name: 'Admin', role: 'admin', organization_id: 1 }, token: 'token', isAuthenticated: true })
    render(<AssetsListPage />, { wrapper })
    await waitFor(() => expect(screen.getByText('New Asset')).toBeInTheDocument())
  })

  it('search input is present', async () => {
    setupHandlers()
    render(<AssetsListPage />, { wrapper })
    await waitFor(() => expect(screen.getByPlaceholderText(/search assets/i)).toBeInTheDocument())
  })

  it('toggles to grid view', async () => {
    setupHandlers()
    render(<AssetsListPage />, { wrapper })
    const gridBtn = screen.getByLabelText('Grid view')
    await userEvent.click(gridBtn)
    // After clicking grid, table headers should be gone
    await waitFor(() =>
      expect(screen.queryByRole('columnheader', { name: /asset tag/i })).not.toBeInTheDocument(),
    )
  })
})
