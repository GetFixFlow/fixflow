import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { TriggerPMModal } from '../TriggerPMModal'
import type { PreventiveMaintenance } from '@/types'

const mockPM: PreventiveMaintenance = {
  id: 1, name: 'Monthly Pump Oil Change', title: 'Monthly Pump Oil Change',
  status: 'active', priority: 'medium',
  frequency_type: 'time_based', frequency_value: 30, frequency_unit: 'days',
  asset_id: 1, organization_id: 1, created_at: '', updated_at: '',
  estimated_hours: 1.5,
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

describe('TriggerPMModal', () => {
  it('shows WO preview with template title and estimated hours', () => {
    render(<TriggerPMModal open pm={mockPM} onClose={() => {}} />, { wrapper })
    expect(screen.getByText('Trigger PM Now')).toBeInTheDocument()
    expect(screen.getByText('Monthly Pump Oil Change')).toBeInTheDocument()
    expect(screen.getByText('1.5')).toBeInTheDocument()
  })

  it('advanced overrides expand on click', async () => {
    render(<TriggerPMModal open pm={mockPM} onClose={() => {}} />, { wrapper })
    expect(screen.queryByLabelText(/override due date/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getByText(/advanced overrides/i))
    expect(screen.getByText(/override due date/i)).toBeInTheDocument()
  })

  it('submission calls trigger mutation and closes on success', async () => {
    server.use(
      http.post('/api/v1/preventive_maintenances/1/trigger', () =>
        HttpResponse.json({ data: { work_order_number: 'WO-100', work_order_id: 100 }, meta: { request_id: 'test', timestamp: '' } }),
      ),
      http.get('/api/v1/preventive_maintenances', () =>
        HttpResponse.json({ preventive_maintenances: [], meta: { request_id: 'test', timestamp: '' } }),
      ),
    )
    const onClose = vi.fn()
    render(<TriggerPMModal open pm={mockPM} onClose={onClose} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /create work order now/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('cancel button calls onClose', async () => {
    const onClose = vi.fn()
    render(<TriggerPMModal open pm={mockPM} onClose={onClose} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
