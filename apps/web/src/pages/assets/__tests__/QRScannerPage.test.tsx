import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { QRScannerPage } from '../QRScannerPage'
import type { LookupMatch } from '@/types/scanning'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

// A camera that reads whatever the test says it saw.
interface FakeScanner {
  config: { formatsToSupport: number[] }
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  see: (text: string) => void
}
const scanners: FakeScanner[] = []
const camera = vi.hoisted(() => ({ cameras: [{ id: 'back', label: 'Back camera' }] as { id: string; label?: string }[], failure: '' }))

vi.mock('html5-qrcode', () => {
  class Html5Qrcode {
    static getCameras = vi.fn(async () => camera.cameras)
    config: FakeScanner['config']
    onDecoded: (text: string) => void = () => {}
    start = vi.fn(async (_camera: unknown, _settings: unknown, onDecoded: (text: string) => void) => {
      if (camera.failure) throw new Error(camera.failure)
      this.onDecoded = onDecoded
    })
    stop = vi.fn(async () => {})
    clear = vi.fn()
    constructor(_id: string, config: FakeScanner['config']) {
      this.config = config
      scanners.push(this as unknown as FakeScanner)
    }
    see = (text: string) => this.onDecoded(text)
  }
  return {
    Html5Qrcode,
    Html5QrcodeSupportedFormats: { QR_CODE: 0, CODE_128: 1, CODE_39: 2, EAN_13: 3, EAN_8: 4, UPC_A: 5, UPC_E: 6, ITF: 7, DATA_MATRIX: 9 },
  }
})

const pump: LookupMatch = { id: 7, name: 'Pump 3', asset_tag: 'FF-000042', barcode: '5012345678900', serial_number: 'SN-1', location: 'Boiler room', matched_on: ['barcode'] }
const fan: LookupMatch = { id: 8, name: 'Fan 1', asset_tag: 'FF-000043', barcode: null, serial_number: '5012345678900', location: null, matched_on: ['serial_number', 'barcode'] }

let looked: string[]

