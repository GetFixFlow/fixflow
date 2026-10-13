import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/api/client'
import { BrandingPage } from '../BrandingPage'
import type { Role } from '@/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const saved = { name: 'Acme', logo_url: null, favicon_url: null, primary_color: '#2563eb', login_headline: 'Sign in to FixFlow', login_subtitle: 'Enter your credentials to continue' }

function signInAs(role: Role) {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role, organization_id: 1 } as never, token: 't', isAuthenticated: true })
}
const serve = (branding: object = saved) => server.use(http.get('/api/v1/branding', () => HttpResponse.json({ branding })))

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BrandingPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  signInAs('admin')
  document.documentElement.removeAttribute('style')
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

describe('BrandingPage', () => {
  it('shows what is saved', async () => {
    serve({ ...saved, primary_color: '#16a34a', login_headline: 'Acme Maintenance', logo_url: '/api/v1/storage/x/logo.png' })
    renderPage()

    expect(await screen.findByLabelText('Colour')).toHaveValue('#16a34a')
    expect(screen.getByLabelText('Headline')).toHaveValue('Acme Maintenance')
    expect(screen.getAllByAltText('Logo')[0]).toHaveAttribute('src', '/api/v1/storage/x/logo.png')
  })

  it('shows the colour on the app as it is picked, and puts it back when you leave without saving', async () => {
    serve()
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Forest Green' }))

    expect(document.documentElement.style.getPropertyValue('--brand-600')).not.toBe('')
    expect(screen.getByLabelText('Colour')).toHaveValue('#15803d')
  })

  it('warns about, and will not save, a colour too light for white text', async () => {
    serve()
    renderPage()
    const colour = await screen.findByLabelText('Colour')

    await userEvent.clear(colour)
    await userEvent.type(colour, '#ffeb3b')

    expect(screen.getByRole('alert')).toHaveTextContent('too light')
    expect(screen.getByRole('button', { name: 'Save branding' })).toBeDisabled()
  })

  it('will not save something that is not a colour', async () => {
    serve()
    renderPage()
    const colour = await screen.findByLabelText('Colour')

    await userEvent.clear(colour)
    await userEvent.type(colour, 'blue')

    expect(screen.getByRole('alert')).toHaveTextContent('like #2563eb')
    expect(screen.getByRole('button', { name: 'Save branding' })).toBeDisabled()
  })

  it('needs a headline', async () => {
    serve()
    renderPage()

    await userEvent.clear(await screen.findByLabelText('Headline'))

    expect(screen.getByRole('button', { name: 'Save branding' })).toBeDisabled()
  })

  it('saves the colour and the sign-in text', async () => {
    serve()
    server.use(http.patch('/api/v1/branding', () => HttpResponse.json({ branding: saved })))
    const patch = vi.spyOn(apiClient, 'patch')
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Purple' }))
    await userEvent.clear(screen.getByLabelText('Headline'))
    await userEvent.type(screen.getByLabelText('Headline'), 'Acme Maintenance')
    await userEvent.click(screen.getByRole('button', { name: 'Save branding' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Branding saved.'))
    const form = patch.mock.calls[0][1] as FormData
    expect(form.get('branding[primary_color]')).toBe('#7c3aed')
    expect(form.get('branding[login_headline]')).toBe('Acme Maintenance')
    expect(form.has('branding[logo]')).toBe(false)
  })

  it('sends a chosen logo, and previews it first', async () => {
    serve()
    server.use(http.patch('/api/v1/branding', () => HttpResponse.json({ branding: saved })))
    const patch = vi.spyOn(apiClient, 'patch')
    renderPage()
    await screen.findByLabelText('Colour')

    await userEvent.upload(screen.getByLabelText('Logo file'), new File([new Uint8Array(10)], 'logo.png', { type: 'image/png' }))
    expect(screen.getAllByAltText('Logo')[0]).toHaveAttribute('src', 'blob:preview')
    await userEvent.click(screen.getByRole('button', { name: 'Save branding' }))

    await waitFor(() => expect(patch).toHaveBeenCalled())
    expect((patch.mock.calls[0][1] as FormData).get('branding[logo]')).toBeInstanceOf(File)
  })

  it('refuses an image of the wrong kind or size before sending it', async () => {
    serve()
    renderPage()
    await screen.findByLabelText('Colour')

    await userEvent.upload(screen.getByLabelText('Logo file'), new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }), { applyAccept: false })
    expect(screen.getByRole('alert')).toHaveTextContent('The logo must be a PNG, JPEG or WebP image.')

    await userEvent.upload(screen.getByLabelText('Logo file'), new File([new Uint8Array(3 * 1024 * 1024)], 'big.png', { type: 'image/png' }))
    expect(screen.getByRole('alert')).toHaveTextContent('2 MB or smaller')
  })

  it('removes a saved logo', async () => {
    serve({ ...saved, logo_url: '/api/v1/storage/x/logo.png' })
    server.use(http.patch('/api/v1/branding', () => HttpResponse.json({ branding: saved })))
    const patch = vi.spyOn(apiClient, 'patch')
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /remove/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Save branding' }))

    await waitFor(() => expect(patch).toHaveBeenCalled())
    expect((patch.mock.calls[0][1] as FormData).get('branding[remove_logo]')).toBe('true')
  })

  it("shows the server's reason when it refuses", async () => {
    serve()
    server.use(http.patch('/api/v1/branding', () => HttpResponse.json({ error: { message: 'The logo must be 2048 KB or smaller.' } }, { status: 422 })))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Purple' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save branding' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The logo must be 2048 KB or smaller.'))
  })

  it('says so when it could not load, instead of showing an empty form', async () => {
    server.use(http.get('/api/v1/branding', () => HttpResponse.json({}, { status: 500 })))
    renderPage()

    expect(await screen.findByText('The branding settings could not be loaded.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Colour')).not.toBeInTheDocument()
  })

  it('is for administrators only', async () => {
    signInAs('manager')
    serve()
    renderPage()

    expect(await screen.findByText(/only administrators/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Colour')).not.toBeInTheDocument()
  })
})
