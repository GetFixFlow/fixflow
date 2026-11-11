import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { DirectorySettingsPage } from '../DirectorySettingsPage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const CALLBACK = 'https://fixflow.acme.test/api/v1/auth/oidc/callback'

const empty = {
  oidc_enabled: false, oidc_label: 'Company account', oidc_issuer: null, oidc_client_id: null, oidc_scopes: 'openid email profile',
  oidc_groups_claim: 'groups', oidc_trust_email: false,
  ldap_enabled: false, ldap_host: null, ldap_port: 389, ldap_encryption: 'starttls', ldap_verify_certificate: true, ldap_ca_certificate: null,
  ldap_bind_dn: null, ldap_user_base: null, ldap_user_filter: '(objectClass=person)', ldap_login_attributes: 'mail,uid,sAMAccountName,userPrincipalName',
  ldap_email_attribute: 'mail', ldap_first_name_attribute: 'givenName', ldap_last_name_attribute: 'sn', ldap_id_attribute: 'entryUUID',
  ldap_groups_attribute: 'memberOf', ldap_group_base: null,
  create_people: true, sync_roles: true, default_role: null, role_groups: {},
  oidc_secret_set: false, ldap_password_set: false, roles: ['admin', 'manager', 'technician', 'requester'],
}
const saved = {
  ...empty, oidc_enabled: true, oidc_issuer: 'https://keycloak.acme.test/realms/acme', oidc_client_id: 'fixflow', oidc_secret_set: true,
  ldap_password_set: true, role_groups: { admin: ['fixflow-admins', 'it-leads'], technician: ['crew'] },
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DirectorySettingsPage />
    </QueryClientProvider>,
  )
}

