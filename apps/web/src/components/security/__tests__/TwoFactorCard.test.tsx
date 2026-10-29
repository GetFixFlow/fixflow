import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { SecurityPage } from '@/pages/settings/SecurityPage'
import { TwoFactorCard } from '../TwoFactorCard'

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,QR')) } }))

const CODES = ['aaaaa-bbbbb', 'ccccc-ddddd']
let calls: { method: string; path: string; body?: unknown }[]
let state: { enabled: boolean; left: number; required: boolean }

/** A server that remembers: the status follows what was done. */
function serve({ confirmFails = false, disableFails = false } = {}) {
  const status = () => ({ two_factor: { enabled: state.enabled, enabled_at: state.enabled ? '2026-10-29T00:00:00Z' : null, recovery_codes_left: state.left, required_by_company: state.required } })
  server.use(
    http.get('/api/v1/profile/two_factor', () => HttpResponse.json(status())),
    http.post('/api/v1/profile/two_factor', () => {
      calls.push({ method: 'POST', path: 'start' })
      return HttpResponse.json({ ...status(), setup: { secret: 'JBSWY3DPEHPK3PXP', otpauth_uri: 'otpauth://totp/FixFlow:pat?secret=JBSWY3DPEHPK3PXP' } }, { status: 201 })
    }),
    http.post('/api/v1/profile/two_factor/confirm', async ({ request }) => {
      calls.push({ method: 'POST', path: 'confirm', body: await request.json() })
      if (confirmFails) return HttpResponse.json({ error: { message: 'That code is not right. Check the app and try again.', code: 'TWO_FACTOR_INVALID' } }, { status: 422 })
      state = { ...state, enabled: true, left: 10 }
      return HttpResponse.json({ ...status(), recovery_codes: CODES })
    }),
    http.delete('/api/v1/profile/two_factor', async ({ request }) => {
      calls.push({ method: 'DELETE', path: 'disable', body: await request.json() })
      if (disableFails) return HttpResponse.json({ error: { message: 'Your password is not right.', code: 'PASSWORD_INVALID' } }, { status: 422 })
      state = { ...state, enabled: false, left: 0 }
      return HttpResponse.json(status())
    }),
    http.post('/api/v1/profile/two_factor/recovery_codes', async ({ request }) => {
      calls.push({ method: 'POST', path: 'recovery_codes', body: await request.json() })
      return HttpResponse.json({ ...status(), recovery_codes: CODES })
    }),
    http.get('/api/v1/auth/me', () => HttpResponse.json({ id: 1, email: 'a@b.c', full_name: 'Ada', role: 'technician', organization_id: 1, two_factor_enabled: state.enabled })),
  )
}

function renderCard(ui = <TwoFactorCard />) {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role: 'technician', organization_id: 1 } as never, token: 't', isAuthenticated: true })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>)
}

beforeEach(() => {
  calls = []
  state = { enabled: false, left: 0, required: false }
})

