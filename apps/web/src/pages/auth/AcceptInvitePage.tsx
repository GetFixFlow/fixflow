import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useSearchParams } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageLoader } from '@/components/shared/PageLoader'
import { useAcceptInvitation, useInvitation } from '@/hooks/useAuth'

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  })

type FormValues = z.infer<typeof schema>

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <Zap className="h-6 w-6 text-white" />
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

export function AcceptInvitePage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const { data: invitation, isLoading, isError } = useInvitation(token)
  const { mutate: accept, isPending } = useAcceptInvitation(token ?? '')
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (token && isLoading) return <PageLoader />

  if (!token || isError || !invitation) {
    return (
      <Shell>
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">This invitation can't be used</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            The link is invalid, was already used, or has expired. Ask your administrator to send a new one.
          </p>
          <Link to="/login" className="mt-4 inline-block text-sm text-brand-600 hover:underline">
            Go to sign in
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Join {invitation.organization_name}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Hi {invitation.first_name}, choose a password to finish setting up your {invitation.role} account.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <form onSubmit={handleSubmit((v) => accept(v))} className="space-y-4">
          <Input id="email" label="Email" value={invitation.email} readOnly disabled />
          <Input
            id="password"
            type="password"
            label="Password"
            placeholder="••••••••"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            id="password_confirmation"
            type="password"
            label="Confirm password"
            placeholder="••••••••"
            autoComplete="new-password"
            error={errors.password_confirmation?.message}
            {...register('password_confirmation')}
          />
          <Button type="submit" className="w-full" loading={isPending}>
            Set password and continue
          </Button>
        </form>
      </div>
    </Shell>
  )
}
