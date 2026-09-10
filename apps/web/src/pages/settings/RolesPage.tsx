import { useState } from 'react'
import { Check, Minus, X as XIcon } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

type PermValue = 'full' | 'limited' | 'none'

interface PermRow {
  section: string
  label: string
  admin: PermValue
  manager: PermValue
  technician: PermValue
  requester: PermValue
  limitedNote?: Record<string, string>
}

const PERMISSIONS: PermRow[] = [
  // Work Orders
  {
    section: 'Work Orders', label: 'View all WOs',
    admin: 'full', manager: 'full', technician: 'limited', requester: 'limited',
    limitedNote: { technician: 'Assigned WOs only', requester: 'Own requests only' },
  },
  {
    section: 'Work Orders', label: 'View own WOs',
    admin: 'full', manager: 'full', technician: 'full', requester: 'full',
  },
  {
    section: 'Work Orders', label: 'Create WOs',
    admin: 'full', manager: 'full', technician: 'limited', requester: 'none',
    limitedNote: { technician: 'Can create basic WOs' },
  },
  {
    section: 'Work Orders', label: 'Submit requests',
    admin: 'full', manager: 'full', technician: 'full', requester: 'full',
  },
  {
    section: 'Work Orders', label: 'Assign WOs',
    admin: 'full', manager: 'full', technician: 'none', requester: 'none',
  },
  {
    section: 'Work Orders', label: 'Verify WOs',
    admin: 'full', manager: 'full', technician: 'none', requester: 'none',
  },
  // Assets
  {
    section: 'Assets', label: 'View assets',
    admin: 'full', manager: 'full', technician: 'full', requester: 'limited',
    limitedNote: { requester: 'Limited details' },
  },
  {
    section: 'Assets', label: 'Create/edit assets',
    admin: 'full', manager: 'full', technician: 'none', requester: 'none',
  },
  {
    section: 'Assets', label: 'Delete assets',
    admin: 'full', manager: 'none', technician: 'none', requester: 'none',
  },
  // PM
  {
    section: 'Preventive Maintenance', label: 'View PM schedules',
    admin: 'full', manager: 'full', technician: 'full', requester: 'none',
  },
  {
    section: 'Preventive Maintenance', label: 'Create/edit PM',
    admin: 'full', manager: 'full', technician: 'none', requester: 'none',
  },
  {
    section: 'Preventive Maintenance', label: 'Execute PM tasks',
    admin: 'full', manager: 'full', technician: 'full', requester: 'none',
  },
  // IoT
  {
    section: 'IoT', label: 'View IoT dashboard',
    admin: 'full', manager: 'full', technician: 'limited', requester: 'none',
    limitedNote: { technician: 'Read-only alerts' },
  },
  {
    section: 'IoT', label: 'Manage IoT rules',
    admin: 'full', manager: 'full', technician: 'none', requester: 'none',
  },
  {
    section: 'IoT', label: 'Configure sensors',
    admin: 'full', manager: 'limited', technician: 'none', requester: 'none',
    limitedNote: { manager: 'Cannot delete sensors' },
  },
  // Reports
  {
    section: 'Reports', label: 'View reports',
    admin: 'full', manager: 'full', technician: 'limited', requester: 'none',
    limitedNote: { technician: 'Own performance only' },
  },
  {
    section: 'Reports', label: 'Export reports',
    admin: 'full', manager: 'full', technician: 'none', requester: 'none',
  },
  // Settings
  {
    section: 'Settings', label: 'Manage users',
    admin: 'full', manager: 'limited', technician: 'none', requester: 'none',
    limitedNote: { manager: 'View only, cannot invite/deactivate' },
  },
  {
    section: 'Settings', label: 'Manage org settings',
    admin: 'full', manager: 'none', technician: 'none', requester: 'none',
  },
  {
    section: 'Settings', label: 'View audit log',
    admin: 'full', manager: 'limited', technician: 'none', requester: 'none',
    limitedNote: { manager: 'Last 30 days only' },
  },
]

