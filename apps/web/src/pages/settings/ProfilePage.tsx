import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { SessionsCard } from '@/components/settings/SessionsCard'
import { useAuthStore } from '@/stores/authStore'
import {
  useProfile,
  useUpdateProfile,
  useChangePassword,
  useLocalization,
} from '@/hooks/useSettings'
import { LANGUAGES, currentLanguage, label } from '@/i18n'
import { cn } from '@/lib/utils'

function nameToColor(name: string): string {
  const colors = ['bg-blue-700', 'bg-green-700', 'bg-purple-700', 'bg-orange-700', 'bg-teal-700', 'bg-pink-700']
  let hash = 0
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function passwordStrength(pw: string): { score: number; labelKey: string; color: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const labelKeys = ['', 'weak', 'fair', 'good', 'strong']
  const colors = ['', 'bg-red-500', 'bg-amber-500', 'bg-yellow-400', 'bg-green-500']
  return { score, labelKey: labelKeys[score], color: colors[score] || '' }
}

const profileSchema = z.object({
  full_name: z.string().min(2, 'settings.profile.errors.name_required'),
  email: z.string().optional(),
  phone: z.string().optional(),
  job_title: z.string().optional(),
  department: z.string().optional(),
  locale: z.string().optional(),
})

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'common.state.required'),
    password: z.string().min(10, 'settings.profile.errors.password_min'),
    password_confirmation: z.string(),
  })
  .refine((d) => d.password === d.password_confirmation, {
    message: 'auth.errors.passwords_match',
    path: ['password_confirmation'],
  })

type ProfileFormData = z.infer<typeof profileSchema>
type PasswordFormData = z.infer<typeof passwordSchema>

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  manager: 'bg-blue-100 text-blue-800',
  technician: 'bg-green-100 text-green-800',
  requester: 'bg-gray-100 text-gray-700',
}

