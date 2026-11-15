import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { setLanguage } from '@/i18n'
import { useAuthStore } from '@/stores/authStore'
import { AI_CONFIG_KEY } from '@/hooks/useAI'
import { AISettingsPage } from '../AISettingsPage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const providers = (over: Record<string, unknown> = {}) => ({
  anthropic: { default_model: 'claude-sonnet-5-5', key_set: false },
  openai_compatible: { key_set: false },
  local: { key_set: false },
  ...over,
})

const off = (over: Record<string, unknown> = {}) => ({
  provider: 'none', enabled: false, source: null, where: null, environment_configured: false, providers: providers(),
  features: { priority: true, anomalies: true, limits: true, parts: true }, ...over,
})

const local = (over: Record<string, unknown> = {}) =>
  off({
    provider: 'local', enabled: true, source: 'app', where: 'model.lan',
    providers: providers({ local: { base_url: 'http://model.lan:11434/v1', model: 'llama3', key_set: false } }), ...over,
  })

function renderPage(role = 'admin') {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role, organization_id: 1 } as never, token: 't', isAuthenticated: true })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AISettingsPage />
    </QueryClientProvider>,
  )
}

type Sent = { saved?: Record<string, string>; tested?: Record<string, string>; removed?: boolean }

/** The server's side: what it has saved now, and a record of what the page sent. */
function serve(current: object, overrides: { save?: () => Response; test?: () => Response } = {}) {
  const sent: Sent = {}
  server.use(
    http.get('/api/v1/ai_settings', () => HttpResponse.json({ ai: current })),
    http.patch('/api/v1/ai_settings', async ({ request }) => {
      if (overrides.save) return overrides.save()
      sent.saved = ((await request.json()) as { ai: Record<string, string> }).ai
      return HttpResponse.json({ ai: current })
    }),
    http.delete('/api/v1/ai_settings', () => {
      sent.removed = true
      return HttpResponse.json({ ai: off() })
    }),
    http.post('/api/v1/ai_settings/test', async ({ request }) => {
      if (overrides.test) return overrides.test()
      sent.tested = ((await request.json()) as { ai: Record<string, string> }).ai
      return HttpResponse.json({ success: true, message: 'Connected. model.lan answered in 0.4 s.', reply: 'ready' })
    }),
  )
  return sent
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(async () => {
  await setLanguage('en', false)
})

describe('AISettingsPage', () => {
  it('is for administrators only', async () => {
    renderPage('manager')

    expect(await screen.findByText(/Only administrators can manage AI settings/)).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('says AI is off and offers the four choices, with Off picked, when nothing is set up', async () => {
    serve(off())
    renderPage()

    expect(await screen.findByText('AI is off')).toBeInTheDocument()
    expect(screen.getByText(/Nothing is sent to any AI provider/)).toBeInTheDocument()
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['none', 'anthropic', 'openai_compatible', 'local'])
    expect(screen.getByRole('radio', { name: /^Off/ })).toBeChecked()
    expect(screen.queryByLabelText('Model')).not.toBeInTheDocument() // no fields until a provider is picked
    expect(screen.getByText('Nothing is sent anywhere.')).toBeInTheDocument()
  })

  it('shows what is saved, and where the data goes, for a local model', async () => {
    serve(local())
    renderPage()

    expect(await screen.findByText('AI is on: Local model')).toBeInTheDocument()
    expect(screen.getByText('Sending to model.lan, model llama3.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^Local model/ })).toBeChecked()
    expect(screen.getByLabelText('Address')).toHaveValue('http://model.lan:11434/v1')
    expect(screen.getByLabelText('Model')).toHaveValue('llama3')
    expect(screen.getByLabelText('Key (if it asks for one)')).toHaveValue('')
    expect(screen.getByText(/sent only to model\.lan, which FixFlow has checked is on this server or a private network/)).toBeInTheDocument()
  })

  it("asks for each provider's own fields", async () => {
    const user = userEvent.setup()
    serve(off())
    renderPage()
    await screen.findByText('AI is off')

    await user.click(screen.getByRole('radio', { name: /^Anthropic/ }))
    expect(screen.getByLabelText('Model')).toHaveAttribute('placeholder', 'claude-sonnet-5-5')
    expect(screen.getByText('Leave blank to use claude-sonnet-5-5.')).toBeInTheDocument()
    expect(screen.getByLabelText('Key')).toHaveAttribute('type', 'password')
    expect(screen.queryByLabelText('Address')).not.toBeInTheDocument()
    expect(screen.getByText(/sent to Anthropic's service \(api\.anthropic\.com\)/)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /^OpenAI-compatible/ }))
    expect(screen.getByLabelText('Address')).toHaveAttribute('placeholder', 'https://api.openai.com/v1')
    expect(screen.getByText(/It must start with https:\/\//)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /^Local model/ }))
    expect(screen.getByLabelText('Address')).toHaveAttribute('placeholder', 'http://localhost:11434/v1')
    expect(screen.getByText(/host\.docker\.internal:11434/)).toBeInTheDocument()
  })

  it('keeps what was typed for one provider while another is looked at', async () => {
    const user = userEvent.setup()
    serve(off())
    renderPage()
    await screen.findByText('AI is off')

    await user.click(screen.getByRole('radio', { name: /^Local model/ }))
    await user.type(screen.getByLabelText('Address'), 'http://model.lan:11434/v1')
    await user.click(screen.getByRole('radio', { name: /^Anthropic/ }))
    await user.type(screen.getByLabelText('Key'), 'sk-ant-typed')
    await user.click(screen.getByRole('radio', { name: /^Local model/ }))

    expect(screen.getByLabelText('Address')).toHaveValue('http://model.lan:11434/v1')
    expect(screen.queryByDisplayValue('sk-ant-typed')).not.toBeInTheDocument() // the Claude key is not in the local model's form
  })

  it("sends only the chosen provider's fields when saved, and says it was saved", async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    const sent = serve(off())
    renderPage()
    await screen.findByText('AI is off')

    await user.click(screen.getByRole('radio', { name: /^Local model/ }))
    await user.type(screen.getByLabelText('Address'), 'http://model.lan:11434/v1')
    await user.type(screen.getByLabelText('Model'), 'llama3')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(sent.saved).toEqual({ provider: 'local', base_url: 'http://model.lan:11434/v1', model: 'llama3', api_key: '' }))
    expect(toast.success).toHaveBeenCalledWith('AI settings saved')
  })

  it('empties the key box once it is saved, so the key is not left on the screen', async () => {
    const user = userEvent.setup()
    serve(off())
    renderPage()
    await screen.findByText('AI is off')

    await user.click(screen.getByRole('radio', { name: /^Anthropic/ }))
    await user.type(screen.getByLabelText('Key'), 'sk-ant-typed')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByLabelText('Key')).toHaveValue(''))
  })

  it('tells the rest of the app AI changed, so the Ask AI button follows at once', async () => {
    const user = userEvent.setup()
    serve(off())
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(AI_CONFIG_KEY, { enabled: false, model: 'x', provider: 'none', source: null })
    useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role: 'admin', organization_id: 1 } as never, token: 't', isAuthenticated: true })
    render(
      <QueryClientProvider client={client}>
        <AISettingsPage />
      </QueryClientProvider>,
    )
    await screen.findByText('AI is off')

    await user.click(screen.getByRole('radio', { name: /^Local model/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(client.getQueryState(AI_CONFIG_KEY)?.isInvalidated).toBe(true))
  })

  it('saves Off as just that, so nothing else goes with it', async () => {
    const user = userEvent.setup()
    const sent = serve(local())
    renderPage()
    await screen.findByText('AI is on: Local model')

    await user.click(screen.getByRole('radio', { name: /^Off/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(sent.saved).toEqual({ provider: 'none' }))
  })

  it('shows the reason in words when the server refuses the settings', async () => {
    const user = userEvent.setup()
    serve(off(), {
      save: () => HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Address is not on this server or a private network.' } }, { status: 422 }),
    })
    renderPage()
    await screen.findByText('AI is off')

    await user.click(screen.getByRole('radio', { name: /^Local model/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Address is not on this server or a private network.')
  })

  it('tries the settings in the form without saving them, and shows what the server said', async () => {
    const user = userEvent.setup()
    const sent = serve(local())
    renderPage()
    await screen.findByText('AI is on: Local model')

    await user.clear(screen.getByLabelText('Model'))
    await user.type(screen.getByLabelText('Model'), 'qwen')
    await user.click(screen.getByRole('button', { name: 'Try it' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Connected. model.lan answered in 0.4 s.')
    expect(sent.tested).toMatchObject({ provider: 'local', model: 'qwen' })
    expect(sent.saved).toBeUndefined()
    expect(screen.getByText('Asks the model one fixed question. No work order data is sent.')).toBeInTheDocument()
  })

  it('shows why a test failed', async () => {
    const user = userEvent.setup()
    serve(local(), {
      test: () => HttpResponse.json({ success: false, error: { code: 'AI_TEST_FAILED', message: 'Nothing is answering at model.lan. Is the service running?' } }, { status: 422 }),
    })
    renderPage()
    await screen.findByText('AI is on: Local model')

    await user.click(screen.getByRole('button', { name: 'Try it' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Nothing is answering at model.lan. Is the service running?')
  })

  it('has nothing to try while Off', async () => {
    serve(off())
    renderPage()
    await screen.findByText('AI is off')

    expect(screen.queryByRole('button', { name: 'Try it' })).not.toBeInTheDocument()
  })

  it('shows a saved key only as saved, never its value, and says what happens to it', async () => {
    serve(off({ provider: 'anthropic', enabled: true, source: 'app', where: 'api.anthropic.com', providers: providers({ anthropic: { default_model: 'claude-sonnet-5-5', model: 'claude-opus-5-5', key_set: true } }) }))
    renderPage()

    const key = await screen.findByLabelText('Key')
    expect(key).toHaveValue('')
    expect(key).toHaveAttribute('placeholder', 'Saved. Leave blank to keep it.')
    expect(screen.getByText(/Kept encrypted and never shown again. It is sent only to api\.anthropic\.com\./)).toBeInTheDocument()
  })

  it('says when the AI runs on the server\'s .env file, and how to move it', async () => {
    serve(off({
      provider: 'anthropic', enabled: true, source: 'environment', where: 'api.anthropic.com', environment_configured: true,
      providers: providers({ anthropic: { default_model: 'claude-sonnet-5-5', model: 'claude-haiku-5-5', key_set: true } }),
    }))
    renderPage()

    expect(await screen.findByText(/This comes from the server's \.env file/)).toBeInTheDocument()
    expect(screen.getByText(/The key is set in the server's \.env file\. Enter it here to move it into FixFlow\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Forget these settings' })).not.toBeInTheDocument() // nothing saved to forget
  })

  it('warns when a provider is chosen but cannot run', async () => {
    serve(local({ enabled: false }))
    renderPage()

    expect(await screen.findByText(/A provider is chosen but its settings are not complete/)).toBeInTheDocument()
  })

  it('forgets the settings after a confirmation, and starts over from Off', async () => {
    const user = userEvent.setup()
    const sent = serve(local())
    renderPage()
    await screen.findByText('AI is on: Local model')

    await user.click(screen.getByRole('button', { name: 'Forget these settings' }))

    await waitFor(() => expect(sent.removed).toBe(true))
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('forget every saved key'))
    await waitFor(() => expect(screen.getByRole('radio', { name: /^Off/ })).toBeChecked())
  })

  it('does not forget anything when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    const sent = serve(local())
    renderPage()
    await screen.findByText('AI is on: Local model')

    await user.click(screen.getByRole('button', { name: 'Forget these settings' }))

    expect(sent.removed).toBeUndefined()
  })

  it('offers a way to try again when the settings cannot be loaded', async () => {
    server.use(http.get('/api/v1/ai_settings', () => HttpResponse.json({}, { status: 500 })))
    renderPage()

    expect(await screen.findByText('The AI settings could not be loaded.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  describe('what the AI does', () => {
    it('lists each feature as a switch that is on, and says what the priority one sends and where', async () => {
      serve(local())
      renderPage()

      const priority = await screen.findByRole('checkbox', { name: 'Suggest a priority for new work orders' })
      const anomalies = screen.getByRole('checkbox', { name: 'Flag unusual sensor readings' })
      expect(priority).toBeChecked()
      expect(anomalies).toBeChecked()
      expect(priority).toHaveAccessibleDescription(/sends the title, the description and what is open on the asset to model\.lan/)
      expect(anomalies).toHaveAccessibleDescription(/nothing is sent to the provider/)
    })

    it('lists the two forecasts as switches too, and says they are worked out on the server', async () => {
      serve(local())
      renderPage()

      const limits = await screen.findByRole('checkbox', { name: 'Warn when a sensor is heading for its limit' })
      const parts = screen.getByRole('checkbox', { name: 'Forecast parts that may run short' })
      expect(limits).toBeChecked()
      expect(parts).toBeChecked()
      expect(limits).toHaveAccessibleDescription(/nothing is sent to the provider/)
      expect(parts).toHaveAccessibleDescription(/nothing is sent to the provider/)
    })

    it('switches a forecast off on its own', async () => {
      const user = userEvent.setup()
      const sent = serve(local())
      renderPage()

      await user.click(await screen.findByRole('checkbox', { name: 'Forecast parts that may run short' }))

      await waitFor(() => expect(sent.saved).toEqual({ features: { parts: false } }))
    })

    it('switches one off on its own, sending only that and nothing about the provider', async () => {
      const user = userEvent.setup()
      const sent = serve(local())
      renderPage()

      await user.click(await screen.findByRole('checkbox', { name: 'Flag unusual sensor readings' }))

      await waitFor(() => expect(sent.saved).toEqual({ features: { anomalies: false } }))
    })

    it('shows one that was switched off as off, and cannot be changed while AI is off', async () => {
      serve(local({ features: { priority: false, anomalies: true } }))
      renderPage()

      expect(await screen.findByRole('checkbox', { name: 'Suggest a priority for new work orders' })).not.toBeChecked()
    })

    it('is disabled, with a word on why, when no provider is chosen', async () => {
      serve(off())
      renderPage()

      expect(await screen.findByRole('checkbox', { name: 'Flag unusual sensor readings' })).toBeDisabled()
      expect(screen.getByText('Choose a provider above to use these.')).toBeInTheDocument()
    })

    it('says when a switch could not be saved', async () => {
      const user = userEvent.setup()
      serve(local(), { save: () => HttpResponse.json({ error: { message: 'Nope.' } }, { status: 422 }) as unknown as Response })
      renderPage()

      await user.click(await screen.findByRole('checkbox', { name: 'Flag unusual sensor readings' }))

      const { toast } = await import('sonner')
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Nope.'))
    })
  })

  it('reads in Spanish', async () => {
    await setLanguage('es', false)
    serve(local())
    renderPage()

    expect(await screen.findByText('La IA está activada: Modelo local')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^Modelo local/ })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Probar' })).toBeInTheDocument()
    expect(screen.getByLabelText('Dirección')).toHaveValue('http://model.lan:11434/v1')
  })
})
