import { useState } from 'react'
import { format } from 'date-fns'
import { Download, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'login', label: 'Login' },
  { value: 'invite', label: 'Invite' },
  { value: 'role_change', label: 'Role Change' },
  { value: 'deactivate', label: 'Deactivate' },
  { value: 'api_key', label: 'API Key' },
]

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  login: 'bg-gray-100 text-gray-600',
  invite: 'bg-purple-100 text-purple-700',
  role_change: 'bg-amber-100 text-amber-700',
  deactivate: 'bg-orange-100 text-orange-700',
  api_key: 'bg-teal-100 text-teal-700',
}

// Mock audit log data
const MOCK_LOGS = [
  { id: 1, action: 'login', resource_type: 'User', resource_id: 1, resource_name: 'Alice Smith', ip_address: '192.168.1.1', user: { full_name: 'Alice Smith', email: 'alice@test.com' }, created_at: new Date().toISOString() },
  { id: 2, action: 'create', resource_type: 'WorkOrder', resource_id: 42, resource_name: 'Fix pump motor', ip_address: '192.168.1.1', user: { full_name: 'Alice Smith', email: 'alice@test.com' }, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 3, action: 'invite', resource_type: 'User', resource_id: 3, resource_name: 'bob@company.com', ip_address: '192.168.1.1', user: { full_name: 'Alice Smith', email: 'alice@test.com' }, created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 4, action: 'update', resource_type: 'Asset', resource_id: 5, resource_name: 'Air Compressor #3', ip_address: '10.0.0.5', user: { full_name: 'Bob Jones', email: 'bob@test.com' }, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 5, action: 'delete', resource_type: 'IotRule', resource_id: 12, resource_name: 'High temp alert', ip_address: '192.168.1.1', user: { full_name: 'Alice Smith', email: 'alice@test.com' }, created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 6, action: 'role_change', resource_type: 'User', resource_id: 4, resource_name: 'Carol → Manager', ip_address: '192.168.1.1', user: { full_name: 'Alice Smith', email: 'alice@test.com' }, created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: 7, action: 'api_key', resource_type: 'ApiKey', resource_id: 2, resource_name: 'Production IoT Key', ip_address: '192.168.1.1', user: { full_name: 'Alice Smith', email: 'alice@test.com' }, created_at: new Date(Date.now() - 4 * 86400000).toISOString() },
]

export function AuditLogPage() {
  const { user } = useAuthStore()
  const [filterUser, setFilterUser] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6">
        <PageHeader title="Audit Log" description="Track all system activity" />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Access Denied. Only administrators can view the audit log.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const filteredLogs = MOCK_LOGS.filter((log) => {
    if (filterAction && log.action !== filterAction) return false
    if (filterUser && !log.user?.full_name.toLowerCase().includes(filterUser.toLowerCase())) return false
    if (filterDateFrom && new Date(log.created_at) < new Date(filterDateFrom)) return false
    if (filterDateTo && new Date(log.created_at) > new Date(filterDateTo + 'T23:59:59')) return false
    return true
  })

  const handleExportCsv = () => {
    const rows = [
      ['Date', 'User', 'Action', 'Resource', 'IP Address'],
      ...filteredLogs.map((log) => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.user?.full_name ?? '',
        log.action,
        `${log.resource_type}: ${log.resource_name}`,
        log.ip_address ?? '',
      ]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'audit-log.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Track all system activity and changes"
        actions={
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by user…"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-8 pr-3 text-sm"
              />
            </div>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
            >
              {ACTION_TYPES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              placeholder="From date"
              className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
            />
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              placeholder="To date"
              className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Log Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                      No activity log entries match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-xs">{log.user?.full_name}</p>
                        <p className="text-xs text-gray-400">{log.user?.email}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600',
                        )}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs text-gray-500">{log.resource_type}</p>
                        <p className="text-xs text-gray-700 dark:text-gray-300">{log.resource_name}</p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 font-mono hidden md:table-cell">
                        {log.ip_address}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
