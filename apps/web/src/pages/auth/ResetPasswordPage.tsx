import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useSearchParams } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useResetPassword } from '@/hooks/useAuth'

const schema = z
  .object({
    password: z.string().min(10, 'Password must be at least 10 characters'),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  })

type FormValues = z.infer<typeof schema>

export function ResetPasswordPage() {
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
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Choose a new password</h1>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {!token ? (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              This link is missing its reset code.{' '}
              <Link to="/forgot-password" className="text-brand-600 hover:underline">
                Ask for a new one
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
                label="New password"
                autoComplete="new-password"
                error={errors.password?.message}
                {...register('password')}
              />
            <p className="-mt-2 text-xs text-gray-500">10 or more characters. A few words in a row work well. Common passwords, and ones made from your name or email address, are refused.</p>
              <Input
                id="password_confirmation"
                type="password"
                label="Confirm new password"
                autoComplete="new-password"
                error={errors.password_confirmation?.message}
                {...register('password_confirmation')}
              />
              <Button type="submit" className="w-full" loading={isPending}>
                Change password
              </Button>
              <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                Link not working?{' '}
                <Link to="/forgot-password" className="text-brand-600 hover:underline">
                  Ask for a new one
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
