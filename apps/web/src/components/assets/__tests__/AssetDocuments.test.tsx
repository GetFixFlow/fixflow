import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { apiClient } from '@/api/client'
import { server } from '@/test/server'
import { AssetDocuments } from '../AssetDocuments'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const manual = {
  id: 1, description: 'Operator manual, 2019', filename: 'pump-manual.pdf', content_type: 'application/pdf',
  url: '/api/v1/storage/manual', created_at: '2026-10-20T10:00:00Z', user: { id: 5, full_name: 'Tina Tech' },
}
const nameplate = {
  id: 2, description: null, filename: 'nameplate.png', content_type: 'image/png',
  url: '/api/v1/storage/nameplate', created_at: '2026-10-21T10:00:00Z', user: { id: 6, full_name: 'Manny Manager' },
}

function renderDocuments(canManage: boolean, userId = 5) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><AssetDocuments assetId={7} canManage={canManage} userId={userId} /></QueryClientProvider>)
}

describe('the documents of an asset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    server.use(http.get('/api/v1/assets/7/documents', () => HttpResponse.json({ documents: [manual, nameplate] })))
  })

  it('lists each file with its note and who added it, as a link that opens in a new tab, with a picture for a photo', async () => {
    renderDocuments(false)

    const link = await screen.findByRole('link', { name: 'pump-manual.pdf' })
    expect(link).toHaveAttribute('href', '/api/v1/storage/manual')
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.getByText('Operator manual, 2019')).toBeInTheDocument()
    expect(screen.getByText(/added by tina tech on/i)).toBeInTheDocument()
    expect(document.querySelector('img[src="/api/v1/storage/nameplate"]')).not.toBeNull()
    expect(document.querySelector('img[src="/api/v1/storage/manual"]')).toBeNull()
  })

  it('says so when there is nothing yet', async () => {
    server.use(http.get('/api/v1/assets/7/documents', () => HttpResponse.json({ documents: [] })))
    renderDocuments(false)

    expect(await screen.findByText('No documents yet')).toBeInTheDocument()
  })

  it('offers to remove what the person added, and everything to a manager', async () => {
    const own = renderDocuments(false, 5)
    await screen.findByText('pump-manual.pdf')
    expect(screen.getByRole('button', { name: 'Remove pump-manual.pdf' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove nameplate.png' })).toBeNull()
    own.unmount()

    renderDocuments(true, 99)
    await screen.findByText('pump-manual.pdf')
    expect(screen.getByRole('button', { name: 'Remove pump-manual.pdf' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove nameplate.png' })).toBeInTheDocument()
  })

  it('removes a file after asking', async () => {
    let removed = false
    server.use(http.delete('/api/v1/asset_documents/1', () => { removed = true; return new HttpResponse(null, { status: 204 }) }))
    renderDocuments(false, 5)

    await userEvent.click(await screen.findByRole('button', { name: 'Remove pump-manual.pdf' }))

    await waitFor(() => expect(removed).toBe(true))
    expect(window.confirm).toHaveBeenCalledWith('Remove “pump-manual.pdf” from this asset?')
  })

  it('sends the chosen file with the note', async () => {
    server.use(http.post('/api/v1/assets/7/documents', () => HttpResponse.json({ data: manual }, { status: 201 })))
    const post = vi.spyOn(apiClient, 'post')
    renderDocuments(false)
    await screen.findByText('pump-manual.pdf')

    await userEvent.type(screen.getByLabelText(/note/i), 'Wiring diagram')
    await userEvent.upload(screen.getByLabelText('Choose a file'), new File(['%PDF'], 'wiring.pdf', { type: 'application/pdf' }))

    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][0]).toBe('/assets/7/documents')
    const form = post.mock.calls[0][1] as FormData
    expect((form.get('document[file]') as File).name).toBe('wiring.pdf')
    expect(form.get('description')).toBe('Wiring diagram')
    await waitFor(() => expect(screen.getByLabelText(/note/i)).toHaveValue(''))
  })

  it('does not send a file over 10 MB, and says why', async () => {
    let sent = false
    server.use(http.post('/api/v1/assets/7/documents', () => { sent = true; return HttpResponse.json({ data: manual }, { status: 201 }) }))
    renderDocuments(false)
    await screen.findByText('pump-manual.pdf')
    const big = new File(['x'], 'huge.pdf', { type: 'application/pdf' })
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })

    await userEvent.upload(screen.getByLabelText('Choose a file'), big)

    expect(toast.error).toHaveBeenCalledWith('That file is over 10 MB. Choose a smaller one.')
    expect(sent).toBe(false)
  })

  it("shows the server's reason when it refuses a file", async () => {
    server.use(http.post('/api/v1/assets/7/documents', () =>
      HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'File must be a photo, PDF or Word document' } }, { status: 422 })))
    renderDocuments(false)
    await screen.findByText('pump-manual.pdf')

    await userEvent.upload(screen.getByLabelText('Choose a file'), new File(['MZ'], 'setup.exe', { type: 'application/x-msdownload' }), { applyAccept: false })

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('File must be a photo, PDF or Word document'))
  })

  it('says so, instead of an empty list, when the documents cannot be loaded', async () => {
    server.use(http.get('/api/v1/assets/7/documents', () => HttpResponse.json({ error: { message: 'x' } }, { status: 500 })))
    renderDocuments(false)

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument()
  })
})
