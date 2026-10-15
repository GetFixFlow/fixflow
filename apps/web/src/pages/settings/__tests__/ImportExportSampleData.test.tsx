import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { ImportExportPage } from '../ImportExportPage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const none = { Location: 0, Asset: 0, Part: 0, PreventiveMaintenance: 0, WorkOrder: 0 }
const some = { Location: 3, Asset: 5, Part: 4, PreventiveMaintenance: 1, WorkOrder: 9 }

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ImportExportPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role: 'admin', organization_id: 1 } as never, token: 't', isAuthenticated: true })
})

describe('Settings, sample data', () => {
  it('explains what it is, and offers to add it when there is none', async () => {
    server.use(http.get('/api/v1/sample_data', () => HttpResponse.json({ loaded: false, counts: none })))
    renderPage()

    // The button is there at once but only usable once the page knows whether sample data is loaded.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add sample data' })).toBeEnabled())
    expect(screen.getByText(/creates no accounts and sends no email/i)).toBeInTheDocument()
  })

  it('says what is loaded and offers to remove it, not to add it again', async () => {
    server.use(http.get('/api/v1/sample_data', () => HttpResponse.json({ loaded: true, counts: some })))
    renderPage()

    expect(await screen.findByText(/3 places, 5 assets, 4 parts, 1 PM schedules?, 9 work orders/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove sample data' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add sample data' })).not.toBeInTheDocument()
  })

  it('adds it', async () => {
    server.use(
      http.get('/api/v1/sample_data', () => HttpResponse.json({ loaded: false, counts: none })),
      http.post('/api/v1/sample_data', () => HttpResponse.json({ loaded: true, counts: some }, { status: 201 })),
    )
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Add sample data' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Sample data added.'))
  })

  it('lists what was kept because it was built on, so nothing disappears unexplained', async () => {
    server.use(
      http.get('/api/v1/sample_data', () => HttpResponse.json({ loaded: true, counts: some })),
      http.delete('/api/v1/sample_data', () => HttpResponse.json({
        loaded: false, counts: none,
        report: { removed: { Asset: 4 }, kept: [{ type: 'Asset', name: 'Sample: Pump 01', reason: 'work orders or schedules you created use this asset' }] },
      })),
    )
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Remove sample data' }))

    expect(await screen.findByText(/Kept, because you built on them/)).toBeInTheDocument()
    expect(screen.getByText(/Sample: Pump 01: work orders or schedules you created use this asset/)).toBeInTheDocument()
  })
})
