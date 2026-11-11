import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { setLanguage } from '@/i18n'
import { AssetsListPage } from '../AssetsListPage'
import { QRScannerPage } from '../QRScannerPage'
import { QRLabelPrintPage } from '../QRLabelPrintPage'
import { AssetEditPage } from '../AssetEditPage'
import { AssetDetailPage } from '../AssetDetailPage'
import { PartsPage } from '@/pages/parts/PartsPage'
import { VendorsPage } from '@/pages/vendors/VendorsPage'
import { PurchasingPage } from '@/pages/purchasing/PurchasingPage'
import { AssetStatusChanger } from '@/components/assets/AssetStatusChanger'
import { AssetDocuments } from '@/components/assets/AssetDocuments'
import { warrantyStatus } from '@/lib/warranty'
import type { Asset, Role } from '@/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,x'), toCanvas: vi.fn(async () => {}) } }))
vi.mock('html5-qrcode', () => {
  class Html5Qrcode {
    static getCameras = vi.fn(async () => [])
    constructor() {}
  }
  return { Html5Qrcode, Html5QrcodeSupportedFormats: { QR_CODE: 0, CODE_128: 1, CODE_39: 2, EAN_13: 3, EAN_8: 4, UPC_A: 5, UPC_E: 6, ITF: 7 } }
})

const asset = (id: number, name: string, status: Asset['status'], extra: Partial<Asset> = {}): Asset => ({
  id, name, asset_tag: `FF-00000${id}`, status, organization_id: 1, created_at: '2026-01-01', updated_at: '2026-01-01', ...extra,
})

function signInAs(role: Role) {
  useAuthStore.setState({
    user: { id: 1, email: 'a@b.c', full_name: 'Test', role, organization_id: 1 } as never,
    token: 't', isAuthenticated: true,
  })
}

function renderIn(ui: React.ReactNode, url = '/') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  signInAs('admin')
  setLanguage('es', false)
  server.use(
    http.get('/api/v1/locations', () => HttpResponse.json({ locations: [] })),
  )
})

