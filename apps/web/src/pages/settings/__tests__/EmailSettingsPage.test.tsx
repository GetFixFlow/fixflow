import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { EmailSettingsPage } from '../EmailSettingsPage'
import type { Role } from '@/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const empty = { host: '', port: 587, username: '', encryption: 'tls', from_name: '', from_address: '', password_set: false, configured: false, source: null, environment_host: null }
const saved = { ...empty, host: 'smtp.acme.com', port: 465, username: 'mail@acme.com', encryption: 'ssl', from_name: 'Acme', from_address: 'mail@acme.com', password_set: true, configured: true, source: 'settings' }

function signInAs(role: Role) {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role, organization_id: 1 } as never, token: 't', isAuthenticated: true })
}

const serve = (status: object) => server.use(http.get('/api/v1/email_settings', () => HttpResponse.json({ smtp: status })))

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <EmailSettingsPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  signInAs('admin')
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('EmailSettingsPage', () => {
  it('shows the settings that are saved, so they can be changed', async () => {
    serve(saved)
    renderPage()

    expect(await screen.findByDisplayValue('smtp.acme.com')).toBeInTheDocument()
    expect(screen.getByLabelText('Port')).toHaveValue(465)
    expect(screen.getByLabelText('Encryption')).toHaveValue('ssl')
    expect(screen.getByLabelText('Sender address')).toHaveValue('mail@acme.com')
    expect(screen.getByText(/sending through smtp.acme.com/i)).toBeInTheDocument()
  })

  it('never shows the password, only that one is saved', async () => {
    serve(saved)
    renderPage()

    const password = await screen.findByLabelText('Password')
    expect(password).toHaveValue('')
    expect(password).toHaveAttribute('placeholder', expect.stringContaining('Saved'))
  })

  it('says when email is set up on the server instead, and that saving here takes over', async () => {
    serve({ ...empty, configured: true, source: 'environment', environment_host: 'smtp.sendgrid.net' })
    renderPage()

    expect(await screen.findByText(/set up on the server \(smtp.sendgrid.net\)/i)).toBeInTheDocument()
    expect(screen.getByText(/would take over/i)).toBeInTheDocument()
  })

  it('says when nothing is set up, and what happens meanwhile', async () => {
    serve(empty)
    renderPage()

    expect(await screen.findByText('Email is not set up')).toBeInTheDocument()
    expect(screen.getByText(/link to copy/i)).toBeInTheDocument()
  })

  it('fills in common settings for a provider, with the thing people trip over', async () => {
    serve(empty)
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Gmail' }))

    expect(screen.getByLabelText('Server address')).toHaveValue('smtp.gmail.com')
    expect(screen.getByLabelText('Port')).toHaveValue(587)
    expect(screen.getByText(/app password/i)).toBeInTheDocument()
  })

  it('will not save or test until there is a server and a sender', async () => {
    serve(empty)
    renderPage()

    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /test email/i })).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Server address'), 'smtp.acme.com')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled() // still no sender
    await userEvent.type(screen.getByLabelText('Sender address'), 'mail@acme.com')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('saves what was typed, including the password', async () => {
    serve(empty)
    let body: { smtp: Record<string, unknown> } | undefined
    server.use(http.patch('/api/v1/email_settings', async ({ request }) => {
      body = (await request.json()) as typeof body
      return HttpResponse.json({ smtp: saved })
    }))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Microsoft 365' }))
    await userEvent.type(screen.getByLabelText('Username'), 'mail@acme.com')
    await userEvent.type(screen.getByLabelText('Password'), 's3cret')
    await userEvent.type(screen.getByLabelText('Sender address'), 'mail@acme.com')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Email settings saved.'))
    expect(body?.smtp).toMatchObject({ host: 'smtp.office365.com', port: 587, encryption: 'tls', username: 'mail@acme.com', password: 's3cret', from_address: 'mail@acme.com' })
  })

  it('sends a test through what is in the form, and says it worked', async () => {
    serve(saved)
    let body: { smtp: Record<string, unknown> } | undefined
    server.use(http.post('/api/v1/email_settings/test', async ({ request }) => {
      body = (await request.json()) as typeof body
      return HttpResponse.json({ success: true, message: 'Test email sent to ada@acme.com. Check the inbox (and spam).' })
    }))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /test email/i }))

    expect(await screen.findByRole('status')).toHaveTextContent('Test email sent to ada@acme.com')
    expect(body?.smtp).toMatchObject({ host: 'smtp.acme.com', port: 465, password: '' })
  })

  it('shows why a test failed, in the page, until the form changes', async () => {
    serve(saved)
    server.use(http.post('/api/v1/email_settings/test', () =>
      HttpResponse.json({ success: false, error: { code: 'EMAIL_TEST_FAILED', message: 'The mail server at smtp.acme.com:465 refused the username or password.' } }, { status: 422 })))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /test email/i }))

    expect(await screen.findByRole('status')).toHaveTextContent('refused the username or password')

    await userEvent.type(screen.getByLabelText('Password'), 'x')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('removes the saved settings, to go back to the server\'s', async () => {
    serve(saved)
    const removed = vi.fn()
    server.use(http.delete('/api/v1/email_settings', () => { removed(); return HttpResponse.json({ smtp: empty }) }))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Remove saved settings' }))

    await waitFor(() => expect(removed).toHaveBeenCalled())
  })

  it('does not offer to remove anything when nothing is saved here', async () => {
    serve({ ...empty, configured: true, source: 'environment', environment_host: 'smtp.env.com' })
    renderPage()

    await screen.findByText(/set up on the server/i)
    expect(screen.queryByRole('button', { name: 'Remove saved settings' })).not.toBeInTheDocument()
  })

  it('says so when the settings could not be loaded, instead of showing an empty form', async () => {
    server.use(http.get('/api/v1/email_settings', () => HttpResponse.json({}, { status: 500 })))
    renderPage()

    expect(await screen.findByText('The email settings could not be loaded.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Server address')).not.toBeInTheDocument()
  })

  it('is for administrators only', async () => {
    signInAs('manager')
    serve(saved)
    renderPage()

    expect(await screen.findByText(/only administrators/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Server address')).not.toBeInTheDocument()
  })
})
