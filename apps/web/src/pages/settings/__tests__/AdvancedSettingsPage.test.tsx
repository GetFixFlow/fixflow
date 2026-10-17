import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { AdvancedSettingsPage } from '../AdvancedSettingsPage'

function renderPage() {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role: 'admin', organization_id: 1 } as never, token: 't', isAuthenticated: true })
  return render(<MemoryRouter><AdvancedSettingsPage /></MemoryRouter>)
}

describe('AdvancedSettingsPage', () => {
  it('no longer shows made-up system information or an update check that always says you are up to date', () => {
    renderPage()
    for (const invented of [/Session 15/, /Rails Version/, /PostgreSQL Version/, /Redis Version/, /Node Version/, /Check for Updates/, /running the latest version/]) {
      expect(screen.queryByText(invented)).toBeNull()
    }
  })

  it('points to the real System Health page', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /Open System Health/ })).toHaveAttribute('href', '/settings/system-health')
  })
})
