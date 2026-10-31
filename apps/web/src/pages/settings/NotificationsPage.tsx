import { useState } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/hooks/useSettings'
import type { NotificationPreferences } from '@/api/settings'
import { cn } from '@/lib/utils'

function Toggle({ checked, onChange, id, label }: { checked: boolean; onChange: (v: boolean) => void; id?: string; label: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        checked ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  )
}

interface EmailEvent {
  key: string
  label: string
  hint: string
  group: string
  /** Who is sent it: everyone, or managers and administrators only. */
  minRole?: 'manager'
}

// Exactly the emails the server sends (EmailPreferences::EMAIL_EVENTS). An email that is not
// sent yet is not listed: a switch for it would do nothing. Those that are also pushed
// (EmailPreferences::PUSH_EVENTS) have a second switch.
const EMAIL_EVENTS: EmailEvent[] = [
  { key: 'wo_assigned', label: 'A work order is assigned to me', hint: 'Sent to the technician it is assigned to.', group: 'Work orders' },
  { key: 'wo_verified', label: 'A work order I requested is finished', hint: 'Sent to the person who asked for the work, once it is verified.', group: 'Work orders' },
  { key: 'wo_needs_verification', label: 'Work is finished and needs verifying', hint: 'Sent when a technician completes a work order.', group: 'Work orders', minRole: 'manager' },
  { key: 'wo_new_request', label: 'Someone reports a problem', hint: 'Sent when a person without an account reports a problem from a QR label.', group: 'Work orders', minRole: 'manager' },
  { key: 'pm_generated', label: 'A scheduled work order is created for me', hint: 'Sent when a preventive maintenance schedule creates a work order assigned to you.', group: 'Preventive maintenance' },
  { key: 'pm_due_soon', label: 'Maintenance is due this week', hint: 'A summary of your schedules due within 7 days (managers get all of them).', group: 'Preventive maintenance' },
  { key: 'pm_overdue', label: 'Maintenance is overdue', hint: 'A summary of overdue schedules.', group: 'Preventive maintenance', minRole: 'manager' },
  { key: 'part_low_stock', label: 'A part is running low or out', hint: 'Sent once each time stock reaches its reorder point, and again if it runs out.', group: 'Inventory', minRole: 'manager' },
  { key: 'po_requested', label: 'Someone asks for parts to be bought', hint: 'Sent when a purchase request is waiting for your decision.', group: 'Inventory', minRole: 'manager' },
]

// What a screen reader says for each Push box (the row's own label belongs to the email box).
const PUSH_EVENTS: Record<string, string> = {
  wo_assigned: 'an assignment',
  wo_verified: 'a finished request',
  pm_generated: 'a scheduled work order',
  wo_needs_verification: 'work to verify',
  wo_new_request: 'a reported problem',
  part_low_stock: 'a part running low',
  po_requested: 'a purchase request',
}

const SOUND_KEY = 'fixflow-alert-sound'

function readSound() {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'false'
  } catch {
    return true
  }
}

function playSampleSound() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
  } catch {
    // This browser cannot play sounds.
  }
}

function sameChoices(a: NotificationPreferences, b: NotificationPreferences) {
  return (
    a.email_enabled === b.email_enabled &&
    a.push_enabled === b.push_enabled &&
    EMAIL_EVENTS.every((e) => a.rules[e.key]?.email === b.rules[e.key]?.email && a.rules[e.key]?.push === b.rules[e.key]?.push)
  )
}

