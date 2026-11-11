import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { EditUserModal } from '../EditUserModal'
import { InviteUserModal } from '../InviteUserModal'
import type { User } from '@/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const target = { id: 5, email: 't@acme.com', full_name: 'Tom Tech', first_name: 'Tom', last_name: 'Tech', role: 'technician', organization_id: 1 } as User

const client = () => new QueryClient({ defaultOptions: { mutations: { retry: false } } })

describe('EditUserModal: what a screen reader announces for each control', () => {
  it('names every field, the read-only email included, and the close button', () => {
    useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role: 'admin', organization_id: 1 } as never, token: 't', isAuthenticated: true })
    render(<QueryClientProvider client={client()}><EditUserModal open onClose={() => undefined} user={target} /></QueryClientProvider>)

    expect(screen.getByLabelText('Full Name *')).toHaveValue('Tom Tech')
    expect(screen.getByLabelText('Email *')).toBeDisabled()
    expect(screen.getByLabelText('Phone')).toHaveAttribute('type', 'tel')
    expect(screen.getByLabelText('Job Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Role')).toHaveValue('technician')
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})

describe('InviteUserModal: what a screen reader announces for each control', () => {
  it('names the roles as a group of radio buttons, each with its own name, and says which one is chosen', async () => {
    render(<QueryClientProvider client={client()}><InviteUserModal open onClose={() => undefined} /></QueryClientProvider>)

    const roles = screen.getByRole('radiogroup', { name: 'Role *' })
    const radios = within(roles).getAllByRole('radio')
    expect(radios.length).toBeGreaterThanOrEqual(3)
    expect(radios.filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1)

    const other = radios.find((r) => !(r as HTMLInputElement).checked)!
    await userEvent.click(other)
    expect(other).toBeChecked()
    expect(radios.filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1)
  })

  it('names the personal message box', () => {
    render(<QueryClientProvider client={client()}><InviteUserModal open onClose={() => undefined} /></QueryClientProvider>)

    expect(screen.getByLabelText('Personal Message (optional)')).toBeInTheDocument()
  })
})
