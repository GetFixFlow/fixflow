import { LanguageSelect } from '@/components/ui/LanguageSelect'
import { t as translate } from '@/i18n'
import { Trans, useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { isAxiosError } from 'axios'
import { CheckCircle, Copy, MapPin, Zap } from 'lucide-react'
import { workRequestsApi } from '@/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { loadRecentRequests, rememberRequest } from '@/lib/recentRequests'

// The limits match the server's (PublicWorkRequest), which has the last word.
function makeSchema(hasAsset: boolean) {
  return z.object({
    requester_name: z.string().trim().min(2, 'workOrders.portal.name_required').max(100, 'workOrders.portal.max_100'),
    requester_email: z.union([z.literal(''), z.string().trim().email('workOrders.portal.email_invalid').max(254)]),
    location_description: hasAsset
      ? z.string().max(200, 'workOrders.portal.max_200')
      : z.string().trim().min(2, 'workOrders.portal.location_required').max(200, 'workOrders.portal.max_200'),
    description: z
      .string()
      .trim()
      .min(10, 'workOrders.portal.describe_min')
      .max(2000, 'workOrders.portal.max_2000'),
    asset_description: z.string().max(200, 'workOrders.portal.max_200'),
    leave_empty: z.string(), // the hidden field: people never see it, so they never fill it
  })
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>

const formOff = () => translate('workOrders.portal.form_off')

/** What to tell the person when sending failed. Never a success message for a request that was not made. */
function failureMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const status = error.response?.status
    if (status === 429) return translate('workOrders.portal.too_many')
    if (status === 403 && error.response?.data?.error?.code === 'PUBLIC_REQUESTS_OFF') return formOff()
    if (status === 413) return translate('workOrders.portal.too_long')
    if (status === 422) return error.response?.data?.error?.message ?? translate('workOrders.portal.check_details')
    if (!error.response) return translate('workOrders.portal.offline')
  }
  return translate('workOrders.portal.failed')
}

