import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { InviteUserModal } from '../InviteUserModal'
import { usersApi } from '@/api/users'

vi.mock('@/api/users', () => ({
  usersApi: { invite: vi.fn(), list: vi.fn() },
}))

const result = (emailSent: boolean) => ({
  data: {
    user: { id: 9, email: 'nina@acme.com', full_name: 'Nina Hire', role: 'technician', organization_id: 1, created_at: '' },
    invitation_url: 'https://app.example.com/accept-invite?token=tok123',
    email_sent: emailSent,
  },
})

function renderModal(onClose = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <InviteUserModal open onClose={onClose} />
    </QueryClientProvider>,
  )
  return onClose
}

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText(/first name/i), 'Nina')
  await userEvent.type(screen.getByLabelText(/last name/i), 'Hire')
  await userEvent.type(screen.getByLabelText(/^email \*/i), 'nina@acme.com')
  await userEvent.click(screen.getByRole('button', { name: /create invitation/i }))
}

describe('InviteUserModal', () => {
  beforeEach(() => {
    vi.mocked(usersApi.invite).mockReset()
  })

  it('sends first and last name separately', async () => {
    vi.mocked(usersApi.invite).mockResolvedValue(result(true) as never)
    renderModal()
    await fillAndSubmit()

    await waitFor(() => expect(usersApi.invite).toHaveBeenCalled())
    expect(vi.mocked(usersApi.invite).mock.calls[0][0]).toMatchObject({
      first_name: 'Nina',
      last_name: 'Hire',
      email: 'nina@acme.com',
      role: 'technician',
      send_welcome: true,
    })
  })

  it('shows the link and says it was emailed when email is set up', async () => {
    vi.mocked(usersApi.invite).mockResolvedValue(result(true) as never)
    renderModal()
    await fillAndSubmit()

    expect(await screen.findByText(/we emailed nina@acme.com/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Invitation link')).toHaveValue('https://app.example.com/accept-invite?token=tok123')
  })

  it('tells the admin to send the link by hand when email is not set up', async () => {
    vi.mocked(usersApi.invite).mockResolvedValue(result(false) as never)
    renderModal()
    await fillAndSubmit()

    expect(await screen.findByText(/email is not set up on this server/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Invitation link')).toBeInTheDocument()
  })

  it('requires both names', async () => {
    renderModal()
    await userEvent.type(screen.getByLabelText(/^email \*/i), 'nina@acme.com')
    await userEvent.click(screen.getByRole('button', { name: /create invitation/i }))

    expect(await screen.findByText(/first name required/i)).toBeInTheDocument()
    expect(screen.getByText(/last name required/i)).toBeInTheDocument()
    expect(usersApi.invite).not.toHaveBeenCalled()
  })

  it('closes from the result screen with Done', async () => {
    vi.mocked(usersApi.invite).mockResolvedValue(result(true) as never)
    const onClose = renderModal()
    await fillAndSubmit()

    await userEvent.click(await screen.findByRole('button', { name: /^done$/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
