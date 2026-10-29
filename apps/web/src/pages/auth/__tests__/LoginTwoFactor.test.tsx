import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { LoginPage } from '../LoginPage'

const person = { id: 7, email: 'pat@acme.test', full_name: 'Pat Doe', role: 'technician', organization_id: 1 }
let secondStep: { challenge: string; code: string }[]

function serve({ afterCode = HttpResponse.json({ message: 'ok', user: { ...person, two_factor_enabled: true } }, { headers: { Authorization: 'Bearer tok123' } }) as Response } = {}) {
  server.use(
    http.get('/api/v1/setup/status', () => HttpResponse.json({ setup_required: false })),
    http.post('/api/v1/auth/sign_in', async ({ request }) => {
      const body = (await request.json()) as { user: { email: string; password: string } }
      return body.user.password === 'password123'
        ? HttpResponse.json({ two_factor_required: true, challenge: 'signed-challenge', message: 'Enter the code' })
        : HttpResponse.json({ error: 'Invalid Email or password.' }, { status: 401 })
    }),
    http.post('/api/v1/auth/two_factor', async ({ request }) => {
      secondStep.push((await request.json()) as { challenge: string; code: string })
      return afterCode.clone()
    }),
  )
}

function renderLogin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<p>Dashboard here</p>} />
          <Route path="/two-factor-setup" element={<p>Set up screen</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function enterPassword() {
  await userEvent.type(await screen.findByLabelText('Email'), 'pat@acme.test')
  await userEvent.type(screen.getByLabelText('Password'), 'password123')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

beforeEach(() => {
  secondStep = []
  useAuthStore.getState().clearAuth()
})

describe('signing in with two-factor sign-in on', () => {
  it('asks for the code after the password, and signs in with it', async () => {
    serve()
    renderLogin()
    await enterPassword()

    expect(await screen.findByLabelText('Code')).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)

    await userEvent.type(screen.getByLabelText('Code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }))

    expect(await screen.findByText('Dashboard here')).toBeInTheDocument()
    expect(secondStep).toEqual([{ challenge: 'signed-challenge', code: '123456' }])
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, token: 'tok123' })
  })

  it('takes a recovery code in the same box', async () => {
    serve()
    renderLogin()
    await enterPassword()
    await userEvent.type(await screen.findByLabelText('Code'), 'k3x9d-7qm2w')
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }))

    await screen.findByText('Dashboard here')
    expect(secondStep[0].code).toBe('k3x9d-7qm2w')
  })

  it('keeps the code form after a wrong code, and offers a way back to the password', async () => {
    serve({ afterCode: HttpResponse.json({ error: 'That code is not right.' }, { status: 401 }) as Response })
    renderLogin()
    await enterPassword()
    await userEvent.type(await screen.findByLabelText('Code'), '000000')
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() => expect(secondStep).toHaveLength(1))
    expect(screen.getByLabelText('Code')).toBeInTheDocument()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)

    await userEvent.click(screen.getByRole('button', { name: 'Start again' }))
    expect(await screen.findByLabelText('Password')).toBeInTheDocument()
  })

  it('does not enable Verify until a code is long enough', async () => {
    serve()
    renderLogin()
    await enterPassword()
    const verify = await screen.findByRole('button', { name: 'Verify' })
    expect(verify).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Code'), '12345')
    expect(verify).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Code'), '6')
    expect(verify).toBeEnabled()
  })

  it('sends a person whose company requires two-factor, and who has not set it up, to the set-up screen', async () => {
    serve({ afterCode: HttpResponse.json({ message: 'ok', user: { ...person, two_factor_setup_required: true } }, { headers: { Authorization: 'Bearer t' } }) as Response })
    renderLogin()
    await enterPassword()
    await userEvent.type(await screen.findByLabelText('Code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }))

    expect(await screen.findByText('Set up screen')).toBeInTheDocument()
  })

  it('still signs in with the password alone for a person who does not use it', async () => {
    server.use(
      http.get('/api/v1/setup/status', () => HttpResponse.json({ setup_required: false })),
      http.post('/api/v1/auth/sign_in', () =>
        HttpResponse.json({ message: 'ok', user: person }, { headers: { Authorization: 'Bearer plain' } })),
    )
    renderLogin()
    await enterPassword()

    expect(await screen.findByText('Dashboard here')).toBeInTheDocument()
    expect(useAuthStore.getState().token).toBe('plain')
  })
})
