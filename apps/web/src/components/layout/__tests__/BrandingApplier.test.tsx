import { describe, it, expect, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { BrandingApplier } from '../BrandingApplier'

const branding = (extra: object = {}) => ({
  name: 'Acme', logo_url: null, favicon_url: null, primary_color: '#2563eb',
  login_headline: 'Sign in', login_subtitle: '', ...extra,
})

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('style')
  document.head.innerHTML = '<link rel="icon" href="/favicon.ico">'
})

const mount = () => render(
  <QueryClientProvider client={new QueryClient()}>
    <BrandingApplier />
  </QueryClientProvider>,
)

describe('BrandingApplier', () => {
  it("puts the company's colour on the whole app", async () => {
    server.use(http.get('/api/v1/branding', () => HttpResponse.json({ branding: branding({ primary_color: '#16a34a' }) })))
    mount()

    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--brand-600')).toBe('22 163 74'))
  })

  it("uses the company's favicon, keeping the original to go back to", async () => {
    server.use(http.get('/api/v1/branding', () => HttpResponse.json({ branding: branding({ favicon_url: '/api/v1/storage/blobs/redirect/x/icon.png' }) })))
    mount()

    const link = document.querySelector('link[rel~="icon"]')!
    await waitFor(() => expect(link.getAttribute('href')).toBe('/api/v1/storage/blobs/redirect/x/icon.png'))
    expect(link.getAttribute('data-original')).toBe('/favicon.ico')
  })

  it('changes nothing for the default branding', async () => {
    mount()

    await waitFor(() => expect(document.querySelector('link[rel~="icon"]')!.getAttribute('href')).toBe('/favicon.ico'))
    expect(document.documentElement.style.getPropertyValue('--brand-600')).toBe('')
  })

  it('leaves the app as it is when the branding cannot be loaded', async () => {
    server.use(http.get('/api/v1/branding', () => HttpResponse.json({}, { status: 500 })))
    mount()

    await new Promise((r) => setTimeout(r, 100))
    expect(document.documentElement.style.getPropertyValue('--brand-600')).toBe('')
  })
})
