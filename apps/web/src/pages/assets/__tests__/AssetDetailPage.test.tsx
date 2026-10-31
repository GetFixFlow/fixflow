import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('has a documents tab that opens the files kept with the asset', async () => {
    setupHandlers()
    server.use(http.get('/api/v1/assets/1/documents', () => HttpResponse.json({
      documents: [{ id: 1, description: null, filename: 'pump-manual.pdf', content_type: 'application/pdf', url: '/api/v1/storage/m',
        created_at: '2026-10-20T10:00:00Z', user: { id: 2, full_name: 'Tina Tech' } }],
    })))
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Admin', role: 'admin', organization_id: 1 }, token: 'token', isAuthenticated: true })
    render(<AssetDetailPage />, { wrapper })
    await waitForAssetLoaded()

    await userEvent.click(screen.getByRole('tab', { name: /documents/i }))

    expect(await screen.findByRole('link', { name: 'pump-manual.pdf' })).toBeInTheDocument()
  })

  it('has a downtime tab that shows when the asset is down', async () => {
    setupHandlers()
    server.use(http.get('/api/v1/assets/1/downtimes', () => HttpResponse.json({
      downtimes: [{ id: 1, asset_id: 1, started_at: '2026-10-15T08:00:00Z', ended_at: null, reason: 'Overheating', open: true, hours: 4,
        started_by: null, ended_by: null }],
    })))
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Admin', role: 'admin', organization_id: 1 }, token: 'token', isAuthenticated: true })
    render(<AssetDetailPage />, { wrapper })
    await waitForAssetLoaded()

    await userEvent.click(screen.getByRole('tab', { name: /downtime/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/down since .*overheating/i)
  })

  describe('the warranty', () => {
    const inDays = (days: number) => {
      const date = new Date()
      date.setDate(date.getDate() + days)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }

    async function openWith(warranty: string | null) {
      server.use(http.get('/api/v1/assets/1', () => HttpResponse.json({ data: { ...mockAsset, warranty_expires_on: warranty } })))
      server.use(
        http.get('/api/v1/locations', () => HttpResponse.json({ locations: [] })),
        http.get('/api/v1/work_orders', () => HttpResponse.json({ work_orders: [] })),
      )
      useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Admin', role: 'admin', organization_id: 1 }, token: 'token', isAuthenticated: true })
      render(<AssetDetailPage />, { wrapper })
      await waitForAssetLoaded()
    }

    it('says when it ends, and warns in amber within 30 days', async () => {
      await openWith(inDays(12))

      const note = screen.getByRole('status')
      expect(note).toHaveTextContent(/warranty ends in 12 days/i)
      expect(note.className).toContain('amber')
    })

    it('is calm while it is far off, and says so when it has ended', async () => {
      await openWith(inDays(200))
      expect(screen.getByRole('status')).toHaveTextContent(/warranty ends in 200 days/i)
      expect(screen.getByRole('status').className).not.toContain('amber')
    })

    it('says how long ago it ended', async () => {
      await openWith(inDays(-3))
      expect(screen.getByRole('status')).toHaveTextContent(/warranty ended 3 days ago/i)
    })

    it('shows nothing when no date is set', async () => {
      await openWith(null)
      expect(screen.queryByRole('status')).toBeNull()
    })
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
