import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useLogin, useSetupStatus } from '@/hooks/useAuth'
import { useBranding } from '@/hooks/useSettings'

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const { mutate: login, isPending } = useLogin()
  const { data: setup } = useSetupStatus()
  const { data: branding } = useBranding()

  // A brand-new install has no company yet: send the first visitor to setup.
  if (setup?.setup_required) return <Navigate to="/setup" replace />

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
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
            {branding?.login_headline ?? 'Sign in to FixFlow'}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {branding?.login_subtitle ?? 'Enter your credentials to continue'}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <form onSubmit={handleSubmit((v) => login(v))} className="space-y-4">
            <Input
              id="email"
              type="email"
              label="Email"
              placeholder="admin@example.com"
              error={errors.email?.message}
              autoComplete="email"
              {...register('email')}
            />
            <Input
              id="password"
              type="password"
              label="Password"
              placeholder="••••••••"
              error={errors.password?.message}
              autoComplete="current-password"
              {...register('password')}
            />
            <Button type="submit" className="w-full" loading={isPending}>
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-center text-sm">
            <Link to="/forgot-password" className="text-brand-600 hover:underline">
              Forgot your password?
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
            Need an account? Ask your administrator to invite you.
          </p>
        </div>
      </div>
    </div>
  )
}