describe('two-factor sign-in card', () => {
  it('says it is not on, and offers to set it up', async () => {
    serve()
    renderCard()
    expect(await screen.findByRole('status')).toHaveTextContent('Not on')
    expect(screen.getByRole('button', { name: 'Set up' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turn off' })).not.toBeInTheDocument()
  })

  it('sets up: shows the QR code and the key, takes the first code, then shows the recovery codes once', async () => {
    serve()
    let enabled = 0
    renderCard(<TwoFactorCard onEnabled={() => { enabled += 1 }} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Set up' }))

    expect(await screen.findByAltText('QR code for your authenticator app')).toHaveAttribute('src', 'data:image/png;base64,QR')
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()
    const turnOn = screen.getByRole('button', { name: 'Turn on' })
    expect(turnOn).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Code from the app'), '123 456')
    await userEvent.click(turnOn)

    const region = await screen.findByRole('region', { name: 'Recovery codes' })
    CODES.forEach((code) => expect(within(region).getByText(code)).toBeInTheDocument())
    expect(calls.find((c) => c.path === 'confirm')?.body).toEqual({ code: '123 456' })
    expect(enabled).toBe(0) // not until the codes are saved

    await userEvent.click(within(region).getByRole('button', { name: 'I have saved them' }))
    expect(enabled).toBe(1)
    expect(screen.queryByRole('region', { name: 'Recovery codes' })).not.toBeInTheDocument()
    expect(await screen.findByText(/On · 10 recovery codes left/)).toBeInTheDocument()
    await waitFor(() => expect(useAuthStore.getState().user?.two_factor_enabled).toBe(true))
  })

  it('says so when the first code is wrong, and stays on the set-up', async () => {
    serve({ confirmFails: true })
    renderCard()
    await userEvent.click(await screen.findByRole('button', { name: 'Set up' }))
    await userEvent.type(await screen.findByLabelText('Code from the app'), '000000')
    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That code is not right')
    expect(screen.getByLabelText('Code from the app')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Recovery codes' })).not.toBeInTheDocument()
  })

  it('cancels a set-up without changing anything', async () => {
    serve()
    renderCard()
    await userEvent.click(await screen.findByRole('button', { name: 'Set up' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(screen.queryByLabelText('Code from the app')).not.toBeInTheDocument()
    expect(calls.some((c) => c.path === 'confirm')).toBe(false)
  })

  describe('when it is on', () => {
    beforeEach(() => { state = { enabled: true, left: 3, required: false } })

    it('shows how many recovery codes are left', async () => {
      serve()
      renderCard()
      expect(await screen.findByRole('status')).toHaveTextContent('On · 3 recovery codes left')
      expect(screen.queryByRole('button', { name: 'Set up' })).not.toBeInTheDocument()
    })

    it('turns off only with the password and a code', async () => {
      serve()
      renderCard()
      await userEvent.click(await screen.findByRole('button', { name: 'Turn off' }))
      const confirm = screen.getByRole('button', { name: 'Confirm' })
      expect(confirm).toBeDisabled()

      await userEvent.type(screen.getByLabelText('Password'), 'password123')
      await userEvent.type(screen.getByLabelText('Code'), '654321')
      await userEvent.click(confirm)

      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Not on'))
      expect(calls.find((c) => c.path === 'disable')?.body).toEqual({ password: 'password123', code: '654321' })
    })

    it('keeps it on and says why when the password is wrong', async () => {
      serve({ disableFails: true })
      renderCard()
      await userEvent.click(await screen.findByRole('button', { name: 'Turn off' }))
      await userEvent.type(screen.getByLabelText('Password'), 'nope')
      await userEvent.type(screen.getByLabelText('Code'), '654321')
      await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Your password is not right.')
      expect(screen.getByRole('status')).toHaveTextContent('On')
    })

    it('makes new recovery codes with the password and a code, and shows them', async () => {
      serve()
      renderCard()
      await userEvent.click(await screen.findByRole('button', { name: 'New recovery codes' }))
      await userEvent.type(screen.getByLabelText('Password'), 'password123')
      await userEvent.type(screen.getByLabelText('Code'), '654321')
      await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

      const region = await screen.findByRole('region', { name: 'Recovery codes' })
      expect(within(region).getByText(CODES[0])).toBeInTheDocument()
    })
  })

  it('cannot be turned off when the company requires it', async () => {
    state = { enabled: true, left: 10, required: true }
    serve()
    renderCard()

    expect(await screen.findByText(/Your company requires it for everyone/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turn off' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New recovery codes' })).toBeInTheDocument()
  })

  it('is the Security page, with no invented login history or session timeout', async () => {
    serve()
    renderCard(<SecurityPage />)

    expect(await screen.findByText('Two-factor sign-in')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open My Profile/ })).toHaveAttribute('href', '/settings/profile')
    expect(screen.queryByText('Login History')).not.toBeInTheDocument()
    expect(screen.queryByText('Session Timeout')).not.toBeInTheDocument()
    expect(screen.queryByText(/Sri Lanka/)).not.toBeInTheDocument()
  })
})
