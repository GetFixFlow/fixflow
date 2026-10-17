import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { fixtures } from '@/test/reportFixtures'
import { useAuthStore } from '@/stores/authStore'
import { AuditLogPage } from '../AuditLogPage'
import type { AuditPage } from '@/api/audit'
import type { Role } from '@/types'

const saved = vi.hoisted(() => ({ files: [] as Array<{ blob: Blob; filename: string }> }))
vi.mock('@/services/exportService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/exportService')>()),
  triggerDownload: (blob: Blob, filename: string) => saved.files.push({ blob, filename }),
}))
const toasts = vi.hoisted(() => ({ warning: [] as string[], error: [] as string[] }))
vi.mock('sonner', () => ({
  toast: { warning: (m: string) => toasts.warning.push(m), error: (m: string) => toasts.error.push(m), success: vi.fn() },
}))

// The real page, fed what the server really sends (src/test/fixtures/reports/activity_logs.json).
const log = fixtures.auditLog
let asked: URLSearchParams[]

function serve(answer: AuditPage | 'fail' = log) {
  server.use(http.get('/api/v1/activity_logs', ({ request }) => {
    asked.push(new URL(request.url).searchParams)
    return answer === 'fail' ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json(answer)
  }))
}

function renderPage(role: Role = 'admin') {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role, organization_id: 1 } as never, token: 't', isAuthenticated: true })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><AuditLogPage /></MemoryRouter></QueryClientProvider>)
}

const last = () => asked[asked.length - 1]
const rowOf = async (text: string) => (await screen.findByText(text)).closest('tr') as HTMLElement
const withPages = (pages: number, current = 1): AuditPage => ({
  ...log, meta: { pagination: { current_page: current, total_pages: pages, total_count: pages * 25, per_page: 25 } },
})

beforeEach(() => {
  asked = []
  saved.files = []
  toasts.warning = []
  toasts.error = []
  serve()
})

