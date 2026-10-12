import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Navigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageLoader } from '@/components/shared/PageLoader'
import { useRegister, useSetupStatus } from '@/hooks/useAuth'

const schema = z
  .object({
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    organization_name: z.string().min(2, 'Company name is required'),
    email: z.string().email('Valid email required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  })

type FormValues = z.infer<typeof schema>

export function SetupPage() {
  const { data: status, isLoading } = useSetupStatus()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const { mutate: setUp, isPending } = useRegister()

  if (isLoading) return <PageLoader />
  // Setup runs once per install. If it is done, nobody can create another company here.
  if (status && !status.setup_required) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Set up FixFlow</h1>
          <p className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
            Create your company and the first administrator. You can invite everyone else afterwards.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <form onSubmit={handleSubmit((v) => setUp(v))} className="space-y-4">
            <Input
              id="organization_name"
              label="Company name"
              placeholder="Acme Corp"
              error={errors.organization_name?.message}
              {...register('organization_name')}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="first_name"
                label="First name"
                placeholder="Jane"
                autoComplete="given-name"
                error={errors.first_name?.message}
                {...register('first_name')}
              />
              <Input
                id="last_name"
                label="Last name"
                placeholder="Smith"
                autoComplete="family-name"
                error={errors.last_name?.message}
                {...register('last_name')}
              />
            </div>
            <Input
              id="email"
              type="email"
              label="Work email"
              placeholder="jane@acme.com"
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
              autoComplete="new-password"
              {...register('password')}
            />
            <Input
              id="password_confirmation"
              type="password"
              label="Confirm password"
              placeholder="••••••••"
              error={errors.password_confirmation?.message}
              autoComplete="new-password"
              {...register('password_confirmation')}
            />
            <Button type="submit" className="w-full" loading={isPending}>
              Finish setup
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
