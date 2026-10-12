import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { AcceptInvitePage } from '../AcceptInvitePage'
import { authApi } from '@/api'

vi.mock('@/api', () => ({
  authApi: { invitation: vi.fn(), acceptInvitation: vi.fn(), setupStatus: vi.fn() },
}))

function renderAt(url: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/login" element={<div>login screen</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const details = {
  email: 'nina@acme.com',
  first_name: 'Nina',
  last_name: 'Hire',
  role: 'technician' as const,
  organization_name: 'Acme Corp',
}

describe('AcceptInvitePage', () => {
  beforeEach(() => {
    vi.mocked(authApi.invitation).mockReset()
    vi.mocked(authApi.acceptInvitation).mockReset()
  })

  it('greets the invited person with the company, role and email', async () => {
    vi.mocked(authApi.invitation).mockResolvedValue(details)
    renderAt('/accept-invite?token=abc')

    expect(await screen.findByRole('heading', { name: /join acme corp/i })).toBeInTheDocument()
    expect(screen.getByText(/hi nina/i)).toHaveTextContent(/technician/)
    expect(screen.getByLabelText('Email')).toHaveValue('nina@acme.com')
    expect(authApi.invitation).toHaveBeenCalledWith('abc')
  })

  it('explains an invalid or used link', async () => {
    vi.mocked(authApi.invitation).mockRejectedValue({ response: { status: 404 } })
    renderAt('/accept-invite?token=bad')

    expect(await screen.findByText(/this invitation can't be used/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to sign in/i })).toBeInTheDocument()
  })

  it('explains a missing token without calling the API', async () => {
    renderAt('/accept-invite')

    expect(await screen.findByText(/this invitation can't be used/i)).toBeInTheDocument()
    expect(authApi.invitation).not.toHaveBeenCalled()
  })

  it('rejects mismatched passwords without calling the API', async () => {
    vi.mocked(authApi.invitation).mockResolvedValue(details)
    renderAt('/accept-invite?token=abc')
    await screen.findByLabelText('Password')

    await userEvent.type(screen.getByLabelText('Password'), 'newpassword1')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'different1')
    await userEvent.click(screen.getByRole('button', { name: /set password/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    expect(authApi.acceptInvitation).not.toHaveBeenCalled()
  })

  it('sets the password with the token and goes to sign in', async () => {
    vi.mocked(authApi.invitation).mockResolvedValue(details)
    vi.mocked(authApi.acceptInvitation).mockResolvedValue({} as never)
    renderAt('/accept-invite?token=abc')
    await screen.findByLabelText('Password')

    await userEvent.type(screen.getByLabelText('Password'), 'newpassword1')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'newpassword1')
    await userEvent.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() =>
      expect(authApi.acceptInvitation).toHaveBeenCalledWith('abc', {
        password: 'newpassword1',
        password_confirmation: 'newpassword1',
      }),
    )
    expect(await screen.findByText('login screen')).toBeInTheDocument()
  })
})
