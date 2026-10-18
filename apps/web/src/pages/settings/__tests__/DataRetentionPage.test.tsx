import { describe, it, expect, beforeEach } from 'vitest'
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

// The real page, fed what the server really sends (src/test/fixtures/reports/data_usage.json).
const usage = fixtures.dataUsage

let asked: URLSearchParams[]
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
  serve()
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
    expect(screen.getByText(/not available yet/)).toBeInTheDocument()
    expect(screen.queryByText(/emailed/i)).toBeNull()
  })

  it('describes a production server that makes backups, with the bucket and how long they are kept', async () => {
    serve({ backups: { ...usage.backups, runs: true } })
    renderPage()
    expect(await screen.findByText(/made every night at 03:00 UTC and kept for 30 days/)).toBeInTheDocument()
    expect(screen.getByText('fixflow-backups')).toBeInTheDocument()
    expect(screen.getByText(/written to the server log only/)).toBeInTheDocument()
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
  })
})
