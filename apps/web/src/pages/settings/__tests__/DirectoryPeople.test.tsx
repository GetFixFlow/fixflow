import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UsersPage } from '../UsersPage'
import { ProfilePage } from '../ProfilePage'
import { SecurityPage } from '../SecurityPage'

// What the page shows for a person who signs in through the company directory, and what it still shows for everyone else.
const state = vi.hoisted(() => ({ me: {} as Record<string, unknown> }))

const people = [
  { id: 1, full_name: 'Alice Smith', email: 'alice@test.com', role: 'admin', active: true, created_at: '2026-01-01T00:00:00Z', organization_id: 1 },
  { id: 2, full_name: 'Sam Rivera', email: 'sam@test.com', role: 'technician', active: true, identity_provider: 'oidc', created_at: '2026-01-02T00:00:00Z', organization_id: 1 },
  { id: 3, full_name: 'Jo Reyes', email: 'jo@test.com', role: 'manager', active: true, identity_provider: 'ldap', created_at: '2026-01-03T00:00:00Z', organization_id: 1 },
  { id: 4, full_name: 'Pat Invited', email: 'pat@test.com', role: 'technician', active: true, invitation_pending: true, created_at: '2026-01-04T00:00:00Z', organization_id: 1 },
]

vi.mock('@/hooks/useUsers', () => ({
  useUsers: () => ({ data: people, isLoading: false }),
  useInviteUser: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateUser: () => ({ mutate: vi.fn(), isPending: false }),
  useDeactivateUser: () => ({ mutate: vi.fn(), isPending: false }),
  useReactivateUser: () => ({ mutate: vi.fn(), isPending: false }),
  useBulkDeactivate: () => ({ mutate: vi.fn(), isPending: false }),
  useBulkChangeRole: () => ({ mutate: vi.fn(), isPending: false }),
  useResetUserPassword: () => ({ mutate: vi.fn(), isPending: false }),
  useResetUserTwoFactor: () => ({ mutate: vi.fn(), isPending: false }),
  useUnlockUser: () => ({ mutate: vi.fn(), isPending: false }),
  useResendInvitation: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useSettings', () => ({
  useProfile: () => ({ data: { full_name: 'Me', email: 'me@test.com', role: 'technician', created_at: '2026-01-01T00:00:00Z' }, isLoading: false }),
  useLocalization: () => ({ data: { language: 'en' } }),
  useUpdateProfile: () => ({ mutate: vi.fn(), isPending: false }),
  useChangePassword: () => ({ mutate: vi.fn(), isPending: false }),
  useSessions: () => ({ data: [], isLoading: false }),
  useRevokeSession: () => ({ mutate: vi.fn(), isPending: false }),
  useRevokeAllSessions: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/components/security/TwoFactorCard', () => ({ TwoFactorCard: () => <p>Two-factor card</p> }))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: state.me, updateUser: vi.fn() }),
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement

beforeEach(() => {
  state.me = { id: 1, role: 'admin', full_name: 'Alice Smith', email: 'alice@test.com', organization_id: 1 }
})

describe('the users list', () => {
  it('marks the people who sign in through the company directory, and says which kind', () => {
    render(<UsersPage />, { wrapper: Wrapper })

    expect(within(row('Sam Rivera')).getByText('Company account')).toBeInTheDocument()
    expect(within(row('Jo Reyes')).getByText('LDAP')).toBeInTheDocument()
    expect(within(row('Alice Smith')).queryByText('Company account')).not.toBeInTheDocument()
    expect(within(row('Alice Smith')).queryByText('LDAP')).not.toBeInTheDocument()
  })

  it('says under their role that it follows their groups, only for those people', () => {
    render(<UsersPage />, { wrapper: Wrapper })

    expect(within(row('Sam Rivera')).getByText(/Follows their groups in the company directory/)).toBeInTheDocument()
    expect(within(row('Jo Reyes')).getByText(/Follows their groups/)).toBeInTheDocument()
    expect(within(row('Alice Smith')).queryByText(/Follows their groups/)).not.toBeInTheDocument()
  })

  it('offers no password reset to a person with no password here, and still offers it to the rest', async () => {
    state.me = { id: 99, role: 'admin', full_name: 'Root', email: 'root@test.com', organization_id: 1 }
    render(<UsersPage />, { wrapper: Wrapper })

    await userEvent.click(within(row('Sam Rivera')).getByRole('button', { name: 'Actions for Sam Rivera' }))
    expect(screen.getByRole('button', { name: /Edit User/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reset Password/ })).not.toBeInTheDocument()
    await userEvent.click(within(row('Sam Rivera')).getByRole('button', { name: 'Actions for Sam Rivera' }))

    await userEvent.click(within(row('Alice Smith')).getByRole('button', { name: 'Actions for Alice Smith' }))
    expect(screen.getByRole('button', { name: /Reset Password/ })).toBeInTheDocument()
  })
})

describe('the profile page', () => {
  it('keeps the password form for a person with a password', () => {
    state.me = { id: 5, role: 'technician', full_name: 'Me', email: 'me@test.com', organization_id: 1 }
    render(<ProfilePage />, { wrapper: Wrapper })

    expect(screen.getByRole('button', { name: /Change Password/i })).toBeInTheDocument()
    expect(screen.queryByText(/kept by your company directory/)).not.toBeInTheDocument()
  })

  it.each(['oidc', 'ldap'])('replaces the password form with a sentence for a person signed in through %s', (provider) => {
    state.me = { id: 5, role: 'technician', full_name: 'Me', email: 'me@test.com', organization_id: 1, identity_provider: provider }
    render(<ProfilePage />, { wrapper: Wrapper })

    expect(screen.queryByRole('button', { name: /Change Password/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Your password and second step are kept by your company directory/)).toBeInTheDocument()
  })
})

describe('the security page', () => {
  it('shows two-factor set-up for a person with a password', () => {
    state.me = { id: 5, role: 'technician', full_name: 'Me', email: 'me@test.com', organization_id: 1 }
    render(<SecurityPage />, { wrapper: Wrapper })

    expect(screen.getByText('Two-factor card')).toBeInTheDocument()
  })

  it('shows a sentence instead for a person signed in through the directory', () => {
    state.me = { id: 5, role: 'technician', full_name: 'Me', email: 'me@test.com', organization_id: 1, identity_provider: 'oidc' }
    render(<SecurityPage />, { wrapper: Wrapper })

    expect(screen.queryByText('Two-factor card')).not.toBeInTheDocument()
    expect(screen.getByText(/kept by your company directory/)).toBeInTheDocument()
  })
})
