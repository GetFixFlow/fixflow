import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { OfflineSync } from './OfflineSync'
import { LocaleApplier } from './LocaleApplier'
import { useAlertNotifications } from '@/hooks/useAlertNotifications'
import { useLocaleStore } from '@/lib/localeFormat'
import { useUiStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const { sidebarCollapsed } = useUiStore()
  // New IoT alerts arrive on any screen, not just the IoT ones.
  useAlertNotifications()
  // Screens format dates and amounts as they are drawn, so when the settings change they are drawn again.
  const localeKey = JSON.stringify(useLocaleStore((s) => s.locale))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <OfflineSync />
      <LocaleApplier />
      <Sidebar />
      <Header />
      <main
        className={cn(
          'pt-16 transition-all duration-300',
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
