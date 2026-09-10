import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { AIButton } from '../AIButton'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('AIButton', () => {
  it('renders when AI is enabled', async () => {
    render(<AIButton>Ask AI</AIButton>, { wrapper: Wrapper })
    await waitFor(() => expect(screen.getByText('Ask AI')).toBeInTheDocument())
  })

  it('renders nothing when AI is disabled', async () => {
    server.use(
      http.get('/api/v1/ai/config', () =>
        HttpResponse.json({
          success: true,
          data: { enabled: false, model: 'claude-sonnet-4-6' },
          meta: { request_id: 'test', timestamp: '' },
        }),
      ),
    )
    render(<AIButton>Ask AI</AIButton>, { wrapper: Wrapper })
    await waitFor(() => expect(screen.queryByText('Ask AI')).not.toBeInTheDocument())
  })
})