describe('assets in Spanish', () => {
  it('draws the list with Spanish headings, buttons and status words', async () => {
    server.use(http.get('/api/v1/assets', () =>
      HttpResponse.json({ assets: [asset(1, 'Bomba-01', 'operational'), asset(2, 'Compresor-01', 'degraded')], meta: {} })))
    renderIn(<AssetsListPage />)

    expect(await screen.findByText('Bomba-01')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Activos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nuevo activo/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Imprimir etiquetas/ })).toBeInTheDocument()
    expect(screen.getByText('Etiqueta del activo')).toBeInTheDocument()
    expect(screen.getByText('Ubicación')).toBeInTheDocument()
    expect(screen.getAllByText('Degradado').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Buscar activos')).toBeInTheDocument()
    expect(screen.queryByText('New Asset')).not.toBeInTheDocument()
  })

  it('says how many are selected in the form the language needs', async () => {
    server.use(http.get('/api/v1/assets', () =>
      HttpResponse.json({ assets: [asset(1, 'Bomba-01', 'operational'), asset(2, 'Compresor-01', 'degraded')], meta: {} })))
    renderIn(<AssetsListPage />)
    await screen.findByText('Bomba-01')

    await userEvent.click(screen.getByLabelText('Seleccionar Bomba-01'))
    expect(screen.getByText('1 activo seleccionado')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Seleccionar Compresor-01'))
    expect(screen.getByText('2 activos seleccionados')).toBeInTheDocument()
  })

  it('shows the status changer and its confirmation in Spanish', async () => {
    renderIn(<AssetStatusChanger asset={asset(1, 'Bomba-01', 'operational')} />)

    await userEvent.click(screen.getByRole('button', { name: /cambiar el estado del activo/i }))
    expect(screen.getByText('actual')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Fuera de servicio'))
    expect(screen.getByText(/¿Cambiar el estado a/)).toBeInTheDocument()
    expect(screen.getByText('Cancelar')).toBeInTheDocument()
    expect(screen.getByText('Confirmar')).toBeInTheDocument()
  })

  it('words the warranty in Spanish', () => {
    const today = new Date(2026, 9, 16)
    expect(warrantyStatus('2026-10-16', today).text).toBe('termina hoy')
    expect(warrantyStatus('2026-10-17', today).text).toBe('termina mañana')
    expect(warrantyStatus('2026-11-15', today).text).toBe('termina en 30 días')
    expect(warrantyStatus('2026-10-15', today).text).toBe('terminó ayer')
    expect(warrantyStatus('2026-09-16', today).text).toBe('terminó hace 30 días')
  })

  it('draws the asset page: tabs, facts and the warranty note', async () => {
    const soon = new Date(); soon.setDate(soon.getDate() + 10)
    const ends = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`
    server.use(
      http.get('/api/v1/assets/1', () => HttpResponse.json({ data: asset(1, 'Bomba-01', 'down', { warranty_expires_on: ends, serial_number: 'SN-9' }) })),
      http.get('/api/v1/work_orders', () => HttpResponse.json({ work_orders: [], meta: {} })),
    )
    renderIn(<Routes><Route path="/assets/:id" element={<AssetDetailPage />} /></Routes>, '/assets/1')

    expect(await screen.findByRole('heading', { name: 'Bomba-01' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tiempo de inactividad' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Órdenes de trabajo' })).toBeInTheDocument()
    expect(screen.getByText('Último servicio')).toBeInTheDocument()
    expect(screen.getByText('Información del activo')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Garantía: termina en 10 días/)
  })

  it('writes the documents tab in Spanish', async () => {
    server.use(http.get('/api/v1/assets/1/documents', () => HttpResponse.json({ documents: [] })))
    renderIn(<AssetDocuments assetId={1} canManage userId={1} />)

    expect(await screen.findByText('Aún no hay documentos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Añadir un archivo/ })).toBeInTheDocument()
  })

  it('draws the edit form with Spanish labels and the Spanish rule message', async () => {
    server.use(http.get('/api/v1/assets/1', () => HttpResponse.json({ data: asset(1, 'Bomba-01', 'operational') })))
    renderIn(<Routes><Route path="/assets/:id/edit" element={<AssetEditPage />} /></Routes>, '/assets/1/edit')

    expect(await screen.findByText('Editar activo')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre del activo *')).toBeInTheDocument()
    const name = screen.getByLabelText('Nombre del activo *')
    await userEvent.clear(name)
    await userEvent.type(name, 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('El nombre debe tener al menos 2 caracteres')).toBeInTheDocument()
  })
})

describe('scanning and labels in Spanish', () => {
  it('says what to do when there is no camera', async () => {
    renderIn(<QRScannerPage />)

    expect(await screen.findByText('La cámara no está disponible.')).toBeInTheDocument()
    expect(screen.getByLabelText('O escribe o escanea un código')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeInTheDocument()
  })

  it('names the places a code was found in Spanish when several assets have it', async () => {
    server.use(http.get('/api/v1/assets/lookup', () => HttpResponse.json({ matches: [
      { id: 7, name: 'Bomba 3', asset_tag: 'FF-000042', barcode: '5012', serial_number: 'SN-1', location: 'Caldera', matched_on: ['barcode'] },
      { id: 8, name: 'Ventilador 1', asset_tag: 'FF-000043', barcode: null, serial_number: '5012', location: null, matched_on: ['serial_number', 'barcode'] },
    ] })))
    renderIn(<QRScannerPage />)
    await userEvent.type(await screen.findByLabelText('O escribe o escanea un código'), '5012')
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    const list = await screen.findByRole('list')
    expect(within(list).getByText(/FF-000042, Caldera. Coincide por código de barras\./)).toBeInTheDocument()
    expect(within(list).getByText(/FF-000043. Coincide por número de serie y código de barras\./)).toBeInTheDocument()
  })

  it('draws the label page in Spanish', async () => {
    server.use(http.get('/api/v1/assets/labels', () => HttpResponse.json({
      labels: [{ id: 1, name: 'Bomba-01', asset_tag: 'FF-000001', barcode: null, public_code: 'c1', location_name: 'Planta' }], total: 1, truncated: false,
    })))
    renderIn(<QRLabelPrintPage />, '/assets/print-labels?ids=1')

    expect(await screen.findByRole('heading', { name: 'Imprimir etiquetas' })).toBeInTheDocument()
    expect(screen.getByText('Qué activos')).toBeInTheDocument()
    expect(screen.getByText('La etiqueta')).toBeInTheDocument()
    expect(screen.getByLabelText('Tamaño')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Mediana, 80 × 40 mm' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('1 etiqueta elegida')).toBeInTheDocument())
  })
})

describe('parts, vendors and purchasing in Spanish', () => {
  it('draws the parts page', async () => {
    server.use(
      http.get('/api/v1/custom_fields', () => HttpResponse.json({ custom_fields: [] })),
      http.get('/api/v1/parts', () => HttpResponse.json({
        parts: [
          { id: 1, name: 'Sello', sku: 'S-1', quantity_on_hand: 0, reorder_point: 2, unit: 'unidad', unit_cost: 5, low_stock: true, organization_id: 1, created_at: '', updated_at: '' },
        ],
        meta: { current_page: 1, total_pages: 1, total_count: 1, per_page: 25 },
      })),
    )
    renderIn(<PartsPage />)

    expect(await screen.findByText('Sello')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Repuestos e inventario' })).toBeInTheDocument()
    expect(screen.getByText('Sin existencias')).toBeInTheDocument()
    expect(screen.getByText('1 en el catálogo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ajustar/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar repuestos')).toBeInTheDocument()
  })

  it('opens the part form with Spanish rule messages', async () => {
    server.use(
      http.get('/api/v1/custom_fields', () => HttpResponse.json({ custom_fields: [] })),
      http.get('/api/v1/parts', () => HttpResponse.json({ parts: [], meta: { current_page: 1, total_pages: 1, total_count: 0, per_page: 25 } })),
    )
    renderIn(<PartsPage />)
    await userEvent.click(await screen.findByRole('button', { name: /Añadir repuesto/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir repuesto', hidden: false }).catch(() => screen.getAllByRole('button', { name: /Añadir repuesto/ })[1]))

    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument()
  })

  it('draws the vendors page', async () => {
    server.use(http.get('/api/v1/vendors', () => HttpResponse.json({
      vendors: [
        { id: 1, name: 'Acme Eléctrica', category: 'Electricidad', phone: null, email: null, active: true, work_orders_count: 1, contacts: [] },
        { id: 2, name: 'Frío SA', category: null, phone: null, email: null, active: false, work_orders_count: 0, contacts: [] },
      ],
      categories: ['Electricidad'], meta: { current_page: 1, total_pages: 1, total_count: 2, per_page: 25 },
    })))
    renderIn(<VendorsPage />)

    expect(await screen.findByRole('button', { name: 'Acme Eléctrica' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Proveedores y contratistas' })).toBeInTheDocument()
    expect(screen.getByText('2 en la lista')).toBeInTheDocument()
    expect(screen.getByText('Fuera de uso', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar proveedores')).toBeInTheDocument()
  })

  it('draws the purchasing page and the status of each request', async () => {
    signInAs('manager')
    server.use(http.get('/api/v1/purchase_orders', () => HttpResponse.json({
      purchase_orders: [{
        id: 1, number: 'PO-000001', status: 'requested', line_count: 1, total: 10, editable: true,
        requested_by: { id: 7, name: 'Tina' }, created_at: '2026-10-20T09:00:00Z', updated_at: '',
      }],
      waiting_for_approval: 1, meta: { current_page: 1, total_pages: 1, total_count: 1, per_page: 25 },
    })))
    renderIn(<PurchasingPage />)

    expect(await screen.findByRole('button', { name: 'PO-000001' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Compras' })).toBeInTheDocument()
    expect(screen.getByText('1 esperando tu decisión')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Esperando aprobación (1)' })).toBeInTheDocument()
    expect(screen.getByText('Esperando aprobación', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pedir repuestos/ })).toBeInTheDocument()
  })
})
