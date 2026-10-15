import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/api/client'
import { EditUserModal } from '../EditUserModal'
import type { Role, User } from '@/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const target = { id: 5, email: 't@acme.com', full_name: 'Tom Tech', first_name: 'Tom', last_name: 'Tech', role: 'technician', organization_id: 1, hourly_rate: 45 } as User

function signInAs(role: Role) {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role, organization_id: 1 } as never, token: 't', isAuthenticated: true })
}

function renderModal(user: User = target) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditUserModal open onClose={() => undefined} user={user} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  server.use(http.patch('/api/v1/users/5', () => HttpResponse.json({ user: target })))
})

describe('EditUserModal hourly rate', () => {
  it('lets an administrator see and change what an hour of the person costs', async () => {
    signInAs('admin')
    const patch = vi.spyOn(apiClient, 'patch')
    renderModal()

    const rate = screen.getByLabelText('Hourly rate')
    expect(rate).toHaveValue(45)
    await userEvent.clear(rate)
    await userEvent.type(rate, '52.5')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(patch).toHaveBeenCalled())
    expect(patch.mock.calls[0][1]).toMatchObject({ user: { hourly_rate: 52.5 } })
  })

  it('sends nothing for the rate (so the company default applies) when it is emptied', async () => {
    signInAs('admin')
    const patch = vi.spyOn(apiClient, 'patch')
    renderModal()

    await userEvent.clear(screen.getByLabelText('Hourly rate'))
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(patch).toHaveBeenCalled())
    expect(patch.mock.calls[0][1]).toMatchObject({ user: { hourly_rate: null } })
  })

  it('does not send a negative rate', async () => {
    signInAs('admin')
    const patch = vi.spyOn(apiClient, 'patch')
    renderModal()

    await userEvent.clear(screen.getByLabelText('Hourly rate'))
    await userEvent.type(screen.getByLabelText('Hourly rate'), '-5')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    // The field is a number input with a minimum of 0, so the browser stops the form before anything is sent.
    await new Promise((r) => setTimeout(r, 100))
    expect(patch).not.toHaveBeenCalled()
  })

  it('does not show a manager what people are paid, or let them set it', async () => {
    signInAs('manager')
    const patch = vi.spyOn(apiClient, 'patch')
    renderModal({ ...target, hourly_rate: undefined })

    expect(screen.queryByLabelText('Hourly rate')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(patch).toHaveBeenCalled())
    expect((patch.mock.calls[0][1] as { user: object }).user).not.toHaveProperty('hourly_rate')
  })
})
