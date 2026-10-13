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
    created_at: '2026-01-15T00:00:00Z',
    organization_id: 1,
  },
  {
    id: 3,
    full_name: 'Dan Former',
    email: 'dan@test.com',
    role: 'technician',
    active: false,
    created_at: '2026-02-01T00:00:00Z',
    organization_id: 1,
  },
]

const actions = vi.hoisted(() => ({
  deactivate: vi.fn(),
  reactivate: vi.fn(),
  bulkDeactivate: vi.fn(),
  bulkRole: vi.fn(),
}))

vi.mock('@/hooks/useUsers', () => ({
  useUsers: () => ({ data: mockUsers, isLoading: false }),
  useInviteUser: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateUser: () => ({ mutate: vi.fn(), isPending: false }),
  useDeactivateUser: () => ({ mutate: actions.deactivate, isPending: false }),
  useReactivateUser: () => ({ mutate: actions.reactivate, isPending: false }),
  useBulkDeactivate: () => ({ mutate: actions.bulkDeactivate, isPending: false }),
  useBulkChangeRole: () => ({ mutate: actions.bulkRole, isPending: false }),
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

    it('no longer offers Reset Password, which has no backend yet', async () => {
      render(<UsersPage />, { wrapper: Wrapper })
      await openMenu('Bob Jones')
      expect(screen.queryByText(/reset password/i)).not.toBeInTheDocument()
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
