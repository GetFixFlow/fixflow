import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { DEFAULT_LOCALE, useLocaleStore } from '@/lib/localeFormat'
import { setLanguage } from '@/i18n'
import { LocalizationPage } from '../LocalizationPage'
import { ProfilePage } from '../ProfilePage'
import { SettingsLayout } from '../SettingsLayout'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const profile = { id: 1, email: 'a@b.c', full_name: 'Ada Admin', role: 'admin', organization_id: 1, organization_name: 'Acme', created_at: '2026-01-01T00:00:00Z', locale: null, language: 'en' }

const mount = (ui: React.ReactNode) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{ui}</MemoryRouter>
  </QueryClientProvider>,
)

beforeEach(() => {
  localStorage.clear()
  useLocaleStore.setState({ locale: DEFAULT_LOCALE })
  useAuthStore.setState({ user: profile as never, token: 't', isAuthenticated: true })
  server.use(
    http.get('/api/v1/profile', () => HttpResponse.json({ user: profile })),
    http.get('/api/v1/localization_settings', () => HttpResponse.json({ localization: { ...DEFAULT_LOCALE, language: 'es' } })),
    http.get('/api/v1/sessions', () => HttpResponse.json({ sessions: [] })),
  )
})

describe('the settings screens in Spanish', () => {
  it('words the settings menu in Spanish', () => {
    setLanguage('es', false)
    mount(<SettingsLayout />)

    expect(screen.getByRole('link', { name: 'Mi perfil' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Seguridad' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Idioma y región' })).toBeInTheDocument()
  })

  it('lets a person choose their own language, or the company\'s, on the profile', async () => {
    setLanguage('es', false)
    let sent: { user?: { locale?: string } } = {}
    server.use(http.patch('/api/v1/profile', async ({ request }) => {
      sent = (await request.json()) as typeof sent
      return HttpResponse.json({ user: { ...profile, locale: 'es', language: 'es' } })
    }))
    mount(<ProfilePage />)

    const language = await screen.findByLabelText('Idioma')
    expect(language).toHaveValue('')
    expect(await screen.findByRole('option', { name: 'Usar el idioma de la empresa (Español)' })).toBeInTheDocument()

    await userEvent.selectOptions(language, 'es')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(sent.user?.locale).toBe('es'))
    await waitFor(() => expect(useAuthStore.getState().user?.language).toBe('es'))
  })

  it("sets the company's language on the localization screen, and previews dates with Spanish month names", async () => {
    setLanguage('es', false)
    useLocaleStore.setState({ locale: { ...DEFAULT_LOCALE, date_format: 'DD MMM YYYY' } })
    server.use(http.get('/api/v1/localization_settings', () => HttpResponse.json({ localization: { ...DEFAULT_LOCALE, date_format: 'DD MMM YYYY', language: 'es' } })))
    mount(<LocalizationPage />)

    expect(await screen.findByLabelText('Idioma')).toHaveValue('es')
    expect(screen.getByRole('heading', { name: 'Vista previa' })).toBeInTheDocument()
    expect(screen.getByTestId('preview-date').textContent).toMatch(/^\d{2} (ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic) \d{4}$/)
  })
})
