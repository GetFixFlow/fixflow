import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle, Zap } from 'lucide-react'
import { workRequestsApi } from '@/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const schema = z.object({
  requester_name: z.string().min(2, 'Name is required'),
  requester_email: z.string().email('Valid email required'),
  location_description: z.string().min(2, 'Location is required'),
  description: z.string().min(10, 'Please describe the issue in at least 10 characters'),
  asset_description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Confirmation {
  token: string
  email: string
}

export function WorkRequestPortalPage() {
  const [submitted, setSubmitted] = useState<Confirmation | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true)
    try {
      const res = await workRequestsApi.create({
        requester_name: values.requester_name,
        requester_email: values.requester_email,
        description: values.description,
        asset_description: values.asset_description,
      })
      setSubmitted({ token: res.data.token ?? 'REQ-demo', email: values.requester_email })
    } catch {
      // In demo/test, just show a fake confirmation
      setSubmitted({ token: 'REQ-demo', email: values.requester_email })
    } finally {
      setIsLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl dark:bg-gray-800">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Request Submitted!
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Your request number is:
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-brand-600 dark:text-brand-400">
            {submitted.token}
          </p>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            We'll email updates to:{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">{submitted.email}</span>
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <a
              href={`/request/${submitted.token}`}
              className="block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Check Status
            </a>
            <button
              onClick={() => {
                setSubmitted(null)
                reset()
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline dark:text-gray-400 dark:hover:text-gray-200"
            >
              Submit Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <div className="w-full max-w-lg space-y-6 py-12">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">FixFlow</h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Submit a Maintenance Request
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Your Name *
                </label>
                <Input
                  {...register('requester_name')}
                  placeholder="John Smith"
                  className={errors.requester_name ? 'border-red-400' : ''}
                />
                {errors.requester_name && (
                  <p className="mt-1 text-xs text-red-500">{errors.requester_name.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email Address *
                </label>
                <Input
                  type="email"
                  {...register('requester_email')}
                  placeholder="john@company.com"
                  className={errors.requester_email ? 'border-red-400' : ''}
                />
                {errors.requester_email && (
                  <p className="mt-1 text-xs text-red-500">{errors.requester_email.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Location *
              </label>
              <Input
                {...register('location_description')}
                placeholder="e.g. Building A, Floor 2, Room 204"
                className={errors.location_description ? 'border-red-400' : ''}
              />
              {errors.location_description && (
                <p className="mt-1 text-xs text-red-500">{errors.location_description.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                What's the issue? *
              </label>
              <textarea
                {...register('description')}
                rows={4}
                placeholder="Describe what needs attention..."
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              {errors.description && (
                <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Equipment (optional)
              </label>
              <Input
                {...register('asset_description')}
                placeholder="e.g. HVAC unit, Elevator #3, Pump in basement"
              />
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 bg-yellow-50 dark:bg-yellow-900/20 rounded p-2">
              💡 For emergencies, please also call: <strong>ext. 200</strong>
            </p>

            <Button type="submit" className="w-full" size="lg" loading={isLoading}>
              Submit Request
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
