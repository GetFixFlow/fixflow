import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { fixtures } from '@/test/reportFixtures'
import { useAuthStore } from '@/stores/authStore'
import { formatBytes } from '@/lib/retentionText'
import { DataRetentionPage } from '../DataRetentionPage'
import type { DataUsage } from '@/api/dataUsage'
import type { Role } from '@/types'
import type { BackupList } from '@/api/backups'

const saved_files = vi.hoisted(() => ({ files: [] as { blob: Blob; filename: string }[] }))
const toasts = vi.hoisted(() => ({ error: [] as string[] }))
vi.mock('@/services/exportService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/exportService')>()),
  triggerDownload: (blob: Blob, filename: string) => saved_files.files.push({ blob, filename }),
}))
vi.mock('sonner', () => ({ toast: { error: (m: string) => toasts.error.push(m), success: vi.fn(), warning: vi.fn() } }))

// The real page, fed what the server really sends (src/test/fixtures/reports/data_usage.json).
const usage = fixtures.dataUsage

let asked: URLSearchParams[]
let backupsAsked: number
let downloaded: string[]
let patches: Record<string, unknown>[]
let saved: { sensor: number; audit: number }

/** Answers like the server: what would go depends on the limit asked about (5 readings per 30 days over the limit, say). */
function serve(overrides: Partial<DataUsage> = {}) {
  saved = { sensor: usage.sensor_data.retention_days, audit: usage.audit_log.retention_days ?? 0 }
  server.use(
    http.get('/api/v1/organization_settings', () => HttpResponse.json({
      organization: { iot_data_retention_days: saved.sensor, audit_log_retention_days: saved.audit },
    })),
    http.patch('/api/v1/organization_settings', async ({ request }) => {
      const body = ((await request.json()) as { organization: Record<string, number> }).organization
      patches.push(body)
      saved = { sensor: body.iot_data_retention_days ?? saved.sensor, audit: body.audit_log_retention_days ?? saved.audit }
      return HttpResponse.json({ organization: {} })
    }),
    http.get('/api/v1/data_usage', ({ request }) => {
      const params = new URL(request.url).searchParams
      asked.push(params)
      const sensorDays = Number(params.get('sensor_days') ?? saved.sensor)
      const auditDays = Number(params.get('audit_days') ?? saved.audit)
      return HttpResponse.json({
        ...usage,
        sensor_data: { ...usage.sensor_data, retention_days: saved.sensor, checked_days: sensorDays, removable_readings: sensorDays < 30 ? 120 : 0, removable_summaries: sensorDays < 30 ? 7 : 0 },
        audit_log: { ...usage.audit_log, retention_days: saved.audit || null, checked_days: auditDays || null, removable_lines: auditDays && auditDays < 365 ? 40 : 0 },
        ...overrides,
      })
    }),
  )
}

/** Answers like the server does for the backups list and the download of one. */
function serveBackups(list: Partial<BackupList> = {}) {
  server.use(
    http.get('/api/v1/backups', () => { backupsAsked += 1; return HttpResponse.json({ ...fixtures.backups, ...list }) }),
    http.get('/api/v1/backups/:name/download', ({ params }) => {
      downloaded.push(String(params.name))
      return new HttpResponse('dump', { headers: { 'Content-Disposition': `attachment; filename="${params.name}"`, 'Content-Type': 'application/gzip' } })
    }),
  )
}

function renderPage(role: Role = 'admin') {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role, organization_id: 1 } as never, token: 't', isAuthenticated: true })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><DataRetentionPage /></MemoryRouter></QueryClientProvider>)
}

const sensorSelect = () => screen.getByLabelText('Keep sensor readings for')
const auditSelect = () => screen.getByLabelText('Keep the audit log for')

beforeEach(() => {
  asked = []
  patches = []
  backupsAsked = 0
  downloaded = []
  saved_files.files = []
  toasts.error = []
  serve()
  serveBackups()
})

