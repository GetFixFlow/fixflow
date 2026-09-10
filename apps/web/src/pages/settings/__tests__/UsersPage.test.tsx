import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UsersPage } from '../UsersPage'

const mockUsers = [
  {
    id: 1,
    full_name: 'Alice Smith',
    email: 'alice@test.com',
    role: 'admin',
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    organization_id: 1,
  },
  {
    id: 2,
    full_name: 'Bob Jones',
    email: 'bob@test.com',
    role: 'technician',
    active: true,
    created_at: '2026-01-15T00:00:00Z',
    organization_id: 1,
  },
]

vi.mock('@/hooks/useUsers', () => ({
  useUsers: () => ({ data: mockUsers, isLoading: false }),
  useInviteUser: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateUser: () => ({ mutate: vi.fn(), isPending: false }),
  useChangeUserRole: () => ({ mutate: vi.fn(), isPending: false }),
  useDeactivateUser: () => ({ mutate: vi.fn(), isPending: false }),
  useReactivateUser: () => ({ mutate: vi.fn(), isPending: false }),
  useResetUserPassword: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 1,
      role: 'admin',
      full_name: 'Alice Smith',
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

describe('UsersPage', () => {
  it('renders team members', () => {
    render(<UsersPage />, { wrapper: Wrapper })
    expect(screen.getByText('Team Members')).toBeInTheDocument()
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
  })

  it('shows invite user button for admin', () => {
    render(<UsersPage />, { wrapper: Wrapper })
    expect(screen.getByText(/Invite User/i)).toBeInTheDocument()
  })

  it('opens invite modal on button click', async () => {
    render(<UsersPage />, { wrapper: Wrapper })
    fireEvent.click(screen.getByText(/Invite User/i))
    expect(await screen.findByText('Invite Team Member')).toBeInTheDocument()
  })
})
