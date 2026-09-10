import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Download, LayoutGrid, List, Calendar, Plus as PlusIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import { useAuthStore } from '@/stores/authStore'
import { WorkOrderFilters, type WorkOrderFilterState } from '@/components/work-orders/WorkOrderFilters'
import { WorkOrderKanbanBoard } from '@/components/work-orders/WorkOrderKanbanBoard'
import { WorkOrderCalendarView } from '@/components/work-orders/WorkOrderCalendarView'
import { WorkOrdersTable } from '@/components/work-orders/WorkOrdersTable'
import { WorkOrderStats } from '@/components/work-orders/WorkOrderStats'
import type { WorkOrder } from '@/types'

type ViewMode = 'kanban' | 'table' | 'calendar'
type TabId = 'all' | 'my' | 'overdue' | 'unassigned' | 'pending_verify'

const TABS: { id: TabId; label: string; roles?: string[] }[] = [
  { id: 'all', label: 'All' },
  { id: 'my', label: 'My Work Orders' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'unassigned', label: 'Unassigned', roles: ['admin', 'manager'] },
  { id: 'pending_verify', label: 'Pending Verify', roles: ['admin', 'manager'] },
]

function filterWorkOrders(
  workOrders: WorkOrder[],
  filters: WorkOrderFilterState,
  tab: TabId,
  userId?: number,
): WorkOrder[] {
  let result = workOrders

  // Tab filters
  if (tab === 'my' && userId) {
    result = result.filter((wo) => wo.assignee_id === userId)
  } else if (tab === 'overdue') {
    result = result.filter(
      (wo) =>
        wo.due_date &&
        new Date(wo.due_date) < new Date() &&
        !['completed', 'verified', 'cancelled'].includes(wo.status),
    )
  } else if (tab === 'unassigned') {
    result = result.filter((wo) => !wo.assignee_id)
  } else if (tab === 'pending_verify') {
    result = result.filter((wo) => wo.status === 'completed')
  }

  // Search
  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (wo) =>
        wo.title.toLowerCase().includes(q) ||
        wo.work_order_number.toLowerCase().includes(q) ||
        wo.asset?.name.toLowerCase().includes(q),
    )
  }

  // Status
  if (filters.statuses.length > 0) {
    result = result.filter((wo) => filters.statuses.includes(wo.status))
  }

  // Priority
  if (filters.priorities.length > 0) {
    result = result.filter((wo) => filters.priorities.includes(wo.priority))
  }

  // Overdue only
  if (filters.overdue_only) {
    result = result.filter(
      (wo) =>
        wo.due_date &&
        new Date(wo.due_date) < new Date() &&
        !['completed', 'verified', 'cancelled'].includes(wo.status),
    )
  }

  return result
}

