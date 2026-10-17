import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { WorkRequestPortalPage } from '../WorkRequestPortalPage'
import { rememberRequest } from '@/lib/recentRequests'

const TOKEN = 'abcdefghijklmnopqrstuv'

function renderPortal(url = '/request') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <WorkRequestPortalPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Answers the create call and keeps what was sent. */
function captureCreate(response: () => Response | Promise<Response> = () => HttpResponse.json({ data: {}, token: TOKEN }, { status: 201 })) {
  const sent: { body?: { work_request: Record<string, unknown> } } = {}
  server.use(
    http.post('/api/v1/work_requests', async ({ request }) => {
      sent.body = (await request.json()) as { work_request: Record<string, unknown> }
      return response()
    }),
  )
  return sent
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, { location = true } = {}) {
  await user.type(screen.getByLabelText(/your name/i), 'Kamal Perera')
  if (location) await user.type(screen.getByLabelText(/^location/i), 'Block B, floor 2')
  await user.type(screen.getByLabelText(/what is the problem/i), 'The door will not close properly')
  await user.click(screen.getByRole('button', { name: /submit request/i }))
}

describe('WorkRequestPortalPage', () => {
  beforeEach(() => {
    localStorage.clear()
    server.use(http.get('/api/v1/public_request_form', () => HttpResponse.json({ data: { open: true } })))
  })

  it('sends the request and shows the link to follow it', async () => {
    const user = userEvent.setup()
    const sent = captureCreate()
    renderPortal()

    await fillAndSubmit(user)

    expect(await screen.findByText(/request submitted/i)).toBeInTheDocument()
    expect(sent.body?.work_request).toMatchObject({
      requester_name: 'Kamal Perera',
      location_description: 'Block B, floor 2',
      description: 'The door will not close properly',
    })
    expect(screen.getByText(`${window.location.origin}/request/${TOKEN}`)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /check status/i })).toHaveAttribute('href', `/request/${TOKEN}`)
  })

  it('needs no email, and sends none when it is left empty', async () => {
    const user = userEvent.setup()
    const sent = captureCreate()
    renderPortal()

    await fillAndSubmit(user)

    await screen.findByText(/request submitted/i)
    expect(sent.body?.work_request.requester_email).toBeUndefined()
  })

  it('does not fill in the hidden trap field, which stays out of reach of the keyboard', async () => {
    const user = userEvent.setup()
    const sent = captureCreate()
    renderPortal()

    const trap = document.getElementById('leave_empty') as HTMLInputElement
    expect(trap.tabIndex).toBe(-1)
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull()

    await fillAndSubmit(user)

    await screen.findByText(/request submitted/i)
    expect(sent.body?.work_request.leave_empty).toBeUndefined()
  })

  it('keeps the link on this device so the person can find the request again', async () => {
    const user = userEvent.setup()
    captureCreate()
    const { unmount } = renderPortal()

    await fillAndSubmit(user)
    await screen.findByText(/request submitted/i)
    unmount()
    renderPortal()

    expect(screen.getByRole('link', { name: /the door will not close properly/i })).toHaveAttribute(
      'href',
      `/request/${TOKEN}`,
    )
  })

  describe('from a QR label', () => {
    it('says which equipment is being reported, asks nothing about where it is, and sends the code', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/public_assets/CODE123', () =>
          HttpResponse.json({ data: { name: 'Pump 3', asset_tag: 'FF-000012', location: 'Boiler room' } }),
        ),
      )
      const sent = captureCreate()
      renderPortal('/request?asset=CODE123')

      expect(await screen.findByText('Pump 3')).toBeInTheDocument()
      expect(screen.getByText(/FF-000012 · Boiler room/)).toBeInTheDocument()
      expect(screen.queryByLabelText(/^location/i)).not.toBeInTheDocument()

      await fillAndSubmit(user, { location: false })

      await screen.findByText(/request submitted/i)
      expect(sent.body?.work_request).toMatchObject({ asset_code: 'CODE123' })
      expect(sent.body?.work_request.asset_description).toBeUndefined()
    })

    it('copes with a label that is not recognised: says so, asks for the place, and sends no code', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/public_assets/OLDCODE', () =>
          HttpResponse.json({ error: { code: 'RESOURCE_NOT_FOUND' } }, { status: 404 }),
        ),
      )
      const sent = captureCreate()
      renderPortal('/request?asset=OLDCODE')

      expect(await screen.findByRole('alert')).toHaveTextContent(/not recognised/i)

      await fillAndSubmit(user)

      await screen.findByText(/request submitted/i)
      expect(sent.body?.work_request.asset_code).toBeUndefined()
      expect(sent.body?.work_request.location_description).toBe('Block B, floor 2')
    })
  })

  describe('when sending fails, never says it worked', () => {
    it.each([
      ['the server refuses the details', 422, { error: { message: 'Description is too short' } }, /description is too short/i],
      ['too many requests', 429, { error: { code: 'RATE_LIMITED' } }, /too many requests/i],
      ['the request is too large', 413, { error: { code: 'PAYLOAD_TOO_LARGE' } }, /too long/i],
      ['the server breaks', 500, { error: { code: 'INTERNAL_ERROR' } }, /was not sent/i],
    ])('%s', async (_name, status, body, message) => {
      const user = userEvent.setup()
      captureCreate(() => HttpResponse.json(body, { status }))
      renderPortal()

      await fillAndSubmit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(screen.queryByText(/request submitted/i)).not.toBeInTheDocument()
      expect(localStorage.getItem('fixflow_recent_requests')).toBeNull()
    })

    it('when the server cannot be reached', async () => {
      const user = userEvent.setup()
      captureCreate(() => HttpResponse.error())
      renderPortal()

      await fillAndSubmit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i)
      expect(screen.queryByText(/request submitted/i)).not.toBeInTheDocument()
    })

    it('keeps what was typed so the person can try again', async () => {
      const user = userEvent.setup()
      captureCreate(() => HttpResponse.json({}, { status: 500 }))
      renderPortal()

      await fillAndSubmit(user)

      await screen.findByRole('alert')
      expect(screen.getByLabelText(/what is the problem/i)).toHaveValue('The door will not close properly')
    })
  })

  it('checks the form before sending anything', async () => {
    const user = userEvent.setup()
    const sent = captureCreate()
    renderPortal()

    await user.type(screen.getByLabelText(/your name/i), 'K')
    await user.type(screen.getByLabelText(/what is the problem/i), 'broken')
    await user.type(screen.getByLabelText(/email/i), 'not an email')
    await user.click(screen.getByRole('button', { name: /submit request/i }))

    await waitFor(() => expect(screen.getByText(/name is required/i)).toBeInTheDocument())
    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument()
    expect(screen.getByText(/valid email/i)).toBeInTheDocument()
    expect(screen.getByText(/location is required/i)).toBeInTheDocument()
    expect(sent.body).toBeUndefined()
  })

  it('does not invent a phone number for emergencies', () => {
    renderPortal()

    expect(screen.queryByText(/ext\. 200/i)).not.toBeInTheDocument()
    expect(screen.getByText(/do not use this form/i)).toBeInTheDocument()
  })

  describe('when an administrator has turned the form off', () => {
    const off = () => HttpResponse.json({ data: { open: false } })

    it('says so instead of showing a form people would fill in for nothing', async () => {
      server.use(http.get('/api/v1/public_request_form', off))
      renderPortal()

      expect(await screen.findByRole('status')).toHaveTextContent('This request form is turned off. Please contact your maintenance team directly.')
      expect(screen.queryByLabelText(/your name/i)).toBeNull()
      expect(screen.queryByRole('button', { name: /submit request/i })).toBeNull()
    })

    it('does not look up the QR label\'s asset (the server would refuse it)', async () => {
      let lookups = 0
      server.use(
        http.get('/api/v1/public_request_form', off),
        http.get('/api/v1/public_assets/:code', () => { lookups += 1; return HttpResponse.json({ data: {} }) }),
      )
      renderPortal('/request?asset=ABCD2345')

      await screen.findByRole('status')
      expect(lookups).toBe(0)
    })

    it('still shows the requests this device made, so people can follow them', async () => {
      rememberRequest({ token: TOKEN, title: 'The door will not close', created_at: new Date().toISOString() })
      server.use(http.get('/api/v1/public_request_form', off))
      renderPortal()

      expect(await screen.findByRole('link', { name: 'The door will not close' })).toHaveAttribute('href', `/request/${TOKEN}`)
    })

    it('shows the same message when it was turned off while someone was typing', async () => {
      const user = userEvent.setup()
      captureCreate(() => HttpResponse.json(
        { success: false, error: { code: 'PUBLIC_REQUESTS_OFF', message: 'This request form is turned off.' } }, { status: 403 },
      ))
      renderPortal()

      await fillAndSubmit(user)

      expect(await screen.findByRole('status')).toHaveTextContent('turned off')
      expect(screen.queryByText(/request submitted/i)).toBeNull()
    })

    it('shows the form as before while it is on', async () => {
      renderPortal()
      expect(await screen.findByLabelText(/your name/i)).toBeInTheDocument()
      expect(screen.queryByText(/turned off/i)).toBeNull()
    })
  })
})
