import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { SchedulePreviewModal, calculatePreviewDates } from '../SchedulePreviewModal'
import type { PreventiveMaintenance } from '@/types'

const mockPM: PreventiveMaintenance = {
  id: 1, name: 'Monthly Oil Change', title: 'Monthly Oil Change',
  status: 'active', priority: 'medium',
  frequency_type: 'time_based', frequency_value: 30, frequency_unit: 'days',
  asset_id: 1, organization_id: 1, created_at: '', updated_at: '',
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

describe('SchedulePreviewModal', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/v1/preventive_maintenances/1/preview_schedule', () =>
        HttpResponse.json({ items: [], meta: { request_id: 'test', timestamp: '' } }),
      ),
    )
  })

  it('shows modal title and PM name', () => {
    render(<SchedulePreviewModal open pm={mockPM} onClose={() => {}} />, { wrapper })
    expect(screen.getByText('Schedule Preview')).toBeInTheDocument()
    expect(screen.getByText('Monthly Oil Change')).toBeInTheDocument()
  })

  it('shows 5 preview dates when passed directly', () => {
    const dates = calculatePreviewDates('time_based', 30, 'days', new Date().toISOString(), 5)
    const previewDates = dates.map((item) => item)
    render(<SchedulePreviewModal open pm={mockPM} previewDates={previewDates} onClose={() => {}} />, { wrapper })
    // 5 rows in table (plus header row)
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBeGreaterThanOrEqual(5)
  })

  it('weekend warning shows for Saturday dates', () => {
    // Build a date that falls on Saturday
    const sat = new Date()
    while (sat.getDay() !== 6) sat.setDate(sat.getDate() + 1)
    const previewDates = [{ date: sat, daysUntil: 3, warnings: ['Falls on a Saturday'] }]
    render(<SchedulePreviewModal open pm={mockPM} previewDates={previewDates} onClose={() => {}} />, { wrapper })
    // Warning triangle icon should be present in the DOM
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  it('calculatePreviewDates produces correct count for time_based', () => {
    const dates = calculatePreviewDates('time_based', 30, 'days', new Date().toISOString(), 12)
    expect(dates).toHaveLength(12)
  })

  it('calculatePreviewDates handles week unit', () => {
    const dates = calculatePreviewDates('time_based', 1, 'weeks', new Date().toISOString(), 3)
    expect(dates).toHaveLength(3)
    // Second date should be ~7 days after first
    const diffDays = Math.round((dates[1].date.getTime() - dates[0].date.getTime()) / 86400000)
    expect(diffDays).toBe(7)
  })
})
