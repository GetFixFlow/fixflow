import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { AssetSelect } from '../AssetSelect'

const asset = (id: number, name: string) => ({ id, name, asset_tag: `T-${id}`, status: 'operational' })

function renderIt(value: number | null) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AssetSelect id="pick" value={value} onChange={() => {}} />
    </QueryClientProvider>,
  )
}

describe('AssetSelect', () => {
  it('shows the chosen asset when it is among the ones listed', async () => {
    server.use(http.get('/api/v1/assets', () => HttpResponse.json({ assets: [asset(1, 'Fan'), asset(2, 'Pump')], meta: {} })))
    renderIt(2)

    expect(await screen.findByText('Pump')).toBeInTheDocument()
  })

  it('shows the chosen asset when it is not among the first ones listed, by fetching it', async () => {
    server.use(
      http.get('/api/v1/assets', () => HttpResponse.json({ assets: [asset(1, 'Fan')], meta: {} })),
      http.get('/api/v1/assets/99', () => HttpResponse.json({ data: asset(99, 'Far away boiler') })),
    )
    renderIt(99)

    expect(await screen.findByText('Far away boiler')).toBeInTheDocument()
    expect(screen.getByText('T-99')).toBeInTheDocument()
  })

  it('shows the placeholder, and fetches nothing, when no asset is chosen', async () => {
    let fetched = 0
    server.use(
      http.get('/api/v1/assets', () => HttpResponse.json({ assets: [asset(1, 'Fan')], meta: {} })),
      http.get('/api/v1/assets/:id', () => { fetched += 1; return HttpResponse.json({ data: asset(1, 'Fan') }) }),
    )
    renderIt(null)
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(screen.getByRole('button', { name: /Select an asset|asset/i })).toBeInTheDocument()
    expect(fetched).toBe(0)
  })
})
