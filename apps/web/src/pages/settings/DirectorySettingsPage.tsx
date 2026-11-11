import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosError } from 'axios'
import { Copy } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, type InputProps } from '@/components/ui/Input'
import { Card, CardContent, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useDirectorySettings, useRemoveDirectorySettings, useTestDirectory, useUpdateDirectorySettings } from '@/hooks/useDirectory'
import { label } from '@/i18n'
import type { DirectoryChanges, DirectoryForm, DirectoryRole, LdapCheck, OidcCheck } from '@/api/directory'

const ROLES: DirectoryRole[] = ['admin', 'manager', 'technician', 'requester']
const FIELD = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800'
const LABEL = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300'
const HELP = 'mt-1 text-xs text-gray-500 dark:text-gray-400'

/** What the form holds: the saved settings as text for the fields, the secrets only once typed, and each role's groups one to a line. */
interface FormState extends Omit<DirectoryForm, 'role_groups' | 'oidc_secret_set' | 'ldap_password_set' | 'roles'> {
  oidc_client_secret: string
  ldap_bind_password: string
  role_text: Record<DirectoryRole, string>
}

type Outcome = { ok: boolean; message: string }

const serverMessage = (error: unknown, fallback: string) =>
  (error as AxiosError<{ error?: { message?: string } }>).response?.data?.error?.message ?? fallback

function formFrom(saved: DirectoryForm): FormState {
  const rest: Record<string, unknown> = { ...saved }
  for (const key of ['role_groups', 'oidc_secret_set', 'ldap_password_set', 'roles']) delete rest[key]
  const role_groups = saved.role_groups
  return {
    ...(rest as Omit<FormState, 'oidc_client_secret' | 'ldap_bind_password' | 'role_text'>),
    oidc_issuer: saved.oidc_issuer ?? '',
    oidc_client_id: saved.oidc_client_id ?? '',
    ldap_host: saved.ldap_host ?? '',
    ldap_ca_certificate: saved.ldap_ca_certificate ?? '',
    ldap_bind_dn: saved.ldap_bind_dn ?? '',
    ldap_user_base: saved.ldap_user_base ?? '',
    ldap_group_base: saved.ldap_group_base ?? '',
    default_role: saved.default_role ?? null,
    oidc_client_secret: '',
    ldap_bind_password: '',
    role_text: Object.fromEntries(ROLES.map((r) => [r, (role_groups?.[r] ?? []).join('\n')])) as Record<DirectoryRole, string>,
  }
}

/** What is sent to save: the form, with a secret only when one was typed (blank keeps the saved one). */
function changesFrom(form: FormState): DirectoryChanges {
  const { oidc_client_secret, ldap_bind_password, role_text, ...rest } = form
  const changes: DirectoryChanges = { ...rest, role_groups: role_text }
  if (oidc_client_secret) changes.oidc_client_secret = oidc_client_secret
  if (ldap_bind_password) changes.ldap_bind_password = ldap_bind_password
  return changes
}

function TextField({ id, help, ...props }: InputProps & { id: string; help?: string }) {
  return (
    <div>
      <Input id={id} aria-describedby={help ? `${id}-help` : undefined} {...props} />
      {help && <p id={`${id}-help`} className={HELP}>{help}</p>}
    </div>
  )
}

function Check({ id, checked, onChange, children, help }: { id: string; checked: boolean; onChange: (on: boolean) => void; children: React.ReactNode; help?: string }) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <input id={id} type="checkbox" className="rounded" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-describedby={help ? `${id}-help` : undefined} />
        {children}
      </label>
      {help && <p id={`${id}-help`} className={`${HELP} ml-6`}>{help}</p>}
    </div>
  )
}

function OutcomeLine({ outcome }: { outcome: Outcome | null }) {
  if (!outcome) return null
  return (
    <p role={outcome.ok ? 'status' : 'alert'} className={`text-sm ${outcome.ok ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}`}>
      {outcome.message}
    </p>
  )
}

