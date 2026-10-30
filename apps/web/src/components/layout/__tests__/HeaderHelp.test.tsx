import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Header } from '../Header'
import { useAuthStore } from '@/stores/authStore'

describe('the help link in the header menu', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Tech Nician', role: 'technician', organization_id: 1, created_at: '' }, token: 't', isAuthenticated: true })
  })

  it('opens the guides in a new tab, for any role', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><Header /></MemoryRouter>
      </QueryClientProvider>,
    )

    await userEvent.setup().click(screen.getByRole('button', { name: /TN/ }))

    const link = screen.getByRole('menuitem', { name: 'Help and guides' })
    expect(link).toHaveAttribute('href', 'https://getfixflow.github.io/fixflow/latest/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })
})
