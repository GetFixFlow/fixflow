import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { RequiredPartsEditor } from '../RequiredPartsEditor'

const catalog = [
  { id: 1, name: 'Hydraulic seal', sku: 'HS-1', quantity_on_hand: 6, reorder_point: 1, organization_id: 1, created_at: '', updated_at: '' },
  { id: 2, name: 'Drive chain', sku: 'DC-9', quantity_on_hand: 2, reorder_point: 1, organization_id: 1, created_at: '', updated_at: '' },
]

function renderEditor(value: { part_id: number; quantity: number }[] = [], onChange = vi.fn()) {
  server.use(http.get('/api/v1/parts', () => HttpResponse.json({ parts: catalog, meta: {} })))
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RequiredPartsEditor value={value} onChange={onChange} />
    </QueryClientProvider>,
  )
  return onChange
}

describe('RequiredPartsEditor', () => {
  it('offers the real catalog and adds the chosen part', async () => {
    const onChange = renderEditor()
    await userEvent.click(screen.getByRole('button', { name: /add part/i }))

    expect(await screen.findByText('Hydraulic seal')).toBeInTheDocument()
    expect(screen.queryByText('Oil Filter')).not.toBeInTheDocument() // the old invented part
    await userEvent.click(screen.getByText('Drive chain'))

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ part_id: 2, quantity: 1 })])
  })

  it('does not offer a part that is already on the list', async () => {
    renderEditor([{ part_id: 1, quantity: 1 }])
    await userEvent.click(screen.getByRole('button', { name: /add part/i }))

    expect(await screen.findByText('Drive chain')).toBeInTheDocument()
    expect(screen.queryByText('Hydraulic seal')).not.toBeInTheDocument()
  })
})
