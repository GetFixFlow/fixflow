import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { OfflineSync } from './OfflineSync'
import { LocaleApplier } from './LocaleApplier'
import { RouteAnnouncer } from './RouteAnnouncer'
import { useAlertNotifications } from '@/hooks/useAlertNotifications'
import { useLocaleStore } from '@/lib/localeFormat'
import { useUiStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const { sidebarCollapsed } = useUiStore()
  // New IoT alerts arrive on any screen, not just the IoT ones.
  useAlertNotifications()
  // Screens format dates and amounts as they are drawn, so when the settings change they are drawn again.
  // The same when the language changes, so that texts written outside a component (a label, a toast) are drawn again too.
  const { t, i18n } = useTranslation()
  const localeKey = `${i18n.language}:${JSON.stringify(useLocaleStore((s) => s.locale))}`

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* The first Tab on every page: past the menu, to the content. Shown only while it has the keyboard. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg"
      >
        {t('shell.skip_to_content')}
      </a>
      <RouteAnnouncer />
      <OfflineSync />
      <LocaleApplier />
      <Sidebar />
      <Header />
      <main
        id="main"
        tabIndex={-1}
        className={cn(
          'pt-16 transition-all duration-300 focus:outline-none',
          sidebarCollapsed ? 'pl-16' : 'pl-64',
        )}
      >
        <div className="p-6">
          <Outlet key={localeKey} />
        </div>
      </main>
    </div>
  )
}