export function WorkOrdersListPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isManager = user?.role === 'admin' || user?.role === 'manager'

  const defaultView: ViewMode = isManager ? 'kanban' : 'table'
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem('fixflow-wo-view') as ViewMode) ?? defaultView,
  )
  const [tab, setTab] = useState<TabId>('all')
  const [filters, setFilters] = useState<WorkOrderFilterState>({
    search: '',
    statuses: [],
    priorities: [],
  })
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)
  const PER_PAGE = 25

  const queryParams = useMemo(() => {
    const p: Record<string, unknown> = {}
    if (filters.search) p.search = filters.search
    if (filters.statuses.length) p.status = filters.statuses.join(',')
    if (filters.priorities.length) p.priority = filters.priorities.join(',')
    if (tab === 'overdue' || filters.overdue_only) p.overdue = true
    if (tab === 'my') p.my_work_orders = true
    if (tab === 'unassigned') p.unassigned = true
    if (tab === 'pending_verify') p.status = 'completed'
    return p
  }, [filters, tab])

  const { data, isLoading } = useWorkOrders(queryParams)
  const workOrders = data?.work_orders ?? []

  const filtered = useMemo(
    () => filterWorkOrders(workOrders, filters, tab, user?.id),
    [workOrders, filters, tab, user?.id],
  )

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(filtered.length / PER_PAGE)

  const setViewPersisted = useCallback((v: ViewMode) => {
    setView(v)
    localStorage.setItem('fixflow-wo-view', v)
  }, [])

  const openCount = workOrders.filter((wo) =>
    ['open', 'assigned', 'in_progress'].includes(wo.status),
  ).length

  const visibleTabs = TABS.filter(
    (t) => !t.roles || (user && t.roles.includes(user.role)),
  )

  const tabCounts: Record<TabId, number> = {
    all: workOrders.length,
    my: workOrders.filter((wo) => wo.assignee_id === user?.id).length,
    overdue: workOrders.filter(
      (wo) =>
        wo.due_date &&
        new Date(wo.due_date) < new Date() &&
        !['completed', 'verified', 'cancelled'].includes(wo.status),
    ).length,
    unassigned: workOrders.filter((wo) => !wo.assignee_id && wo.status === 'open').length,
    pending_verify: workOrders.filter((wo) => wo.status === 'completed').length,
  }

  const stats = {
    open: workOrders.filter((wo) => wo.status === 'open').length,
    in_progress: workOrders.filter((wo) => wo.status === 'in_progress').length,
    completed_this_month: workOrders.filter((wo) => wo.status === 'completed').length,
    overdue: tabCounts.overdue,
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Work Orders"
        description={`${openCount} open work order${openCount !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            {isManager && (
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
                Export
              </Button>
            )}
            <Button onClick={() => navigate('/work-orders/new')}>
              <Plus className="h-4 w-4" />
              New Work Order
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <WorkOrderStats stats={stats} />

      {/* Filters */}
      <div className="sticky top-16 z-10 rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <WorkOrderFilters
          filters={filters}
          onChange={(f) => {
            setFilters(f)
            setPage(1)
          }}
          showAssigneeFilter={isManager}
        />
      </div>

      {/* Tabs + View toggle */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700"
          role="tablist"
        >
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                setTab(t.id)
                setPage(1)
              }}
              className={cn(
                'flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                tab === t.id
                  ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200',
              )}
            >
              {t.label}
              {tabCounts[t.id] > 0 && (
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700">
                  {tabCounts[t.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {(
            [
              { id: 'kanban', Icon: LayoutGrid, label: 'Kanban' },
              { id: 'table', Icon: List, label: 'Table' },
              { id: 'calendar', Icon: Calendar, label: 'Calendar' },
            ] as const
          ).map(({ id, Icon, label }) => (
            <Button
              key={id}
              variant={view === id ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewPersisted(id)}
              aria-label={label}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 dark:border-brand-800 dark:bg-brand-900/20">
          <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
            {selectedIds.size} selected
          </span>
          {isManager && (
            <>
              <Button variant="outline" size="sm">
                Assign to...
              </Button>
              <Button variant="outline" size="sm">
                Change Priority
              </Button>
              <Button variant="outline" size="sm" className="text-red-600">
                Cancel selected
              </Button>
            </>
          )}
          <Button variant="outline" size="sm">
            Export selected
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-gray-500 underline hover:text-gray-700"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* View content */}
      {view === 'kanban' ? (
        <WorkOrderKanbanBoard workOrders={filtered} />
      ) : view === 'calendar' ? (
        <WorkOrderCalendarView workOrders={filtered} />
      ) : (
        <>
          <WorkOrdersTable
            workOrders={paginated}
            isLoading={isLoading}
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
            rowActions={[
              {
                label: 'View Details',
                onClick: (wo) => navigate(`/work-orders/${wo.id}`),
              },
              ...(isManager
                ? [
                    {
                      label: 'Edit',
                      onClick: (wo: WorkOrder) => navigate(`/work-orders/${wo.id}/edit`),
                    },
                  ]
                : []),
              ...(user?.role === 'technician'
                ? [
                    {
                      label: 'Assign to Me',
                      onClick: () => {},
                      hidden: (wo: WorkOrder) =>
                        !!wo.assignee_id || wo.status !== 'open',
                    },
                  ]
                : []),
              ...(isManager
                ? [
                    {
                      label: 'Cancel',
                      onClick: () => {},
                      danger: true,
                      hidden: (wo: WorkOrder) =>
                        ['verified', 'cancelled'].includes(wo.status),
                    },
                  ]
                : []),
            ]}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * PER_PAGE + 1}–
                {Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => navigate('/work-orders/new')}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 sm:hidden"
        aria-label="New work order"
      >
        <PlusIcon className="h-6 w-6" />
      </button>
    </div>
  )
}