function serve(matches: LookupMatch[] | Response) {
  looked = []
  server.use(
    http.get('/api/v1/assets/lookup', ({ request }) => {
      looked.push(new URL(request.url).searchParams.get('code') ?? '')
      return matches instanceof Response ? matches : HttpResponse.json({ matches })
    }),
    http.get('/api/v1/assets', () => HttpResponse.json({ assets: [{ id: 7, name: 'Pump 3', asset_tag: 'FF-000042', status: 'operational' }, { id: 9, name: 'Press', asset_tag: 'FF-000050', status: 'operational' }], meta: {} })),
  )
}

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderPage(role = 'technician') {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Test', role, organization_id: 1 } as never, token: 't', isAuthenticated: true })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/assets/scan']}>
        <Routes>
          <Route path="/assets/scan" element={<QRScannerPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const lastScanner = () => scanners[scanners.length - 1]
const waitForCamera = () => waitFor(() => expect(lastScanner()?.start).toHaveBeenCalled())

beforeEach(() => {
  vi.clearAllMocks()
  scanners.length = 0
  camera.cameras = [{ id: 'back' }]
  camera.failure = ''
  serve([pump])
})

describe('QRScannerPage camera', () => {
  it('reads QR codes and the common barcodes, and not much else', async () => {
    renderPage()
    await waitForCamera()

    expect(lastScanner().config.formatsToSupport).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('looks in a box that is wide and short, so a barcode fits, and as wide as the picture allows for a small view', async () => {
    renderPage()
    await waitForCamera()

    const settings = lastScanner().start.mock.calls[0][1] as { qrbox: (w: number, h: number) => { width: number; height: number } }
    expect(settings.qrbox(300, 300)).toEqual({ width: 270, height: 150 })
    expect(settings.qrbox(400, 200)).toEqual({ width: 360, height: 100 })
    expect(settings.qrbox(60, 60)).toEqual({ width: 54, height: 50 })
  })

  it('opens the asset when the code belongs to one, and stops the camera', async () => {
    renderPage()
    await waitForCamera()
    lastScanner().see('5012345678900')

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/assets/7'))
    expect(looked).toEqual(['5012345678900'])
    expect(lastScanner().stop).toHaveBeenCalled()
  })

  it('looks a code up once even when the camera reads it again before it has stopped', async () => {
    renderPage()
    await waitForCamera()
    lastScanner().see('ABC')
    lastScanner().see('ABC')
    lastScanner().see('ABC')

    await waitFor(() => expect(screen.getByTestId('where')).toBeInTheDocument())
    expect(looked).toEqual(['ABC'])
  })

  it('trims what the camera read', async () => {
    renderPage()
    await waitForCamera()
    lastScanner().see('  FF-000042 \n')

    await waitFor(() => expect(looked).toEqual(['FF-000042']))
  })
})

describe('what a scan can find', () => {
  it('asks which asset when several have the code, saying how each matched', async () => {
    serve([pump, fan])
    renderPage()
    await waitForCamera()
    lastScanner().see('5012345678900')

    const list = await screen.findByRole('list')
    expect(within(list).getByText(/FF-000042, Boiler room. Matched the barcode\./)).toBeInTheDocument()
    expect(within(list).getByText(/FF-000043. Matched the serial number and barcode\./)).toBeInTheDocument()

    await userEvent.click(within(list).getByRole('button', { name: /Fan 1/ }))
    expect(screen.getByTestId('where')).toHaveTextContent('/assets/8')
  })

  it('says when no asset has the code, and offers to search and to scan again', async () => {
    serve([])
    renderPage()
    await waitForCamera()
    lastScanner().see('NOPE-1')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No asset has the code NOPE-1.')
    expect(within(alert).getByRole('link', { name: /search assets/i })).toHaveAttribute('href', '/assets?search=NOPE-1')

    const before = scanners.length
    await userEvent.click(within(alert).getByRole('button', { name: 'Scan again' }))
    await waitFor(() => expect(scanners.length).toBe(before + 1))
    await waitFor(() => expect(lastScanner().start).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('can read the same code again after Scan again', async () => {
    serve([])
    renderPage()
    await waitForCamera()
    lastScanner().see('NOPE-1')
    await userEvent.click(await screen.findByRole('button', { name: 'Scan again' }))
    await waitFor(() => expect(lastScanner().start).toHaveBeenCalled())
    lastScanner().see('NOPE-2')

    await waitFor(() => expect(looked).toEqual(['NOPE-1', 'NOPE-2']))
  })

  it('says so when the lookup fails, and tries again on request', async () => {
    serve(new Response(null, { status: 500 }))
    renderPage()
    await waitForCamera()
    lastScanner().see('ABC')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not look up ABC')

    serve([pump])
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/assets/7'))
  })
})

describe('typing or a handheld scanner', () => {
  it('looks up what is typed, trimmed, when Look up is pressed or Enter is', async () => {
    renderPage()
    await waitForCamera()
    await userEvent.type(screen.getByLabelText('Or type or scan a code'), '  sn-1  {Enter}')

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/assets/7'))
    expect(looked).toEqual(['sn-1'])
  })

  it('wants something typed first', async () => {
    renderPage()
    await waitForCamera()

    expect(screen.getByRole('button', { name: 'Look up' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Or type or scan a code'), '   ')
    expect(screen.getByRole('button', { name: 'Look up' })).toBeDisabled()
  })

  it('stops the camera so that it does not read a second code while the first is looked up', async () => {
    serve([]) // nothing found, so the page stays and does not stop the camera by leaving
    renderPage()
    await waitForCamera()
    await userEvent.type(screen.getByLabelText('Or type or scan a code'), 'ABC{Enter}')
    lastScanner().see('SECOND')

    await screen.findByText(/No asset has the code/)
    expect(looked).toEqual(['ABC'])
    expect(lastScanner().stop).toHaveBeenCalled()
  })

  it('works when there is no camera, and says so', async () => {
    camera.cameras = []
    renderPage()

    expect(await screen.findByText('Camera not available.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Or type or scan a code'), 'ABC{Enter}')
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/assets/7'))
  })

  it('works when the camera was refused, and says so', async () => {
    camera.failure = 'NotAllowedError: Permission denied'
    renderPage()

    expect(await screen.findByText('Camera access was denied.')).toBeInTheDocument()
    expect(screen.getByLabelText('Or type or scan a code')).toBeEnabled()
  })

  it('shows another camera problem with a way to try again', async () => {
    camera.failure = 'Something broke'
    renderPage()

    expect(await screen.findByText('Scanner error.')).toBeInTheDocument()
    expect(screen.getByText(/Something broke/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('linking a code nobody has to an asset', () => {
  async function scanUnknown(role: string) {
    serve([])
    renderPage(role)
    await waitForCamera()
    lastScanner().see('STICKER-9')
    await screen.findByText(/No asset has the code/)
  }

  it('is offered to managers and administrators, not to technicians', async () => {
    await scanUnknown('technician')
    expect(screen.queryByRole('button', { name: /link it to an asset/i })).not.toBeInTheDocument()
  })

  it('is not offered for a code too long to keep as a barcode', async () => {
    serve([])
    renderPage('manager')
    await waitForCamera()
    lastScanner().see('x'.repeat(65))
    await screen.findByText(/No asset has the code/)

    expect(screen.queryByRole('button', { name: /link it to an asset/i })).not.toBeInTheDocument()
  })

  it.each(['manager', 'admin'])('keeps the code as the barcode of the asset a %s picks, and opens it', async (role) => {
    let body: unknown
    await scanUnknown(role)
    server.use(http.patch('/api/v1/assets/:id', async ({ request, params }) => {
      body = { id: params.id, ...((await request.json()) as object) }
      return HttpResponse.json({ data: { id: 7 } })
    }))
    await userEvent.click(screen.getByRole('button', { name: /link it to an asset/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Link it' })).toBeDisabled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Asset' }))
    await userEvent.click(await within(dialog).findByRole('option', { name: /Pump 3/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Link it' }))

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/assets/7'))
    expect(body).toEqual({ id: '7', asset: { barcode: 'STICKER-9' } })
    expect(toast.success).toHaveBeenCalled()
  })

  it('shows why when the server refuses, and keeps the dialog open', async () => {
    await scanUnknown('manager')
    server.use(http.patch('/api/v1/assets/:id', () =>
      HttpResponse.json({ error: { message: 'Barcode is already on another asset' } }, { status: 422 })))
    await userEvent.click(screen.getByRole('button', { name: /link it to an asset/i }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Asset' }))
    await userEvent.click(await within(dialog).findByRole('option', { name: /Pump 3/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Link it' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Barcode is already on another asset')
    expect(within(dialog).getByRole('button', { name: 'Link it' })).toBeEnabled()
  })

  it('can be cancelled', async () => {
    await scanUnknown('manager')
    await userEvent.click(screen.getByRole('button', { name: /link it to an asset/i }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
