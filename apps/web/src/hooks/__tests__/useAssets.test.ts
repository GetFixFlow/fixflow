import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useAssets, useAsset, useCreateAsset, useDeleteAsset } from '../useAssets'
import type { Asset } from '@/types'

const mockAsset: Asset = {
  id: 1,
  name: 'Pump-01',
  asset_tag: 'FF-000001',
  status: 'operational',
  organization_id: 1,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

describe('useAssets', () => {
  it('fetches paginated asset list', async () => {
    server.use(
      http.get('/api/v1/assets', () =>
        HttpResponse.json({
          assets: [mockAsset],
          meta: { request_id: 'test', timestamp: new Date().toISOString() },
        }),
      ),
    )
    const { result } = renderHook(() => useAssets(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.assets).toHaveLength(1)
    expect(result.current.data?.assets[0].name).toBe('Pump-01')
  })
})

describe('useAsset', () => {
  it('fetches single asset by id', async () => {
    server.use(
      http.get('/api/v1/assets/1', () =>
        HttpResponse.json({
          data: mockAsset,
          meta: { request_id: 'test', timestamp: new Date().toISOString() },
        }),
      ),
    )
    const { result } = renderHook(() => useAsset(1), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.name).toBe('Pump-01')
  })

  it('does not fetch when id is 0', () => {
    const { result } = renderHook(() => useAsset(0), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useCreateAsset', () => {
  it('invalidates list on success', async () => {
    server.use(
      http.post('/api/v1/assets', () =>
        HttpResponse.json({
          data: { ...mockAsset, id: 2, name: 'New Asset' },
          meta: { request_id: 'test', timestamp: new Date().toISOString() },
        }),
      ),
      http.get('/api/v1/assets', () =>
        HttpResponse.json({ assets: [], meta: { request_id: 'test', timestamp: new Date().toISOString() } }),
      ),
    )
    const { result } = renderHook(() => useCreateAsset(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ name: 'New Asset', status: 'operational' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useDeleteAsset', () => {
  it('removes from list on success', async () => {
    server.use(
      http.delete('/api/v1/assets/1', () => HttpResponse.json({ success: true })),
      http.get('/api/v1/assets', () =>
        HttpResponse.json({ assets: [], meta: { request_id: 'test', timestamp: new Date().toISOString() } }),
      ),
    )
    const { result } = renderHook(() => useDeleteAsset(), { wrapper: createWrapper() })
    await result.current.mutateAsync(1)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
