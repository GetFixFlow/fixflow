import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DowntimeReportPage } from '../DowntimeReportPage'
import { useReportStore } from '@/stores/reportStore'
import { reportsApi } from '@/api/reports'
import { formatHours, formatPercent } from '@/utils/chartUtils'
import { fixtures, kpiValue, serveReportFixtures } from '@/test/reportFixtures'

// Charts need a real layout to draw; the cards and the table are the real ones, fed what the server really sends.
vi.mock('@/components/reports/ReportFiltersSidebar', () => ({ ReportFiltersSidebar: () => null }))
vi.mock('@/components/reports/DowntimeChart', () => ({ DowntimeChart: ({ data }: { data: unknown[] }) => <div>chart of {data.length}</div> }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><DowntimeReportPage /></MemoryRouter></QueryClientProvider>)
}

describe('DowntimeReportPage with the server\'s real response', () => {
  beforeEach(() => {
    useReportStore.getState().resetFilters()
    serveReportFixtures()
  })

  it('shows the figures for all the assets', async () => {
    renderPage()
    const { summary } = fixtures.assetDowntime
    expect(summary.failures).toBeGreaterThan(0)

    await waitFor(async () => expect(await kpiValue(screen, 'Availability')).toBe(formatPercent(summary.availability)))
    expect(await kpiValue(screen, 'Downtime')).toBe(formatHours(summary.downtime_hours))
    expect(await kpiValue(screen, 'Failures')).toBe(String(summary.failures))
    expect(await kpiValue(screen, 'MTBF')).toBe(formatHours(summary.mtbf_hours!))
    expect(await kpiValue(screen, 'MTTR')).toBe(formatHours(summary.mttr_hours!))
  })

  it('lists each asset with its availability, and a dash where it has not failed', async () => {
    renderPage()
    const failed = fixtures.assetDowntime.assets.find((row) => row.failures > 0)!
    const steady = fixtures.assetDowntime.assets.find((row) => row.failures === 0 && !row.down_now)!

    const failedRow = (await screen.findByText(failed.name)).closest('tr')!
    expect(failedRow).toHaveTextContent(formatPercent(failed.availability))
    expect(failedRow).toHaveTextContent(formatHours(failed.mtbf_hours!))
    const steadyRow = screen.getByText(steady.name).closest('tr')!
    expect(steadyRow).toHaveTextContent('100.0%')
    expect(steadyRow.querySelectorAll('td')[6]).toHaveTextContent('—')
  })

  it('marks an asset that is down now', async () => {
    renderPage()
    const down = fixtures.assetDowntime.assets.find((row) => row.down_now)!

    expect((await screen.findByText(down.name)).closest('tr')).toHaveTextContent('Down now')
  })

  it('asks for the period and the Filters chosen, and exports the same table as CSV only', async () => {
    const download = vi.spyOn(reportsApi, 'download').mockResolvedValue({ blob: new Blob(['x']), filename: 'asset_downtime.csv', truncated: false })
    useReportStore.getState().setFilter('location_ids', [3])
    renderPage()
    await screen.findByText(fixtures.assetDowntime.assets[0].name)

    await userEvent.click(screen.getByRole('button', { name: /export/i }))

    expect(screen.getByText('Export as CSV')).toBeInTheDocument()
    expect(screen.queryByText('Export as PDF')).toBeNull()
    await userEvent.click(screen.getByText('Export as CSV'))
    await waitFor(() => expect(download).toHaveBeenCalledWith('assets/downtime', 'csv', expect.objectContaining({ location_ids: [3] })))
  })
})
