import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { setLanguage } from '@/i18n'
import type { WorkOrderDraft } from '@/api/ai'
import { DraftFromWords } from '../DraftFromWords'

const pump = { id: 7, name: 'Coolant pump', asset_tag: 'P-003', location_path: 'Line 3' }
const fan = { id: 8, name: 'Extractor fan', asset_tag: null, location_path: null }
const draft = (over: Partial<WorkOrderDraft> = {}): WorkOrderDraft => ({
  title: 'Coolant pump leaking oil', description: 'Leaking on line 3.', priority: 'high', asset: pump, asset_candidates: [pump, fan], ...over,
})

function renderIt(props: Partial<React.ComponentProps<typeof DraftFromWords>> = {}) {
  const onDraft = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DraftFromWords onDraft={onDraft} {...props} />
    </QueryClientProvider>,
  )
  return onDraft
}

const config = (over: Record<string, unknown>) =>
  http.get('/api/v1/ai/config', () =>
    HttpResponse.json({ success: true, data: { enabled: true, model: 'm', provider: 'anthropic', source: 'app', features: { priority: true, anomalies: true, limits: true, parts: true, draft: true }, ...over }, meta: {} }),
  )

/** The server's side: records what was sent and answers. */
function serve(answer: WorkOrderDraft | 'error') {
  const asked: Record<string, unknown>[] = []
  server.use(http.post('/api/v1/ai/work_order_draft', async ({ request }) => {
    asked.push((await request.json()) as Record<string, unknown>)
    if (answer === 'error') return HttpResponse.json({ error: { message: 'Anthropic did not accept the key.', code: 'AI_FAILED' } }, { status: 422 })
    return HttpResponse.json({ data: answer })
  }))
  return asked
}

const words = () => screen.findByLabelText('What is wrong?')
const make = () => screen.getByRole('button', { name: 'Make a draft' })

beforeEach(async () => {
  await setLanguage('en', false)
})

describe('DraftFromWords', () => {
  it('has a box for the words, how to dictate them, and where they go, and a button held back until there are enough', async () => {
    renderIt()

    const box = await words()
    expect(make()).toBeDisabled()
    expect(screen.getByText(/Tap the microphone on your keyboard to say it instead of typing/)).toBeInTheDocument()
    expect(screen.getByText(/are sent to Anthropic. Nothing is saved until you create the work order/)).toBeInTheDocument()
    await userEvent.type(box, 'pump')
    expect(make()).toBeDisabled()
    await userEvent.type(box, ' is leaking')
    expect(make()).toBeEnabled()
  })

  it('says your own model when that is what is chosen', async () => {
    server.use(config({ provider: 'local' }))
    renderIt()

    expect(await screen.findByText(/are sent to your own model/)).toBeInTheDocument()
  })

  it('sends the words, and fills the form in with what comes back, the asset included', async () => {
    const asked = serve(draft())
    const onDraft = renderIt()
    await userEvent.type(await words(), 'pump on line 3 is leaking oil')

    await userEvent.click(make())

    expect(await screen.findByText(/The draft is filled in below/)).toBeInTheDocument()
    expect(asked).toEqual([{ text: 'pump on line 3 is leaking oil' }])
    expect(onDraft).toHaveBeenCalledWith({ nonce: 1, title: 'Coolant pump leaking oil', description: 'Leaking on line 3.', priority: 'high', asset_id: 7 })
    expect(screen.queryByText('Which asset is it?')).not.toBeInTheDocument()
  })

  it('offers the matching assets to choose from when none was chosen, and applies the draft again with the one picked', async () => {
    serve(draft({ asset: null, priority: null }))
    const onDraft = renderIt()
    await userEvent.type(await words(), 'something is leaking')
    await userEvent.click(make())

    expect(await screen.findByText('Which asset is it?')).toBeInTheDocument()
    expect(onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ nonce: 1, asset_id: null, priority: null }))
    await userEvent.click(screen.getByRole('button', { name: 'Coolant pump (Line 3)' }))

    expect(onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ nonce: 2, asset_id: 7, title: 'Coolant pump leaking oil' }))
    expect(screen.queryByText('Which asset is it?')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('The draft is filled in below')
  })

  it('offers no asset when the work order is already for one', async () => {
    serve(draft({ asset: null }))
    renderIt({ assetLocked: true })
    await userEvent.type(await words(), 'something is leaking')
    await userEvent.click(make())

    expect(await screen.findByText(/The draft is filled in below/)).toBeInTheDocument()
    expect(screen.queryByText('Which asset is it?')).not.toBeInTheDocument()
  })

  it("shows the provider's own words when it fails, and fills nothing in", async () => {
    serve('error')
    const onDraft = renderIt()
    await userEvent.type(await words(), 'pump on line 3 is leaking oil')

    await userEvent.click(make())

    expect(await screen.findByRole('alert')).toHaveTextContent('Anthropic did not accept the key.')
    expect(onDraft).not.toHaveBeenCalled()
  })

  it('shows nothing, and asks for nothing, when it is switched off or AI is off', async () => {
    server.use(config({ features: { priority: true, anomalies: true, limits: true, parts: true, draft: false } }))
    renderIt()
    await new Promise((resolve) => setTimeout(resolve, 150))

    expect(screen.queryByText('Describe the problem in your own words')).not.toBeInTheDocument()
  })

  it('is not shown while it is still being found out whether it is switched on', async () => {
    renderIt()

    expect(screen.queryByText('Describe the problem in your own words')).not.toBeInTheDocument()
    expect(await screen.findByText('Describe the problem in your own words')).toBeInTheDocument()
  })

  it('reads in Spanish', async () => {
    await setLanguage('es', false)
    renderIt()

    expect(await screen.findByLabelText('¿Qué falla?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hacer un borrador' })).toBeInTheDocument()
    expect(screen.getByText(/Toque el micrófono del teclado/)).toBeInTheDocument()
  })
})
