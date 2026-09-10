import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NotificationsPage } from '../NotificationsPage'

vi.mock('@/hooks/useSettings', () => ({
  useNotificationPreferences: () => ({ data: null, isLoading: false }),
  useUpdateNotificationPreferences: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      role: 'admin',
      id: 1,
      full_name: 'Alice',
      email: 'alice@test.com',
      organization_id: 1,
    },
  }),
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('NotificationsPage', () => {
  it('renders channel toggles', () => {
    render(<NotificationsPage />, { wrapper: Wrapper })
    expect(screen.getByText('Email Notifications')).toBeInTheDocument()
    expect(screen.getByText('Push Notifications')).toBeInTheDocument()
    expect(screen.getByText('IoT Alert Sound')).toBeInTheDocument()
  })

  it('renders notification rules table', () => {
    render(<NotificationsPage />, { wrapper: Wrapper })
    expect(screen.getByText('WO assigned to me')).toBeInTheDocument()
    expect(screen.getByText('PM overdue')).toBeInTheDocument()
  })
})
