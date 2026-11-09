import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { QRLabelPrintPage } from '../QRLabelPrintPage'
import type { LabelAsset } from '@/types/scanning'

const drawing = vi.hoisted(() => ({ hold: null as null | Promise<void> }))
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async (value: string) => {
      if (drawing.hold) await drawing.hold
      return `data:image/png;base64,${btoa(value)}`
    }),
  },
}))

const label = (id: number, name: string, extra: Partial<LabelAsset> = {}): LabelAsset => ({
  id, name, asset_tag: `FF-${String(id).padStart(6, '0')}`, barcode: null, public_code: `code${id}`, location_name: 'Plant', ...extra,
})
const everything = Array.from({ length: 15 }, (_, i) => label(i + 1, `Asset ${i + 1}`))

let asked: URLSearchParams[]

function serve(labels: LabelAsset[], extra: { total?: number; truncated?: boolean } = {}, status = 200) {
  asked = []
  server.use(
    http.get('/api/v1/assets/labels', ({ request }) => {
      const params = new URL(request.url).searchParams
      asked.push(params)
      if (status !== 200) return HttpResponse.json({ error: { message: 'no' } }, { status })
      const ids = params.get('ids')?.split(',').map(Number)
      const rows = ids ? labels.filter((l) => ids.includes(l.id)) : labels
      const search = params.get('search')?.toLowerCase()
      const found = search ? rows.filter((l) => l.name.toLowerCase().includes(search)) : rows
      return HttpResponse.json({ labels: found, total: extra.total ?? found.length, truncated: extra.truncated ?? false })
    }),
    http.get('/api/v1/locations', () => HttpResponse.json({ locations: [] })),
  )
}

function renderPage(url = '/assets/print-labels') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}><QRLabelPrintPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

const printRoot = () => document.getElementById('label-print-root')!
const printed = () => within(printRoot()).queryAllByTestId('asset-label')
const lastAsked = () => asked[asked.length - 1]

beforeEach(() => {
  drawing.hold = null
  vi.spyOn(window, 'print').mockImplementation(() => {})
  serve(everything)
})
afterEach(() => vi.restoreAllMocks())

describe('QRLabelPrintPage', () => {
  it('lists the assets that match, with nothing chosen to start with', async () => {
    renderPage()

    expect(await screen.findByText('Asset 1')).toBeInTheDocument()
    expect(screen.getByText('0 labels chosen')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Print labels' })).toBeDisabled()
    expect(screen.getByText('Choose assets to preview their labels')).toBeInTheDocument()
    expect(printed()).toHaveLength(0)
  })

  it('chooses one asset, shows its label, and prints it', async () => {
    renderPage()
    await userEvent.click(await screen.findByLabelText(/Asset 3/))

    expect(screen.getByText('1 label chosen')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Print labels' })
    await waitFor(() => expect(button).toBeEnabled())
    expect(printed()).toHaveLength(1)
    expect(within(printRoot()).getByText('Asset 3')).toBeInTheDocument()

    await userEvent.click(button)
    expect(window.print).toHaveBeenCalledTimes(1)
  })

  it('chooses every asset that matches, and none again', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Choose all 15' }))

    expect(screen.getByText('15 labels chosen')).toBeInTheDocument()
    await waitFor(() => expect(printed()).toHaveLength(15))

    await userEvent.click(screen.getByRole('button', { name: 'None' }))
    expect(screen.getByText('0 labels chosen')).toBeInTheDocument()
    expect(printed()).toHaveLength(0)
  })

  it('previews the first 12 and prints all of them', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Choose all 15' }))

    await waitFor(() => expect(printed()).toHaveLength(15))
    expect(screen.getByText('Showing the first 12 of 15. All of them are printed.')).toBeInTheDocument()
    const preview = screen.getByText('Preview').closest('div')!
    expect(within(preview).getAllByTestId('asset-label')).toHaveLength(12)
  })

  it('keeps the printed sheet outside the page, in the body, with the style that prints only it', async () => {
    renderPage()
    await userEvent.click(await screen.findByLabelText(/Asset 3/))

    expect(printRoot().parentElement).toBe(document.body)
    const style = Array.from(document.body.querySelectorAll('style')).map((s) => s.textContent).join('')
    expect(style).toContain('body > *:not(#label-print-root) { display: none !important; }')
    expect(style).toContain('#label-print-root { display: flex !important; }')
  })

  it('says it is preparing until the QR codes are drawn, and then prints', async () => {
    let release = () => {}
    drawing.hold = new Promise<void>((resolve) => { release = resolve })
    renderPage()
    await userEvent.click(await screen.findByLabelText(/Asset 3/))

    expect(screen.getByRole('button', { name: 'Preparing…' })).toBeDisabled()
    await act(async () => { release() })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Print labels' })).toBeEnabled())
  })

  it('says when there are more assets than it shows', async () => {
    serve(everything, { total: 812, truncated: true })
    renderPage()

    expect(await screen.findByRole('status')).toHaveTextContent('812 assets match; the first 15 are shown. Narrow the search to reach the rest.')
  })

  it('says when nothing matches', async () => {
    serve([])
    renderPage()

    expect(await screen.findByText('No assets match.')).toBeInTheDocument()
  })

  it('is for managers: anyone else is told so', async () => {
    serve([], {}, 403)
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Only managers and administrators can print labels.')
    expect(screen.queryByLabelText('Search')).not.toBeInTheDocument()
  })
})

