import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReportsHubPage } from '../ReportsHubPage'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

describe('ReportsHubPage', () => {
  it('renders all 7 report sections', () => {
    render(<ReportsHubPage />, { wrapper: Wrapper })
    expect(screen.getByText('Work Orders')).toBeInTheDocument()
    expect(screen.getByText('Asset Health')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Downtime' })).toBeInTheDocument()
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

describe('ReportsHubPage plugin reports', () => {
  it('lists the reports plugins add, each opening its own page', async () => {
    server.use(http.get('/api/v1/plugin_reports', () => HttpResponse.json({ reports: [
      { plugin: 'overdue_work', plugin_title: 'Overdue work', key: 'overdue_now', title: 'Overdue now', description: 'Open work past its due date.', period: false },
    ] })))
    render(<ReportsHubPage />, { wrapper: Wrapper })

    expect(await screen.findByRole('heading', { name: 'From plugins' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Overdue now' })).toHaveAttribute('href', '/reports/plugins/overdue_work/overdue_now')
    expect(screen.getByText('Overdue work · As of now')).toBeInTheDocument()
  })

  it('shows no plugin section when there are none', async () => {
    render(<ReportsHubPage />, { wrapper: Wrapper })

    await screen.findByText('Reports & Analytics')
    expect(screen.queryByRole('heading', { name: 'From plugins' })).not.toBeInTheDocument()
  })

  it('still shows the built-in reports when the plugin list cannot be loaded', async () => {
    server.use(http.get('/api/v1/plugin_reports', () => new HttpResponse(null, { status: 500 })))
    render(<ReportsHubPage />, { wrapper: Wrapper })

    expect(await screen.findByText('Work Orders')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'From plugins' })).not.toBeInTheDocument()
  })
})
