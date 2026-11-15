import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { setLanguage } from '@/i18n'
import type { PartForecast } from '@/api/ai'
import { PartsForecast } from '../PartsForecast'

const forecast = (over: Partial<PartForecast> = {}): PartForecast => ({
  part: { id: 1, name: 'Belt', sku: 'B-1', unit: 'each' }, status: 'short', used_last_30_days: 4, expected: 4.2, low: 1.8, high: 6.6, on_hand: 3, on_order: 0,
  days_of_stock: 21, suggested_quantity: 4, periods: 6, uses: 12, ...over,
})

function renderIt() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PartsForecast /></QueryClientProvider>)
}

const serve = (list: PartForecast[]) => server.use(http.get('/api/v1/ai/forecasts/parts', () => HttpResponse.json({ data: list })))
const config = (features: Record<string, boolean>) =>
  http.get('/api/v1/ai/config', () => HttpResponse.json({ success: true, data: { enabled: true, model: 'm', provider: 'local', source: 'app', features }, meta: {} }))

beforeEach(async () => {
  await setLanguage('en', false)
})

describe('PartsForecast', () => {
  it('says what is expected, what is held, and what to order, with what it rests on', async () => {
    serve([forecast()])
    renderIt()

    expect(await screen.findByText('Belt')).toBeInTheDocument()
    expect(screen.getByText('May run short')).toHaveClass('bg-red-100')
    expect(screen.getByText('Expected use over the next 30 days: 4.2 each (likely 1.8 to 6.6)')).toBeInTheDocument()
    expect(screen.getByText(/In stock 3, on order 0 · about 21 days of stock · consider ordering 4/)).toBeInTheDocument()
    expect(screen.getByText('from 6 months of use, logged 12 times')).toBeInTheDocument()
  })

  it('calls one that only just covers it tight, and suggests nothing when nothing is needed', async () => {
    serve([forecast({ status: 'tight', suggested_quantity: 0, days_of_stock: null })])
    renderIt()

    expect(await screen.findByText('Tight')).toHaveClass('bg-yellow-100')
    expect(screen.queryByText(/consider ordering/)).not.toBeInTheDocument()
    expect(screen.queryByText(/days of stock/)).not.toBeInTheDocument()
  })

  it('says so when no part is expected to run short', async () => {
    serve([])
    renderIt()

    expect(await screen.findByText('No part is expected to run short.')).toBeInTheDocument()
  })

  it('shows nothing, and asks for nothing, when the forecast is switched off', async () => {
    let asked = 0
    server.use(config({ priority: true, anomalies: true, limits: true, parts: false }),
      http.get('/api/v1/ai/forecasts/parts', () => { asked += 1; return HttpResponse.json({ data: [] }) }))
    renderIt()
    await new Promise((resolve) => setTimeout(resolve, 150))

    expect(screen.queryByRole('heading', { name: 'Parts that may run short' })).not.toBeInTheDocument()
    expect(asked).toBe(0)
  })

  it('reads in Spanish', async () => {
    await setLanguage('es', false)
    serve([forecast()])
    renderIt()

    expect(await screen.findByText('Puede agotarse')).toBeInTheDocument()
    expect(screen.getByText(/Uso esperado en los próximos 30 días: 4.2 each/)).toBeInTheDocument()
    expect(screen.getByText(/considere pedir 4/)).toBeInTheDocument()
  })
})
