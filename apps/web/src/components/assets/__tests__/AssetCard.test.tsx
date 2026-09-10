import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AssetCard } from '../AssetCard'
import type { Asset } from '@/types'

const mockAsset: Asset = {
  id: 1,
  name: 'Pump-01',
  asset_tag: 'FF-000001',
  status: 'operational',
  organization_id: 1,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

describe('AssetCard', () => {
  it('renders asset name and tag', () => {
    render(<AssetCard asset={mockAsset} />, { wrapper })
    expect(screen.getByText('Pump-01')).toBeInTheDocument()
    expect(screen.getByText('FF-000001')).toBeInTheDocument()
  })

  it('shows operational status', () => {
    render(<AssetCard asset={mockAsset} />, { wrapper })
    expect(screen.getByText(/operational/i)).toBeInTheDocument()
  })

  it('shows correct status dot color for degraded', () => {
    render(<AssetCard asset={{ ...mockAsset, status: 'degraded' }} />, { wrapper })
    expect(screen.getByText(/degraded/i)).toBeInTheDocument()
  })

  it('shows correct status dot for down', () => {
    render(<AssetCard asset={{ ...mockAsset, status: 'down' }} />, { wrapper })
    expect(screen.getByText(/down/i)).toBeInTheDocument()
  })

  it('shows open work orders count when > 0', () => {
    render(<AssetCard asset={{ ...mockAsset, open_work_orders_count: 3 }} />, { wrapper })
    expect(screen.getByText(/3 open wo/i)).toBeInTheDocument()
  })

  it('shows three-dot menu options', async () => {
    const onDelete = vi.fn()
    render(<AssetCard asset={mockAsset} onDelete={onDelete} />, { wrapper })
    const menuBtn = screen.getByLabelText('Asset options')
    await userEvent.click(menuBtn)
    expect(screen.getByText('View')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('calls onDelete when delete is clicked', async () => {
    const onDelete = vi.fn()
    render(<AssetCard asset={mockAsset} onDelete={onDelete} />, { wrapper })
    const menuBtn = screen.getByLabelText('Asset options')
    await userEvent.click(menuBtn)
    await userEvent.click(screen.getByText('Delete'))
    expect(onDelete).toHaveBeenCalledWith(mockAsset)
  })
})
