import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { LoginPage } from '../LoginPage'
import { ForgotPasswordPage } from '../ForgotPasswordPage'
import { authApi } from '@/api'
import i18n, { setLanguage } from '@/i18n'

vi.mock('@/api', () => ({
  authApi: { setupStatus: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn(), login: vi.fn(), register: vi.fn() },
}))
vi.mock('@/lib/queryClient', async () => ({
  queryClient: new (await import('@tanstack/react-query')).QueryClient(),
}))

const mount = (page: React.ReactNode) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{page}</MemoryRouter>
  </QueryClientProvider>,
)

beforeEach(() => {
  vi.mocked(authApi.setupStatus).mockResolvedValue({ setup_required: false, email_configured: true })
  localStorage.clear()
})

describe('the sign-in pages in Spanish', () => {
  it('reads the sign-in page in Spanish, errors included', async () => {
    setLanguage('es', false)
    mount(<LoginPage />)

    expect(await screen.findByRole('heading', { name: 'Inicia sesión en FixFlow' })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('Se requiere un correo electrónico válido')).toBeInTheDocument()
    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument()
  })

  it('lets a visitor choose the language before signing in, and remembers it on this device', async () => {
    mount(<LoginPage />)
    expect(await screen.findByRole('heading', { name: 'Sign in to FixFlow' })).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Language'), 'es')

    expect(await screen.findByRole('heading', { name: 'Inicia sesión en FixFlow' })).toBeInTheDocument()
    expect(localStorage.getItem('fixflow-language')).toBe('es')
    expect(i18n.language).toBe('es')
    expect(document.documentElement.lang).toBe('es')
  })

  it('has the language picker on the forgotten-password page too', async () => {
    setLanguage('es', false)
    mount(<ForgotPasswordPage />)

    expect(await screen.findByRole('heading', { name: '¿Olvidaste tu contraseña?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar enlace de restablecimiento' })).toBeInTheDocument()
    expect(screen.getByLabelText('Idioma')).toHaveValue('es')
  })
})
