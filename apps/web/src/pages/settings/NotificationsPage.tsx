import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/hooks/useSettings'
import type { NotificationPreferences } from '@/api/settings'
import { cn } from '@/lib/utils'

// Simple Toggle component
function Toggle({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        checked ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700',
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0',
      )} />
    </button>
  )
}

interface NotifEvent {
  key: string
  label: string
  group: string
  minRole?: 'manager' | 'admin'
}

const NOTIF_EVENTS: NotifEvent[] = [
  // Work Orders
  { key: 'wo_assigned', label: 'WO assigned to me', group: 'Work Orders' },
  { key: 'wo_completed', label: 'WO completed (my requests)', group: 'Work Orders' },
  { key: 'wo_overdue', label: 'WO overdue (assigned to me)', group: 'Work Orders' },
  { key: 'wo_verified', label: 'WO verified (my WOs)', group: 'Work Orders' },
  // Preventive Maintenance
  { key: 'pm_due_soon', label: 'PM due in 7 days', group: 'Preventive Maintenance' },
  { key: 'pm_overdue', label: 'PM overdue', group: 'Preventive Maintenance' },
  { key: 'pm_generated', label: 'PM work order generated', group: 'Preventive Maintenance' },
  // IoT Alerts (manager+)
  { key: 'iot_critical', label: 'Critical IoT alert', group: 'IoT Alerts', minRole: 'manager' },
  { key: 'iot_high', label: 'High IoT alert', group: 'IoT Alerts', minRole: 'manager' },
  { key: 'iot_medium', label: 'Medium IoT alert', group: 'IoT Alerts', minRole: 'manager' },
  { key: 'iot_resolved', label: 'Alert resolved', group: 'IoT Alerts', minRole: 'manager' },
  // System (admin+)
  { key: 'user_joined', label: 'New user joined', group: 'System', minRole: 'admin' },
  { key: 'api_key', label: 'API key created/revoked', group: 'System', minRole: 'admin' },
  { key: 'daily_digest', label: 'Daily digest', group: 'System', minRole: 'admin' },
]

const DEFAULT_PREFS: NotificationPreferences = {
  email_enabled: true,
  push_enabled: false,
  sound_enabled: true,
  rules: Object.fromEntries(
    NOTIF_EVENTS.map((e) => [e.key, { email: true, push: false, in_app: true }])
  ),
  daily_digest: {
    enabled: true,
    send_at: '08:00',
    include: { open_wos: true, overdue_wos: true, pm_due: true, alerts: false },
  },
  weekly_report: {
    enabled: false,
    send_on: 'monday',
    include: { wo_summary: true, pm_compliance: true, costs: false },
  },
}

function roleAllows(userRole: string, minRole?: 'manager' | 'admin') {
  if (!minRole) return true
  if (minRole === 'manager') return userRole === 'manager' || userRole === 'admin'
  if (minRole === 'admin') return userRole === 'admin'
  return false
}