function DirectoryFormView({ saved, callbackUrl }: { saved: DirectoryForm; callbackUrl: string }) {
  const { t } = useTranslation()
  const update = useUpdateDirectorySettings()
  const remove = useRemoveDirectorySettings()
  const test = useTestDirectory()
  const [form, setForm] = useState<FormState>(() => formFrom(saved))
  const [oidcResult, setOidcResult] = useState<Outcome | null>(null)
  const [ldapResult, setLdapResult] = useState<Outcome | null>(null)
  const [personResult, setPersonResult] = useState<Outcome[] | null>(null)
  const [person, setPerson] = useState({ login: '', password: '' })
  const [copied, setCopied] = useState(false)

  const set = (changes: Partial<FormState>) => setForm((f) => ({ ...f, ...changes }))
  const setRole = (role: DirectoryRole, text: string) => setForm((f) => ({ ...f, role_text: { ...f.role_text, [role]: text } }))

  const someoneCanGetARole = form.default_role != null || ROLES.some((r) => form.role_text[r].trim() !== '')
  const problem = (form.oidc_enabled || form.ldap_enabled) && !someoneCanGetARole ? t('directory.roles.nobody_warning') : null

  const check = (kind: 'oidc' | 'ldap') => {
    const setResult = kind === 'oidc' ? setOidcResult : setLdapResult
    test.mutate(
      { kind, settings: changesFrom(form) },
      {
        onSuccess: (r) => {
          if (kind === 'oidc') {
            const o = r as OidcCheck
            setResult({ ok: true, message: t('directory.oidc.check_ok', { issuer: o.issuer, keys: o.keys }) })
          } else {
            const l = r as LdapCheck
            const count = t('directory.ldap.check_ok', { host: l.host, port: l.port, count: l.people_found })
            setResult({ ok: true, message: l.more_than_listed ? `${count} ${t('directory.ldap.check_more')}` : count })
          }
        },
        onError: (e) => setResult({ ok: false, message: serverMessage(e, t(kind === 'oidc' ? 'directory.oidc.check_failed' : 'directory.ldap.check_failed')) }),
      },
    )
  }

  const tryPerson = () =>
    test.mutate(
      { kind: 'ldap', settings: changesFrom(form), person },
      {
        onSuccess: (r) => {
          const found = r.person
          if (!found || !found.found) return setPersonResult([{ ok: false, message: t('directory.try.not_found') }])
          const lines: Outcome[] = [
            { ok: true, message: t('directory.try.found', { name: `${found.first_name} ${found.last_name}`.trim(), email: found.email }) },
            { ok: true, message: found.groups.length ? t('directory.try.groups', { groups: found.groups.join('; ') }) : t('directory.try.no_groups') },
            found.role
              ? { ok: true, message: t('directory.try.role', { role: label('role', found.role) }) }
              : { ok: false, message: t('directory.try.turned_away') },
          ]
          setPersonResult(lines)
        },
        onError: (e) => setPersonResult([{ ok: false, message: serverMessage(e, t('directory.try.failed')) }]),
      },
    )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(callbackUrl)
      setCopied(true)
    } catch {
      setCopied(false) // the address is on the screen to select by hand
    }
  }

  const forget = () => {
    if (!confirm(t('directory.actions.remove_confirm'))) return
    remove.mutate(undefined)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t('directory.page.title')} description={t('directory.page.description')} />
      <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
        {t('directory.page.note')}
      </p>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <CardTitle>{t('directory.oidc.title')}</CardTitle>
            <p className={HELP}>{t('directory.oidc.help')}</p>
          </div>
          <Check id="dir-oidc-enabled" checked={form.oidc_enabled} onChange={(on) => set({ oidc_enabled: on })}>{t('directory.oidc.enabled')}</Check>
          <TextField id="dir-oidc-label" label={t('directory.oidc.label')} help={t('directory.oidc.label_help')} value={form.oidc_label} onChange={(e) => set({ oidc_label: e.target.value })} />
          <TextField id="dir-oidc-issuer" label={t('directory.oidc.issuer')} help={t('directory.oidc.issuer_help')} placeholder="https://" value={form.oidc_issuer ?? ''} onChange={(e) => set({ oidc_issuer: e.target.value })} />
          <TextField id="dir-oidc-client-id" label={t('directory.oidc.client_id')} autoComplete="off" value={form.oidc_client_id ?? ''} onChange={(e) => set({ oidc_client_id: e.target.value })} />
          <TextField
            id="dir-oidc-secret"
            type="password"
            autoComplete="off"
            label={t('directory.oidc.client_secret')}
            help={t('directory.oidc.secret_help')}
            placeholder={saved.oidc_secret_set ? t('directory.oidc.secret_saved') : ''}
            value={form.oidc_client_secret}
            onChange={(e) => set({ oidc_client_secret: e.target.value })}
          />
          <TextField id="dir-oidc-scopes" label={t('directory.oidc.scopes')} value={form.oidc_scopes} onChange={(e) => set({ oidc_scopes: e.target.value })} />
          <TextField id="dir-oidc-groups" label={t('directory.oidc.groups_claim')} help={t('directory.oidc.groups_claim_help')} value={form.oidc_groups_claim} onChange={(e) => set({ oidc_groups_claim: e.target.value })} />
          <Check id="dir-oidc-trust" checked={form.oidc_trust_email} onChange={(on) => set({ oidc_trust_email: on })} help={t('directory.oidc.trust_email_help')}>
            {t('directory.oidc.trust_email')}
          </Check>

          <div>
            <label htmlFor="dir-oidc-redirect" className={LABEL}>{t('directory.oidc.redirect')}</label>
            <div className="flex gap-2">
              <input id="dir-oidc-redirect" readOnly value={callbackUrl} aria-describedby="dir-oidc-redirect-help" className={`${FIELD} font-mono`} />
              <Button type="button" variant="outline" onClick={copy}>
                <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {copied ? t('directory.oidc.copied') : t('directory.oidc.copy')}
              </Button>
            </div>
            <p id="dir-oidc-redirect-help" className={HELP}>{t('directory.oidc.redirect_help')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={() => { setOidcResult(null); check('oidc') }} disabled={test.isPending}>
              {test.isPending && test.variables?.kind === 'oidc' ? t('directory.oidc.checking') : t('directory.oidc.check')}
            </Button>
            <OutcomeLine outcome={oidcResult} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <CardTitle>{t('directory.ldap.title')}</CardTitle>
            <p className={HELP}>{t('directory.ldap.help')}</p>
          </div>
          <Check id="dir-ldap-enabled" checked={form.ldap_enabled} onChange={(on) => set({ ldap_enabled: on })}>{t('directory.ldap.enabled')}</Check>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <TextField id="dir-ldap-host" label={t('directory.ldap.host')} placeholder="ldap.example.com" value={form.ldap_host ?? ''} onChange={(e) => set({ ldap_host: e.target.value })} />
            </div>
            <TextField id="dir-ldap-port" type="number" label={t('directory.ldap.port')} value={String(form.ldap_port)} onChange={(e) => set({ ldap_port: Number(e.target.value) })} />
          </div>
          <div>
            <label htmlFor="dir-ldap-encryption" className={LABEL}>{t('directory.ldap.encryption')}</label>
            <select
              id="dir-ldap-encryption"
              className={FIELD}
              value={form.ldap_encryption}
              aria-describedby={form.ldap_encryption === 'none' ? 'dir-ldap-encryption-warning' : undefined}
              onChange={(e) => set({ ldap_encryption: e.target.value as FormState['ldap_encryption'] })}
            >
              <option value="none">{t('directory.ldap.encryption_none')}</option>
              <option value="starttls">{t('directory.ldap.encryption_starttls')}</option>
              <option value="ssl">{t('directory.ldap.encryption_ssl')}</option>
            </select>
            {form.ldap_encryption === 'none' && (
              <p id="dir-ldap-encryption-warning" role="alert" className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t('directory.ldap.encryption_none_warning')}</p>
            )}
          </div>
          <Check id="dir-ldap-verify" checked={form.ldap_verify_certificate} onChange={(on) => set({ ldap_verify_certificate: on })} help={t('directory.ldap.verify_help')}>
            {t('directory.ldap.verify')}
          </Check>
          <div>
            <label htmlFor="dir-ldap-ca" className={LABEL}>{t('directory.ldap.ca')}</label>
            <textarea id="dir-ldap-ca" rows={4} className={`${FIELD} font-mono text-xs`} aria-describedby="dir-ldap-ca-help" value={form.ldap_ca_certificate ?? ''} onChange={(e) => set({ ldap_ca_certificate: e.target.value })} />
            <p id="dir-ldap-ca-help" className={HELP}>{t('directory.ldap.ca_help')}</p>
          </div>
          <TextField id="dir-ldap-bind-dn" label={t('directory.ldap.bind_dn')} help={t('directory.ldap.bind_dn_help')} autoComplete="off" value={form.ldap_bind_dn ?? ''} onChange={(e) => set({ ldap_bind_dn: e.target.value })} />
          <TextField
            id="dir-ldap-bind-password"
            type="password"
            autoComplete="off"
            label={t('directory.ldap.bind_password')}
            placeholder={saved.ldap_password_set ? t('directory.oidc.secret_saved') : ''}
            value={form.ldap_bind_password}
            onChange={(e) => set({ ldap_bind_password: e.target.value })}
          />
          <TextField id="dir-ldap-user-base" label={t('directory.ldap.user_base')} help={t('directory.ldap.user_base_help')} value={form.ldap_user_base ?? ''} onChange={(e) => set({ ldap_user_base: e.target.value })} />
          <TextField id="dir-ldap-user-filter" label={t('directory.ldap.user_filter')} value={form.ldap_user_filter} onChange={(e) => set({ ldap_user_filter: e.target.value })} />
          <TextField id="dir-ldap-login" label={t('directory.ldap.login_attributes')} help={t('directory.ldap.login_attributes_help')} value={form.ldap_login_attributes} onChange={(e) => set({ ldap_login_attributes: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField id="dir-ldap-email" label={t('directory.ldap.email_attribute')} value={form.ldap_email_attribute} onChange={(e) => set({ ldap_email_attribute: e.target.value })} />
            <TextField id="dir-ldap-first" label={t('directory.ldap.first_name_attribute')} value={form.ldap_first_name_attribute} onChange={(e) => set({ ldap_first_name_attribute: e.target.value })} />
            <TextField id="dir-ldap-last" label={t('directory.ldap.last_name_attribute')} value={form.ldap_last_name_attribute} onChange={(e) => set({ ldap_last_name_attribute: e.target.value })} />
          </div>
          <TextField id="dir-ldap-id" label={t('directory.ldap.id_attribute')} help={t('directory.ldap.id_attribute_help')} value={form.ldap_id_attribute} onChange={(e) => set({ ldap_id_attribute: e.target.value })} />
          <TextField id="dir-ldap-groups" label={t('directory.ldap.groups_attribute')} help={t('directory.ldap.groups_attribute_help')} value={form.ldap_groups_attribute} onChange={(e) => set({ ldap_groups_attribute: e.target.value })} />
          <TextField id="dir-ldap-group-base" label={t('directory.ldap.group_base')} help={t('directory.ldap.group_base_help')} value={form.ldap_group_base ?? ''} onChange={(e) => set({ ldap_group_base: e.target.value })} />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={() => { setLdapResult(null); check('ldap') }} disabled={test.isPending}>
              {test.isPending && test.variables?.kind === 'ldap' && !test.variables.person ? t('directory.ldap.checking') : t('directory.ldap.check')}
            </Button>
            <OutcomeLine outcome={ldapResult} />
          </div>

          <fieldset className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-gray-200">{t('directory.try.title')}</legend>
            <p className={HELP}>{t('directory.try.help')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField id="dir-try-login" label={t('directory.try.login')} autoComplete="off" value={person.login} onChange={(e) => setPerson((p) => ({ ...p, login: e.target.value }))} />
              <TextField id="dir-try-password" type="password" label={t('directory.try.password')} autoComplete="off" value={person.password} onChange={(e) => setPerson((p) => ({ ...p, password: e.target.value }))} />
            </div>
            <Button type="button" variant="outline" onClick={() => { setPersonResult(null); tryPerson() }} disabled={test.isPending || person.login.trim() === '' || person.password === ''}>
              {test.isPending && test.variables?.person ? t('directory.try.trying') : t('directory.try.button')}
            </Button>
            {personResult && (
              <div role={personResult.every((l) => l.ok) ? 'status' : 'alert'} className="space-y-0.5">
                {personResult.map((line) => (
                  <p key={line.message} className={`text-sm ${line.ok ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}`}>{line.message}</p>
                ))}
              </div>
            )}
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <CardTitle>{t('directory.roles.title')}</CardTitle>
            <p className={HELP}>{t('directory.roles.help')}</p>
          </div>
          {ROLES.map((role) => (
            <div key={role}>
              <label htmlFor={`dir-roles-${role}`} className={LABEL}>{t('directory.roles.groups_for', { role: label('role', role) })}</label>
              <textarea id={`dir-roles-${role}`} rows={2} className={FIELD} value={form.role_text[role]} onChange={(e) => setRole(role, e.target.value)} />
            </div>
          ))}
          <div>
            <label htmlFor="dir-roles-default" className={LABEL}>{t('directory.roles.default')}</label>
            <select id="dir-roles-default" className={FIELD} aria-describedby="dir-roles-default-help" value={form.default_role ?? ''} onChange={(e) => set({ default_role: (e.target.value || null) as DirectoryRole | null })}>
              <option value="">{t('directory.roles.default_none')}</option>
              {ROLES.map((role) => <option key={role} value={role}>{label('role', role)}</option>)}
            </select>
            <p id="dir-roles-default-help" className={HELP}>{t('directory.roles.default_help')}</p>
          </div>
          <Check id="dir-create-people" checked={form.create_people} onChange={(on) => set({ create_people: on })} help={t('directory.roles.create_people_help')}>{t('directory.roles.create_people')}</Check>
          <Check id="dir-sync-roles" checked={form.sync_roles} onChange={(on) => set({ sync_roles: on })} help={t('directory.roles.sync_roles_help')}>{t('directory.roles.sync_roles')}</Check>
          {problem && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{problem}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => update.mutate(changesFrom(form), { onSuccess: () => set({ oidc_client_secret: '', ldap_bind_password: '' }) })} disabled={!!problem || update.isPending}>
              {update.isPending ? t('directory.actions.saving') : t('directory.actions.save')}
            </Button>
            <Button type="button" variant="ghost" onClick={forget} disabled={remove.isPending} className="text-red-600 dark:text-red-400">
              {remove.isPending ? t('directory.actions.removing') : t('directory.actions.remove')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function DirectorySettingsPage() {
  const { t } = useTranslation()
  const { data, isLoading, refetch } = useDirectorySettings()

  if (isLoading) return <Skeleton className="h-64 max-w-3xl" />
  if (!data) {
    return (
      <div className="max-w-3xl space-y-3">
        <PageHeader title={t('directory.page.title')} description={t('directory.page.description')} />
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t('directory.page.load_failed')}</p>
        <Button variant="outline" onClick={() => refetch()}>{t('directory.page.try_again')}</Button>
      </div>
    )
  }
  // A new form when the server's copy changes (saved, removed): it starts from what is really saved.
  return <DirectoryFormView key={JSON.stringify(data.settings)} saved={data.settings} callbackUrl={data.callback_url} />
}
