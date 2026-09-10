import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { AssetCreatePage } from '../AssetCreatePage'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AssetCreatePage', () => {
  it('shows step 1 by default', () => {
    render(<AssetCreatePage />, { wrapper })
    expect(screen.getByLabelText(/asset name/i)).toBeInTheDocument()
    expect(screen.getByText('Continue →')).toBeInTheDocument()
  })

  it('validates required name on step 1', async () => {
    render(<AssetCreatePage />, { wrapper })
    await userEvent.click(screen.getByText('Continue →'))
    await waitFor(() => expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument())
  })

  it('cannot proceed to step 2 with invalid data', async () => {
    render(<AssetCreatePage />, { wrapper })
    await userEvent.click(screen.getByText('Continue →'))
    // Still on step 1
    expect(screen.getByLabelText(/asset name/i)).toBeInTheDocument()
  })

  it('advances to step 2 with valid data', async () => {
    server.use(
      http.get('/api/v1/locations', () =>
        HttpResponse.json({ locations: [], meta: { request_id: 'test', timestamp: '' } }),
      ),
    )
    render(<AssetCreatePage />, { wrapper })
    await userEvent.type(screen.getByLabelText(/asset name/i), 'My Pump')
    await userEvent.click(screen.getByText('Continue →'))
    await waitFor(() => expect(screen.getByText(/location & classification/i)).toBeInTheDocument())
  })

  it('shows back button on step 2 to go back', async () => {
    server.use(
      http.get('/api/v1/locations', () =>
        HttpResponse.json({ locations: [], meta: { request_id: 'test', timestamp: '' } }),
      ),
    )
    render(<AssetCreatePage />, { wrapper })
    await userEvent.type(screen.getByLabelText(/asset name/i), 'My Pump')
    await userEvent.click(screen.getByText('Continue →'))
    await waitFor(() => expect(screen.getByText('← Back')).toBeInTheDocument())
    await userEvent.click(screen.getByText('← Back'))
    expect(screen.getByLabelText(/asset name/i)).toBeInTheDocument()
  })

  it('shows step 3 review with entered name', async () => {
    server.use(
      http.get('/api/v1/locations', () =>
        HttpResponse.json({ locations: [], meta: { request_id: 'test', timestamp: '' } }),
      ),
    )
    render(<AssetCreatePage />, { wrapper })
    await userEvent.type(screen.getByLabelText(/asset name/i), 'My Pump')
    await userEvent.click(screen.getByText('Continue →'))
    await waitFor(() => expect(screen.getByText('Continue →')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Continue →'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Asset' })).toBeInTheDocument())
    expect(screen.getByText('My Pump')).toBeInTheDocument()
  })
})
