import { formatDistanceToNow } from 'date-fns'
import { Monitor, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Session {
  id: string
  device: string
  location: string
  last_active_at: string
  current: boolean
}

interface SessionsTableProps {
  sessions: Session[]
  onRevoke: (id: string) => void
  onRevokeAll: () => void
  isRevoking: boolean
}

export function SessionsTable({ sessions, onRevoke, onRevokeAll, isRevoking }: SessionsTableProps) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-400 uppercase">
              <th className="text-left py-2">Device</th>
              <th className="text-left py-2">Location</th>
              <th className="text-left py-2">Last Active</th>
              <th className="text-right py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-gray-50 dark:border-gray-800">
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    {s.device.toLowerCase().includes('mobile') || s.device.toLowerCase().includes('pwa')
                      ? <Smartphone className="h-4 w-4 text-gray-400" />
                      : <Monitor className="h-4 w-4 text-gray-400" />}
                    <span className="font-medium">{s.device}</span>
                    {s.current && (
                      <span className="text-[10px] rounded-full bg-green-100 text-green-700 px-1.5 py-0.5">
                        Current
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 text-gray-500">{s.location}</td>
                <td className="py-2.5 text-gray-500">
                  {s.current
                    ? 'Now'
                    : formatDistanceToNow(new Date(s.last_active_at), { addSuffix: true })}
                </td>
                <td className="py-2.5 text-right">
                  {!s.current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRevoke(s.id)}
                      disabled={isRevoking}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                    >
                      Revoke
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        variant="outline"
        onClick={onRevokeAll}
        disabled={isRevoking}
        className="text-red-600 border-red-300 hover:bg-red-50 w-full sm:w-auto"
      >
        Revoke All Other Sessions
      </Button>
    </div>
  )
}
