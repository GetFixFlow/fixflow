import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LanguageSelect } from '@/components/ui/LanguageSelect'
import { useResetPassword } from '@/hooks/useAuth'

const schema = z
  .object({
    password: z.string().min(10, 'auth.errors.password_min'),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, {
    message: 'auth.errors.passwords_match',
    path: ['password_confirmation'],
  })

type FormValues = z.infer<typeof schema>

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token')
  const { mutate: reset, isPending } = useResetPassword()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 dark:bg-gray-900">
      <div className="fixed right-4 top-4 z-10"><LanguageSelect /></div>
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('auth.reset.title')}</h1>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {!token ? (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t('auth.reset.missing_code')}{' '}
              <Link to="/forgot-password" className="text-brand-600 hover:underline">
                {t('auth.reset.ask_new')}
              </Link>
              .
            </p>
          ) : (
            <form
              onSubmit={handleSubmit((v) =>
                reset({ reset_password_token: token, password: v.password, password_confirmation: v.password_confirmation }),
              )}
              className="space-y-4"
            >
              <Input
                id="password"
                type="password"
                label={t('auth.reset.new_password')}
                autoComplete="new-password"
                error={errors.password?.message && t(errors.password.message)}
                {...register('password')}
              />
            <p className="-mt-2 text-xs text-gray-500">{t('auth.password_hint')}</p>
              <Input
                id="password_confirmation"
                type="password"
                label={t('auth.reset.confirm_password')}
                autoComplete="new-password"
                error={errors.password_confirmation?.message && t(errors.password_confirmation.message)}
                {...register('password_confirmation')}
              />
              <Button type="submit" className="w-full" loading={isPending}>
                {t('auth.reset.change')}
              </Button>
              <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                {t('auth.reset.not_working')}{' '}
                <Link to="/forgot-password" className="text-brand-600 hover:underline">
                  {t('auth.reset.ask_new')}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
