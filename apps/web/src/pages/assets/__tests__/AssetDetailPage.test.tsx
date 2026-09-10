import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { AssetDetailPage } from '../AssetDetailPage'
import { useAuthStore } from '@/stores/authStore'
import type { Asset } from '@/types'

const mockAsset: Asset = {
  id: 1,
  name: 'Pump-01',
  asset_tag: 'FF-000001',
  status: 'operational',
  serial_number: 'SN-001',
  manufacturer: 'Grundfos',
  organization_id: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/assets/1']}>
        <Routes>
          <Route path="/assets/:id" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function setupHandlers() {
  server.use(
    http.get('/api/v1/assets/1', () =>
      HttpResponse.json({
        data: mockAsset,
        meta: { request_id: 'test', timestamp: '' },
      }),
    ),
    http.get('/api/v1/locations', () =>
      HttpResponse.json({ locations: [], meta: { request_id: 'test', timestamp: '' } }),
    ),
    http.get('/api/v1/work_orders', () =>
      HttpResponse.json({ work_orders: [], meta: { request_id: 'test', timestamp: '' } }),
    ),
  )
}

async function waitForAssetLoaded() {
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Pump-01' })).toBeInTheDocument())
}

describe('AssetDetailPage', () => {
  it('renders asset name and tag correctly', async () => {
    setupHandlers()
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Admin', role: 'admin', organization_id: 1 }, token: 'token', isAuthenticated: true })
    render(<AssetDetailPage />, { wrapper })
    await waitForAssetLoaded()
    expect(screen.getAllByText('FF-000001').length).toBeGreaterThan(0)
  })

  it('QR code renders in overview tab', async () => {
    setupHandlers()
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Admin', role: 'admin', organization_id: 1 }, token: 'token', isAuthenticated: true })
    render(<AssetDetailPage />, { wrapper })
    await waitForAssetLoaded()
    expect(screen.getByLabelText(/qr code for asset/i)).toBeInTheDocument()
  })

  it('shows tabs', async () => {
    setupHandlers()
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Admin', role: 'admin', organization_id: 1 }, token: 'token', isAuthenticated: true })
    render(<AssetDetailPage />, { wrapper })
    await waitForAssetLoaded()
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /work orders/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument()
  })

  it('Edit button visible for manager role', async () => {
    setupHandlers()
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Manager', role: 'manager', organization_id: 1 }, token: 'token', isAuthenticated: true })
    render(<AssetDetailPage />, { wrapper })
    await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument())
  })

  it('Edit button not visible for technician role', async () => {
    setupHandlers()
    useAuthStore.setState({ user: { id: 2, email: '', full_name: 'Tech', role: 'technician', organization_id: 1 }, token: 'token', isAuthenticated: true })
    render(<AssetDetailPage />, { wrapper })
    await waitForAssetLoaded()
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
  })

  it('shows not found when asset missing', async () => {
    server.use(
      http.get('/api/v1/assets/1', () => HttpResponse.json({ error: 'not found' }, { status: 404 })),
      http.get('/api/v1/locations', () =>
        HttpResponse.json({ locations: [], meta: { request_id: 'test', timestamp: '' } }),
      ),
      http.get('/api/v1/work_orders', () =>
        HttpResponse.json({ work_orders: [], meta: { request_id: 'test', timestamp: '' } }),
      ),
    )
    render(<AssetDetailPage />, { wrapper })
    await waitFor(() => expect(screen.getByText(/not found or you don't have access/i)).toBeInTheDocument())
  })
})