export function WorkRequestPortalPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const code = searchParams.get('asset')?.trim() || undefined
  const [submitted, setSubmitted] = useState<{ token: string; email: string } | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Links are the only way back to a request: keep them out of the Referer header sent to anything the page opens.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'referrer'
    meta.content = 'no-referrer'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  // An administrator can turn the form off. People are told so before they type a request, not after.
  const formQuery = useQuery({
    queryKey: ['public_request_form'],
    queryFn: () => workRequestsApi.form().then((r) => r.data.data.open),
    retry: false,
  })
  const [closedByServer, setClosedByServer] = useState(false)
  const closed = formQuery.data === false || closedByServer

  const assetQuery = useQuery({
    queryKey: ['public_asset', code],
    queryFn: () => workRequestsApi.asset(code!).then((r) => r.data.data),
    enabled: !!code && formQuery.data === true,
    retry: false,
  })
  // A label that is not recognised is not sent along: the person describes the equipment instead.
  const asset = assetQuery.data
  const hasAsset = !!asset
  const schema = useMemo(() => makeSchema(hasAsset), [hasAsset])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      requester_name: '',
      requester_email: '',
      location_description: '',
      description: '',
      asset_description: '',
      leave_empty: '',
    },
  })

  const recent = useMemo(() => loadRecentRequests(), [submitted])

  const onSubmit = async (values: FormValues) => {
    setSendError(null)
    try {
      const res = await workRequestsApi.create({
        requester_name: values.requester_name,
        requester_email: values.requester_email || undefined,
        description: values.description,
        location_description: values.location_description || undefined,
        asset_description: hasAsset ? undefined : values.asset_description || undefined,
        asset_code: hasAsset ? code : undefined,
        leave_empty: values.leave_empty || undefined,
      })
      const token = res.data.token
      rememberRequest({
        token,
        title: values.description.split('\n')[0].slice(0, 80),
        created_at: new Date().toISOString(),
      })
      setSubmitted({ token, email: values.requester_email })
    } catch (error) {
      const message = failureMessage(error)
      if (message === formOff()) setClosedByServer(true)
      setSendError(message)
    }
  }

  const statusUrl = submitted ? `${window.location.origin}/request/${submitted.token}` : ''

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(statusUrl)
      setCopied(true)
    } catch {
      setCopied(false) // the link is on the page to copy by hand
    }
  }

  const recentRequests = recent.length > 0 && (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="mb-2 font-medium text-gray-700 dark:text-gray-300">{t('workOrders.portal.recent')}</p>
      <ul className="space-y-1">
        {recent.map((r) => (
          <li key={r.token}>
            <Link to={`/request/${r.token}`} className="text-brand-600 hover:underline dark:text-brand-400">
              {r.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )

  if (closed) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-gray-50 p-4 dark:bg-gray-900">
        <div className="absolute right-4 top-4 z-10"><LanguageSelect /></div>
        <div className="w-full max-w-lg space-y-6 py-12">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('workOrders.portal.title')}</h1>
            <p role="status" className="mt-3 text-gray-600 dark:text-gray-400">{formOff()}</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
              {t('workOrders.portal.emergency_short')}
            </p>
          </div>
          {recentRequests}
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
        <div className="absolute right-4 top-4 z-10"><LanguageSelect /></div>
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl dark:bg-gray-800">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('workOrders.portal.submitted')}</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            {t('workOrders.portal.submitted_help')}
          </p>
          <p className="mt-3 break-all rounded-md bg-gray-50 p-2 font-mono text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">
            {statusUrl}
          </p>
          {submitted.email && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              <Trans i18nKey="workOrders.portal.will_email" values={{ email: submitted.email }} components={{ strong: <span className="font-medium text-gray-700 dark:text-gray-300" /> }} />
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Link
              to={`/request/${submitted.token}`}
              className="block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              {t('workOrders.portal.check_status')}
            </Link>
            <button
              onClick={copyLink}
              className="inline-flex items-center justify-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <Copy className="h-4 w-4" />
              {copied ? t('workOrders.portal.copied') : t('workOrders.portal.copy')}
            </button>
            <button
              onClick={() => {
                setSubmitted(null)
                setCopied(false)
                reset()
              }}
              className="text-sm text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {t('workOrders.portal.another')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <div className="absolute right-4 top-4 z-10"><LanguageSelect /></div>
      <div className="w-full max-w-lg space-y-6 py-12">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">FixFlow</h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">{t('workOrders.portal.title')}</p>
        </div>

        {code && assetQuery.isLoading && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">{t('workOrders.portal.looking')}</p>
        )}
        {asset && (
          <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-900 dark:bg-brand-900/20">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
            <div className="text-sm">
              <p className="font-medium text-gray-900 dark:text-gray-100">{asset.name}</p>
              <p className="text-gray-600 dark:text-gray-400">
                {asset.asset_tag}
                {asset.location ? ` · ${asset.location}` : ''}
              </p>
            </div>
          </div>
        )}
        {code && assetQuery.isError && (
          <p role="alert" className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
            {t('workOrders.portal.unrecognised')}
          </p>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="requester_name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('workOrders.portal.name')}
                </label>
                <Input
                  id="requester_name"
                  autoComplete="name"
                  {...register('requester_name')}
                  placeholder={t('workOrders.portal.name_placeholder')}
                  className={errors.requester_name ? 'border-red-400' : ''}
                />
                {errors.requester_name && <p className="mt-1 text-xs text-red-500">{t(errors.requester_name.message ?? '')}</p>}
              </div>
              <div>
                <label htmlFor="requester_email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('workOrders.portal.email')}
                </label>
                <Input
                  id="requester_email"
                  type="email"
                  autoComplete="email"
                  {...register('requester_email')}
                  placeholder={t('workOrders.portal.email_placeholder')}
                  className={errors.requester_email ? 'border-red-400' : ''}
                />
                {errors.requester_email && <p className="mt-1 text-xs text-red-500">{t(errors.requester_email.message ?? '')}</p>}
              </div>
            </div>

            {!hasAsset && (
              <>
                <div>
                  <label htmlFor="location_description" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('workOrders.portal.location')}
                  </label>
                  <Input
                    id="location_description"
                    {...register('location_description')}
                    placeholder={t('workOrders.portal.location_placeholder')}
                    className={errors.location_description ? 'border-red-400' : ''}
                  />
                  {errors.location_description && (
                    <p className="mt-1 text-xs text-red-500">{t(errors.location_description.message ?? '')}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="asset_description" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('workOrders.portal.equipment')}
                  </label>
                  <Input
                    id="asset_description"
                    {...register('asset_description')}
                    placeholder={t('workOrders.portal.equipment_placeholder')}
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('workOrders.portal.problem')}
              </label>
              <textarea
                id="description"
                {...register('description')}
                rows={4}
                placeholder={t('workOrders.portal.problem_placeholder')}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              {errors.description && <p className="mt-1 text-xs text-red-500">{t(errors.description.message ?? '')}</p>}
            </div>

            {/* A trap for scripts: people cannot see it or reach it with the keyboard. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="leave_empty">{t('workOrders.portal.leave_empty')}</label>
              <input id="leave_empty" type="text" tabIndex={-1} autoComplete="off" {...register('leave_empty')} />
            </div>

            <p className="rounded bg-yellow-50 p-2 text-xs text-gray-600 dark:bg-yellow-900/20 dark:text-gray-400">
              {t('workOrders.portal.privacy')}
            </p>

            {sendError && (
              <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                {sendError}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              {t('workOrders.portal.submit')}
            </Button>
          </form>
        </div>

        {recentRequests}
      </div>
    </div>
  )
}