describe('AuditLogPage', () => {
  it('shows what the server recorded, in words: who, what happened, which record and what changed', async () => {
    renderPage()
    const asset = await rowOf('Pump')
    expect(within(asset).getByText('Alice Silva')).toBeInTheDocument()
    expect(within(asset).getByText('Asset updated')).toBeInTheDocument()
    expect(within(asset).getByText('Asset')).toBeInTheDocument()
    expect(within(asset).getByText('Changed: name, status')).toBeInTheDocument()
    expect(within(asset).getByText('10.0.0.5')).toBeInTheDocument()
  })

  it('says "System" when the system did it, and shows a role going from one to another', async () => {
    renderPage()
    expect(within(await rowOf('WO-000003')).getByText('System')).toBeInTheDocument()
    expect(within(await rowOf('Bo Technician')).getByText('Role: technician → manager')).toBeInTheDocument()
  })

  it('shows sign-ins as sign-ins, with who signed in and from where', async () => {
    renderPage()
    const signIn = log.activity_logs.find((l) => l.action === 'user.signed_in')!
    await screen.findByText('Pump')
    const row = screen.getAllByRole('row').find((r) => within(r).queryByText('Signed in'))!
    const cells = within(row).getAllByRole('cell')
    expect(cells[1]).toHaveTextContent(signIn.user!.full_name) // who
    expect(cells[2]).toHaveTextContent('Signed in') // what happened
    expect(cells[5]).toHaveTextContent(signIn.ip_address!) // from where
  })

  it('asks for the first page with no filters, and shows nothing that was not recorded', async () => {
    renderPage()
    await screen.findByText('Pump')
    expect(Object.fromEntries(asked[0])).toEqual({ page: '1' })
    for (const invented of ['Alice Smith', 'Air Compressor #3', 'High temp alert', 'Production IoT Key']) {
      expect(screen.queryByText(invented)).toBeNull()
    }
  })

  it('asks the server to filter (it does not filter the page it has), and starts again at page 1', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pump')
    await user.type(screen.getByLabelText('Person'), 'alice')
    await user.selectOptions(screen.getByLabelText('Kind of record'), 'Asset')
    await user.selectOptions(screen.getByLabelText('What happened'), 'updated')
    await user.type(screen.getByLabelText('Record'), 'pump')
    await user.type(screen.getByLabelText('From date'), '2026-10-01')
    await user.type(screen.getByLabelText('To date'), '2026-10-16')
    await waitFor(() => {
      expect(Object.fromEntries(last())).toEqual({
        page: '1', person: 'alice', q: 'pump', resource_type: 'Asset', verb: 'updated', from: '2026-10-01', to: '2026-10-16',
      })
    })
  })

  it('does not ask the server for every letter that is typed', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pump')
    const before = asked.length
    await user.type(screen.getByLabelText('Person'), 'alice')
    await waitFor(() => expect(last().get('person')).toBe('alice'))
    expect(asked.length - before).toBeLessThanOrEqual(2)
  })

  it('pages through the log, and goes back to the first page when a filter changes', async () => {
    const user = userEvent.setup()
    serve(withPages(3))
    renderPage()
    await screen.findByText('Page 1 of 3 (75 lines)')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(last().get('page')).toBe('2'))
    await user.selectOptions(screen.getByLabelText('What happened'), 'created')
    await waitFor(() => expect(Object.fromEntries(last())).toEqual({ page: '1', verb: 'created' }))
  })

  it('has no pager when everything fits on one page', async () => {
    renderPage()
    await screen.findByText('Pump')
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
  })

  it('downloads the log as a file with the filters that are showing', async () => {
    const user = userEvent.setup()
    let fileParams: URLSearchParams | undefined
    server.use(http.get('/api/v1/activity_logs.csv', ({ request }) => {
      fileParams = new URL(request.url).searchParams
      return new HttpResponse('when,who\n', { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="audit_log_2026-10-16.csv"' } })
    }))
    renderPage()
    await screen.findByText('Pump')
    await user.selectOptions(screen.getByLabelText('What happened'), 'deleted')
    await user.click(screen.getByRole('button', { name: /export csv/i }))
    await waitFor(() => expect(saved.files).toHaveLength(1))
    expect(saved.files[0].filename).toBe('audit_log_2026-10-16.csv')
    expect(Object.fromEntries(fileParams!)).toEqual({ verb: 'deleted' })
    expect(toasts.warning).toEqual([])
  })

  it('says so when the file was cut at the limit', async () => {
    const user = userEvent.setup()
    server.use(http.get('/api/v1/activity_logs.csv', () => new HttpResponse('when\n', {
      headers: { 'Content-Type': 'text/csv', 'X-Export-Truncated': 'true' },
    })))
    renderPage()
    await screen.findByText('Pump')
    await user.click(screen.getByRole('button', { name: /export csv/i }))
    await waitFor(() => expect(toasts.warning[0]).toContain('newest 50,000 lines'))
  })

  it('says the file could not be made, rather than doing nothing', async () => {
    const user = userEvent.setup()
    server.use(http.get('/api/v1/activity_logs.csv', () => HttpResponse.json({ error: { message: 'Nope' } }, { status: 403 })))
    renderPage()
    await screen.findByText('Pump')
    await user.click(screen.getByRole('button', { name: /export csv/i }))
    await waitFor(() => expect(toasts.error).toEqual(['Only administrators can export the audit log.']))
    expect(saved.files).toEqual([])
  })

  it('says when nothing matches, and when the log could not be loaded', async () => {
    serve({ ...log, activity_logs: [] })
    const { unmount } = renderPage()
    expect(await screen.findByText('Nothing in the audit log matches these filters.')).toBeInTheDocument()
    unmount()
    serve('fail')
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
  })

  it('is for administrators only, and asks the server nothing for anyone else', async () => {
    renderPage('manager')
    expect(await screen.findByText(/Only administrators can see the audit log/)).toBeInTheDocument()
    expect(asked).toEqual([])
  })
})