export function ProfilePage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()
  const { data: company } = useLocalization()
  const changePassword = useChangePassword()

  const [pwVisible, setPwVisible] = useState<Record<string, boolean>>({})
  const [pwOpen, setPwOpen] = useState(false)

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      job_title: '',
      department: '',
      locale: '',
    },
    values: profile
      ? {
          full_name: profile.full_name ?? '',
          email: profile.email ?? '',
          phone: profile.phone ?? '',
          job_title: profile.job_title ?? '',
          department: profile.department ?? '',
          locale: profile.locale ?? '',
        }
      : undefined,
  })

  const pwForm = useForm<PasswordFormData>({ resolver: zodResolver(passwordSchema) })
  const newPw = pwForm.watch('password', '')
  const { score: pwScore, labelKey: pwLabelKey, color: pwColor } = passwordStrength(newPw)

  const pwReqs = [
    { label: t('settings.profile.req_length'), met: newPw.length >= 10 },
    { label: t('settings.profile.req_upper'), met: /[A-Z]/.test(newPw) },
    { label: t('settings.profile.req_number'), met: /[0-9]/.test(newPw) },
    { label: t('settings.profile.req_symbol'), met: /[^A-Za-z0-9]/.test(newPw) },
  ]

  const onSaveProfile = form.handleSubmit((data) => {
    updateProfile.mutate({ full_name: data.full_name, phone: data.phone, job_title: data.job_title, department: data.department, locale: data.locale ?? '' })
  })

  const onChangePassword = pwForm.handleSubmit((data) => {
    changePassword.mutate(data, {
      onSuccess: () => {
        pwForm.reset()
        setPwOpen(false)
      },
    })
  })

  const initials = (user?.full_name ?? 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const avatarColor = nameToColor(user?.full_name ?? 'User')

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title={t('settings.profile.title')} description={t('settings.profile.description')} />

      {/* Profile Form */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('settings.profile.info')}</h2>

          {/* Avatar: initials only; photo upload is not supported yet */}
          <div className="flex items-center gap-4">
            <div className={cn('h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold text-white', avatarColor)}>
              {initials}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : (
            <>
              {/* Form fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('settings.profile.full_name')} *
                  </label>
                  <Input id="profile-name" {...form.register('full_name')} />
                  {form.formState.errors.full_name && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{t(form.formState.errors.full_name.message ?? '')}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('auth.email')}
                  </label>
                  <Input id="profile-email" {...form.register('email')} type="email" disabled aria-describedby="email-note" />
                  <p id="email-note" className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.profile.email_note')}</p>
                </div>
                <div>
                  <label htmlFor="profile-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('settings.profile.phone')}
                  </label>
                  <Input id="profile-phone" {...form.register('phone')} type="tel" />
                </div>
                <div>
                  <label htmlFor="profile-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('settings.profile.job_title')}
                  </label>
                  <Input id="profile-title" {...form.register('job_title')} />
                </div>
                <div>
                  <label htmlFor="profile-department" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('settings.profile.department')}
                  </label>
                  <Input id="profile-department" {...form.register('department')} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="profile-language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('language.label')}
                  </label>
                  <select
                    id="profile-language"
                    {...form.register('locale')}
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="">
                      {t('language.use_company', { name: LANGUAGES.find((l) => l.code === company?.language)?.name ?? LANGUAGES[0].name })}
                    </option>
                    {LANGUAGES.map((language) => (
                      <option key={language.code} value={language.code}>{language.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Read-only fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <p className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('settings.profile.role')}</p>
                  <span className={cn(
                    'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                    ROLE_COLORS[user?.role ?? 'technician'],
                  )}>
                    {label('role', user?.role)}
                  </span>
                </div>
                <div>
                  <p className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('settings.profile.organization')}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{profile?.organization_name ?? '—'}</p>
                </div>
                <div>
                  <p className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('settings.profile.member_since')}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {user?.created_at ? new Intl.DateTimeFormat(currentLanguage(), { month: 'long', year: 'numeric' }).format(new Date(user.created_at)) : '—'}
                  </p>
                </div>
              </div>
            </>
          )}

          <Button onClick={onSaveProfile} disabled={updateProfile.isPending}>
            {updateProfile.isPending ? t('common.actions.saving') : t('settings.profile.save')}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <button
          onClick={() => setPwOpen(!pwOpen)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('settings.profile.change_password')}</h2>
          {pwOpen ? <ChevronUp className="h-5 w-5 text-gray-500 dark:text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
        </button>
        {pwOpen && (
          <CardContent className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-gray-700">
            {(['current_password', 'password', 'password_confirmation'] as const).map((field) => {
              const labels = {
                current_password: t('settings.profile.current_password'),
                password: t('settings.profile.new_password'),
                password_confirmation: t('settings.profile.confirm_password'),
              }
              return (
                <div key={field}>
                  <label htmlFor={`profile-${field}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {labels[field]} *
                  </label>
                  <div className="relative">
                    <Input
                      id={`profile-${field}`}
                      {...pwForm.register(field)}
                      type={pwVisible[field] ? 'text' : 'password'}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setPwVisible((v) => ({ ...v, [field]: !v[field] }))}
                      aria-label={pwVisible[field] ? t('settings.profile.hide_password') : t('settings.profile.show_password')}
                      className="absolute right-2.5 top-2.5 text-gray-500 dark:text-gray-400"
                    >
                      {pwVisible[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {pwForm.formState.errors[field] && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{t(pwForm.formState.errors[field]?.message ?? '')}</p>
                  )}
                </div>
              )
            })}

            {newPw && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">{t('settings.profile.strength')}</span>
                  <span className={cn(
                    'font-medium',
                    pwScore >= 3 ? 'text-green-700 dark:text-green-400' : pwScore >= 2 ? 'text-amber-700 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
                  )}>
                    {pwLabelKey ? t(`settings.profile.strength_${pwLabelKey}`) : ''}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={cn('h-1.5 flex-1 rounded-full', i <= pwScore ? pwColor : 'bg-gray-200')} />
                  ))}
                </div>
                <div className="space-y-1">
                  {pwReqs.map((req) => (
                    <div key={req.label} className={cn('flex items-center gap-1.5 text-xs', req.met ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400')}>
                      <Check className={cn('h-3 w-3', req.met ? 'opacity-100' : 'opacity-30')} />
                      <span>{req.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('settings.profile.refused')}
                </p>
              </div>
            )}

            <Button onClick={onChangePassword} disabled={changePassword.isPending}>
              {changePassword.isPending ? t('settings.profile.updating') : t('settings.profile.update_password')}
            </Button>
          </CardContent>
        )}
      </Card>

      <SessionsCard />
    </div>
  )
}
