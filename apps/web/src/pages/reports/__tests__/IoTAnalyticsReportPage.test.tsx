import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IoTAnalyticsReportPage } from '../IoTAnalyticsReportPage'
import { useReportStore } from '@/stores/reportStore'
import { fixtures, kpiValue, serveReportFixtures } from '@/test/reportFixtures'

// Real page, cards and table, fed what the server really sends (see reportFixtures.ts).
vi.mock('@/components/reports/ReportFiltersSidebar', () => ({ ReportFiltersSidebar: () => null }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><IoTAnalyticsReportPage /></MemoryRouter></QueryClientProvider>)
}

describe('IoTAnalyticsReportPage with the server\'s real responses', () => {
  let asked: URL[]
  beforeEach(() => {
    useReportStore.getState().resetFilters()
    asked = serveReportFixtures()
  })

  it('shows the alert totals, the resolved share and the active rules', async () => {
    const { total_alerts, critical_count, resolved_rate } = fixtures.iotAlerts
    expect(total_alerts).toBeGreaterThan(0)
    renderPage()
    await waitFor(async () => expect(await kpiValue(screen, 'Total Alerts')).toBe(String(total_alerts)))
    expect(await kpiValue(screen, 'Critical Alerts')).toBe(String(critical_count))
    expect(await kpiValue(screen, 'Resolved Rate')).toBe(`${resolved_rate.toFixed(1)}%`)
    expect(await kpiValue(screen, 'Active Rules')).toBe(String(fixtures.iotRules.active_count))
  })

  it('lists how each rule did', async () => {
    renderPage()
    const rule = fixtures.iotRules.rules[0]
    const row = (await screen.findByText(rule.rule_name)).closest('tr')!
    expect(Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent)).toEqual(
      [rule.rule_name, String(rule.trigger_count), `${rule.resolve_rate.toFixed(1)}%`, String(rule.wo_created), `${rule.avg_resolution_hours.toFixed(1)}h`])
  })

  it('shows the sensor comparison when the server sends a series (one asset chosen)', async () => {
    expect(fixtures.iotAlerts.sensor_series.length).toBeGreaterThan(0)
    renderPage()
    expect(await screen.findByText('Sensor Metric Comparison')).toBeInTheDocument()
  })

  it('asks for both reports with the period and the Filters', async () => {
    useReportStore.getState().setFilter('asset_ids', [9])
    renderPage()
    await screen.findByText(fixtures.iotRules.rules[0].rule_name)
    for (const path of ['/iot/alerts', '/iot/rule_effectiveness']) {
      const url = asked.find((candidate) => candidate.pathname.endsWith(path))!
      expect(url.searchParams.getAll('asset_ids[]'), path).toEqual(['9'])
      expect(url.searchParams.has('from') && url.searchParams.has('to'), path).toBe(true)
    }
  })
})
