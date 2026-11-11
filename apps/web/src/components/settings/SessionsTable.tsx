import { useTranslation } from 'react-i18next'
import { Monitor, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { UserSession } from '@/api/settings'
import { timeAgo } from '@/lib/timeAgo'

interface SessionsTableProps {
  sessions: UserSession[]
  onRevoke: (id: string) => void
  onRevokeAll: () => void
  isRevoking: boolean
}

export function SessionsTable({ sessions, onRevoke, onRevokeAll, isRevoking }: SessionsTableProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-400 uppercase">
              <th className="text-left py-2">{t('settings.sessions.device')}</th>
              <th className="text-left py-2">{t('settings.sessions.address')}</th>
              <th className="text-left py-2">{t('settings.sessions.last_active')}</th>
              <th className="text-right py-2">{t('settings.sessions.action')}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-gray-50 dark:border-gray-800">
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    {/iOS|Android/.test(s.device)
                      ? <Smartphone className="h-4 w-4 text-gray-400" />
                      : <Monitor className="h-4 w-4 text-gray-400" />}
                    <span className="font-medium">{s.device}</span>
                    {s.current && (
                      <span className="text-[10px] rounded-full bg-green-100 text-green-700 px-1.5 py-0.5">
                        {t('settings.sessions.current')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 font-mono text-xs text-gray-500">{s.ip_address ?? t('common.state.unknown')}</td>
                <td className="py-2.5 text-gray-500">
                  {s.current
                    ? t('settings.sessions.now')
                    : timeAgo(s.last_active_at)}
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
                      {t('shell.header.sign_out')}
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
        disabled={isRevoking || sessions.every((s) => s.current)}
        className="text-red-600 border-red-300 hover:bg-red-50 w-full sm:w-auto"
      >
        {t('settings.sessions.sign_out_others')}
      </Button>
    </div>
  )
}
