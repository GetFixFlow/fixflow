import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { SessionsTable } from '@/components/settings/SessionsTable'
import { useSessions, useRevokeSession, useRevokeAllSessions } from '@/hooks/useSettings'

/** Where the signed-in person is signed in, with a way to end any of those sessions. */
export function SessionsCard() {
  const { t } = useTranslation()
  const { data: sessions, isLoading, isError, refetch } = useSessions()
  const revokeSession = useRevokeSession()
  const revokeAll = useRevokeAllSessions()

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('settings.sessions.title')}</h3>
          <p className="mt-0.5 text-xs text-gray-400">
            {t('settings.sessions.help')}
          </p>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError || !sessions ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {t('settings.sessions.load_failed')}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('common.actions.retry')}
            </Button>
          </div>
        ) : (
          <SessionsTable
            sessions={sessions}
            onRevoke={(id) => revokeSession.mutate(id)}
            onRevokeAll={() => revokeAll.mutate(undefined)}
            isRevoking={revokeSession.isPending || revokeAll.isPending}
          />
        )}
      </CardContent>
    </Card>
  )
}
