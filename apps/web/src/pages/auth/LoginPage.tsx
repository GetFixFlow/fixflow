import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LanguageSelect } from '@/components/ui/LanguageSelect'
import { useLogin, useSetupStatus, useVerifyTwoFactor } from '@/hooks/useAuth'
import { useBranding } from '@/hooks/useSettings'

const schema = z.object({
  email: z.string().email('auth.errors.email_required'),
  password: z.string().min(8, 'auth.errors.password_short'),
})

type FormValues = z.infer<typeof schema>

// What the server sends for a company that never changed its sign-in texts: these are the English defaults, so for that
// company the page uses the translation instead (a text the company wrote itself is shown as written).
const SERVER_DEFAULT_HEADLINE = 'Sign in to FixFlow'
const SERVER_DEFAULT_SUBTITLE = 'Enter your credentials to continue'
const customText = (text: string | null | undefined, serverDefault: string) => (text && text !== serverDefault ? text : null)

export function LoginPage() {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
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
                className="block w-full text-center text-sm text-brand-600 hover:underline"
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
              type="email"
              label={t('auth.email')}
              placeholder="admin@example.com"
              error={errors.email?.message && t(errors.email.message)}
              autoComplete="email"
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

          <p className="mt-4 text-center text-sm">
            <Link to="/forgot-password" className="text-brand-600 hover:underline">
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
    </div>
  )
}
