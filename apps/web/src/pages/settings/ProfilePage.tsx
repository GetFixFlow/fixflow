import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ChevronDown, ChevronUp, Check } from 'lucide-react'
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
} from '@/hooks/useSettings'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

function nameToColor(name: string): string {
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-teal-500', 'bg-pink-500']
  let hash = 0
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['', 'bg-red-500', 'bg-amber-500', 'bg-yellow-400', 'bg-green-500']
  return { score, label: labels[score] || '', color: colors[score] || '' }
}

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name is required'),
  email: z.string().optional(),
  phone: z.string().optional(),
  job_title: z.string().optional(),
  department: z.string().optional(),
})

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Required'),
    password: z.string().min(10, 'At least 10 characters'),
    password_confirmation: z.string(),
  })
  .refine((d) => d.password === d.password_confirmation, {
    message: 'Passwords do not match',
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
  const { user } = useAuthStore()
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()
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
    },
    values: profile
      ? {
          full_name: profile.full_name ?? '',
          email: profile.email ?? '',
          phone: profile.phone ?? '',
          job_title: profile.job_title ?? '',
          department: profile.department ?? '',
        }
      : undefined,
  })

  const pwForm = useForm<PasswordFormData>({ resolver: zodResolver(passwordSchema) })
  const newPw = pwForm.watch('password', '')
  const { score: pwScore, label: pwLabel, color: pwColor } = passwordStrength(newPw)

  const pwReqs = [
    { label: 'At least 10 characters (required)', met: newPw.length >= 10 },
    { label: 'An uppercase letter (stronger, not required)', met: /[A-Z]/.test(newPw) },
    { label: 'A number (stronger, not required)', met: /[0-9]/.test(newPw) },
    { label: 'A symbol (stronger, not required)', met: /[^A-Za-z0-9]/.test(newPw) },
  ]

  const onSaveProfile = form.handleSubmit((data) => {
    updateProfile.mutate({ full_name: data.full_name, phone: data.phone, job_title: data.job_title, department: data.department })
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
      <PageHeader title="My Profile" description="Update your personal information and preferences" />

      {/* Profile Form */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Profile Information</h3>

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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Full Name *
                  </label>
                  <Input {...form.register('full_name')} />
                  {form.formState.errors.full_name && (
                    <p className="text-xs text-red-500 mt-1">{form.formState.errors.full_name.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <Input {...form.register('email')} type="email" disabled aria-describedby="email-note" />
                  <p id="email-note" className="text-xs text-gray-400 mt-1">Your sign-in email cannot be changed here yet.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone
                  </label>
                  <Input {...form.register('phone')} type="tel" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Job Title
                  </label>
                  <Input {...form.register('job_title')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Department
                  </label>
                  <Input {...form.register('department')} />
                </div>
              </div>

              {/* Read-only fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Role</label>
                  <span className={cn(
                    'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                    ROLE_COLORS[user?.role ?? 'technician'],
                  )}>
                    {user?.role}
                  </span>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Organization</label>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{profile?.organization_name ?? '—'}</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Member Since</label>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {user?.created_at ? format(new Date(user.created_at), 'MMMM yyyy') : '—'}
                  </p>
                </div>
              </div>
            </>
          )}

          <Button onClick={onSaveProfile} disabled={updateProfile.isPending}>
            {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <button
          onClick={() => setPwOpen(!pwOpen)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Change Password</h3>
          {pwOpen ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </button>
        {pwOpen && (
          <CardContent className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-gray-700">
            {(['current_password', 'password', 'password_confirmation'] as const).map((field) => {
              const labels = {
                current_password: 'Current Password',
                password: 'New Password',
                password_confirmation: 'Confirm Password',
              }
              return (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {labels[field]} *
                  </label>
                  <div className="relative">
                    <Input
                      {...pwForm.register(field)}
                      type={pwVisible[field] ? 'text' : 'password'}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setPwVisible((v) => ({ ...v, [field]: !v[field] }))}
                      className="absolute right-2.5 top-2.5 text-gray-400"
                    >
                      {pwVisible[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {pwForm.formState.errors[field] && (
                    <p className="text-xs text-red-500 mt-1">{pwForm.formState.errors[field]?.message}</p>
                  )}
                </div>
              )
            })}

            {newPw && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Password Strength</span>
                  <span className={cn(
                    'font-medium',
                    pwScore >= 3 ? 'text-green-600' : pwScore >= 2 ? 'text-amber-600' : 'text-red-600',
                  )}>
                    {pwLabel}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={cn('h-1.5 flex-1 rounded-full', i <= pwScore ? pwColor : 'bg-gray-200')} />
                  ))}
                </div>
                <div className="space-y-1">
                  {pwReqs.map((req) => (
                    <div key={req.label} className={cn('flex items-center gap-1.5 text-xs', req.met ? 'text-green-600' : 'text-gray-400')}>
                      <Check className={cn('h-3 w-3', req.met ? 'opacity-100' : 'opacity-30')} />
                      <span>{req.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  Common passwords, and ones made from your name or email address, are refused when you save.
                </p>
              </div>
            )}

            <Button onClick={onChangePassword} disabled={changePassword.isPending}>
              {changePassword.isPending ? 'Updating…' : 'Update Password'}
            </Button>
          </CardContent>
        )}
      </Card>

      <SessionsCard />
    </div>
  )
}