/** The server's side: what it has saved, and a record of what it was sent. */
function serve(settings: object) {
  const sent: { patch?: { settings: Record<string, unknown> }; test?: Record<string, unknown>; deleted?: boolean } = {}
  server.use(
    http.get('/api/v1/directory_settings', () => HttpResponse.json({ settings, callback_url: CALLBACK })),
    http.patch('/api/v1/directory_settings', async ({ request }) => {
      sent.patch = (await request.json()) as { settings: Record<string, unknown> }
      return HttpResponse.json({ settings, callback_url: CALLBACK })
    }),
    http.delete('/api/v1/directory_settings', () => {
      sent.deleted = true
      return HttpResponse.json({ settings: empty, callback_url: CALLBACK })
    }),
  )
  return sent
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('DirectorySettingsPage', () => {
  it('starts with everything off and the default settings filled in', async () => {
    serve(empty)
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: /company sign-in/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/offer "sign in with"/i)).not.toBeChecked()
    expect(screen.getByLabelText(/sign people in through the directory server/i)).not.toBeChecked()
    expect(screen.getByLabelText(/^scopes$/i)).toHaveValue('openid email profile')
    expect(screen.getByLabelText(/^port$/i)).toHaveValue(389)
    expect(screen.getByLabelText(/people sign in with|what people sign in with/i)).toHaveValue('mail,uid,sAMAccountName,userPrincipalName')
    expect(screen.getByLabelText(/create an account|make an account/i)).toBeChecked()
    expect(screen.getByLabelText(/role follows the groups/i)).toBeChecked()
  })

  it('shows the redirect address to register at the provider', async () => {
    serve(empty)
    renderPage()

    expect(await screen.findByLabelText(/redirect address to register/i)).toHaveValue(CALLBACK)
    expect(screen.getByLabelText(/redirect address to register/i)).toHaveAttribute('readonly')
  })

  it('never shows a secret, and says a saved one is kept when left blank', async () => {
    serve(saved)
    renderPage()

    const secret = await screen.findByLabelText(/client secret/i)
    expect(secret).toHaveValue('')
    expect(secret).toHaveAttribute('type', 'password')
    expect(secret).toHaveAttribute('placeholder', expect.stringMatching(/saved.*leave blank/i))
    expect(screen.getByLabelText(/service account password/i)).toHaveAttribute('placeholder', expect.stringMatching(/saved/i))
  })

  it('puts each role\'s groups one to a line', async () => {
    serve(saved)
    renderPage()

    expect(await screen.findByLabelText(/groups that give the administrator role/i)).toHaveValue('fixflow-admins\nit-leads')
    expect(screen.getByLabelText(/groups that give the technician role/i)).toHaveValue('crew')
    expect(screen.getByLabelText(/groups that give the manager role/i)).toHaveValue('')
  })

  it('saves what the form holds, the groups as text, and no secret when none was typed', async () => {
    const user = userEvent.setup()
    const sent = serve(saved)
    renderPage()

    await user.clear(await screen.findByLabelText(/name of the account on the sign-in button/i))
    await user.type(screen.getByLabelText(/name of the account on the sign-in button/i), 'Acme')
    await user.type(screen.getByLabelText(/groups that give the manager role/i), 'leads')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(sent.patch).toBeDefined())
    const body = sent.patch!.settings
    expect(body).toMatchObject({
      oidc_enabled: true, oidc_label: 'Acme', oidc_issuer: 'https://keycloak.acme.test/realms/acme', oidc_client_id: 'fixflow',
      role_groups: { admin: 'fixflow-admins\nit-leads', manager: 'leads', technician: 'crew', requester: '' },
    })
    expect(body).not.toHaveProperty('oidc_client_secret')
    expect(body).not.toHaveProperty('ldap_bind_password')
    expect(body).not.toHaveProperty('oidc_secret_set')
    expect(body).not.toHaveProperty('roles')
  })

  it('sends a secret once it is typed', async () => {
    const user = userEvent.setup()
    const sent = serve(saved)
    renderPage()

    await user.type(await screen.findByLabelText(/client secret/i), 'new-secret')
    await user.type(screen.getByLabelText(/service account password/i), 'bind-pass')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(sent.patch).toBeDefined())
    expect(sent.patch!.settings).toMatchObject({ oidc_client_secret: 'new-secret', ldap_bind_password: 'bind-pass' })
  })

  it('will not save while turned on with nobody able to get a role', async () => {
    const user = userEvent.setup()
    serve(empty)
    renderPage()

    await user.click(await screen.findByLabelText(/offer "sign in with"/i))

    expect(screen.getByRole('alert')).toHaveTextContent(/name the groups for at least one role/i)
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()

    await user.selectOptions(screen.getByLabelText(/role for people in none of these groups/i), 'requester')
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled()
  })

  it('warns about a server with no encryption', async () => {
    const user = userEvent.setup()
    serve(empty)
    renderPage()

    await user.selectOptions(await screen.findByLabelText(/^encryption$/i), 'none')

    expect(screen.getByRole('alert')).toHaveTextContent(/passwords cross the network in the clear/i)
  })

  describe('Check', () => {
    it('checks the provider with the settings in the form, and says it answered', async () => {
      const user = userEvent.setup()
      serve(saved)
      let sent: Record<string, unknown> | undefined
      server.use(
        http.post('/api/v1/directory_settings/test', async ({ request }) => {
          sent = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({ issuer: 'https://keycloak.acme.test/realms/acme', keys: 2, redirect_uri: CALLBACK, pkce: true })
        }),
      )
      renderPage()

      await user.click((await screen.findAllByRole('button', { name: /^check$/i }))[0])

      expect(await screen.findByRole('status')).toHaveTextContent(/the provider answered.*keycloak\.acme\.test.*2 signing keys/i)
      expect(sent).toMatchObject({ kind: 'oidc', settings: { oidc_client_id: 'fixflow' } })
      expect(sent!.settings).not.toHaveProperty('oidc_client_secret')
    })

    it('shows the server\'s reason next to the button when the provider cannot be reached', async () => {
      const user = userEvent.setup()
      serve(saved)
      server.use(
        http.post('/api/v1/directory_settings/test', () =>
          HttpResponse.json({ error: { code: 'DIRECTORY_TEST_FAILED', message: 'Could not reach keycloak.acme.test: connection refused' } }, { status: 422 })),
      )
      renderPage()

      await user.click((await screen.findAllByRole('button', { name: /^check$/i }))[0])

      expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach keycloak\.acme\.test: connection refused/i)
    })

    it('checks the directory server and says how many people it finds', async () => {
      const user = userEvent.setup()
      serve(saved)
      server.use(
        http.post('/api/v1/directory_settings/test', () =>
          HttpResponse.json({ host: 'ldap.acme.test', port: 389, encryption: 'starttls', people_found: 12, more_than_listed: false })),
      )
      renderPage()

      await user.click((await screen.findAllByRole('button', { name: /^check$/i }))[1])

      expect(await screen.findByRole('status')).toHaveTextContent(/connected to ldap\.acme\.test:389\. 12 people found/i)
    })
  })

  describe('Try a person', () => {
    function serveTry(person: object) {
      let sent: Record<string, unknown> | undefined
      server.use(
        http.post('/api/v1/directory_settings/test', async ({ request }) => {
          sent = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({ host: 'ldap.acme.test', port: 389, encryption: 'starttls', people_found: 1, more_than_listed: false, person })
        }),
      )
      return () => sent
    }

    it('shows the person found, their groups, and the role they would get', async () => {
      const user = userEvent.setup()
      serve(saved)
      const sent = serveTry({ found: true, email: 'jo@acme.test', first_name: 'Jo', last_name: 'Reyes', groups: ['cn=fixflow-admins,dc=acme'], role: 'admin' })
      renderPage()

      await user.type(await screen.findByLabelText(/^login$/i), 'jo')
      await user.type(screen.getByLabelText(/^password$/i), 'jo-pass')
      await user.click(screen.getByRole('button', { name: /^try$/i }))

      const result = await screen.findByRole('status')
      expect(result).toHaveTextContent('Found Jo Reyes (jo@acme.test).')
      expect(result).toHaveTextContent('Groups: cn=fixflow-admins,dc=acme')
      expect(result).toHaveTextContent('Would sign in as: Administrator.')
      expect(sent()).toMatchObject({ kind: 'ldap', login: 'jo', password: 'jo-pass' })
    })

    it('says so when the person would be turned away', async () => {
      const user = userEvent.setup()
      serve(saved)
      serveTry({ found: true, email: 'jo@acme.test', first_name: 'Jo', last_name: 'Reyes', groups: [], role: null })
      renderPage()

      await user.type(await screen.findByLabelText(/^login$/i), 'jo')
      await user.type(screen.getByLabelText(/^password$/i), 'x')
      await user.click(screen.getByRole('button', { name: /^try$/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/would be turned away/i)
      expect(screen.getByText(/no groups/i)).toBeInTheDocument()
    })

    it('says so when the person is not found or the password is wrong', async () => {
      const user = userEvent.setup()
      serve(saved)
      serveTry({ found: false })
      renderPage()

      await user.type(await screen.findByLabelText(/^login$/i), 'nobody')
      await user.type(screen.getByLabelText(/^password$/i), 'x')
      await user.click(screen.getByRole('button', { name: /^try$/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/not found, or the password is wrong/i)
    })

    it('needs a login and a password before it tries, and keeps the password hidden', async () => {
      serve(saved)
      renderPage()

      expect(await screen.findByRole('button', { name: /^try$/i })).toBeDisabled()
      expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password')
    })
  })

  describe('Remove', () => {
    it('asks first, then removes', async () => {
      const user = userEvent.setup()
      const sent = serve(saved)
      renderPage()

      await user.click(await screen.findByRole('button', { name: /remove company sign-in/i }))

      expect(window.confirm).toHaveBeenCalled()
      await waitFor(() => expect(sent.deleted).toBe(true))
    })

    it('does nothing when the administrator says no', async () => {
      const user = userEvent.setup()
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const sent = serve(saved)
      renderPage()

      await user.click(await screen.findByRole('button', { name: /remove company sign-in/i }))

      expect(sent.deleted).toBeUndefined()
    })
  })

  it('says so, and offers to try again, when the settings cannot be loaded', async () => {
    server.use(http.get('/api/v1/directory_settings', () => HttpResponse.json({}, { status: 500 })))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i)
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
