import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { unhandledRejectionsDuring } from '@/test/unhandled'
import { IoTRuleCreatePage } from '../IoTRuleCreatePage'
import { IoTRuleEditPage } from '../IoTRuleEditPage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))

// The five-step form is covered by its own tests; here it is a button that submits a rule.
vi.mock('@/components/iot/IoTRuleForm', () => ({
  IoTRuleForm: ({ onSubmit, defaultValues }: { onSubmit: (d: unknown) => Promise<void>; defaultValues?: { name?: string } }) => (
    <div>
      <span>{defaultValues?.name}</span>
      <button onClick={() => onSubmit({ name: 'Too hot', metric_name: 'temperature', operator: 'gt', threshold_value: 85, asset_id: 1 })}>
        Save rule
      </button>
    </div>
  ),
}))

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>
}

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/iot/rules/new" element={<IoTRuleCreatePage />} />
          <Route path="/iot/rules/:id/edit" element={<IoTRuleEditPage />} />
          <Route path="/iot/rules" element={<div>All rules</div>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('creating and editing a rule', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.success).mockClear()
  })

  it('creates the rule with the form\'s own field names and goes back to the list', async () => {
    const user = userEvent.setup()
    let body: { iot_rule: Record<string, unknown> } | undefined
    server.use(http.post('/api/v1/iot_rules', async ({ request }) => {
      body = (await request.json()) as typeof body
      return HttpResponse.json({ data: { id: 5 } }, { status: 201 })
    }))
    renderAt('/iot/rules/new')

    await user.click(screen.getByRole('button', { name: /save rule/i }))

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/iot/rules'))
    expect(body?.iot_rule).toMatchObject({ name: 'Too hot', threshold_value: 85, asset_id: 1 })
    expect(toast.success).toHaveBeenCalledWith('Rule created.')
  })

  it('stays on the form and says why when the server refuses the rule', async () => {
    const user = userEvent.setup()
    server.use(http.post('/api/v1/iot_rules', () =>
      HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Threshold is not a number' } }, { status: 422 })))
    renderAt('/iot/rules/new')

    const unhandled = await unhandledRejectionsDuring(() => user.click(screen.getByRole('button', { name: /save rule/i })))

    expect(unhandled).toEqual([])
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Threshold is not a number'))
    expect(screen.getByTestId('where')).toHaveTextContent('/iot/rules/new')
    expect(screen.getByRole('button', { name: /save rule/i })).toBeInTheDocument()
  })

  it('saves an edit and goes back to the list', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/v1/iot_rules/7', () => HttpResponse.json({ data: { id: 7, name: 'Pump too hot' } })),
      http.patch('/api/v1/iot_rules/7', () => HttpResponse.json({ data: { id: 7 } })),
    )
    renderAt('/iot/rules/7/edit')

    expect(await screen.findByText('Pump too hot')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /save rule/i }))

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/iot/rules'))
    expect(toast.success).toHaveBeenCalledWith('Rule updated.')
  })

  it('stays on the edit form and says why when the save is refused', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/v1/iot_rules/7', () => HttpResponse.json({ data: { id: 7, name: 'Pump too hot' } })),
      http.patch('/api/v1/iot_rules/7', () =>
        HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Assigned to must be an active person in your company' } }, { status: 422 })),
    )
    renderAt('/iot/rules/7/edit')
    const save = await screen.findByRole('button', { name: /save rule/i })

    const unhandled = await unhandledRejectionsDuring(() => user.click(save))

    expect(unhandled).toEqual([])
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Assigned to must be an active person in your company'))
    expect(screen.getByTestId('where')).toHaveTextContent('/iot/rules/7/edit')
  })
})
