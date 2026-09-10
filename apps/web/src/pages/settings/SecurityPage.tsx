import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Shield, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface LoginEntry {
  id: string
  date: string
  ip: string
  device: string
  location: string
  status: 'success' | 'failed'
  suspicious?: boolean
}

const MOCK_LOGINS: LoginEntry[] = [
  {
    id: '1',
    date: new Date().toISOString(),
    ip: '192.168.1.1',
    device: 'Chrome on macOS',
    location: 'Sri Lanka',
    status: 'success',
  },
  {
    id: '2',
    date: new Date(Date.now() - 2 * 3600000).toISOString(),
    ip: '192.168.1.1',
    device: 'Mobile PWA',
    location: 'Sri Lanka',
    status: 'success',
  },
  {
    id: '3',
    date: new Date(Date.now() - 3 * 86400000).toISOString(),
    ip: '45.67.89.100',
    device: 'Firefox on Windows',
    location: 'Unknown',
    status: 'success',
    suspicious: true,
  },
]

const SESSION_TIMEOUTS = ['1 hour', '8 hours', '24 hours', '7 days']

export function SecurityPage() {
  const [twoFactorOpen, setTwoFactorOpen] = useState(false)
  const [sessionTimeout, setSessionTimeout] = useState('24 hours')

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Security" description="Manage your account security settings" />

      {/* 2FA */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Two-Factor Authentication
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Add an extra layer of security to your account.
                </p>
                <span className="inline-flex items-center gap-1 mt-1.5 text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">
                  <AlertTriangle className="h-3 w-3" /> Not enabled
                </span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setTwoFactorOpen(!twoFactorOpen)}>
              Enable 2FA
            </Button>
          </div>
          {twoFactorOpen && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm space-y-3">
              <p className="font-medium">Setup Two-Factor Authentication</p>
              <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-400">
                <li>Download an authenticator app (Google Authenticator, Authy)</li>
                <li>Scan the QR code below with your authenticator app</li>
                <li>Enter the 6-digit code to verify</li>
              </ol>
              <div className="flex items-center justify-center h-32 bg-white dark:bg-gray-900 border border-dashed border-gray-300 rounded-lg">
                <span className="text-gray-400 text-xs">QR Code (backend required)</span>
              </div>
              <Button size="sm" disabled>
                Verify Code (backend required)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Login History */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Login History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 uppercase">
                  <th className="text-left py-2">Date/Time</th>
                  <th className="text-left py-2">Device</th>
                  <th className="text-left py-2">Location</th>
                  <th className="text-right py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_LOGINS.map((entry) => (
                  <tr
                    key={entry.id}
                    className={cn(
                      'border-b border-gray-50 dark:border-gray-800',
                      entry.suspicious && 'bg-amber-50 dark:bg-amber-900/10',
                    )}
                  >
                    <td className="py-2 text-gray-600 dark:text-gray-400">
                      {formatDistanceToNow(new Date(entry.date), { addSuffix: true })}
                    </td>
                    <td className="py-2 text-gray-700 dark:text-gray-300">{entry.device}</td>
                    <td className="py-2">
                      <span className={cn(entry.suspicious ? 'text-amber-600 font-medium' : 'text-gray-500')}>
                        {entry.location}
                        {entry.suspicious && ' ⚠️'}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5',
                        entry.status === 'success'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700',
                      )}>
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Session Timeout */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Security Preferences</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Session Timeout
            </label>
            <select
              value={sessionTimeout}
              onChange={(e) => setSessionTimeout(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            >
              {SESSION_TIMEOUTS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              You will be logged out after this period of inactivity.
            </p>
          </div>
          <Button size="sm">Save Preferences</Button>
        </CardContent>
      </Card>
    </div>
  )
}
