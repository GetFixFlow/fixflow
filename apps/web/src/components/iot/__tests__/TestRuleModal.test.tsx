import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { TestRuleModal } from '../TestRuleModal'
import type { IotRuleExtended } from '@/types'
import { vi } from 'vitest'

const mockRule: IotRuleExtended = {
  id: 1, name: 'Pump-01 High Vibration', asset_id: 1, metric_name: 'vibration', metric_unit: 'mm/s',
  operator: 'gt', threshold_value: 8.5, sensor_type: 'vibration', condition: 'gt', severity: 'critical',
  enabled: true, status: 'active', auto_create_wo: true, wo_priority: 'critical', cooldown_minutes: 60,
  organization_id: 1, created_at: '', updated_at: '',
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

describe('TestRuleModal', () => {
  it('shows rule name', () => {
    render(<TestRuleModal open rule={mockRule} onClose={() => {}} />, { wrapper })
    expect(screen.getByText('Pump-01 High Vibration')).toBeInTheDocument()
  })

  it('shows vibration metric and threshold', () => {
    render(<TestRuleModal open rule={mockRule} onClose={() => {}} />, { wrapper })
    expect(screen.getAllByText(/vibration/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/8.5/).length).toBeGreaterThan(0)
  })

  it('run test with value calls API', async () => {
    let tested = false
    server.use(
      http.post('/api/v1/iot_rules/1/test', () => {
        tested = true
        return HttpResponse.json({ would_trigger: true, reason: 'Value 9.2 > threshold 8.5', recent_readings: [] })
      }),
    )
    render(<TestRuleModal open rule={mockRule} onClose={() => {}} />, { wrapper })
    const input = screen.getByRole('spinbutton')
    await userEvent.clear(input)
    await userEvent.type(input, '9.2')
    await userEvent.click(screen.getByRole('button', { name: /run test/i }))
    await waitFor(() => expect(tested).toBe(true))
  })

  it('result shows would trigger YES', async () => {
    server.use(
      http.post('/api/v1/iot_rules/1/test', () =>
        HttpResponse.json({ would_trigger: true, reason: 'Value exceeds threshold', recent_readings: [] }),
      ),
    )
    render(<TestRuleModal open rule={mockRule} onClose={() => {}} />, { wrapper })
    const input = screen.getByRole('spinbutton')
    await userEvent.clear(input)
    await userEvent.type(input, '9.2')
    await userEvent.click(screen.getByRole('button', { name: /run test/i }))
    await waitFor(() => expect(screen.getAllByText(/yes|would trigger/i).length).toBeGreaterThan(0))
  })

  it('cancel closes modal', async () => {
    const onClose = vi.fn()
    render(<TestRuleModal open rule={mockRule} onClose={onClose} />, { wrapper })
    const btns = screen.getAllByRole('button', { name: /close|cancel/i })
    await userEvent.click(btns[btns.length - 1])
    expect(onClose).toHaveBeenCalled()
  })
})
