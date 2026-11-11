import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MoreHorizontal, User, RefreshCw, Zap, Copy, Check } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge'
import { WorkOrderPriorityBadge } from './WorkOrderPriorityBadge'
import { WorkOrderDueDate } from './WorkOrderDueDate'
import { activeFields, useCustomFields } from '@/hooks/useCustomFields'
import { shownValue } from '@/lib/customFields'
import type { WorkOrder, WorkOrderSource } from '@/types'

const SOURCE_ICONS: Record<WorkOrderSource, React.ElementType> = {
  manual: User,
  pm: RefreshCw,
  iot_rule: Zap,
}

interface RowAction {
  label: string
  onClick: (wo: WorkOrder) => void
  danger?: boolean
  hidden?: (wo: WorkOrder) => boolean
}

interface WorkOrdersTableProps {
  workOrders: WorkOrder[]
  isLoading?: boolean
  showAsset?: boolean
  showAssignee?: boolean
  compact?: boolean
  selectedIds?: Set<number>
  onSelectChange?: (ids: Set<number>) => void
  rowActions?: RowAction[]
  emptyMessage?: string
}

function CopyableId({ text }: { text: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        copy()
      }}
      className="group flex items-center gap-1 font-mono text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      aria-label={t('workOrders.table.copy', { text })}
    >
      {text}
      {copied ? (
        <Check className="h-3 w-3 text-green-700 dark:text-green-400" />
      ) : (
        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100" />
      )}
    </button>
  )
}

export function WorkOrdersTable({
  workOrders,
  isLoading,
  showAsset = true,
  showAssignee = true,
  compact = false,
  selectedIds,
  onSelectChange,
  rowActions = [],
  emptyMessage,
}: WorkOrdersTableProps) {
  const { t } = useTranslation()
  // The custom fields an administrator chose to show in the lists, one column each.
  const { data: customFields } = useCustomFields('work_order')
  const listFields = activeFields(customFields).filter((field) => field.in_list)

  const allSelected =
    workOrders.length > 0 && selectedIds && workOrders.every((wo) => selectedIds.has(wo.id))

  const toggleAll = () => {
    if (!onSelectChange) return
    if (allSelected) {
      onSelectChange(new Set())
    } else {
      onSelectChange(new Set(workOrders.map((wo) => wo.id)))
    }
  }

  const toggleRow = (id: number) => {
    if (!onSelectChange || !selectedIds) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectChange(next)
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (!workOrders.length) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 py-12 dark:border-gray-600">
        <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage ?? t('workOrders.table.empty')}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
          <tr>
            {onSelectChange && (
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={!!allSelected}
                  onChange={toggleAll}
                  aria-label={t('workOrders.table.select_all')}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 dark:text-brand-400 focus:ring-brand-500"
                />
              </th>
            )}
            <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
              {t('workOrders.table.number')}
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
              {t('workOrders.table.title')}
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
              {t('workOrders.table.priority')}
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
              {t('workOrders.table.status')}
            </th>
            {showAsset && (
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                {t('workOrders.table.asset')}
              </th>
            )}
            {showAssignee && (
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                {t('workOrders.table.assignee')}
              </th>
            )}
            <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
              {t('workOrders.table.due_date')}
            </th>
            {listFields.map((field) => (
              <th key={field.key} className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                {field.label}
              </th>
            ))}
            <th className="w-8 px-2 py-3"><span className="sr-only">{t('workOrders.table.actions')}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {workOrders.map((wo) => {
            const isOverdue =
              wo.due_date &&
              new Date(wo.due_date) < new Date() &&
              !['completed', 'verified', 'cancelled'].includes(wo.status)
            const isCritical = wo.priority === 'critical'
            const SourceIcon = SOURCE_ICONS[wo.source ?? 'manual'] ?? User
            const visibleActions = rowActions.filter((a) => !a.hidden?.(wo))

            return (
              <tr
                key={wo.id}
                className={cn(
                  'group bg-white transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/50',
                  isOverdue && 'bg-red-50/50 dark:bg-red-900/10',
                  isCritical && 'border-l-2 border-l-red-500',
                  selectedIds?.has(wo.id) && 'bg-brand-50 dark:bg-brand-900/10',
                )}
              >
                {onSelectChange && (
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(wo.id) ?? false}
                      onChange={() => toggleRow(wo.id)}
                      aria-label={t('workOrders.table.select', { number: wo.work_order_number })}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 dark:text-brand-400 focus:ring-brand-500"
                    />
                  </td>
                )}
                <td className={cn('px-4 py-3', compact && 'py-2')}>
                  <div className="flex items-center gap-2">
                    <CopyableId text={wo.work_order_number} />
                    <SourceIcon className="h-3 w-3 text-gray-500 dark:text-gray-400" title={wo.source} />
                  </div>
                </td>
                <td className={cn('px-4 py-3', compact && 'py-2')}>
                  <Link
                    to={`/work-orders/${wo.id}`}
                    className="font-medium text-gray-900 hover:text-brand-600 dark:text-gray-100 dark:hover:text-brand-400"
                  >
                    {wo.title.length > 40 ? `${wo.title.slice(0, 40)}…` : wo.title}
                  </Link>
                </td>
                <td className={cn('px-4 py-3', compact && 'py-2')}>
                  <WorkOrderPriorityBadge priority={wo.priority} size="sm" />
                </td>
                <td className={cn('px-4 py-3', compact && 'py-2')}>
                  <WorkOrderStatusBadge status={wo.status} size="sm" />
                </td>
                {showAsset && (
                  <td className={cn('px-4 py-3', compact && 'py-2')}>
                    {wo.asset ? (
                      <Link
                        to={`/assets/${wo.asset_id}`}
                        className="text-gray-700 hover:text-brand-600 dark:text-gray-300 dark:hover:text-brand-400"
                      >
                        <span className="font-medium">{wo.asset.name}</span>
                        {wo.asset.asset_tag && (
                          <span className="ml-1 font-mono text-xs text-gray-500 dark:text-gray-400">
                            {wo.asset.asset_tag}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">—</span>
                    )}
                  </td>
                )}
                {showAssignee && (
                  <td className={cn('px-4 py-3', compact && 'py-2')}>
                    {wo.assignee ? (
                      <span className="text-gray-700 dark:text-gray-300">
                        {wo.assignee.full_name}
                      </span>
                    ) : (
                      <span className="italic text-gray-500 dark:text-gray-400">{t('common.state.unassigned')}</span>
                    )}
                  </td>
                )}
                <td className={cn('px-4 py-3', compact && 'py-2')}>
                  <WorkOrderDueDate dueDate={wo.due_date} />
                </td>
                {listFields.map((field) => (
                  <td key={field.key} className={cn('px-4 py-3 text-gray-700 dark:text-gray-300', compact && 'py-2')}>
                    {shownValue(field, wo.custom_values?.[field.key]) || <span className="text-gray-500 dark:text-gray-400">—</span>}
                  </td>
                ))}
                <td className="px-2 py-3">
                  {visibleActions.length > 0 && (
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          aria-label={t('workOrders.table.row_actions')}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="z-50 min-w-36 rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                          align="end"
                        >
                          {visibleActions.map((action) => (
                            <DropdownMenu.Item
                              key={action.label}
                              className={cn(
                                'flex cursor-pointer select-none items-center rounded px-3 py-1.5 text-sm outline-none transition-colors hover:bg-gray-100 dark:hover:bg-gray-700',
                                action.danger && 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
                              )}
                              onSelect={() => action.onClick(wo)}
                            >
                              {action.label}
                            </DropdownMenu.Item>
                          ))}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
