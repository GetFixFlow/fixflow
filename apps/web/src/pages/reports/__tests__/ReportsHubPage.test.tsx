import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReportsHubPage } from '../ReportsHubPage'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

describe('ReportsHubPage', () => {
  it('renders all 6 report sections', () => {
    render(<ReportsHubPage />, { wrapper: Wrapper })
    expect(screen.getByText('Work Orders')).toBeInTheDocument()
    expect(screen.getByText('Asset Health')).toBeInTheDocument()
    expect(screen.getByText('PM Compliance')).toBeInTheDocument()
    expect(screen.getByText('IoT Analytics')).toBeInTheDocument()
    expect(screen.getByText('Technician Performance')).toBeInTheDocument()
    expect(screen.getByText('Cost Analysis')).toBeInTheDocument()
  })

  it('shows page header', () => {
    render(<ReportsHubPage />, { wrapper: Wrapper })
    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument()
  })
})
