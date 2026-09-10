import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/authStore'
import { useOrgSettings, useUpdateOrgSettings } from '@/hooks/useSettings'
import type { OrgSettings } from '@/api/settings'

const INDUSTRIES = ['Manufacturing', 'Facilities', 'Healthcare', 'Education', 'Property', 'Municipal', 'Other']
const SIZES = ['1-10', '11-50', '51-200', '201-500', '500+']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore',
  'Asia/Kolkata', 'Asia/Colombo', 'Australia/Sydney',
]

const orgSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  slug: z.string().min(2, 'Slug is required'),
  industry: z.string().optional(),
  size: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  address: z.string().optional(),
  default_priority: z.string(),
  default_due_days: z.coerce.number().min(1).max(365),
  require_completion_notes: z.boolean(),
  auto_close_days: z.coerce.number().min(0).max(365),
  wo_number_prefix: z.string().min(1),
  pm_compliance_target: z.coerce.number().min(0).max(100),
  pm_reminder_days: z.coerce.number().min(0).max(30),
  pm_pause_on_down: z.boolean(),
  iot_alert_cooldown: z.coerce.number().min(0),
  iot_stale_threshold: z.coerce.number().min(1),
  iot_data_retention_days: z.coerce.number().min(1),
  iot_auto_wo_threshold: z.string(),
  work_hours_start: z.string(),
  work_hours_end: z.string(),
  timezone: z.string(),
})

type OrgFormData = z.infer<typeof orgSchema>

interface Holiday {
  date: string
  name: string
  repeating: boolean
}

const DEFAULT_ORG: Partial<OrgSettings> = {
  name: '',
  slug: '',
  default_priority: 'medium',
  default_due_days: 7,
  require_completion_notes: false,
  auto_close_days: 30,
  wo_number_prefix: 'WO',
  pm_compliance_target: 90,
  pm_reminder_days: 7,
  pm_pause_on_down: false,
  iot_alert_cooldown: 60,
  iot_stale_threshold: 300,
  iot_data_retention_days: 365,
  iot_auto_wo_threshold: 'critical',
  work_hours: { start: '08:00', end: '17:00' },
  work_days: [1, 2, 3, 4, 5],
  timezone: 'UTC',
}

