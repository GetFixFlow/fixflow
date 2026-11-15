import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { setLanguage } from '@/i18n'
import type { SiteRow, SitesReport } from '@/api/sites'
import { SitesReportPage } from '../SitesReportPage'

const row = (over: Partial<SiteRow> = {}): SiteRow => ({
  id: 1, name: 'North', assets: 12, open_work_orders: 5, overdue_work_orders: 2, completed_work_orders: 9, total_cost: 1234.5, people: 4,
  availability: 97.25, downtime_hours: 18, failures: 3, ...over,
})

const report: SitesReport = {
  period: { from: '2026-10-16', to: '2026-11-15' },
  sites: [row(), row({ id: 2, name: 'South', assets: 7, open_work_orders: 1, overdue_work_orders: 0, completed_work_orders: 4, total_cost: 80, people: 2, availability: 100, downtime_hours: 0, failures: 0 })],
  shared: row({ id: null, name: null, assets: 1, open_work_orders: 1, overdue_work_orders: 0, completed_work_orders: 0, total_cost: 0, people: null, availability: 100, downtime_hours: 0, failures: 0 }),
  total: { assets: 20, open_work_orders: 7, overdue_work_orders: 2, completed_work_orders: 13, total_cost: 1314.5, downtime_hours: 18, failures: 3 },
}

function renderPage() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SitesReportPage /></QueryClientProvider>)
}

beforeEach(() => { server.use(http.get('/api/v1/reports/sites', () => HttpResponse.json({ data: report }))) })
afterEach(async () => { await setLanguage('en', false) })

const cells = (name: string) => within(screen.getByRole('row', { name: new RegExp(`^${name}`) })).getAllByRole('cell').map((cell) => cell.textContent)

describe('SitesReportPage', () => {
  it('puts each site on a line, then what is in no site, then the total, under named columns', async () => {
    renderPage()

    expect(await screen.findByRole('rowheader', { name: 'North' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Site', 'Assets', 'Open work orders', 'Overdue', 'Finished', 'Cost of finished work', 'Availability', 'Downtime (h)', 'Failures', 'People',
    ])
    expect(screen.getAllByRole('rowheader').map((header) => header.textContent)).toEqual(['North', 'South', 'In no site', 'All sites'])
  })

  it('shows the figures of a site, the cost as money, and a dash for people when it is the shared line', async () => {
    renderPage()
    await screen.findByRole('rowheader', { name: 'North' })

    expect(cells('North').slice(0, 4)).toEqual(['12', '5', '2', '9'])
    expect(cells('North')[4]).toMatch(/1,234\.50/)
    expect(cells('North').slice(-1)[0]).toBe('4')
    expect(cells('In no site').slice(-1)[0]).toBe('—')
    expect(cells('All sites')[0]).toBe('20')
  })

  it('says what the shared line is', async () => {
    renderPage()

    expect(await screen.findByText(/Assets in no site, and work with no asset, are shared by every site/)).toBeInTheDocument()
  })

  it('says so when there are no sites yet', async () => {
    server.use(http.get('/api/v1/reports/sites', () => HttpResponse.json({ data: { ...report, sites: [] } })))
    renderPage()

    expect(await screen.findByText(/No sites yet/)).toBeInTheDocument()
  })

  it('says when the report cannot be loaded', async () => {
    server.use(http.get('/api/v1/reports/sites', () => HttpResponse.json({}, { status: 500 })))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('The report could not be loaded.')
  })

  it('reads in Spanish', async () => {
    await setLanguage('es', false)
    renderPage()

    expect(await screen.findByRole('rowheader', { name: 'En ninguna sede' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Órdenes abiertas' })).toBeInTheDocument()
  })
})
