import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProfilePage } from '../ProfilePage'

vi.mock('@/hooks/useSettings', () => ({
  useProfile: () => ({
    data: {
      full_name: 'Alice Smith',
      email: 'alice@test.com',
      role: 'admin',
      created_at: '2026-01-01T00:00:00Z',
    },
    isLoading: false,
  }),
  useUpdateProfile: () => ({ mutate: vi.fn(), isPending: false }),
  useChangePassword: () => ({ mutate: vi.fn(), isPending: false }),
  useSessions: () => ({
    data: [
      {
        id: '1',
        device: 'Chrome Mac',
        location: 'US',
        last_active_at: new Date().toISOString(),
        current: true,
      },
    ],
    isLoading: false,
  }),
  useRevokeSession: () => ({ mutate: vi.fn(), isPending: false }),
  useRevokeAllSessions: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      full_name: 'Alice Smith',
      email: 'alice@test.com',
      role: 'admin',
      created_at: '2026-01-01T00:00:00Z',
      id: 1,
      organization_id: 1,
    },
    updateUser: vi.fn(),
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

describe('ProfilePage', () => {
  it('renders profile form', () => {
    render(<ProfilePage />, { wrapper: Wrapper })
    expect(screen.getByText('My Profile')).toBeInTheDocument()
  })

  it('shows user name in form', async () => {
    render(<ProfilePage />, { wrapper: Wrapper })
    const input = await screen.findByDisplayValue('Alice Smith')
    expect(input).toBeInTheDocument()
  })

  it('shows role badge', () => {
    render(<ProfilePage />, { wrapper: Wrapper })
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('shows sessions table', () => {
    render(<ProfilePage />, { wrapper: Wrapper })
    expect(screen.getByText('Active Sessions')).toBeInTheDocument()
    expect(screen.getByText('Chrome Mac')).toBeInTheDocument()
  })

  it('shows change password section (collapsed)', () => {
    render(<ProfilePage />, { wrapper: Wrapper })
    expect(screen.getByText('Change Password')).toBeInTheDocument()
  })
})