describe('which assets', () => {
  it('asks for what the Assets list had filtered, when it sends its filters', async () => {
    renderPage('/assets/print-labels?search=pump&status=down&location_id=4')
    await screen.findByText('No assets match.')

    expect(Object.fromEntries(lastAsked())).toEqual({ search: 'pump', status: 'down', location_id: '4' })
    expect(screen.getByLabelText('Search')).toHaveValue('pump')
    expect(screen.getByLabelText('Status')).toHaveValue('down')
  })

  it('narrows by what is typed, after a short wait, and by status', async () => {
    renderPage()
    await screen.findByText('Asset 1')

    await userEvent.type(screen.getByLabelText('Search'), 'asset 12')
    await waitFor(() => expect(lastAsked().get('search')).toBe('asset 12'))
    expect(await screen.findByText('Asset 12')).toBeInTheDocument()
    expect(screen.queryByText('Asset 1')).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'degraded')
    await waitFor(() => expect(lastAsked().get('status')).toBe('degraded'))
  })

  it('asks for only the assets picked on the list, and chooses them all', async () => {
    renderPage('/assets/print-labels?ids=2,5')

    expect(await screen.findByText('2 labels chosen')).toBeInTheDocument()
    expect(lastAsked().get('ids')).toBe('2,5')
    expect(screen.getByText('The assets you picked on the list.')).toBeInTheDocument()
    expect(screen.queryByText('Asset 1')).not.toBeInTheDocument()
  })

  it('lets go of the picks, to show every asset, when asked', async () => {
    renderPage('/assets/print-labels?ids=2,5')
    await userEvent.click(await screen.findByRole('button', { name: 'Show all assets' }))

    expect(await screen.findByText('Asset 1')).toBeInTheDocument()
    expect(lastAsked().get('ids')).toBeNull()
    expect(screen.queryByText('The assets you picked on the list.')).not.toBeInTheDocument()
  })

  it('lets go of the picks when a filter is changed', async () => {
    renderPage('/assets/print-labels?ids=2,5')
    await screen.findByText('2 labels chosen')
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'down')

    await waitFor(() => expect(lastAsked().get('ids')).toBeNull())
    expect(lastAsked().get('status')).toBe('down')
  })

  it('keeps only the chosen assets that are still among the results when the search narrows', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Choose all 15' }))
    expect(screen.getByText('15 labels chosen')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Search'), 'asset 1')
    await waitFor(() => expect(screen.getByText('7 labels chosen')).toBeInTheDocument()) // 1, 10 to 15
  })
})

describe('what stays chosen', () => {
  it('lets go of a chosen asset once a search has hidden it, so clearing the search does not bring it back', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Choose all 15' }))
    await userEvent.type(screen.getByLabelText('Search'), 'asset 12')
    await waitFor(() => expect(screen.getByText('1 label chosen')).toBeInTheDocument())

    await userEvent.clear(screen.getByLabelText('Search'))
    await screen.findByText('Asset 1')

    expect(screen.getByText('1 label chosen')).toBeInTheDocument()
  })
})

describe('the label', () => {
  async function choose() {
    renderPage()
    await userEvent.click(await screen.findByLabelText(/Asset 3/))
    await waitFor(() => expect(printed()).toHaveLength(1))
  }

  it('has a barcode of the tag and the place, which can be left out', async () => {
    await choose()
    expect(within(printRoot()).getByRole('img', { name: 'Barcode of FF-000003' })).toBeInTheDocument()
    expect(within(printRoot()).getByText('Plant')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('Barcode of the tag'))
    await userEvent.click(screen.getByLabelText('The place'))

    expect(within(printRoot()).queryByRole('img', { name: /Barcode of/ })).not.toBeInTheDocument()
    expect(within(printRoot()).queryByText('Plant')).not.toBeInTheDocument()
  })

  it('is as big as the size says, medium to start with', async () => {
    await choose()
    expect(printed()[0]).toHaveStyle({ width: '80mm', height: '40mm' })

    await userEvent.selectOptions(screen.getByLabelText('Size'), 'small')
    expect(printed()[0]).toHaveStyle({ width: '60mm', height: '30mm' })
  })

  it('goes on A4 or on US Letter', async () => {
    await choose()
    const style = () => Array.from(document.body.querySelectorAll('style')).map((s) => s.textContent).join('')
    expect(style()).toContain('size: A4')

    await userEvent.selectOptions(screen.getByLabelText('Paper'), 'letter')
    expect(style()).toContain('size: letter')
  })

  it('tells the person to print at full size', async () => {
    await choose()

    expect(screen.getByText(/Print at 100% scale/)).toBeInTheDocument()
  })
})
