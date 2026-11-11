import { StrictMode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { directoryApi } from '@/api/directory'
import { setLanguage } from '@/i18n'
import { LoginPage } from '../LoginPage'
import { DirectoryCallbackPage } from '../DirectoryCallbackPage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const person = { id: 7, email: 'sam@acme.test', full_name: 'Sam Rivera', role: 'technician', organization_id: 1, identity_provider: 'oidc' }

function offer(options: { oidc?: { enabled: boolean; label: string }; ldap?: { enabled: boolean } }) {
  server.use(
    http.get('/api/v1/setup/status', () => HttpResponse.json({ setup_required: false })),
    http.get('/api/v1/auth/directory', () =>
      HttpResponse.json({ oidc: options.oidc ?? { enabled: false, label: 'Company account' }, ldap: options.ldap ?? { enabled: false } })),
  )
}

function mount(path: string, strict = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const tree = (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/directory" element={<DirectoryCallbackPage />} />
          <Route path="/dashboard" element={<p>Dashboard here</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree)
}

beforeEach(() => {
  setLanguage('en', false)
  vi.mocked(toast.error).mockClear()
  useAuthStore.getState().clearAuth()
  window.history.replaceState({}, '', '/')
})

describe('the sign-in screen with the company account on', () => {
  it('offers a button named for the company account, that goes to the start of the sign-in', async () => {
    offer({ oidc: { enabled: true, label: 'Acme SSO' } })
    mount('/login')

    const link = await screen.findByRole('link', { name: 'Sign in with Acme SSO' })
    expect(link).toHaveAttribute('href', directoryApi.startUrl())
    expect(directoryApi.startUrl()).toMatch(/\/auth\/oidc\/start$/)
    expect(screen.getByLabelText('Email')).toBeInTheDocument() // the password form stays
    expect(screen.getByText('or')).toBeInTheDocument()
  })

  it('offers no button when it is off', async () => {
    offer({})
    mount('/login')

    await screen.findByLabelText('Email')
    expect(screen.queryByRole('link', { name: /Sign in with/ })).not.toBeInTheDocument()
  })

  it('still shows the password form when the company cannot be asked what it offers', async () => {
    server.use(
      http.get('/api/v1/setup/status', () => HttpResponse.json({ setup_required: false })),
      http.get('/api/v1/auth/directory', () => HttpResponse.json({ error: 'down' }, { status: 500 })),
    )
    mount('/login')

    expect(await screen.findByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })
})

describe('the sign-in screen with LDAP on', () => {
  it('asks for an email or username, and sends a plain username with a short password as typed', async () => {
    const sent: { user: { email: string; password: string } }[] = []
    offer({ ldap: { enabled: true } })
    server.use(
      http.post('/api/v1/auth/sign_in', async ({ request }) => {
        sent.push((await request.json()) as { user: { email: string; password: string } })
        return HttpResponse.json({ message: 'ok', user: { ...person, identity_provider: 'ldap' } }, { headers: { Authorization: 'Bearer ldap-token' } })
      }),
    )
    mount('/login')

    const field = await screen.findByLabelText('Email or username')
    expect(field).toHaveAttribute('type', 'text')
    expect(field).toHaveAttribute('autocomplete', 'username')
    await userEvent.type(field, 'jo')
    await userEvent.type(screen.getByLabelText('Password'), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Dashboard here')).toBeInTheDocument()
    expect(sent).toEqual([{ user: { email: 'jo', password: 'short' } }])
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, token: 'ldap-token' })
  })

  it('still wants something typed in both fields', async () => {
    offer({ ldap: { enabled: true } })
    mount('/login')

    await screen.findByLabelText('Email or username')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter your email or username')).toBeInTheDocument()
    expect(screen.getByText('Enter your password')).toBeInTheDocument()
  })

  it('keeps asking for an email and a long enough password when LDAP is off', async () => {
    offer({})
    mount('/login')

    await userEvent.type(await screen.findByLabelText('Email'), 'jo@x')
    await userEvent.type(screen.getByLabelText('Password'), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Valid email required')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
  })

  it('shows the words the server gives when the directory turns the person away', async () => {
    offer({ ldap: { enabled: true } })
    server.use(
      http.post('/api/v1/auth/sign_in', () =>
        HttpResponse.json({ error: 'Your account is not in a group that may use FixFlow. Ask your administrator.', code: 'DIRECTORY_NOT_ALLOWED' }, { status: 403 })),
    )
    mount('/login')

    await userEvent.type(await screen.findByLabelText('Email or username'), 'jo')
    await userEvent.type(screen.getByLabelText('Password'), 'pw')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/not in a group that may use FixFlow/)))
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})

describe('coming back from the company account with a problem', () => {
  const words: Record<string, RegExp> = {
    not_set_up: /not set up/,
    unreachable: /could not be reached/,
    denied: /cancelled or refused/,
    failed: /did not work/,
    not_allowed: /not in a group/,
    no_account: /do not have an account/,
    deactivated: /deactivated/,
    email_not_verified: /could not be linked/,
    account_conflict: /signs in another way/,
  }

  it.each(Object.entries(words))('says what %s means, as an alert', async (code, pattern) => {
    offer({ oidc: { enabled: true, label: 'Acme SSO' } })
    mount(`/login?directory_error=${code}`)

    expect(await screen.findByRole('alert')).toHaveTextContent(pattern)
  })

  it('says the general thing for a code it does not know, never the code itself', async () => {
    offer({})
    mount('/login?directory_error=something_new')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/did not work/)
    expect(alert).not.toHaveTextContent('something_new')
  })

  it('shows no alert when nothing went wrong', async () => {
    offer({})
    mount('/login')

    await screen.findByLabelText('Email')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('the page the company account sends the browser back to', () => {
  function serveExchange(status = 200) {
    const notes: string[] = []
    server.use(
      http.post('/api/v1/auth/directory', async ({ request }) => {
        notes.push(((await request.json()) as { code: string }).code)
        return status === 200
          ? HttpResponse.json({ message: 'ok', user: person }, { headers: { Authorization: 'Bearer oidc-token' } })
          : HttpResponse.json({ error: 'Sign in again: this step has expired.', code: 'DIRECTORY_CODE_INVALID' }, { status })
      }),
    )
    return notes
  }

  it('swaps the note for a session and goes on to the dashboard', async () => {
    const notes = serveExchange()
    mount('/login/directory?code=note-1')

    expect(await screen.findByText('Dashboard here')).toBeInTheDocument()
    expect(notes).toEqual(['note-1'])
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, token: 'oidc-token' })
    expect(useAuthStore.getState().user).toMatchObject({ email: 'sam@acme.test', identity_provider: 'oidc' })
  })

  it('sends the one-use note once, even when React runs the page twice', async () => {
    const notes = serveExchange()
    mount('/login/directory?code=note-1', true)

    await screen.findByText('Dashboard here')
    expect(notes).toEqual(['note-1'])
  })

  it('takes the note out of the address bar so it is not left in the history', async () => {
    serveExchange()
    window.history.replaceState({}, '', '/login/directory?code=note-1')
    mount('/login/directory?code=note-1')

    await screen.findByText('Dashboard here')
    expect(window.location.search).toBe('')
  })

  it('says so, with a way back, when the note does not work', async () => {
    const notes = serveExchange(401)
    mount('/login/directory?code=old-note')

    expect(await screen.findByRole('alert')).toHaveTextContent(/expired or was already used/)
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login?directory_error=failed')
    expect(notes).toEqual(['old-note'])
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('sends nothing and goes to the sign-in screen when there is no note', async () => {
    const notes = serveExchange()
    offer({})
    mount('/login/directory')

    expect(await screen.findByLabelText('Email')).toBeInTheDocument()
    await waitFor(() => expect(notes).toEqual([]))
  })
})

describe('in Spanish', () => {
  it('reads the button, the field and the alert in Spanish', async () => {
    offer({ oidc: { enabled: true, label: 'Acme SSO' }, ldap: { enabled: true } })
    setLanguage('es', false)
    mount('/login?directory_error=not_allowed')

    expect(await screen.findByRole('link', { name: 'Iniciar sesión con Acme SSO' })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico o nombre de usuario')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Tu cuenta no está en un grupo que pueda usar FixFlow')
  })
})
