import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { WorkOrderForm } from '../WorkOrderForm'

function renderForm(props: Partial<React.ComponentProps<typeof WorkOrderForm>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><WorkOrderForm onSubmit={onSubmit} lockedAssetId={7} {...props} /></MemoryRouter>
    </QueryClientProvider>,
  )
  return onSubmit
}

const config = (over: Record<string, unknown>) =>
  http.get('/api/v1/ai/config', () =>
    HttpResponse.json({ success: true, data: { enabled: true, model: 'm', provider: 'anthropic', source: 'app', features: { priority: true, anomalies: true }, ...over }, meta: {} }),
  )

/** The server's side: records what was asked and answers. */
function serveSuggestion(answer: { priority: string; reason: string } | 'error') {
  const asked: Record<string, unknown>[] = []
  server.use(
    http.post('/api/v1/ai/priority', async ({ request }) => {
      asked.push((await request.json()) as Record<string, unknown>)
      if (answer === 'error') return HttpResponse.json({ error: { message: 'Anthropic did not accept the key.', code: 'AI_FAILED' } }, { status: 422 })
      return HttpResponse.json({ data: answer })
    }),
  )
  return asked
}

const suggestButton = () => screen.findByRole('button', { name: 'Suggest a priority' })
const type = (text: string) => userEvent.type(screen.getByPlaceholderText(/describe the issue/i), text)

describe('WorkOrderForm: suggest a priority', () => {
  it('offers it on a new work order, once there is a title to go on, and says where the text goes', async () => {
    renderForm()

    const button = await suggestButton()
    expect(button).toBeDisabled()
    expect(screen.getByText(/sent to Anthropic. You choose the priority/)).toBeInTheDocument()
    await type('Pump is leaking oil')
    expect(button).toBeEnabled()
  })

  it('names your own model when that is what is chosen', async () => {
    server.use(config({ provider: 'local' }))
    renderForm()

    expect(await screen.findByText(/sent to your own model/)).toBeInTheDocument()
  })

  it('is not there when an administrator switched it off, when AI is off, or when editing', async () => {
    server.use(config({ features: { priority: false, anomalies: true } }))
    const { unmount } = render(<div />)
    unmount()
    renderForm()
    await screen.findByRole('button', { name: 'Create Work Order' })
    expect(screen.queryByRole('button', { name: 'Suggest a priority' })).not.toBeInTheDocument()
  })

  it('is not there while AI is off', async () => {
    server.use(config({ enabled: false, provider: 'none', features: { priority: false, anomalies: false } }))
    renderForm()

    await screen.findByRole('button', { name: 'Create Work Order' })
    expect(screen.queryByRole('button', { name: 'Suggest a priority' })).not.toBeInTheDocument()
  })

  it('is not there when editing a work order, even though AI is on', async () => {
    let asked = false
    server.use(http.get('/api/v1/ai/config', () => {
      asked = true
      return HttpResponse.json({ success: true, data: { enabled: true, model: 'm', provider: 'anthropic', source: 'app', features: { priority: true, anomalies: true } }, meta: {} })
    }))
    renderForm({ mode: 'edit', defaultValues: { title: 'Pump is leaking' } })

    await screen.findByRole('button', { name: /Save/ })
    await waitFor(() => expect(asked).toBe(true))
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(screen.queryByRole('button', { name: 'Suggest a priority' })).not.toBeInTheDocument()
  })

  it('sends what was typed and the asset, shows the suggestion with its reason, and changes nothing until the person says so', async () => {
    const asked = serveSuggestion({ priority: 'high', reason: 'Oil is leaking from a running pump.' })
    renderForm()
    await type('Pump is leaking oil')

    await userEvent.click(await suggestButton())

    expect(await screen.findByText('Suggested priority: High')).toBeInTheDocument()
    expect(screen.getByText('Oil is leaking from a running pump.')).toBeInTheDocument()
    expect(asked).toEqual([{ title: 'Pump is leaking oil', asset_id: 7 }])
    expect(screen.getByRole('button', { name: /Medium/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('takes the suggestion when asked to, and then the box goes away', async () => {
    serveSuggestion({ priority: 'high', reason: 'Oil.' })
    const onSubmit = renderForm()
    await type('Pump is leaking oil')
    await userEvent.click(await suggestButton())

    await userEvent.click(await screen.findByRole('button', { name: 'Use High' }))

    expect(screen.getByRole('button', { name: /High/, pressed: true })).toBeInTheDocument()
    expect(screen.queryByText('Suggested priority: High')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create Work Order' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].priority).toBe('high')
  })

  it('says so, with no button to press, when it matches what is already chosen', async () => {
    serveSuggestion({ priority: 'medium', reason: 'Can wait.' })
    renderForm()
    await type('Light is dim')
    await userEvent.click(await suggestButton())

    expect(await screen.findByText('That is the priority you chose.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Use / })).not.toBeInTheDocument()
  })

  it("shows the provider's own words when it fails, and the form still works", async () => {
    serveSuggestion('error')
    const onSubmit = renderForm()
    await type('Pump is leaking oil')

    await userEvent.click(await suggestButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Anthropic did not accept the key.')
    await userEvent.click(screen.getByRole('button', { name: 'Create Work Order' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
  })
})
