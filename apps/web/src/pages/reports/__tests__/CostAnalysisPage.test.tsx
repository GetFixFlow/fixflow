import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useReportStore } from '@/stores/reportStore'
import { DEFAULT_LOCALE, useLocaleStore } from '@/lib/localeFormat'
import { CostAnalysisPage } from '../CostAnalysisPage'

// Charts need a real layout to draw; what matters here is what they are given.
vi.mock('@/components/reports/CostTrendChart', () => ({
  CostTrendChart: ({ data, unit }: { data: unknown[]; unit?: string }) => <div data-testid="trend" data-points={data.length} data-unit={unit} />,
}))
vi.mock('@/components/reports/CostTreemap', () => ({
  CostTreemap: ({ data }: { data: { name: string }[] }) => <div data-testid="treemap">{data.map((d) => d.name).join(',')}</div>,
}))

const summary = {
  total_cost: 250, labor_cost: 160, parts_cost: 90, work_orders_count: 4, avg_cost_per_wo: 62.5, group_by: 'week',
  trend: [{ period: '2026-09-07', labor: 100, parts: 20, total: 120, wo_count: 1 }, { period: '2026-09-14', labor: 60, parts: 70, total: 130, wo_count: 3 }],
}
const byAsset = {
  assets: [
    { asset_id: 1, asset_name: 'Pump', labor_cost: 150, parts_cost: 50, total_cost: 200, wo_count: 2 },
    { asset_id: null, asset_name: 'No asset', labor_cost: 10, parts_cost: 0, total_cost: 10, wo_count: 1 },
  ],
  treemap: [{ name: 'Pump', cost: 200 }, { name: 'No asset', cost: 10 }], total_assets: 2,
}

let urls: URL[] = []

function serve(s: object = summary, a: object = byAsset) {
  server.use(
    http.get('/api/v1/reports/costs/summary', ({ request }) => { urls.push(new URL(request.url)); return HttpResponse.json(s) }),
    http.get('/api/v1/reports/costs/by_asset', ({ request }) => { urls.push(new URL(request.url)); return HttpResponse.json(a) }),
  )
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><CostAnalysisPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  urls = []
  localStorage.clear()
  useLocaleStore.setState({ locale: DEFAULT_LOCALE })
  useReportStore.setState({ dateFrom: new Date('2026-09-01T12:00:00Z'), dateTo: new Date('2026-09-30T12:00:00Z') })
  useReportStore.getState().resetFilters?.()
})

describe('CostAnalysisPage', () => {
  it('shows what finished work cost: the total, the labor and parts apart, and the average per work order', async () => {
    serve()
    renderPage()

    expect(await screen.findByText('$250')).toBeInTheDocument()
    expect(screen.getByText('$160')).toBeInTheDocument()
    expect(screen.getByText('$90')).toBeInTheDocument()
    expect(screen.getByText('$63')).toBeInTheDocument() // 62.5 shown as a whole amount
  })

  it('ranks the assets by what their work cost', async () => {
    serve()
    renderPage()

    expect(await screen.findByText('Pump')).toBeInTheDocument()
    expect(screen.getByText('No asset')).toBeInTheDocument()
    expect(screen.getByText('$200')).toBeInTheDocument()
    expect(screen.getByTestId('treemap')).toHaveTextContent('Pump,No asset')
  })

  it('draws the trend with the points and the period unit the server chose', async () => {
    serve()
    renderPage()

    const trend = await screen.findByTestId('trend')
    expect(trend).toHaveAttribute('data-points', '2')
    expect(trend).toHaveAttribute('data-unit', 'week')
  })

  it('asks for the period shown, and for the filters chosen in the panel', async () => {
    useReportStore.setState({ filters: { location_ids: [3], asset_ids: [], user_ids: [], priorities: ['critical'], sources: ['pm'] } })
    serve()
    renderPage()

    await screen.findByText('$250')
    const request = urls.find((u) => u.pathname.endsWith('/summary'))!
    expect(request.searchParams.get('from')).toBe('2026-09-01')
    expect(request.searchParams.get('to')).toBe('2026-09-30')
    expect(request.searchParams.getAll('priorities[]')).toEqual(['critical'])
    expect(request.searchParams.getAll('location_ids[]')).toEqual(['3'])
    expect(request.searchParams.getAll('sources[]')).toEqual(['pm'])
  })

  it('says so when nothing was finished in the period, and why labor may be nothing', async () => {
    serve({ ...summary, total_cost: 0, labor_cost: 0, parts_cost: 0, work_orders_count: 0, avg_cost_per_wo: 0, trend: [] }, { assets: [], treemap: [], total_assets: 0 })
    renderPage()

    expect(await screen.findByRole('status')).toHaveTextContent('No work was finished in this period')
    expect(screen.getByRole('status')).toHaveTextContent('hourly rate')
  })

  it('does not say that when there is work', async () => {
    serve()
    renderPage()

    await screen.findByText('$250')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('says so when the figures could not be loaded, instead of showing dashes as if they were zero', async () => {
    server.use(
      http.get('/api/v1/reports/costs/summary', () => HttpResponse.json({}, { status: 500 })),
      http.get('/api/v1/reports/costs/by_asset', () => HttpResponse.json({}, { status: 500 })),
    )
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
  })

  it("shows amounts in the company's currency", async () => {
    useLocaleStore.getState().setLocale({ currency: 'EUR', number_format: '1.234,56' })
    serve({ ...summary, total_cost: 12500.4 })
    renderPage()

    expect(await screen.findByText('€12.500')).toBeInTheDocument()
  })
})
