import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiKeyRevealModal } from '../ApiKeyRevealModal'
import type { ApiKeyWithSecret } from '@/types'
import { vi } from 'vitest'

const mockKey: ApiKeyWithSecret = {
  id: 1, name: 'Factory Floor Gateway', key_prefix: 'fk_live_abc', key: 'fk_live_abc123xyz456secretkey',
  active: true, organization_id: 1, created_at: new Date().toISOString(),
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

describe('ApiKeyRevealModal', () => {
  it('shows generated API key', () => {
    render(<ApiKeyRevealModal open apiKey={mockKey} onClose={() => {}} />, { wrapper })
    expect(screen.getByText('fk_live_abc123xyz456secretkey')).toBeInTheDocument()
  })

  it('shows important copy warning', () => {
    render(<ApiKeyRevealModal open apiKey={mockKey} onClose={() => {}} />, { wrapper })
    expect(screen.getAllByText(/copy this key now|not be shown again/i).length).toBeGreaterThan(0)
  })

  it('shows REST and MQTT setup instructions', () => {
    render(<ApiKeyRevealModal open apiKey={mockKey} onClose={() => {}} />, { wrapper })
    expect(screen.getAllByText(/REST|ingest/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/MQTT/i).length).toBeGreaterThan(0)
  })

  it('close button calls onClose', async () => {
    const onClose = vi.fn()
    render(<ApiKeyRevealModal open apiKey={mockKey} onClose={onClose} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('copy to clipboard button present', () => {
    render(<ApiKeyRevealModal open apiKey={mockKey} onClose={() => {}} />, { wrapper })
    expect(screen.getAllByRole('button', { name: /copy/i }).length).toBeGreaterThan(0)
  })
})
