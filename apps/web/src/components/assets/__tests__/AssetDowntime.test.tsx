import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { apiClient } from '@/api/client'
import { server } from '@/test/server'
import { AssetDowntime } from '../AssetDowntime'
import type { Downtime } from '@/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const over: Downtime = {
  id: 1, asset_id: 7, started_at: '2026-10-10T08:00:00Z', ended_at: '2026-10-10T11:30:00Z', reason: 'Belt snapped', open: false,
  hours: 3.5, started_by: 'Tina Tech', ended_by: 'Manny Manager',
}
const going: Downtime = {
  id: 2, asset_id: 7, started_at: '2026-10-15T08:00:00Z', ended_at: null, reason: 'Overheating', open: true, hours: 26, started_by: null, ended_by: null,
}

function renderTab(canManage: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><AssetDowntime assetId={7} canManage={canManage} /></QueryClientProvider>)
}

const serve = (downtimes: Downtime[]) => server.use(http.get('/api/v1/assets/7/downtimes', () => HttpResponse.json({ downtimes })))
const iso = (local: string) => new Date(local).toISOString()

describe('the downtime of an asset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('lists each stop with how long it lasted, what happened and who recorded it', async () => {
    serve([over])
    renderTab(false)

    expect(await screen.findByText('Belt snapped')).toBeInTheDocument()
    expect(screen.getByText('3.5 hrs')).toBeInTheDocument()
    expect(screen.getByText(/stopped by tina tech, restarted by manny manager/i)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: /it stopped/i })).toBeInTheDocument()
  })

  it('says so when there is none', async () => {
    serve([])
    renderTab(false)

    expect(await screen.findByText('No downtime recorded')).toBeInTheDocument()
  })

  it('warns when the asset is down, since when and why, and offers only to restart it', async () => {
    serve([going, over])
    renderTab(false)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/down since .* \(26\.0 hrs\): overheating/i)
    expect(screen.getByText('still down')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /it stopped/i })).toBeNull()
  })

  it('marks the asset down from the time given, with what happened', async () => {
    serve([])
    server.use(http.post('/api/v1/assets/7/downtimes', () => HttpResponse.json({ data: going }, { status: 201 })))
    const post = vi.spyOn(apiClient, 'post')
    renderTab(false)

    await userEvent.click(await screen.findByRole('button', { name: /it stopped/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Stopped'), { target: { value: '2026-10-15T08:00' } })
    await userEvent.type(within(dialog).getByLabelText(/what happened/i), 'Overheating')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as down' }))

    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0]).toEqual(['/assets/7/downtimes', { downtime: { started_at: iso('2026-10-15T08:00'), ended_at: undefined, reason: 'Overheating' } }])
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('records a stop that is over when the time it ran again is filled in', async () => {
    serve([])
    server.use(http.post('/api/v1/assets/7/downtimes', () => HttpResponse.json({ data: over }, { status: 201 })))
    const post = vi.spyOn(apiClient, 'post')
    renderTab(false)

    await userEvent.click(await screen.findByRole('button', { name: /it stopped/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Stopped'), { target: { value: '2026-10-10T08:00' } })
    fireEvent.change(within(dialog).getByLabelText(/running again/i), { target: { value: '2026-10-10T11:30' } })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record the stop' }))

    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1]).toEqual({
      downtime: { started_at: iso('2026-10-10T08:00'), ended_at: iso('2026-10-10T11:30'), reason: null },
    })
  })

  it('puts the asset back in service from the time given', async () => {
    serve([going])
    server.use(http.post('/api/v1/downtimes/2/restart', () => HttpResponse.json({ data: { ...going, open: false } })))
    const post = vi.spyOn(apiClient, 'post')
    renderTab(false)

    await userEvent.click(await screen.findByRole('button', { name: /running again/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/running again from/i), { target: { value: '2026-10-16T09:30' } })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Back in service' }))

    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0]).toEqual(['/downtimes/2/restart', { ended_at: iso('2026-10-16T09:30') }])
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Back in service.'))
  })

  it("shows the server's reason when it refuses a stop", async () => {
    serve([])
    server.use(http.post('/api/v1/assets/7/downtimes', () =>
      HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'That overlaps another time this asset was down' } }, { status: 422 })))
    renderTab(false)

    await userEvent.click(await screen.findByRole('button', { name: /it stopped/i }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mark as down' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That overlaps another time this asset was down'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('lets only a manager correct or delete, and not delete one that is still going on', async () => {
    serve([going, over])
    const view = renderTab(false)
    await screen.findByText('Belt snapped')
    expect(screen.queryByRole('button', { name: /correct this downtime/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete this downtime/i })).toBeNull()
    view.unmount()

    renderTab(true)
    await screen.findByText('Belt snapped')
    expect(screen.getAllByRole('button', { name: /correct this downtime/i })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /delete this downtime/i })).toHaveLength(1)
  })

  it('lets a manager correct the times and the note', async () => {
    serve([over])
    server.use(http.patch('/api/v1/downtimes/1', () => HttpResponse.json({ data: over })))
    const patch = vi.spyOn(apiClient, 'patch')
    renderTab(true)

    await userEvent.click(await screen.findByRole('button', { name: /correct this downtime/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Stopped'), { target: { value: '2026-10-10T07:45' } })
    await userEvent.clear(within(dialog).getByLabelText(/what happened/i))
    await userEvent.type(within(dialog).getByLabelText(/what happened/i), 'Bearing failed')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(patch).toHaveBeenCalled())
    expect(patch.mock.calls[0][0]).toBe('/downtimes/1')
    expect(patch.mock.calls[0][1]).toEqual({
      downtime: { started_at: iso('2026-10-10T07:45'), ended_at: expect.any(String), reason: 'Bearing failed' },
    })
  })

  it('does not offer an end time when correcting one that is still going on', async () => {
    serve([going])
    renderTab(true)

    await userEvent.click(await screen.findByRole('button', { name: /correct this downtime/i }))

    expect(within(await screen.findByRole('dialog')).queryByLabelText(/running again/i)).toBeNull()
  })

  it('deletes a record after asking', async () => {
    serve([over])
    let deleted = false
    server.use(http.delete('/api/v1/downtimes/1', () => { deleted = true; return new HttpResponse(null, { status: 204 }) }))
    renderTab(true)

    await userEvent.click(await screen.findByRole('button', { name: /delete this downtime/i }))

    await waitFor(() => expect(deleted).toBe(true))
    expect(window.confirm).toHaveBeenCalled()
  })

  it('says so, instead of an empty list, when it cannot be loaded', async () => {
    server.use(http.get('/api/v1/assets/7/downtimes', () => HttpResponse.json({ error: { message: 'x' } }, { status: 500 })))
    renderTab(false)

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument()
  })
})
