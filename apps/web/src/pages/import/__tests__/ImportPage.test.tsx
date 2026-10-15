import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { apiClient } from '@/api/client'
import { ImportPage } from '../ImportPage'

const report = (extra: object = {}) => ({
  kind: 'assets', total_rows: 2, error_count: 0, errors: [], errors_truncated: false,
  columns: { known: ['name', 'status'], custom: [] }, preview: [{ name: 'Pump 1', status: 'operational' }, { name: 'Fan', status: '' }],
  created: 0, ...extra,
})

const problems = [
  { row: 3, column: 'name', message: 'The name is empty.' },
  { row: 5, column: 'status', message: '"working" is not a status. Use one of: operational, degraded, down, decommissioned.' },
]

const csv = (name = 'assets.csv') => new File(['name,status\nPump 1,operational\n'], name, { type: 'text/csv' })

function renderPage(url = '/import') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}><ImportPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

const choose = (file = csv()) => userEvent.upload(screen.getByLabelText('CSV file'), file)

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:download')
  URL.revokeObjectURL = vi.fn()
})

describe('ImportPage', () => {
  it('starts with assets, and says which columns the file needs', () => {
    renderPage()

    expect(screen.getByRole('tab', { name: 'Assets', selected: true })).toBeInTheDocument()
    expect(screen.getByText(/name \(required\), asset_tag, serial_number, status, location/)).toBeInTheDocument()
  })

  it('opens on the kind it was linked to, and switches between them', async () => {
    renderPage('/import?kind=parts')
    expect(screen.getByRole('tab', { name: 'Parts', selected: true })).toBeInTheDocument()
    expect(screen.getByText(/Each SKU can be used once/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Locations' }))

    expect(screen.getByRole('tab', { name: 'Locations', selected: true })).toBeInTheDocument()
    expect(screen.getByText(/Do these first/)).toBeInTheDocument()
  })

  it('falls back to assets for a kind it does not know', () => {
    renderPage('/import?kind=users')
    expect(screen.getByRole('tab', { name: 'Assets', selected: true })).toBeInTheDocument()
  })

  it('downloads the template for the chosen kind', async () => {
    let asked = ''
    server.use(http.get('/api/v1/imports/:kind/template', ({ params }) => {
      asked = String(params.kind)
      return new HttpResponse('name,sku\nOil filter,OF-1\n', { headers: { 'Content-Type': 'text/csv' } })
    }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    renderPage('/import?kind=parts')

    await userEvent.click(screen.getByRole('button', { name: /download the part template/i }))

    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(asked).toBe('parts')
  })

  it('checks the file as soon as it is chosen, and says nothing has been imported while there are problems', async () => {
    let imported = false
    server.use(
      http.post('/api/v1/imports/assets/preview', () => HttpResponse.json(report({ error_count: 2, errors: problems, preview: [] }))),
      http.post('/api/v1/imports/assets', () => { imported = true; return HttpResponse.json(report(), { status: 201 }) }),
    )
    renderPage()

    await choose()

    expect(await screen.findByText('2 problems to fix')).toBeInTheDocument()
    expect(screen.getByText(/Nothing has been imported/)).toBeInTheDocument()
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByText('3')).toBeInTheDocument()
    expect(within(rows[1]).getByText('name')).toBeInTheDocument()
    expect(within(rows[1]).getByText('The name is empty.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^import \d/i })).not.toBeInTheDocument()
    expect(imported).toBe(false)
  })

  it('offers the problems as a file to work through, and says when the list was cut short', async () => {
    server.use(http.post('/api/v1/imports/assets/preview', () => HttpResponse.json(report({ error_count: 450, errors: problems, errors_truncated: true, preview: [] }))))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    renderPage()

    await choose()
    expect(await screen.findByText(/Showing the first 2 of 450/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /download this list/i }))

    expect(click).toHaveBeenCalled()
    const made = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls
    const blob = made[made.length - 1][0] as Blob
    const text = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(blob) })
    expect(text.split('\n')[0]).toBe('row,column,problem')
    expect(text).toContain('"3","name","The name is empty."')
  })

  it('shows what a clean file will do, then imports it and says how many', async () => {
    server.use(
      http.post('/api/v1/imports/assets/preview', () => HttpResponse.json(report())),
      http.post('/api/v1/imports/assets', () => HttpResponse.json(report({ created: 2 }), { status: 201 })),
    )
    renderPage()

    await choose()
    expect(await screen.findByText('2 rows ready to import')).toBeInTheDocument()
    expect(screen.getByText('Pump 1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Import 2 assets' }))

    expect(await screen.findByText('Imported 2 assets')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view assets/i })).toHaveAttribute('href', '/assets')
  })

  it('sends the same file it checked when importing', async () => {
    server.use(
      http.post('/api/v1/imports/assets/preview', () => HttpResponse.json(report())),
      http.post('/api/v1/imports/assets', () => HttpResponse.json(report({ created: 2 }), { status: 201 })),
    )
    const post = vi.spyOn(apiClient, 'post')
    renderPage()

    await choose(csv('my-assets.csv'))
    await userEvent.click(await screen.findByRole('button', { name: 'Import 2 assets' }))

    await screen.findByText('Imported 2 assets')
    const sentFiles = post.mock.calls.map(([url, body]) => [url, ((body as FormData).get('file') as File).name])
    expect(sentFiles).toEqual([['/imports/assets/preview', 'my-assets.csv'], ['/imports/assets', 'my-assets.csv']])
  })

  it('says which columns will be kept as custom fields', async () => {
    server.use(http.post('/api/v1/imports/assets/preview', () =>
      HttpResponse.json(report({ columns: { known: ['name'], custom: ['manufacturer', 'year'] }, preview: [{ name: 'Pump', manufacturer: 'Grundfos', year: '2021' }] }))))
    renderPage()

    await choose()

    expect(await screen.findByText('manufacturer, year')).toBeInTheDocument()
    expect(screen.getByText('Grundfos')).toBeInTheDocument()
  })

  it('shows the server\'s reason when the file cannot be read at all', async () => {
    server.use(http.post('/api/v1/imports/assets/preview', () =>
      HttpResponse.json({ error: { code: 'IMPORT_UNREADABLE', message: 'This looks like an Excel file. In Excel choose File, Save As, CSV, and upload that.' } }, { status: 422 })))
    renderPage()

    await choose()

    expect(await screen.findByRole('alert')).toHaveTextContent('This looks like an Excel file')
    expect(screen.queryByText(/ready to import/)).not.toBeInTheDocument()
  })

  it('shows the problems if the file was refused when importing, for instance because data changed meanwhile', async () => {
    server.use(
      http.post('/api/v1/imports/assets/preview', () => HttpResponse.json(report())),
      http.post('/api/v1/imports/assets', () => HttpResponse.json(report({ error_count: 1, errors: [problems[0]] }), { status: 422 })),
    )
    renderPage()

    await choose()
    await userEvent.click(await screen.findByRole('button', { name: 'Import 2 assets' }))

    expect(await screen.findByText('1 problem to fix')).toBeInTheDocument()
    expect(screen.queryByText(/^Imported/)).not.toBeInTheDocument()
  })

  it('lets you pick a different file, starting again', async () => {
    server.use(http.post('/api/v1/imports/assets/preview', () => HttpResponse.json(report())))
    renderPage()

    await choose()
    await userEvent.click(await screen.findByRole('button', { name: /choose a different file/i }))

    expect(screen.queryByText('2 rows ready to import')).not.toBeInTheDocument()
    expect(screen.getByText(/Drag your CSV here/)).toBeInTheDocument()
  })

  it('does not take a file that is not a CSV, and says what to do', async () => {
    renderPage()

    await userEvent.upload(screen.getByLabelText('CSV file'), new File(['x'], 'photo.png', { type: 'image/png' }), { applyAccept: false })

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a .csv file of 5 MB or less')
  })

  it('clears a result when you switch to another kind', async () => {
    server.use(http.post('/api/v1/imports/assets/preview', () => HttpResponse.json(report())))
    renderPage()
    await choose()
    await screen.findByText('2 rows ready to import')

    await userEvent.click(screen.getByRole('tab', { name: 'Parts' }))

    expect(screen.queryByText('2 rows ready to import')).not.toBeInTheDocument()
  })
})