export function NotificationsPage() {
  const { user } = useAuthStore()
  const { data: serverPrefs } = useNotificationPreferences()
  const updatePrefs = useUpdateNotificationPreferences()

  const [prefs, setPrefs] = useState<NotificationPreferences>(() => ({
    ...DEFAULT_PREFS,
    ...serverPrefs,
  }))

  // Sync from server when it loads
  const mergedPrefs: NotificationPreferences = serverPrefs
    ? { ...DEFAULT_PREFS, ...serverPrefs }
    : prefs

  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences>(mergedPrefs)

  const role = user?.role ?? 'technician'

  const setChannel = (key: keyof NotificationPreferences, value: boolean) => {
    setLocalPrefs((prev) => ({ ...prev, [key]: value }))
  }

  const setRule = (eventKey: string, channel: 'email' | 'push' | 'in_app', value: boolean) => {
    setLocalPrefs((prev) => ({
      ...prev,
      rules: {
        ...prev.rules,
        [eventKey]: { ...(prev.rules[eventKey] ?? { email: true, push: false, in_app: true }), [channel]: value },
      },
    }))
  }

  const handleSave = () => {
    updatePrefs.mutate(localPrefs)
    setPrefs(localPrefs)
  }

  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      alert('Push notifications are not supported in this browser.')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      setChannel('push_enabled', true)
    }
  }

  const playSampleSound = () => {
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
      // AudioContext not available
    }
  }

  const visibleGroups = Array.from(new Set(NOTIF_EVENTS.map((e) => e.group)))

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Notifications" description="Control how and when you receive notifications" />

      {/* Channel Toggles */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notification Channels</h3>

          <div className="space-y-3">
            {/* Email */}
            <div className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Email Notifications</p>
                <p className="text-xs text-gray-400">Receive notifications via email</p>
              </div>
              <Toggle checked={localPrefs.email_enabled} onChange={(v) => setChannel('email_enabled', v)} />
            </div>

            {/* Push */}
            <div className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Push Notifications</p>
                <p className="text-xs text-gray-400">Browser push notifications</p>
              </div>
              <div className="flex items-center gap-2">
                {!localPrefs.push_enabled && (
                  <Button variant="ghost" size="sm" onClick={requestPushPermission} className="text-xs text-brand-600">
                    Enable
                  </Button>
                )}
                <Toggle checked={localPrefs.push_enabled} onChange={(v) => setChannel('push_enabled', v)} />
              </div>
            </div>

            {/* Sound */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">IoT Alert Sound</p>
                <p className="text-xs text-gray-400">Play a sound for critical IoT alerts</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={playSampleSound} className="text-xs text-gray-500">
                  Test
                </Button>
                <Toggle checked={localPrefs.sound_enabled} onChange={(v) => setChannel('sound_enabled', v)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Rules */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notification Rules</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left py-2 text-xs text-gray-400 uppercase font-medium">Event</th>
                  <th className="text-center py-2 text-xs text-gray-400 uppercase font-medium w-16">Email</th>
                  <th className="text-center py-2 text-xs text-gray-400 uppercase font-medium w-16">Push</th>
                  <th className="text-center py-2 text-xs text-gray-400 uppercase font-medium w-16">In-App</th>
                </tr>
              </thead>
              <tbody>
                {visibleGroups.map((group) => {
                  const events = NOTIF_EVENTS.filter(
                    (e) => e.group === group && roleAllows(role, e.minRole),
                  )
                  if (events.length === 0) return null
                  return (
                    <>
                      <tr key={`group-${group}`}>
                        <td colSpan={4} className="pt-3 pb-1">
                          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                            {group}
                          </span>
                        </td>
                      </tr>
                      {events.map((event) => {
                        const rule = localPrefs.rules[event.key] ?? { email: true, push: false, in_app: true }
                        return (
                          <tr key={event.key} className="border-b border-gray-50 dark:border-gray-800">
                            <td className="py-2 text-gray-700 dark:text-gray-300">{event.label}</td>
                            <td className="py-2 text-center">
                              <input
                                type="checkbox"
                                checked={rule.email}
                                onChange={(e) => setRule(event.key, 'email', e.target.checked)}
                                disabled={!localPrefs.email_enabled}
                                className="rounded"
                              />
                            </td>
                            <td className="py-2 text-center">
                              <input
                                type="checkbox"
                                checked={rule.push}
                                onChange={(e) => setRule(event.key, 'push', e.target.checked)}
                                disabled={!localPrefs.push_enabled}
                                className="rounded"
                              />
                            </td>
                            <td className="py-2 text-center">
                              <input
                                type="checkbox"
                                checked={rule.in_app}
                                onChange={(e) => setRule(event.key, 'in_app', e.target.checked)}
                                className="rounded"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Daily Digest */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Daily Digest</h3>
              <p className="text-xs text-gray-400 mt-0.5">Receive a daily summary email</p>
            </div>
            <Toggle
              checked={localPrefs.daily_digest.enabled}
              onChange={(v) => setLocalPrefs((p) => ({ ...p, daily_digest: { ...p.daily_digest, enabled: v } }))}
            />
          </div>
          {localPrefs.daily_digest.enabled && (
            <div className="space-y-3 pt-2 border-t border-gray-50 dark:border-gray-700">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Send at</label>
                <input
                  type="time"
                  value={localPrefs.daily_digest.send_at}
                  onChange={(e) =>
                    setLocalPrefs((p) => ({ ...p, daily_digest: { ...p.daily_digest, send_at: e.target.value } }))
                  }
                  className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Include</label>
                <div className="space-y-1.5">
                  {Object.entries(localPrefs.daily_digest.include).map(([k, v]) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={v}
                        onChange={(e) =>
                          setLocalPrefs((p) => ({
                            ...p,
                            daily_digest: {
                              ...p.daily_digest,
                              include: { ...p.daily_digest.include, [k]: e.target.checked },
                            },
                          }))
                        }
                        className="rounded"
                      />
                      <span className="text-gray-700 dark:text-gray-300">
                        {k.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Report */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Weekly Report</h3>
              <p className="text-xs text-gray-400 mt-0.5">Receive a weekly summary email</p>
            </div>
            <Toggle
              checked={localPrefs.weekly_report.enabled}
              onChange={(v) => setLocalPrefs((p) => ({ ...p, weekly_report: { ...p.weekly_report, enabled: v } }))}
            />
          </div>
          {localPrefs.weekly_report.enabled && (
            <div className="space-y-3 pt-2 border-t border-gray-50 dark:border-gray-700">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Send on</label>
                <select
                  value={localPrefs.weekly_report.send_on}
                  onChange={(e) =>
                    setLocalPrefs((p) => ({ ...p, weekly_report: { ...p.weekly_report, send_on: e.target.value } }))
                  }
                  className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
                >
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => (
                    <option key={d} value={d}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Include</label>
                <div className="space-y-1.5">
                  {Object.entries(localPrefs.weekly_report.include).map(([k, v]) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={v}
                        onChange={(e) =>
                          setLocalPrefs((p) => ({
                            ...p,
                            weekly_report: {
                              ...p.weekly_report,
                              include: { ...p.weekly_report.include, [k]: e.target.checked },
                            },
                          }))
                        }
                        className="rounded"
                      />
                      <span className="text-gray-700 dark:text-gray-300">
                        {k.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={updatePrefs.isPending}>
        {updatePrefs.isPending ? 'Saving…' : 'Save Preferences'}
      </Button>
    </div>
  )
}
