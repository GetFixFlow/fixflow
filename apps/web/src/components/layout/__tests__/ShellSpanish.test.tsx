import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { useRealtimeStore } from '@/stores/realtimeStore'
import { setLanguage } from '@/i18n'
import { Sidebar } from '../Sidebar'
import { Header } from '../Header'
import { SyncStatus } from '../SyncStatus'
import { LanguageApplier } from '../LanguageApplier'
import { KeyboardShortcutsHelp } from '@/components/shared/KeyboardShortcutsHelp'
import { LocationBreadcrumb } from '@/components/shared/LocationBreadcrumb'
import type { IotAlert, Location } from '@/types'

const mount = (ui: React.ReactNode) => render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>{ui}</MemoryRouter>
  </QueryClientProvider>,
)

beforeEach(() => {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada Admin', role: 'admin', organization_id: 1 } as never, token: 't', isAuthenticated: true })
  useRealtimeStore.setState({ newAlerts: [], connected: false })
})

describe('the app shell in Spanish', () => {
  it('names the menu entries in Spanish', () => {
    setLanguage('es', false)
    mount(<Sidebar />)

    for (const name of ['Panel', 'Órdenes de trabajo', 'Activos', 'Repuestos', 'Mantenimiento preventivo', 'Informes', 'Configuración']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Contraer la barra lateral' })).toBeInTheDocument()
  })

  it('words the header, with the plural of new alerts as Spanish has it', () => {
    setLanguage('es', false)
    useRealtimeStore.setState({ newAlerts: [{ id: 1 }] as IotAlert[] })
    const { unmount } = mount(<Header />)
    expect(screen.getByRole('button', { name: 'Notificaciones: 1 alerta nueva' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Escanear código QR' })).toBeInTheDocument()
    unmount()

    useRealtimeStore.setState({ newAlerts: [{ id: 1 }, { id: 2 }] as IotAlert[] })
    mount(<Header />)
    expect(screen.getByRole('button', { name: 'Notificaciones: 2 alertas nuevas' })).toBeInTheDocument()
  })

  it('says it is offline in Spanish', () => {
    setLanguage('es', false)
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    mount(<SyncStatus />)

    expect(screen.getByLabelText('Estado de sincronización')).toHaveTextContent('Sin conexión')
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it("switches to the signed-in person's language, as the server worked it out", () => {
    useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role: 'admin', organization_id: 1, language: 'es' } as never })
    mount(<><LanguageApplier /><Sidebar /></>)

    expect(screen.getByRole('link', { name: 'Órdenes de trabajo' })).toBeInTheDocument()
  })

  it('translates the shared pieces: shortcuts and the location path', () => {
    setLanguage('es', false)
    const locations = [{ id: 1, name: 'Planta 1', parent_id: null }] as unknown as Location[]
    mount(<><KeyboardShortcutsHelp open onClose={() => {}} /><LocationBreadcrumb locations={locations} locationId={1} /></>)

    expect(screen.getByText('Atajos de teclado')).toBeInTheDocument()
    expect(screen.getByText('Nueva orden de trabajo')).toBeInTheDocument()
    expect(screen.getByLabelText('Ruta de la ubicación')).toHaveTextContent('Planta 1')
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
  })
})