describe('DataRetentionPage', () => {
  it('shows what the data really takes up, from the server', async () => {
    renderPage()
    const row = (await screen.findByText('Audit log', { selector: 'td' })).closest('tr') as HTMLElement
    expect(within(row).getByText(formatBytes(usage.tables.activity_logs.bytes))).toBeInTheDocument()
    expect(screen.getByText(`${formatBytes(usage.database_bytes)} database`)).toBeInTheDocument()
    const files = screen.getByText('Uploaded files (photos, documents)').closest('tr') as HTMLElement
    expect(within(files).getByText(`${usage.attachments.count} files`)).toBeInTheDocument()
  })

  it('shows nothing that was not measured', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'What your data takes up' })
    for (const invented of ['5.1 GB / 10 GB', '4.9 GB', 'Download Latest', 'Trigger Backup Now', 'Report Snapshots', '2.3 GB']) {
      expect(screen.queryByText(invented)).toBeNull()
    }
  })

  it('shows the limits that are saved, and what the next cleanup will remove at them', async () => {
    renderPage()
    await waitFor(() => expect(sensorSelect()).toHaveValue(String(usage.sensor_data.retention_days)))
    expect(auditSelect()).toHaveValue(String(usage.audit_log.retention_days))
    expect(await screen.findAllByText(/Nothing is past this limit, so nothing will be deleted/)).toHaveLength(2)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('asks what a shorter limit would delete before anything is saved, and warns', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(sensorSelect()).toBeEnabled())
    await user.selectOptions(sensorSelect(), '7')
    expect(await screen.findByText(/120 readings past this limit will be deleted for good in the next nightly cleanup \(02:00 UTC\)/)).toBeInTheDocument()
    expect(screen.getByText(/and 7 hourly summaries/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('cannot be undone')
    expect(screen.getByRole('button', { name: 'Save, and delete older data tonight' })).toBeInTheDocument()
    expect(patches).toEqual([])
    expect(Object.fromEntries(asked[asked.length - 1])).toEqual({ sensor_days: '7', audit_days: String(usage.audit_log.retention_days) })
  })

  it('does the same for the audit log, and for choosing to keep it for ever', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(auditSelect()).toBeEnabled())
    await user.selectOptions(auditSelect(), '0')
    expect(await screen.findByText(/The audit log is kept for ever, so nothing is deleted/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save retention limits' })).toBeEnabled()
  })

  it('saves both limits, then shows the saved state again with nothing left to confirm', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(sensorSelect()).toBeEnabled())
    await user.selectOptions(sensorSelect(), '7')
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Save, and delete older data tonight' }))
    await waitFor(() => expect(patches).toEqual([{ iot_data_retention_days: 7, audit_log_retention_days: usage.audit_log.retention_days }]))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(sensorSelect()).toHaveValue('7')
  })

  it('does nothing until something is changed, and can be cancelled', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(sensorSelect()).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Save retention limits' })).toBeDisabled()
    await user.selectOptions(sensorSelect(), '90')
    await user.selectOptions(sensorSelect(), String(usage.sensor_data.retention_days))
    expect(screen.getByRole('button', { name: 'Save retention limits' })).toBeDisabled()
    await user.selectOptions(sensorSelect(), '7')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(sensorSelect()).toHaveValue(String(usage.sensor_data.retention_days))
    expect(patches).toEqual([])
  })

  it('offers a limit that was set some other way, instead of showing the wrong one', async () => {
    saved = { sensor: 120, audit: 0 }
    serve()
    server.use(http.get('/api/v1/organization_settings', () => HttpResponse.json({
      organization: { iot_data_retention_days: 120, audit_log_retention_days: 400 },
    })))
    renderPage()
    await waitFor(() => expect(sensorSelect()).toHaveValue('120'))
    expect(within(sensorSelect()).getByRole('option', { name: '120 days' })).toBeInTheDocument()
    expect(within(auditSelect()).getByRole('option', { name: '400 days' })).toBeInTheDocument()
  })

  it('says when it could not count what is past the limit, rather than saying nothing is', async () => {
    serve({ sensor_data: { ...usage.sensor_data, removable_readings: null, removable_summaries: null } })
    renderPage()
    expect(await screen.findByText(/could not be counted just now/)).toBeInTheDocument()
    expect(screen.queryByText(/Nothing is past this limit.*readings/)).toBeNull()
  })

  it('says what the nightly backup does, and does not promise anything it does not do', async () => {
    renderPage()
    expect(await screen.findByText(/This server does not make backups/)).toBeInTheDocument()
    expect(screen.getByText(/nightly at 03:00 UTC, kept 30 days/)).toBeInTheDocument()
    expect(screen.queryByText(/emailed/i)).toBeNull()
    expect(screen.queryByText(/not available yet/)).toBeNull()
  })

  it('describes a production server that makes backups, with the bucket and how long they are kept', async () => {
    serve({ backups: { ...usage.backups, runs: true } })
    renderPage()
    expect(await screen.findByText(/is made every night at 03:00 UTC/)).toBeInTheDocument()
    expect(screen.getByText(/photos and documents people uploaded since the last one/)).toBeInTheDocument()
    expect(screen.getByText(/The database copies are kept for 30 days/)).toBeInTheDocument()
    expect(screen.getByText('fixflow-backups')).toBeInTheDocument()
    expect(screen.getByText(/tried again every 15 minutes, 3 tries in all/)).toBeInTheDocument()
    expect(screen.getByText(/every administrator is emailed \(when email is set up\)/)).toBeInTheDocument()
    expect(screen.queryByText(/written to the server log only/)).toBeNull()
  })

  it('warns that backups on the same storage as the data do not survive losing the server', async () => {
    serve({ backups: { ...usage.backups, runs: true, separate: false } })
    renderPage()
    expect(await screen.findByText(/same storage server and disk as the data they protect/)).toBeInTheDocument()
    expect(screen.getByText('BACKUP_S3_ACCESS_KEY')).toBeInTheDocument()
  })

  it('does not warn when the backups are kept on another storage, and says so', async () => {
    serve({ backups: { ...usage.backups, runs: true, separate: true } })
    renderPage()
    expect(await screen.findByText(/of the separate backup storage/)).toBeInTheDocument()
    expect(screen.queryByText(/same storage server and disk/)).toBeNull()
  })

  it('does not warn on a server that makes no backups', async () => {
    renderPage()
    await screen.findByText(/This server does not make backups/)
    expect(screen.queryByText(/same storage server and disk/)).toBeNull()
  })

  describe('the backups', () => {
    it('lists what the server says is in the storage, newest first, with sizes', async () => {
      renderPage()
      const [newest, older] = fixtures.backups.backups
      const rows = await screen.findAllByRole('row')
      const body = rows.filter((row) => row.textContent?.includes('fixflow_'))
      expect(body).toHaveLength(2)
      expect(body[0]).toHaveTextContent(newest.name)
      expect(body[0]).toHaveTextContent(formatBytes(newest.bytes))
      expect(body[1]).toHaveTextContent(older.name)
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('downloads the one that is chosen, from the server, under its own name', async () => {
      const user = userEvent.setup()
      renderPage()
      const [newest] = fixtures.backups.backups
      const buttons = await screen.findAllByRole('button', { name: /Download the backup of/ })
      await user.click(buttons[0])
      await waitFor(() => expect(saved_files.files).toHaveLength(1))
      expect(downloaded).toEqual([newest.name])
      expect(saved_files.files[0].filename).toBe(newest.name)
      expect(toasts.error).toEqual([])
    })

    it('downloads the row whose button was pressed, not always the newest', async () => {
      const user = userEvent.setup()
      renderPage()
      const [, older] = fixtures.backups.backups
      const buttons = await screen.findAllByRole('button', { name: /Download the backup of/ })
      await user.click(buttons[1])
      await waitFor(() => expect(saved_files.files).toHaveLength(1))
      expect(downloaded).toEqual([older.name])
      expect(saved_files.files[0].filename).toBe(older.name)
    })

    it('says so when the backup is gone from the storage, or the storage is out of reach', async () => {
      const user = userEvent.setup()
      renderPage()
      server.use(http.get('/api/v1/backups/:name/download', () => HttpResponse.json({}, { status: 404 })))
      await user.click((await screen.findAllByRole('button', { name: /Download the backup of/ }))[0])
      await waitFor(() => expect(toasts.error).toEqual(['That backup is no longer in the file storage.']))

      server.use(http.get('/api/v1/backups/:name/download', () => HttpResponse.json({}, { status: 400 })))
      await user.click(screen.getAllByRole('button', { name: /Download the backup of/ })[0])
      await waitFor(() => expect(toasts.error[1]).toMatch(/could not be downloaded/))
      expect(saved_files.files).toEqual([])
    })

    it('warns when a backup is overdue, with the date of the newest', async () => {
      serveBackups({ overdue: true })
      renderPage()
      expect(await screen.findByRole('alert')).toHaveTextContent(/The newest backup is from .* a new one should have been made since/)
      expect(screen.getByRole('alert')).toHaveTextContent('System Health')
    })

    it('warns when there is no backup at all and one is due', async () => {
      serveBackups({ overdue: true, backups: [] })
      renderPage()
      expect(await screen.findByRole('alert')).toHaveTextContent('There is no backup, and one should have been made by now.')
    })

    it('shows the storage problem instead of an empty list that would look like "no backups"', async () => {
      serveBackups({ backups: [], error: 'The file storage did not answer (ServiceUnavailable). Check that it is running.' })
      renderPage()
      expect(await screen.findByRole('alert')).toHaveTextContent('The file storage did not answer')
      expect(screen.queryByText(/No backups yet/)).toBeNull()
    })

    it('says when the list itself could not be loaded', async () => {
      server.use(http.get('/api/v1/backups', () => HttpResponse.json({}, { status: 403 })))
      renderPage()
      expect(await screen.findByRole('alert')).toHaveTextContent('list of backups could not be loaded')
    })

    it('says "No backups yet" and when the first one comes, on a server that makes them', async () => {
      serve({ backups: { ...usage.backups, runs: true } })
      serveBackups({ backups: [] })
      renderPage()
      expect(await screen.findByText(/No backups yet\. The first one is made tonight at 03:00 UTC/)).toBeInTheDocument()
    })

    it('says plainly what a backup holds, what it does not, and how to restore one', async () => {
      renderPage()
      expect(await screen.findByText(/password hashes included/)).toBeInTheDocument()
      expect(screen.getByText(/Every download is written to the audit log/)).toBeInTheDocument()
      expect(screen.getByText(/never deleted from\s+the copy, because an older backup may still point at them/)).toBeInTheDocument()
      expect(screen.getByText(/copies the uploaded files back/)).toBeInTheDocument()
      expect(screen.getByText('rails "fixflow:restore[latest]"')).toBeInTheDocument()
      expect(screen.getByText(/REPLACE=yes/)).toBeInTheDocument()
    })
  })

  it('says when the figures could not be loaded', async () => {
    server.use(http.get('/api/v1/data_usage', () => HttpResponse.json({}, { status: 500 })))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
  })

  it('is for administrators only, and asks the server nothing for anyone else', async () => {
    renderPage('manager')
    expect(await screen.findByText(/Only administrators can manage data retention/)).toBeInTheDocument()
    expect(asked).toEqual([])
    expect(backupsAsked).toBe(0)
  })
})