const ROLES = ['admin', 'manager', 'technician', 'requester'] as const
type RoleName = typeof ROLES[number]

const ROLE_CONFIG: Record<RoleName, { label: string; color: string; bg: string; border: string }> = {
  admin: { label: 'Admin', color: 'text-purple-700', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-300 dark:border-purple-700' },
  manager: { label: 'Manager', color: 'text-blue-700', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-300 dark:border-blue-700' },
  technician: { label: 'Technician', color: 'text-green-700', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-300 dark:border-green-700' },
  requester: { label: 'Requester', color: 'text-gray-700', bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-300 dark:border-gray-700' },
}

function PermIcon({ value, tooltip }: { value: PermValue; tooltip?: string }) {
  const icons = {
    full: <Check className="h-4 w-4 text-green-600" />,
    limited: <Minus className="h-4 w-4 text-amber-500" />,
    none: <XIcon className="h-4 w-4 text-gray-300" />,
  }
  return (
    <div className="flex items-center justify-center" title={tooltip}>
      {icons[value]}
    </div>
  )
}

const sections = Array.from(new Set(PERMISSIONS.map((p) => p.section)))

export function RolesPage() {
  const [highlighted, setHighlighted] = useState<RoleName | null>(null)

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Roles & Permissions"
        description="FixFlow uses 4 built-in roles with predefined permission levels"
      />

      {/* Role cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ROLES.map((role) => {
          const cfg = ROLE_CONFIG[role]
          const isActive = highlighted === role
          return (
            <button
              key={role}
              type="button"
              onClick={() => setHighlighted(isActive ? null : role)}
              className={cn(
                'p-3 rounded-lg border-2 text-left transition-all',
                isActive ? `${cfg.bg} ${cfg.border}` : 'border-gray-200 dark:border-gray-700 hover:border-gray-300',
              )}
            >
              <p className={cn('font-semibold text-sm', isActive ? cfg.color : 'text-gray-700 dark:text-gray-300')}>
                {cfg.label}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {role === 'admin' && 'Full system access'}
                {role === 'manager' && 'Operational control'}
                {role === 'technician' && 'Task execution'}
                {role === 'requester' && 'Request submission'}
              </p>
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-600" /> Full access</span>
        <span className="flex items-center gap-1"><Minus className="h-3.5 w-3.5 text-amber-500" /> Limited access</span>
        <span className="flex items-center gap-1"><XIcon className="h-3.5 w-3.5 text-gray-300" /> No access</span>
      </div>

      {/* Permission Matrix */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-1/2">
                    Permission
                  </th>
                  {ROLES.map((role) => {
                    const cfg = ROLE_CONFIG[role]
                    return (
                      <th
                        key={role}
                        className={cn(
                          'text-center px-4 py-3 text-xs font-medium uppercase transition-colors',
                          highlighted === role ? `${cfg.color} ${cfg.bg}` : 'text-gray-500',
                        )}
                      >
                        {cfg.label}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => (
                  <>
                    <tr key={`section-${section}`} className="bg-gray-50 dark:bg-gray-800/30">
                      <td colSpan={5} className="px-4 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          {section}
                        </span>
                      </td>
                    </tr>
                    {PERMISSIONS.filter((p) => p.section === section).map((perm) => (
                      <tr key={perm.label} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{perm.label}</td>
                        {ROLES.map((role) => {
                          const value = perm[role]
                          const tooltip = perm.limitedNote?.[role]
                          const cfg = ROLE_CONFIG[role]
                          return (
                            <td
                              key={role}
                              className={cn(
                                'px-4 py-2.5 text-center transition-colors',
                                highlighted === role && `${cfg.bg}`,
                              )}
                            >
                              <PermIcon value={value} tooltip={tooltip} />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400">
        * Hover over the limited access icon (—) for details on what's restricted.
        Contact support to request custom role configurations.
      </p>
    </div>
  )
}
