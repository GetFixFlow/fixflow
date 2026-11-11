import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Link, Route, Routes } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/cable', () => ({ cable: { subscriptions: { create: vi.fn(() => ({ unsubscribe: () => {} })) } } }))
import { AppLayout } from '../AppLayout'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types'
import { useState, useEffect } from 'react'

function Page({ title, late = false }: { title: string; late?: boolean }) {
  const [shown, setShown] = useState(!late)
  useEffect(() => { if (late) setTimeout(() => setShown(true), 30) }, [late])
  return <div>{shown && <h1>{title}</h1>}<Link to="/b">go to b</Link><Link to="/a">go to a</Link></div>
}

function renderApp() {
  server.use(http.get('/api/v1/localization_settings', () => HttpResponse.json({ localization: {} })), http.get('/api/v1/branding', () => HttpResponse.json({ branding: { name: 'FixFlow', primary_color: '#2563eb' } })))
  act(() => useAuthStore.setState({ user: { id: 1, email: 'a@b.test', full_name: 'Ana Ruiz', role: 'admin', organization_id: 1 } as User, token: 't', isAuthenticated: true }))
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/a']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/a" element={<Page title="Alpha" />} />
            <Route path="/b" element={<Page title="Beta" late />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('moving through the app by keyboard and screen reader', () => {
  it('has a skip link first, to the main content', async () => {
    renderApp()
    const skip = await screen.findByRole('link', { name: 'Skip to main content' })

    expect(skip).toHaveAttribute('href', '#main')
    expect(document.getElementById('main')).toBe(screen.getByRole('main'))
    expect(skip.compareDocumentPosition(screen.getByRole('navigation', { name: 'Main' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('names the browser tab after the page, and follows a heading that arrives late', async () => {
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Alpha' })).toBeInTheDocument()
    await act(async () => { await Promise.resolve() })
    expect(document.title).toBe('Alpha · FixFlow')

    await userEvent.click(screen.getByRole('link', { name: 'go to b' }))
    expect(await screen.findByRole('heading', { name: 'Beta' })).toBeInTheDocument()
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    expect(document.title).toBe('Beta · FixFlow')
  })

  it('says the new page aloud and puts the keyboard at the top of it after a navigation, but not on the first page', async () => {
    renderApp()
    await screen.findByRole('heading', { name: 'Alpha' })
    await act(async () => { await new Promise((r) => setTimeout(r, 40)) })
    expect(screen.getByRole('status', { name: '' }).textContent).toBe('')
    expect(document.activeElement).toBe(document.body) // the first page leaves the keyboard at the top, where the skip link is

    await userEvent.click(screen.getByRole('link', { name: 'go to b' }))
    await screen.findByRole('heading', { name: 'Beta' })
    await act(async () => { await new Promise((r) => setTimeout(r, 40)) })

    expect(screen.getAllByRole('status').some((node) => node.textContent === 'Beta')).toBe(true)
    expect(document.activeElement).toBe(screen.getByRole('main'))
  })
})
