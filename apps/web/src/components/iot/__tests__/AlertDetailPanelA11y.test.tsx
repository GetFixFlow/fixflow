import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AlertDetailPanel } from '../AlertDetailPanel'
import { ReportFiltersSidebar } from '@/components/reports/ReportFiltersSidebar'
import type { IotAlertExtended } from '@/types'

const alert = { id: 9, severity: 'critical', status: 'open', rule_name: 'Bearing too hot', message: 'Bearing too hot', asset_id: 5, metric_name: 'temp', sensor_value: 91, threshold_value: 80, metric_unit: 'C', created_at: '2026-01-01T00:00:00Z' } as unknown as IotAlertExtended

describe('the alert slide-over', () => {
  it('is hidden from the keyboard and screen readers while closed, and a dialog with a name while open', () => {
    const { rerender } = render(<MemoryRouter><AlertDetailPanel alert={null} onClose={() => {}} /></MemoryRouter>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(<MemoryRouter><AlertDetailPanel alert={alert} onClose={() => {}} /></MemoryRouter>)
    expect(screen.getByRole('dialog', { name: 'Bearing too hot' })).toHaveAttribute('aria-modal', 'true')
  })

  it('takes the keyboard when it opens and closes on Escape', async () => {
    const onClose = vi.fn()
    render(<MemoryRouter><AlertDetailPanel alert={alert} onClose={onClose} /></MemoryRouter>)

    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('has a close button with a name', () => {
    render(<MemoryRouter><AlertDetailPanel alert={alert} onClose={() => {}} /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})

describe('the report filters panel', () => {
  it('is a labelled dialog that closes on Escape', async () => {
    const onClose = vi.fn()
    render(<ReportFiltersSidebar open onClose={onClose} onApply={() => {}} />)

    expect(screen.getByRole('dialog', { name: /Filters/ })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
