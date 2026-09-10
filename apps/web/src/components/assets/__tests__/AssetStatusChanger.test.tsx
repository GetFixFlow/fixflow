import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AssetStatusChanger } from '../AssetStatusChanger'
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

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('AssetStatusChanger', () => {
  it('shows current status badge', () => {
    render(<AssetStatusChanger asset={mockAsset} />, { wrapper })
    expect(screen.getByText(/operational/i)).toBeInTheDocument()
  })

  it('opens popover on click showing status options', async () => {
    render(<AssetStatusChanger asset={mockAsset} />, { wrapper })
    await userEvent.click(screen.getByLabelText('Change asset status'))
    expect(screen.getByText('degraded')).toBeInTheDocument()
    expect(screen.getByText('down')).toBeInTheDocument()
  })

  it('marks current status as current', async () => {
    render(<AssetStatusChanger asset={mockAsset} />, { wrapper })
    await userEvent.click(screen.getByLabelText('Change asset status'))
    expect(screen.getByText('current')).toBeInTheDocument()
  })

  it('shows confirmation for destructive status change (down)', async () => {
    render(<AssetStatusChanger asset={mockAsset} />, { wrapper })
    await userEvent.click(screen.getByLabelText('Change asset status'))
    // Click "down" - should show confirmation
    const downBtn = screen.getAllByText('down')[0]
    await userEvent.click(downBtn)
    expect(screen.getByText(/confirm/i)).toBeInTheDocument()
  })

  it('shows confirmation for decommissioned', async () => {
    render(<AssetStatusChanger asset={mockAsset} />, { wrapper })
    await userEvent.click(screen.getByLabelText('Change asset status'))
    const decommBtn = screen.getByText('decommissioned')
    await userEvent.click(decommBtn)
    expect(screen.getByText(/confirm/i)).toBeInTheDocument()
  })

  it('can cancel destructive status change', async () => {
    render(<AssetStatusChanger asset={mockAsset} />, { wrapper })
    await userEvent.click(screen.getByLabelText('Change asset status'))
    const downBtn = screen.getAllByText('down')[0]
    await userEvent.click(downBtn)
    await userEvent.click(screen.getByText('Cancel'))
    // Should be back to status list
    expect(screen.queryByText(/confirm/i)).not.toBeInTheDocument()
  })
})
