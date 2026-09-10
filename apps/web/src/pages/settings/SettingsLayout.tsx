import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import {
  User, Bell, Lock, Building2, Palette, Mail, Globe, Users, Shield,
  Radio, Database, FileArchive, Search, Settings, AlertTriangle, ChevronRight, Sparkles,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles?: string[]
  badge?: string
}

interface NavSection {
  title: string
  items: NavItem[]
  roles?: string[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Account',
    items: [
      { href: '/settings/profile', label: 'My Profile', icon: User },
      { href: '/settings/notifications', label: 'Notifications', icon: Bell },
      { href: '/settings/security', label: 'Security', icon: Lock },
    ],
  },
  {
    title: 'Organization',
    roles: ['admin'],
    items: [
      { href: '/settings/organization', label: 'Organization', icon: Building2 },
      { href: '/settings/branding', label: 'Branding', icon: Palette },
      { href: '/settings/email', label: 'Email Settings', icon: Mail },
      { href: '/settings/localization', label: 'Localization', icon: Globe },
    ],
  },
  {
    title: 'Team',
    roles: ['admin', 'manager'],
    items: [
      { href: '/settings/users', label: 'Users', icon: Users, roles: ['admin', 'manager'] },
      { href: '/settings/roles', label: 'Roles & Permissions', icon: Shield, roles: ['admin'] },
    ],
  },
  {
    title: 'Integrations',
    roles: ['admin'],
    items: [
      { href: '/settings/iot', label: 'IoT & API Keys', icon: Radio },
      { href: '/settings/ai', label: 'AI Features', icon: Sparkles },
    ],
  },
  {
    title: 'Data',
    roles: ['admin'],
    items: [
      { href: '/settings/import-export', label: 'Import / Export', icon: FileArchive },
      { href: '/settings/data-retention', label: 'Data Retention', icon: Database },
      { href: '/settings/audit-log', label: 'Audit Log', icon: Search },
    ],
  },
  {
    title: 'Danger Zone',
    roles: ['admin'],
    items: [
      { href: '/settings/advanced', label: 'Advanced Settings', icon: AlertTriangle },
    ],
  },
]

function SettingsSidebar({ onNav }: { onNav?: () => void }) {
  const { user } = useAuthStore()
  const role = user?.role ?? 'technician'

  const visibleSections = NAV_SECTIONS.filter((s) =>
    !s.roles || s.roles.includes(role)
  ).map((s) => ({
    ...s,
    items: s.items.filter((i) => !i.roles || i.roles.includes(role)),
  })).filter((s) => s.items.length > 0)

  return (
    <nav className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-gray-400" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
        </div>
      </div>
      <div className="flex-1 py-3 px-2 space-y-5">
        {visibleSections.map((section) => (
          <div key={section.title}>
            <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {section.title}
            </p>
            {section.items.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) => cn(
                  'flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-brand-600 text-white font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100',
                )}
                onClick={onNav}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </div>
    </nav>
  )
}

export function SettingsLayout() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const allItems = NAV_SECTIONS.flatMap((s) => s.items)
  const activeItem = allItems.find((i) => location.pathname.startsWith(i.href))

  return (
    <div className="flex h-full min-h-0">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col w-60 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 h-full overflow-hidden">
        <SettingsSidebar />
      </div>

      {/* Mobile: show nav or content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-gray-500">
            <Settings className="h-5 w-5" />
          </button>
          <span className="font-medium text-sm">{activeItem?.label ?? 'Settings'}</span>
          <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" />
        </div>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="relative w-72 bg-white dark:bg-gray-900 h-full shadow-xl overflow-hidden">
              <SettingsSidebar onNav={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
