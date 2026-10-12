import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { SetupPage } from '../SetupPage'
import { authApi } from '@/api'

vi.mock('@/api', () => ({
  authApi: { setupStatus: vi.fn(), register: vi.fn(), login: vi.fn() },
}))

vi.mock('@/lib/queryClient', async () => {
  const { QueryClient } = await import('@tanstack/react-query')
  return { queryClient: new QueryClient() }
})

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/setup']}>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<div>login screen</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function fillForm(overrides: Partial<Record<string, string>> = {}) {
  const values = {
    'Company name': 'Acme Corp',
    'First name': 'Jane',
    'Last name': 'Smith',
    'Work email': 'jane@acme.com',
    Password: 'securepass1',
    'Confirm password': 'securepass1',
    ...overrides,
  }
  for (const [label, value] of Object.entries(values)) {
    await userEvent.type(screen.getByLabelText(label), value as string)
  }
}

describe('SetupPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.setupStatus).mockResolvedValue({ setup_required: true })
    vi.mocked(authApi.register).mockReset()
  })

  it('shows the setup form on a new install', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: /set up fixflow/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Company name')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument()
  })

  it('sends people to login once setup is complete', async () => {
    vi.mocked(authApi.setupStatus).mockResolvedValue({ setup_required: false })
    renderPage()
    expect(await screen.findByText('login screen')).toBeInTheDocument()
  })

  it('rejects mismatched passwords without calling the API', async () => {
    renderPage()
    await screen.findByLabelText('Company name')
    await fillForm({ 'Confirm password': 'different123' })
    await userEvent.click(screen.getByRole('button', { name: /finish setup/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    expect(authApi.register).not.toHaveBeenCalled()
  })

  it('submits first and last name separately and goes to login', async () => {
    vi.mocked(authApi.register).mockResolvedValue({} as never)
    renderPage()
    await screen.findByLabelText('Company name')
    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /finish setup/i }))

    await waitFor(() => expect(authApi.register).toHaveBeenCalled())
    expect(vi.mocked(authApi.register).mock.calls[0][0]).toEqual({
      organization_name: 'Acme Corp',
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@acme.com',
      password: 'securepass1',
      password_confirmation: 'securepass1',
    })
    expect(await screen.findByText('login screen')).toBeInTheDocument()
  })
})
