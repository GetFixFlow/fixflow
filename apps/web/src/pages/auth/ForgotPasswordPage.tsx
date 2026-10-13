import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useForgotPassword, useSetupStatus } from '@/hooks/useAuth'

const schema = z.object({ email: z.string().email('Enter your email address') })
type FormValues = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const { data: status } = useSetupStatus()
  const { mutate: ask, isPending, isSuccess, data } = useForgotPassword()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  // Only say email is unavailable when the server said so; if we could not find out, offer the form.
  const cannotSendEmail = status?.email_configured === false

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forgot your password?</h1>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {cannotSendEmail ? (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              This server cannot send email, so it cannot send you a link. Ask your administrator for a password reset
              link; they can create one from Settings, Users.
            </p>
          ) : isSuccess ? (
            <p role="status" className="text-sm text-gray-700 dark:text-gray-300">
              {data?.message}
            </p>
          ) : (
            <form onSubmit={handleSubmit((v) => ask(v.email))} className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enter the email you sign in with and we will send you a link to choose a new password.
              </p>
              <Input
                id="email"
                type="email"
                label="Email"
                autoComplete="email"
                error={errors.email?.message}
                {...register('email')}
              />
              <Button type="submit" className="w-full" loading={isPending}>
                Send reset link
              </Button>
            </form>
          )}

          <p className="mt-4 text-center text-sm">
            <Link to="/login" className="text-brand-600 hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
