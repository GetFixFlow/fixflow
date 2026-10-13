import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProfilePage } from '../ProfilePage'

const updateMutate = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/useSettings', () => ({
  useProfile: () => ({
    data: {
      full_name: 'Alice Smith',
      email: 'alice@test.com',
      role: 'admin',
      organization_name: 'Acme Corp',
      created_at: '2026-01-01T00:00:00Z',
    },
    isLoading: false,
  }),
  useUpdateProfile: () => ({ mutate: updateMutate, isPending: false }),
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

  it('shows the real organization name, not a placeholder', () => {
    render(<ProfilePage />, { wrapper: Wrapper })
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.queryByText('Demo Manufacturing Co.')).not.toBeInTheDocument()
  })

  it('keeps the sign-in email read-only', async () => {
    render(<ProfilePage />, { wrapper: Wrapper })
    expect(await screen.findByDisplayValue('alice@test.com')).toBeDisabled()
  })

  it('does not offer a photo upload, which the API does not support yet', () => {
    render(<ProfilePage />, { wrapper: Wrapper })
    expect(screen.queryByText(/change photo/i)).not.toBeInTheDocument()
  })

  it('saves only the fields the API accepts', async () => {
    render(<ProfilePage />, { wrapper: Wrapper })
    const name = await screen.findByDisplayValue('Alice Smith')
    await userEvent.clear(name)
    await userEvent.type(name, 'Alice Jones')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    expect(updateMutate.mock.calls[0][0]).toEqual({
      full_name: 'Alice Jones', phone: '', job_title: '', department: '',
    })
  })
})
