import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { DEFAULT_LOCALE, useLocaleStore } from '@/lib/localeFormat'
import { LocalizationPage } from '../LocalizationPage'
import type { Role } from '@/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const saved = { ...DEFAULT_LOCALE }

function signInAs(role: Role) {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role, organization_id: 1 } as never, token: 't', isAuthenticated: true })
}
const serve = (settings: object = saved) => server.use(http.get('/api/v1/localization_settings', () => HttpResponse.json({ localization: settings })))

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LocalizationPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useLocaleStore.setState({ locale: DEFAULT_LOCALE })
  signInAs('admin')
})

describe('LocalizationPage', () => {
  it('shows what is saved, including a time zone that is not in the usual list', async () => {
    serve({ ...saved, currency: 'LKR', date_format: 'DD/MM/YYYY', timezone: 'Asia/Karachi' })
    renderPage()

    expect(await screen.findByLabelText('Currency')).toHaveValue('LKR')
    expect(screen.getByLabelText('Date format')).toHaveValue('DD/MM/YYYY')
    expect(screen.getByLabelText('Time zone')).toHaveValue('Asia/Karachi')
  })

  it('previews with the settings in the form, before anything is saved', async () => {
    serve()
    renderPage()
    await screen.findByLabelText('Currency')
    expect(screen.getByTestId('preview-money')).toHaveTextContent('$1,234.50')

    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'EUR')
    await userEvent.selectOptions(screen.getByLabelText('Number format'), '1.234,56')
    await userEvent.selectOptions(screen.getByLabelText('Time format'), '24h')

    expect(screen.getByTestId('preview-money')).toHaveTextContent('€1.234,50')
    expect(screen.getByTestId('preview-number')).toHaveTextContent('1.234.567')
    expect(screen.getByTestId('preview-datetime').textContent).toMatch(/\d{2}:\d{2}$/)
    expect(useLocaleStore.getState().locale.currency).toBe('USD') // the app itself is unchanged until saved
  })

  it('has nothing to save until something changes', async () => {
    serve()
    renderPage()

    const button = await screen.findByRole('button', { name: 'Save localization' })
    expect(button).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('First day of the week'), 'monday')
    expect(button).toBeEnabled()
  })

  it('saves, and the whole app starts using the new settings', async () => {
    serve()
    let body: { localization: Record<string, unknown> } | undefined
    server.use(http.patch('/api/v1/localization_settings', async ({ request }) => {
      body = (await request.json()) as typeof body
      return HttpResponse.json({ localization: { ...saved, ...body!.localization } })
    }))
    renderPage()

    await userEvent.selectOptions(await screen.findByLabelText('Currency'), 'GBP')
    await userEvent.selectOptions(screen.getByLabelText('Date format'), 'DD/MM/YYYY')
    await userEvent.click(screen.getByRole('button', { name: 'Save localization' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Localization saved.'))
    expect(body?.localization).toMatchObject({ currency: 'GBP', date_format: 'DD/MM/YYYY' })
    expect(useLocaleStore.getState().locale).toMatchObject({ currency: 'GBP', date_format: 'DD/MM/YYYY' })
  })

  it("shows the server's reason when it refuses", async () => {
    serve()
    server.use(http.patch('/api/v1/localization_settings', () => HttpResponse.json({ error: { message: 'Timezone is not a valid time zone' } }, { status: 422 })))
    renderPage()

    await userEvent.selectOptions(await screen.findByLabelText('Currency'), 'EUR')
    await userEvent.click(screen.getByRole('button', { name: 'Save localization' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Timezone is not a valid time zone'))
    expect(useLocaleStore.getState().locale.currency).toBe('USD')
  })

  it('no longer offers a language, as there are no translations yet', async () => {
    serve()
    renderPage()

    await screen.findByLabelText('Currency')
    expect(screen.queryByLabelText(/language/i)).not.toBeInTheDocument()
  })

  it('says so when it could not load, instead of showing defaults as if they were saved', async () => {
    server.use(http.get('/api/v1/localization_settings', () => HttpResponse.json({}, { status: 500 })))
    renderPage()

    expect(await screen.findByText('The localization settings could not be loaded.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Currency')).not.toBeInTheDocument()
  })

  it('is for administrators only', async () => {
    signInAs('technician')
    serve()
    renderPage()

    expect(await screen.findByText(/only administrators/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Currency')).not.toBeInTheDocument()
  })
})
