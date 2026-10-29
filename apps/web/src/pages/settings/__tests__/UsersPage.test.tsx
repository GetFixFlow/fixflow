import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    two_factor_enabled: true,
    created_at: '2026-01-15T00:00:00Z',
    organization_id: 1,
  },
  {
    id: 3,
    full_name: 'Dan Former',
    email: 'dan@test.com',
    role: 'technician',
    active: false,
    locked: true,
    created_at: '2026-02-01T00:00:00Z',
    organization_id: 1,
  },
]

const actions = vi.hoisted(() => ({
  deactivate: vi.fn(),
  reactivate: vi.fn(),
  bulkDeactivate: vi.fn(),
  bulkRole: vi.fn(),
  resetPassword: vi.fn(),
  resetTwoFactor: vi.fn(),
  unlock: vi.fn(),
}))

vi.mock('@/hooks/useUsers', () => ({
  useUsers: () => ({ data: mockUsers, isLoading: false }),
  useInviteUser: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateUser: () => ({ mutate: vi.fn(), isPending: false }),
  useDeactivateUser: () => ({ mutate: actions.deactivate, isPending: false }),
  useReactivateUser: () => ({ mutate: actions.reactivate, isPending: false }),
  useBulkDeactivate: () => ({ mutate: actions.bulkDeactivate, isPending: false }),
  useBulkChangeRole: () => ({ mutate: actions.bulkRole, isPending: false }),
  useResetUserPassword: () => ({ mutate: actions.resetPassword, isPending: false }),
  useResetUserTwoFactor: () => ({ mutate: actions.resetTwoFactor, isPending: false }),
  useUnlockUser: () => ({ mutate: actions.unlock, isPending: false }),
  useResendInvitation: () => ({ mutate: vi.fn(), isPending: false }),
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

  describe('managing people', () => {
    beforeEach(() => {
      Object.values(actions).forEach((fn) => fn.mockClear())
    })

    function rowOf(name: string) {
      return screen.getByText(name).closest('tr') as HTMLElement
    }

    async function openMenu(name: string) {
      const buttons = within(rowOf(name)).getAllByRole('button')
      await userEvent.click(buttons[buttons.length - 1])
    }

    it('marks a deactivated person', () => {
      render(<UsersPage />, { wrapper: Wrapper })
      expect(within(rowOf('Dan Former')).getByText(/deactivated/i)).toBeInTheDocument()
    })

    it('offers Deactivate for someone else and calls the API for that person', async () => {
      render(<UsersPage />, { wrapper: Wrapper })
      await openMenu('Bob Jones')
      await userEvent.click(screen.getByText('Deactivate'))
      expect(actions.deactivate).toHaveBeenCalledWith(2)
    })

    it('does not offer admins a way to deactivate themselves', async () => {
      render(<UsersPage />, { wrapper: Wrapper })
      await openMenu('Alice Smith')
      expect(screen.queryByText('Deactivate')).not.toBeInTheDocument()
    })

    it('offers Reactivate for a deactivated person', async () => {
      render(<UsersPage />, { wrapper: Wrapper })
      await openMenu('Dan Former')
      await userEvent.click(screen.getByText('Reactivate'))
      expect(actions.reactivate).toHaveBeenCalledWith(3)
    })

    it('offers Reset Password for another active person and shows the link it creates', async () => {
      actions.resetPassword.mockImplementation((_id: number, options: { onSuccess: (r: unknown) => void }) =>
        options.onSuccess({ data: { reset_url: 'https://app.test/reset-password?token=abc', email_sent: false } }),
      )
      render(<UsersPage />, { wrapper: Wrapper })
      await openMenu('Bob Jones')
      await userEvent.click(screen.getByText('Reset Password'))

      expect(actions.resetPassword.mock.calls[0][0]).toBe(2)
      expect(await screen.findByLabelText('Reset link')).toHaveValue('https://app.test/reset-password?token=abc')
      expect(screen.getByText(/email is not set up on this server/i)).toBeInTheDocument()
    })

    it('marks who signs in with an authenticator app', () => {
      render(<UsersPage />, { wrapper: Wrapper })
      const bob = screen.getByText('Bob Jones').closest('tr') as HTMLElement
      expect(within(bob).getByText('2FA')).toBeInTheDocument()
      const dan = screen.getByText('Dan Former').closest('tr') as HTMLElement
      expect(within(dan).queryByText('2FA')).not.toBeInTheDocument()
    })

    it('marks a locked account and lets an administrator unlock it', async () => {
      render(<UsersPage />, { wrapper: Wrapper })
      const dan = screen.getByText('Dan Former').closest('tr') as HTMLElement
      expect(within(dan).getByText('Locked')).toBeInTheDocument()

      await openMenu('Dan Former')
      await userEvent.click(screen.getByText('Unlock account'))
      expect(actions.unlock).toHaveBeenCalledWith(3)
    })

    it('does not offer Unlock for an account that is not locked', async () => {
      render(<UsersPage />, { wrapper: Wrapper })
      await openMenu('Bob Jones')
      expect(screen.queryByText('Unlock account')).not.toBeInTheDocument()
      const bob = screen.getByText('Bob Jones').closest('tr') as HTMLElement
      expect(within(bob).queryByText('Locked')).not.toBeInTheDocument()
    })

    it('offers Reset two-factor for another person who has it on, after asking', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
      render(<UsersPage />, { wrapper: Wrapper })

      await openMenu('Bob Jones')
      await userEvent.click(screen.getByText('Reset two-factor'))
      expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Bob Jones'))
      expect(actions.resetTwoFactor).not.toHaveBeenCalled()

      await openMenu('Bob Jones')
      await userEvent.click(screen.getByText('Reset two-factor'))
      expect(actions.resetTwoFactor).toHaveBeenCalledWith(2)
      confirm.mockRestore()
    })

    it('does not offer Reset two-factor for yourself or for someone who does not have it on', async () => {
      render(<UsersPage />, { wrapper: Wrapper })
      await openMenu('Alice Smith')
      expect(screen.queryByText('Reset two-factor')).not.toBeInTheDocument()
      await openMenu('Dan Former')
      expect(screen.queryByText('Reset two-factor')).not.toBeInTheDocument()
    })

    it('does not offer Reset Password for yourself or for someone deactivated', async () => {
      render(<UsersPage />, { wrapper: Wrapper })
      await openMenu('Alice Smith')
      expect(screen.queryByText('Reset Password')).not.toBeInTheDocument()
    })

    it('does not offer Reset Password for a deactivated person', async () => {
      render(<UsersPage />, { wrapper: Wrapper })
      await openMenu('Dan Former')
      expect(screen.queryByText('Reset Password')).not.toBeInTheDocument()
    })

    it('deactivates the selected people with one request', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<UsersPage />, { wrapper: Wrapper })
      await userEvent.click(within(rowOf('Bob Jones')).getByRole('checkbox'))
      await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))

      expect(actions.bulkDeactivate).toHaveBeenCalledTimes(1)
      expect(actions.bulkDeactivate.mock.calls[0][0]).toEqual([2])
    })

    it('changes the role of the selected people with a role picker, not a typed prompt', async () => {
      render(<UsersPage />, { wrapper: Wrapper })
      await userEvent.click(within(rowOf('Bob Jones')).getByRole('checkbox'))
      expect(screen.getByRole('button', { name: 'Change Role' })).toBeDisabled()

      await userEvent.selectOptions(screen.getByLabelText('New role'), 'manager')
      await userEvent.click(screen.getByRole('button', { name: 'Change Role' }))

      expect(actions.bulkRole).toHaveBeenCalledTimes(1)
      expect(actions.bulkRole.mock.calls[0][0]).toEqual({ ids: [2], role: 'manager' })
    })
  })
})