function PreferencesForm({ saved }: { saved: NotificationPreferences }) {
  const role = useAuthStore((s) => s.user?.role ?? 'technician')
  const update = useUpdateNotificationPreferences()
  const [prefs, setPrefs] = useState(saved)
  const [sound, setSound] = useState(readSound)

  const isManager = role === 'manager' || role === 'admin'
  const events = EMAIL_EVENTS.filter((e) => !e.minRole || isManager)
  const groups = Array.from(new Set(events.map((e) => e.group)))
  const changed = !sameChoices(prefs, saved)

  const setRule = (key: string, change: { email?: boolean; push?: boolean }) =>
    setPrefs((p) => ({ ...p, rules: { ...p.rules, [key]: { ...p.rules[key], ...change } } }))

  const setSoundEnabled = (on: boolean) => {
    setSound(on)
    try {
      localStorage.setItem(SOUND_KEY, String(on))
    } catch {
      // Not remembered, but this session still follows the switch.
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Notifications" description="Choose which emails and push notifications you get" />

      <PushDeviceCard />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Email</h3>
              <p className="mt-0.5 text-xs text-gray-400">
                Turn this off to get none of the emails below. Your choices are kept for when you turn it back on.
              </p>
            </div>
            <Toggle
              id="email-enabled"
              label="Email notifications"
              checked={prefs.email_enabled}
              onChange={(v) => setPrefs((p) => ({ ...p, email_enabled: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Push</h3>
              <p className="mt-0.5 text-xs text-gray-400">
                Turn this off to get no push notifications on any of your devices. Each device is turned on separately, above.
              </p>
            </div>
            <Toggle
              id="push-enabled"
              label="Push notifications"
              checked={prefs.push_enabled}
              onChange={(v) => setPrefs((p) => ({ ...p, push_enabled: v }))}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400">
                  <th className="text-left font-normal">
                    <span className="sr-only">Tell me when</span>
                  </th>
                  <th className="w-16 text-center font-normal">Email</th>
                  <th className="w-16 text-center font-normal">Push</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <GroupRows
                    key={group}
                    group={group}
                    events={events.filter((e) => e.group === group)}
                    prefs={prefs}
                    onChange={setRule}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400">
            Invitations and password reset links are always sent, because you could not use the app without them.
            The summaries of maintenance due and overdue are email only. Emails about overdue work orders and sensor alerts, and digests,
            are not available yet.
          </p>

          <Button
            onClick={() => update.mutate(prefs, { onSuccess: (res) => setPrefs(res.data.preferences) })}
            disabled={!changed || update.isPending}
          >
            {update.isPending ? 'Saving…' : 'Save preferences'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Alert sound on this device</h3>
              <p className="mt-0.5 text-xs text-gray-400">
                Play a sound when a critical sensor alert arrives while FixFlow is open. Applies to this browser only.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={playSampleSound} className="text-xs text-gray-500">
                Test
              </Button>
              <Toggle id="alert-sound" label="Alert sound" checked={sound} onChange={setSoundEnabled} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/** Push notifications on THIS device: whether it can, whether it is on, and a test. Each device is turned on by itself. */
function PushDeviceCard() {
  const push = usePushNotifications()
  const [note, setNote] = useState('')

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Push notifications on this device</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              A message on this phone or computer when work is assigned to you, even while FixFlow is closed. Turn it on in each browser or phone you want it on.
            </p>
          </div>
          {push.supported === 'supported' && !push.loading && (
            <Toggle
              id="push-device"
              label="Push notifications on this device"
              checked={push.enabled}
              onChange={(on) => {
                setNote('')
                void (on ? push.enable() : push.disable())
              }}
            />
          )}
        </div>

        {push.supported === 'unsupported' && (
          <p role="status" className="text-sm text-gray-600 dark:text-gray-400">
            This browser cannot receive push notifications. On an iPhone or iPad, add FixFlow to the Home Screen first and open it from there.
          </p>
        )}
        {push.supported === 'insecure' && (
          <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
            Push notifications need a secure address (https://). Ask whoever looks after this FixFlow server to turn on HTTPS.
          </p>
        )}
        {push.supported === 'supported' && push.permission === 'denied' && !push.enabled && (
          <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
            Notifications are blocked for this site in the browser. Allow them in the browser&apos;s settings for this address, then turn this on.
          </p>
        )}
        {push.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {push.error}
          </p>
        )}
        {push.enabled && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={push.busy}
              onClick={async () => setNote(await push.sendTest())}
            >
              Send a test
            </Button>
            {note && (
              <span role="status" className="text-xs text-gray-500">
                {note}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function GroupRows({
  group,
  events,
  prefs,
  onChange,
}: {
  group: string
  events: EmailEvent[]
  prefs: NotificationPreferences
  onChange: (key: string, change: { email?: boolean; push?: boolean }) => void
}) {
  return (
    <>
      <tr>
        <td colSpan={3} className="pb-1 pt-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{group}</span>
        </td>
      </tr>
      {events.map((event) => (
        <tr key={event.key} className="border-b border-gray-50 dark:border-gray-800">
          <td className="py-2 pr-3">
            <label htmlFor={`rule-${event.key}`} className="block cursor-pointer text-gray-700 dark:text-gray-300">
              {event.label}
              <span className="block text-xs text-gray-400">{event.hint}</span>
            </label>
          </td>
          <td className="w-16 py-2 text-center">
            <input
              id={`rule-${event.key}`}
              type="checkbox"
              checked={prefs.rules[event.key]?.email ?? true}
              onChange={(e) => onChange(event.key, { email: e.target.checked })}
              disabled={!prefs.email_enabled}
              className="rounded"
            />
          </td>
          <td className="w-16 py-2 text-center">
            {event.key in PUSH_EVENTS ? (
              <input
                id={`push-${event.key}`}
                type="checkbox"
                aria-label={`Push for ${PUSH_EVENTS[event.key]}`}
                checked={prefs.rules[event.key]?.push ?? true}
                onChange={(e) => onChange(event.key, { push: e.target.checked })}
                disabled={!prefs.push_enabled}
                className="rounded"
              />
            ) : (
              <span aria-hidden="true" className="text-gray-300">–</span>
            )}
          </td>
        </tr>
      ))}
    </>
  )
}

export function NotificationsPage() {
  const { data, isLoading, refetch } = useNotificationPreferences()

  if (isLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading your preferences…</p>
  }
  if (!data) {
    return (
      <div className="max-w-2xl space-y-3">
        <PageHeader title="Notifications" description="Choose which emails and push notifications you get" />
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Your preferences could not be loaded, so nothing is shown that could be saved over them.
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }
  return <PreferencesForm saved={data} />
}
