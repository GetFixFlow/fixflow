import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { ProtectedRoute } from '../ProtectedRoute'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<p>Dashboard here</p>} />
          <Route path="/two-factor-setup" element={<p>Set up screen</p>} />
        </Route>
        <Route path="/login" element={<p>Login here</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const person = { id: 1, email: 'a@b.c', full_name: 'Ada', role: 'technician', organization_id: 1 }

beforeEach(() => useAuthStore.getState().clearAuth())

describe('ProtectedRoute and two-factor sign-in', () => {
  it('sends a person whose company requires it, and who has not set it up, to the set-up screen from any page', () => {
    useAuthStore.setState({ user: { ...person, two_factor_setup_required: true } as never, token: 't', isAuthenticated: true })
    renderAt('/dashboard')
    expect(screen.getByText('Set up screen')).toBeInTheDocument()
  })

  it('lets them stay on the set-up screen', () => {
    useAuthStore.setState({ user: { ...person, two_factor_setup_required: true } as never, token: 't', isAuthenticated: true })
    renderAt('/two-factor-setup')
    expect(screen.getByText('Set up screen')).toBeInTheDocument()
  })

  it('leaves everyone else alone', () => {
    useAuthStore.setState({ user: { ...person, two_factor_setup_required: false } as never, token: 't', isAuthenticated: true })
    renderAt('/dashboard')
    expect(screen.getByText('Dashboard here')).toBeInTheDocument()
  })

  it('still sends a signed-out person to the login page', () => {
    renderAt('/dashboard')
    expect(screen.getByText('Login here')).toBeInTheDocument()
  })
})
