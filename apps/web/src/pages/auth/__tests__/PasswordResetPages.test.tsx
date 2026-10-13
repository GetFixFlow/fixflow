import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ForgotPasswordPage } from '../ForgotPasswordPage'
import { ResetPasswordPage } from '../ResetPasswordPage'
import { authApi } from '@/api'

vi.mock('@/api', () => ({
  authApi: { setupStatus: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn(), login: vi.fn(), register: vi.fn() },
}))
vi.mock('@/lib/queryClient', async () => ({
  queryClient: new (await import('@tanstack/react-query')).QueryClient(),
}))

function renderAt(url: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<div>login screen</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.setupStatus).mockResolvedValue({ setup_required: false, email_configured: true })
    vi.mocked(authApi.forgotPassword).mockReset()
  })

  it('asks for the email and shows the server answer without saying whether the account exists', async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue({ message: 'If that email belongs to an account, a link is on its way.' })
    renderAt('/forgot-password')

    await userEvent.type(await screen.findByLabelText('Email'), 'tess@acme.com')
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByRole('status')).toHaveTextContent('a link is on its way')
    expect(authApi.forgotPassword).toHaveBeenCalledWith('tess@acme.com')
  })

  it('needs an email address', async () => {
    renderAt('/forgot-password')
    await userEvent.click(await screen.findByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText(/enter your email address/i)).toBeInTheDocument()
    expect(authApi.forgotPassword).not.toHaveBeenCalled()
  })

  it('tells people to ask an administrator when the server cannot send email', async () => {
    vi.mocked(authApi.setupStatus).mockResolvedValue({ setup_required: false, email_configured: false })
    renderAt('/forgot-password')

    expect(await screen.findByText(/cannot send email/i)).toBeInTheDocument()
    expect(screen.getByText(/ask your administrator/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /send reset link/i })).not.toBeInTheDocument()
  })
})

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.resetPassword).mockReset()
  })

  it('explains a link with no code and offers a new one', () => {
    renderAt('/reset-password')
    expect(screen.getByText(/missing its reset code/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ask for a new one/i })).toBeInTheDocument()
  })

  it('rejects mismatched passwords without calling the API', async () => {
    renderAt('/reset-password?token=abc')
    await userEvent.type(screen.getByLabelText('New password'), 'a-new-password-1')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'different-pass-1')
    await userEvent.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    expect(authApi.resetPassword).not.toHaveBeenCalled()
  })

  it('sends the code from the link with the new password, then goes to sign in', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValue({ message: 'ok' })
    renderAt('/reset-password?token=abc123')
    await userEvent.type(screen.getByLabelText('New password'), 'a-new-password-1')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'a-new-password-1')
    await userEvent.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() =>
      expect(authApi.resetPassword).toHaveBeenCalledWith({
        reset_password_token: 'abc123', password: 'a-new-password-1', password_confirmation: 'a-new-password-1',
      }),
    )
    expect(await screen.findByText('login screen')).toBeInTheDocument()
  })
})