export function OrganizationPage() {
  const { user } = useAuthStore()
  const { data: org, isLoading } = useOrgSettings()
  const updateOrg = useUpdateOrgSettings()

  const [workDays, setWorkDays] = useState<number[]>(org?.work_days ?? [1, 2, 3, 4, 5])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [addingHoliday, setAddingHoliday] = useState(false)
  const [newHoliday, setNewHoliday] = useState<Holiday>({ date: '', name: '', repeating: false })

  const merged = { ...DEFAULT_ORG, ...org }

  const form = useForm<OrgFormData>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: '',
      slug: '',
      industry: '',
      size: '',
      website: '',
      address: '',
      default_priority: 'medium',
      default_due_days: 7,
      require_completion_notes: false,
      auto_close_days: 30,
      wo_number_prefix: 'WO',
      pm_compliance_target: 90,
      pm_reminder_days: 7,
      pm_pause_on_down: false,
      iot_alert_cooldown: 60,
      iot_stale_threshold: 300,
      iot_data_retention_days: 365,
      iot_auto_wo_threshold: 'critical',
      work_hours_start: '08:00',
      work_hours_end: '17:00',
      timezone: 'UTC',
    },
    values: merged
      ? {
          name: merged.name ?? '',
          slug: merged.slug ?? '',
          industry: merged.industry ?? '',
          size: merged.size ?? '',
          website: merged.website ?? '',
          address: merged.address ?? '',
          default_priority: merged.default_priority ?? 'medium',
          default_due_days: merged.default_due_days ?? 7,
          require_completion_notes: merged.require_completion_notes ?? false,
          auto_close_days: merged.auto_close_days ?? 30,
          wo_number_prefix: merged.wo_number_prefix ?? 'WO',
          pm_compliance_target: merged.pm_compliance_target ?? 90,
          pm_reminder_days: merged.pm_reminder_days ?? 7,
          pm_pause_on_down: merged.pm_pause_on_down ?? false,
          iot_alert_cooldown: merged.iot_alert_cooldown ?? 60,
          iot_stale_threshold: merged.iot_stale_threshold ?? 300,
          iot_data_retention_days: merged.iot_data_retention_days ?? 365,
          iot_auto_wo_threshold: merged.iot_auto_wo_threshold ?? 'critical',
          work_hours_start: merged.work_hours?.start ?? '08:00',
          work_hours_end: merged.work_hours?.end ?? '17:00',
          timezone: merged.timezone ?? 'UTC',
        }
      : undefined,
  })

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Organization" description="Organization settings" />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Access Denied. Only administrators can view organization settings.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const onSubmit = form.handleSubmit((data) => {
    updateOrg.mutate({
      name: data.name,
      slug: data.slug,
      industry: data.industry,
      size: data.size,
      website: data.website,
      address: data.address,
      default_priority: data.default_priority,
      default_due_days: data.default_due_days,
      require_completion_notes: data.require_completion_notes,
      auto_close_days: data.auto_close_days,
      wo_number_prefix: data.wo_number_prefix,
      pm_compliance_target: data.pm_compliance_target,
      pm_reminder_days: data.pm_reminder_days,
      pm_pause_on_down: data.pm_pause_on_down,
      iot_alert_cooldown: data.iot_alert_cooldown,
      iot_stale_threshold: data.iot_stale_threshold,
      iot_data_retention_days: data.iot_data_retention_days,
      iot_auto_wo_threshold: data.iot_auto_wo_threshold,
      work_hours: { start: data.work_hours_start, end: data.work_hours_end },
      work_days: workDays,
      timezone: data.timezone,
    })
  })

  const toggleWorkDay = (day: number) => {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  const addHoliday = () => {
    if (newHoliday.date && newHoliday.name) {
      setHolidays((prev) => [...prev, newHoliday])
      setNewHoliday({ date: '', name: '', repeating: false })
      setAddingHoliday(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Organization" description="Configure your organization settings" />
        <Card>
          <CardContent className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Organization" description="Configure your organization settings" />

      {/* Section 1: Organization Details */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Organization Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Organization Name *
              </label>
              <Input {...form.register('name')} placeholder="Acme Corp" />
              {form.formState.errors.name && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                URL Slug *
              </label>
              <Input {...form.register('slug')} placeholder="acme-corp" />
              {form.formState.errors.slug && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.slug.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Industry
              </label>
              <select
                {...form.register('industry')}
                className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
              >
                <option value="">Select industry</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company Size
              </label>
              <select
                {...form.register('size')}
                className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
              >
                <option value="">Select size</option>
                {SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Website
              </label>
              <Input {...form.register('website')} placeholder="https://example.com" type="url" />
              {form.formState.errors.website && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.website.message}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Address
              </label>
              <Input {...form.register('address')} placeholder="123 Main St, City, Country" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Maintenance Settings */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Maintenance Settings</h3>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Work Orders</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Priority
                </label>
                <select
                  {...form.register('default_priority')}
                  className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm capitalize"
                >
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Due Days
                </label>
                <Input {...form.register('default_due_days')} type="number" min={1} max={365} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  WO Number Prefix
                </label>
                <Input {...form.register('wo_number_prefix')} placeholder="WO" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Auto-Close After (days)
                </label>
                <Input {...form.register('auto_close_days')} type="number" min={0} max={365} />
                <p className="text-xs text-gray-400 mt-1">0 = disabled</p>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...form.register('require_completion_notes')} className="rounded" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Require completion notes when closing WOs</span>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Preventive Maintenance</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Compliance Target (%)
                </label>
                <Input {...form.register('pm_compliance_target')} type="number" min={0} max={100} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  PM Reminder Days Before Due
                </label>
                <Input {...form.register('pm_reminder_days')} type="number" min={0} max={30} />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...form.register('pm_pause_on_down')} className="rounded" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Pause PM schedules when asset is offline</span>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">IoT Settings</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Alert Cooldown (minutes)
                </label>
                <Input {...form.register('iot_alert_cooldown')} type="number" min={0} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Stale Reading Threshold (seconds)
                </label>
                <Input {...form.register('iot_stale_threshold')} type="number" min={1} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Data Retention (days)
                </label>
                <Input {...form.register('iot_data_retention_days')} type="number" min={1} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Auto-Create WO Threshold
                </label>
                <select
                  {...form.register('iot_auto_wo_threshold')}
                  className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
                >
                  <option value="critical">Critical only</option>
                  <option value="high">High &amp; above</option>
                  <option value="medium">Medium &amp; above</option>
                  <option value="never">Never</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Working Hours */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Working Hours</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Work Start Time
              </label>
              <input
                type="time"
                {...form.register('work_hours_start')}
                className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Work End Time
              </label>
              <input
                type="time"
                {...form.register('work_hours_end')}
                className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Working Days
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleWorkDay(i)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    workDays.includes(i)
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Timezone
            </label>
            <select
              {...form.register('timezone')}
              className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          {/* Holidays */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Public Holidays
              </label>
              <Button variant="ghost" size="sm" onClick={() => setAddingHoliday(true)} className="text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add Holiday
              </Button>
            </div>
            {holidays.length === 0 && !addingHoliday && (
              <p className="text-xs text-gray-400">No holidays configured.</p>
            )}
            {addingHoliday && (
              <div className="flex items-center gap-2 mb-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <input
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday((h) => ({ ...h, date: e.target.value }))}
                  className="h-8 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-xs"
                />
                <input
                  type="text"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday((h) => ({ ...h, name: e.target.value }))}
                  placeholder="Holiday name"
                  className="h-8 flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-xs"
                />
                <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={newHoliday.repeating}
                    onChange={(e) => setNewHoliday((h) => ({ ...h, repeating: e.target.checked }))}
                    className="rounded"
                  />
                  Repeating
                </label>
                <Button size="sm" onClick={addHoliday} className="text-xs h-8">Add</Button>
                <Button variant="ghost" size="sm" onClick={() => setAddingHoliday(false)} className="text-xs h-8">Cancel</Button>
              </div>
            )}
            {holidays.map((h, idx) => (
              <div key={idx} className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-gray-800 text-sm">
                <span className="text-gray-700 dark:text-gray-300">{h.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{h.date}{h.repeating && ' (yearly)'}</span>
                  <button
                    type="button"
                    onClick={() => setHolidays((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button onClick={onSubmit} disabled={updateOrg.isPending}>
        {updateOrg.isPending ? 'Saving…' : 'Save Organization Settings'}
      </Button>
    </div>
  )
}
