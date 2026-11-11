import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LocationSelect } from '../LocationSelect'
import { WorkOrderKanbanCard } from '@/components/work-orders/WorkOrderKanbanCard'
import { AssetCard } from '@/components/assets/AssetCard'
import type { Asset, Location, WorkOrder } from '@/types'

const plant = { id: 1, name: 'Plant 1', location_type: 'building', created_at: '', updated_at: '' } as Location

describe('LocationSelect, by keyboard and for a screen reader', () => {
  it('has its clear button beside the trigger, not inside it (a control cannot hold a control)', async () => {
    const onChange = vi.fn()
    render(<LocationSelect locations={[plant]} value={1} onChange={onChange} label="Location" />)
    const trigger = screen.getByRole('button', { name: /Plant 1/ })
    const clear = screen.getByRole('button', { name: 'Clear selection' })

    expect(trigger).not.toContainElement(clear)
    await userEvent.click(clear)
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('is reached and cleared with the keyboard alone', async () => {
    const onChange = vi.fn()
    render(<LocationSelect locations={[plant]} value={1} onChange={onChange} />)
    await userEvent.tab() // the trigger
    await userEvent.tab() // the clear button
    expect(screen.getByRole('button', { name: 'Clear selection' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('closes on Escape and gives the keyboard back to the trigger', async () => {
    render(<LocationSelect locations={[plant]} value={null} onChange={() => {}} label="Location" />)
    const trigger = screen.getByRole('button', { name: /Select/ })
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await userEvent.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })
})

describe('cards you can open', () => {
  const workOrder = { id: 7, work_order_number: 'WO-000007', title: 'Fix the pump', status: 'open', priority: 'high', work_order_type: 'corrective', source: 'manual', organization_id: 1, created_at: '', updated_at: '' } as WorkOrder
  const asset = { id: 3, name: 'Pump-01', asset_tag: 'FF-000003', status: 'operational', organization_id: 1, created_at: '', updated_at: '' } as Asset

  it('a work order card is one link to the work order, named by its number and title', () => {
    render(<MemoryRouter><WorkOrderKanbanCard workOrder={workOrder} /></MemoryRouter>)
    const link = screen.getByRole('link', { name: 'WO-000007: Fix the pump' })

    expect(link).toHaveAttribute('href', '/work-orders/7')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('an asset card is one link to the asset, with its menu a separate button (not a button holding a button)', () => {
    render(<MemoryRouter><AssetCard asset={asset} /></MemoryRouter>)
    const link = screen.getByRole('link', { name: /Pump-01/ })
    const menu = screen.getByRole('button', { name: /options/i })

    expect(link).toHaveAttribute('href', '/assets/3')
    expect(within(link).queryByRole('button')).not.toBeInTheDocument()
    expect(link).not.toContainElement(menu)
  })
})
