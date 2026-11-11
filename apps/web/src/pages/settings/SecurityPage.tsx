import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { TwoFactorCard } from '@/components/security/TwoFactorCard'

export function SecurityPage() {
  const { t } = useTranslation()
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={t('settings.security.title')} description={t('settings.security.description')} />

      <TwoFactorCard />

      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('settings.sessions.title')}</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t('settings.security.sessions_help')}
            </p>
          </div>
          <Link to="/settings/profile" className="shrink-0 text-sm text-brand-600 dark:text-brand-400 hover:underline">{t('settings.security.open_profile')}</Link>
        </CardContent>
      </Card>
    </div>
  )
}
