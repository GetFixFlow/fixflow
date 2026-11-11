import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LanguageSelect } from '@/components/ui/LanguageSelect'
import { useLogin, useSetupStatus, useVerifyTwoFactor } from '@/hooks/useAuth'
import { useBranding } from '@/hooks/useSettings'
import { useDirectoryOptions } from '@/hooks/useDirectory'
import { directoryApi } from '@/api/directory'

// With LDAP on, the first field is an email or a username and the directory decides what a good password is (it may be
// shorter than ours), so only something has to be typed; the server answers wrong ones.
const passwordSchema = z.object({
  email: z.string().email('auth.errors.email_required'),
  password: z.string().min(8, 'auth.errors.password_short'),
})
const directorySchema = z.object({
  email: z.string().trim().min(1, 'auth.directory.username_required'),
  password: z.string().min(1, 'auth.directory.password_required'),
})

type FormValues = z.infer<typeof passwordSchema>

// The codes the server sends the browser back with (see Api::V1::Auth::DirectoryController); any other is the general one.
const DIRECTORY_ERRORS = ['not_set_up', 'unreachable', 'denied', 'failed', 'not_allowed', 'no_account', 'deactivated', 'email_not_verified', 'account_conflict']

// What the server sends for a company that never changed its sign-in texts: these are the English defaults, so for that
// company the page uses the translation instead (a text the company wrote itself is shown as written).
const SERVER_DEFAULT_HEADLINE = 'Sign in to FixFlow'
const SERVER_DEFAULT_SUBTITLE = 'Enter your credentials to continue'
const customText = (text: string | null | undefined, serverDefault: string) => (text && text !== serverDefault ? text : null)

export function LoginPage() {
  const { t } = useTranslation()
  // Never in the way: if the question cannot be answered, the password form is all there is.
  const { data: directory } = useDirectoryOptions()
  const ldap = directory?.ldap.enabled === true
  const oidc = directory?.oidc.enabled === true ? directory.oidc : null
  const [searchParams] = useSearchParams()
  const directoryError = searchParams.get('directory_error')
  const resolver = useMemo(() => (ldap ? zodResolver(directorySchema) : zodResolver(passwordSchema)), [ldap])
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver })

  // Set once the password was right for a person who signs in with an authenticator app too.
  const [challenge, setChallenge] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const { mutate: login, isPending } = useLogin({ onChallenge: setChallenge })
  const { mutate: verify, isPending: verifying, error: codeError } = useVerifyTwoFactor()
  const { data: setup } = useSetupStatus()
  const { data: branding } = useBranding()

  // A brand-new install has no company yet: send the first visitor to setup.
  if (setup?.setup_required) return <Navigate to="/setup" replace />

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="fixed right-4 top-4 z-10"><LanguageSelect /></div>
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt={branding.name} className="mb-4 h-12 max-w-[14rem] object-contain" />
          ) : (
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
              <Zap className="h-6 w-6 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {customText(branding?.login_headline, SERVER_DEFAULT_HEADLINE) ?? t('auth.login.headline')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {customText(branding?.login_subtitle, SERVER_DEFAULT_SUBTITLE) ?? t('auth.login.subtitle')}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {directoryError && !challenge && (
            <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {t(`auth.directory.errors.${DIRECTORY_ERRORS.includes(directoryError) ? directoryError : 'failed'}`)}
            </p>
          )}
          {challenge ? (
            <form
              onSubmit={(event) => { event.preventDefault(); verify({ challenge, code }) }}
              className="space-y-4"
            >
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('auth.login.code_help')}
              </p>
              <Input
                id="code"
                label={t('auth.login.code')}
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button type="submit" className="w-full" loading={verifying} disabled={code.trim().length < 6}>
                {t('auth.login.verify')}
              </Button>
              <button
                type="button"
                className="block w-full text-center text-sm text-brand-600 dark:text-brand-400 hover:underline"
                onClick={() => { setChallenge(null); setCode('') }}
              >
                {codeError ? t('auth.login.start_again') : t('auth.back_to_sign_in')}
              </button>
            </form>
          ) : (
          <>
          <form onSubmit={handleSubmit((v) => login(v))} className="space-y-4">
            <Input
              id="email"
              type={ldap ? 'text' : 'email'}
              label={ldap ? t('auth.directory.email_or_username') : t('auth.email')}
              placeholder={ldap ? undefined : 'admin@example.com'}
              error={errors.email?.message && t(errors.email.message)}
              autoComplete={ldap ? 'username' : 'email'}
              {...register('email')}
            />
            <Input
              id="password"
              type="password"
              label={t('auth.password')}
              placeholder="••••••••"
              error={errors.password?.message && t(errors.password.message)}
              autoComplete="current-password"
              {...register('password')}
            />
            <Button type="submit" className="w-full" loading={isPending}>
              {t('auth.login.sign_in')}
            </Button>
          </form>

          {oidc && (
            <div className="mt-5">
              <div className="relative mb-4 text-center text-xs uppercase text-gray-500 dark:text-gray-400">
                <span aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-gray-200 dark:border-gray-700" />
                <span className="relative bg-white px-2 dark:bg-gray-800">{t('auth.directory.or')}</span>
              </div>
              <a
                href={directoryApi.startUrl()}
                className="flex w-full items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {t('auth.directory.sign_in_with', { label: oidc.label })}
              </a>
            </div>
          )}

          <p className="mt-4 text-center text-sm">
            <Link to="/forgot-password" className="text-brand-600 dark:text-brand-400 hover:underline">
              {t('auth.login.forgot')}
            </Link>
          </p>
          </>
          )}
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('auth.login.need_account')}
          </p>
        </div>
      </div>
    </main>
  )
}
