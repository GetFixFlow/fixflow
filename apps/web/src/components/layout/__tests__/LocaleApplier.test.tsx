import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { DEFAULT_LOCALE, formatMoney, useLocaleStore } from '@/lib/localeFormat'
import { LocaleApplier } from '../LocaleApplier'

const mount = () => render(
  <QueryClientProvider client={new QueryClient()}>
    <LocaleApplier />
  </QueryClientProvider>,
)

beforeEach(() => {
  localStorage.clear()
  useLocaleStore.setState({ locale: DEFAULT_LOCALE })
})

describe('LocaleApplier', () => {
  it("hands the company's settings to the formatting code once signed in", async () => {
    useAuthStore.setState({ user: { id: 1, role: 'technician' } as never, token: 't', isAuthenticated: true })
    server.use(http.get('/api/v1/localization_settings', () => HttpResponse.json({ localization: { ...DEFAULT_LOCALE, currency: 'EUR', number_format: '1.234,56' } })))
    mount()

    await waitFor(() => expect(formatMoney(1234.5)).toBe('€1.234,50'))
  })

  it('does not ask for them before anyone is signed in', async () => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false })
    const asked = vi.fn()
    server.use(http.get('/api/v1/localization_settings', () => { asked(); return HttpResponse.json({ localization: DEFAULT_LOCALE }) }))
    mount()

    await new Promise((r) => setTimeout(r, 100))
    expect(asked).not.toHaveBeenCalled()
  })

  it('keeps what it knew if the settings cannot be loaded', async () => {
    useAuthStore.setState({ user: { id: 1, role: 'technician' } as never, token: 't', isAuthenticated: true })
    useLocaleStore.getState().setLocale({ currency: 'GBP' })
    server.use(http.get('/api/v1/localization_settings', () => HttpResponse.json({}, { status: 500 })))
    mount()

    await new Promise((r) => setTimeout(r, 100))
    expect(formatMoney(5)).toBe('£5.00')
  })
})
